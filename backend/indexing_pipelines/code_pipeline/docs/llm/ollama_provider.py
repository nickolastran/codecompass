"""
Ollama provider implementation for local LLM inference.
"""

import asyncio
from typing import Optional

try:
    from ollama import AsyncClient
except ImportError:
    AsyncClient = None

from .providers import LLMProvider


class OllamaProvider(LLMProvider):
    """
    Ollama local LLM provider with async support.

    No rate limiting needed since models run locally.
    Supports higher concurrency than cloud APIs.
    """

    def __init__(
        self,
        model: str = "deepseek-r1",
        host: str = "http://localhost:11434",
        max_concurrent: int = 50,
        temperature: float = 0.3,
    ):
        """
        Initialize Ollama provider.

        Args:
            model: Model to use (default: llama3.2)
                   Other options: gemma, mistral, codellama, etc.
            host: Ollama server URL (default: http://localhost:11434)
            max_concurrent: Maximum concurrent requests (default: 50)
                           Higher than OpenAI since no rate limits
            temperature: Temperature for generation (default: 0.3 for consistency)
        """
        if AsyncClient is None:
            raise ImportError(
                "ollama package not installed. Install with: pip install ollama"
            )

        self.client = AsyncClient(host=host)
        self.model = model
        self.temperature = temperature
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def _call_api(
        self,
        system_prompt: str,
        user_prompt: str,
        max_retries: int = 2,
        max_tokens: Optional[int] = None,  # the shared summarize_* pass it; Ollama runs uncapped
    ) -> Optional[str]:
        """
        Call Ollama API with retry logic.

        Args:
            system_prompt: System message
            user_prompt: User message
            max_retries: Maximum retry attempts

        Returns:
            Response content or None on failure
        """
        async with self.semaphore:
            for attempt in range(max_retries):
                try:
                    response = await self.client.chat(
                        model=self.model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        options={"temperature": self.temperature},
                    )

                    # Ollama response format: {'message': {'content': '...'}}
                    content = response.get("message", {}).get("content")
                    return content.strip() if content else None

                except Exception as e:
                    if attempt < max_retries - 1:
                        # Brief retry delay
                        await asyncio.sleep(0.5)
                        continue
                    return None

            return None

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
            try:
                response = await self.client.chat(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    options={
                        "temperature": temperature,
                        "num_predict": 2000,  # Larger for IA generation (JSON output)
                    },
                )

                # Ollama response format: {'message': {'content': '...'}}
                content = response.get("message", {}).get("content")
                if content:
                    return (True, content.strip(), None)
                else:
                    return (False, None, "Empty response from Ollama")
            except Exception as e:
                return (False, None, str(e))

    async def close(self):
        """No-op for Ollama (no persistent connections to close)."""
        pass
