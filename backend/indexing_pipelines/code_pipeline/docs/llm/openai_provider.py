"""
OpenAI-compatible provider (OpenAI, Gemini, Groq, ...) with async support and rate limiting.
Configured via LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_RPM in .env.
"""

import asyncio
import os
import time
from typing import Optional

from dotenv import load_dotenv
from openai import AsyncOpenAI, AuthenticationError, NotFoundError, PermissionDeniedError

from .providers import LLMProvider


class OpenAIProvider(LLMProvider):
    """
    OpenAI API provider with async support and semaphore-based rate limiting.

    Uses AsyncOpenAI client for concurrent requests while respecting rate limits.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        max_concurrent: int = 10,
        temperature: float = 0.3,
    ):
        """
        Initialize OpenAI provider.

        Args:
            api_key: API key (defaults to LLM_API_KEY env var)
            model: Model to use (defaults to LLM_MODEL env var)
            max_concurrent: Maximum concurrent requests (default: 10 for Tier 1)
                           Tier 1: 500 RPM → use 10
                           Tier 2: 5000 RPM → use 50
            temperature: Temperature for generation (default: 0.3 for consistency)
        """
        # Load environment variables from .env file
        load_dotenv()

        self.client = AsyncOpenAI(
            api_key=api_key or os.getenv("LLM_API_KEY"),
            base_url=os.getenv("LLM_BASE_URL") or None,  # None = api.openai.com
        )
        # LLM_MODEL may be a comma-separated list: when one model hits its daily
        # quota (free tiers count per model), switch to the next.
        self.models = [
            m.strip()
            for m in (model or os.getenv("LLM_MODEL", "gpt-4o-mini")).split(",")
            if m.strip()
        ]
        self.model = self.models[0]
        # Set when no further call can succeed (bad key, unknown model, all quota gone); the indexing route aborts on it
        self.fatal_error: Optional[str] = None
        # e.g. "none" stops Gemini Flash "thinking" from eating max_tokens; unset = provider default
        effort = os.getenv("LLM_REASONING_EFFORT")
        self.extra = {"reasoning_effort": effort} if effort else {}

        # Space calls out to stay under free-tier requests-per-minute limits (0 = no pacing)
        # ponytail: fixed spacing, not a token bucket; add one if bursty traffic matters
        rpm = int(os.getenv("LLM_RPM", "0"))
        self.min_interval = 60 / rpm if rpm else 0.0
        self._pace_lock = asyncio.Lock()
        self._next_slot = 0.0
        self.temperature = temperature
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def _call_api(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 300,
        max_retries: int = 5,
    ) -> Optional[str]:
        """
        Call the LLM with pacing, rate-limit retries and daily-quota model fallback.

        Args:
            system_prompt: System message
            user_prompt: User message
            max_tokens: Maximum tokens in response
            max_retries: Maximum retry attempts for per-minute rate limit errors

        Returns:
            Response content or None on failure
        """
        async with self.semaphore:
            return await self._create(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                self.temperature,
                max_tokens,
                max_retries,
            )

    async def _create(
        self, messages: list, temperature: float, max_tokens: int, max_retries: int = 5
    ) -> Optional[str]:
        """One chat completion. Returns None on failure (and instantly once fatal_error is set)."""
        attempt = 0
        while not self.fatal_error:
            model = self.model
            await self._pace()
            try:
                response = await self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **self.extra,
                )
                content = response.choices[0].message.content
                return content.strip() if content else None

            except (AuthenticationError, PermissionDeniedError, NotFoundError) as e:
                # Same for every call (bad LLM_API_KEY, unknown LLM_MODEL): stop instead of failing each one
                self.fatal_error = f"LLM request to {model} failed: {e}"
                print(f"[LLM] {self.fatal_error}")
                return None

            except Exception as e:
                error_str = str(e)

                # Daily quota (e.g. Gemini "...RequestsPerDay..."): retrying won't help today
                if "PerDay" in error_str:
                    self._drop_model(model)
                    continue

                # Per-minute rate limit: back off 5s, 10s, 20s, 40s
                if ("rate_limit" in error_str.lower() or "429" in error_str) and attempt < max_retries - 1:
                    await asyncio.sleep(5 * 2**attempt)
                    attempt += 1
                    continue

                print(f"[LLM] {model} call failed: {error_str[:200]}")
                return None

        return None

    def _drop_model(self, model: str):
        """Move past a model that hit its daily quota (once, even with concurrent calls)."""
        if model != self.model:
            return  # another call already switched
        i = self.models.index(model)
        if i + 1 < len(self.models):
            self.model = self.models[i + 1]
            print(f"[LLM] {model} hit its daily quota; switching to {self.model}")
        else:
            self.fatal_error = (
                "Every model in LLM_MODEL hit its daily free-tier quota. "
                "Try again after it resets (midnight Pacific) or add more models to LLM_MODEL."
            )
            print(f"[LLM] {model} hit its daily quota; no models left in LLM_MODEL")

    async def _pace(self):
        """Wait for the next free slot so calls stay under LLM_RPM."""
        if not self.min_interval:
            return
        async with self._pace_lock:
            now = time.monotonic()
            wait = self._next_slot - now
            self._next_slot = max(now, self._next_slot) + self.min_interval
        if wait > 0:
            await asyncio.sleep(wait)

    async def generate_text(
        self, system_prompt: str, user_prompt: str, temperature: float = 0.3
    ) -> tuple[bool, Optional[str], Optional[str]]:
        """
        Generate text using a custom prompt (for non-summarization tasks like IA generation).

        Args:
            system_prompt: System message defining the assistant's role
            user_prompt: User message with the task
            temperature: Sampling temperature (0.0 = deterministic, 1.0 = creative)

        Returns:
            Tuple of (success, response_text, error_message)
        """
        async with self.semaphore:
            content = await self._create(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature,
                2000,  # Larger for IA generation (JSON output)
            )
        if content:
            return (True, content, None)
        return (False, None, "LLM call failed or returned nothing (see [LLM] log lines)")

    async def close(self):
        """Close the HTTP client."""
        await self.client.close()
