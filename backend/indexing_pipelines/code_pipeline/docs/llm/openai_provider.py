"""
OpenAI provider implementation with async support and rate limiting.
"""

import asyncio
import os
from typing import Optional

from dotenv import load_dotenv
from openai import AsyncOpenAI

from .providers import LLMProvider, SummaryResult


class OpenAIProvider(LLMProvider):
    """
    OpenAI API provider with async support and semaphore-based rate limiting.

    Uses AsyncOpenAI client for concurrent requests while respecting rate limits.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gpt-4o-mini",
        max_concurrent: int = 10,
        temperature: float = 0.3,
    ):
        """
        Initialize OpenAI provider.

        Args:
            api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
            model: Model to use (default: gpt-4o-mini for cost efficiency)
            max_concurrent: Maximum concurrent requests (default: 10 for Tier 1)
                           Tier 1: 500 RPM → use 10
                           Tier 2: 5000 RPM → use 50
            temperature: Temperature for generation (default: 0.3 for consistency)
        """
        # Load environment variables from .env file
        load_dotenv()

        self.client = AsyncOpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))
        self.model = model
        self.temperature = temperature
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def _call_api(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 300,
        max_retries: int = 3,
    ) -> Optional[str]:
        """
        Call OpenAI API with retry logic and rate limiting.

        Args:
            system_prompt: System message
            user_prompt: User message
            max_tokens: Maximum tokens in response
            max_retries: Maximum retry attempts for rate limit errors

        Returns:
            Response content or None on failure
        """
        async with self.semaphore:
            for attempt in range(max_retries):
                try:
                    response = await self.client.chat.completions.create(
                        model=self.model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        temperature=self.temperature,
                        max_tokens=max_tokens,
                    )

                    content = response.choices[0].message.content
                    return content.strip() if content else None

                except Exception as e:
                    error_str = str(e)

                    # Retry on rate limit errors (429)
                    if "rate_limit" in error_str.lower() or "429" in error_str:
                        if attempt < max_retries - 1:
                            # Exponential backoff: 1s, 2s, 4s
                            wait_time = 2**attempt
                            await asyncio.sleep(wait_time)
                            continue

                    # Don't retry other errors
                    return None

            return None

    async def summarize_definition(
        self, code: str, definition_type: str, name: str, include_detailed: bool = False
    ) -> SummaryResult:
        """
        Generate summary for a function or method definition.

        Uses the same prompts as the original definition_summarizer.py
        """
        system_prompt = (
            "You are a technical documentation expert. Generate clear, concise "
            "summaries of code functions and methods. Focus strictly on behavior "
            "and purpose, not line-by-line implementation details."
        )

        if include_detailed:
            # DETAILED mode: both short and detailed summaries
            user_prompt = f"""Analyze this {definition_type}:

```python
{code}
```

Provide TWO summaries:

1. SHORT (1-2 sentences): Describe what the {definition_type} does at a high level, the role of its key parameters, and what it returns or what side effects it has.

2. DETAILED (1-2 paragraphs): Explain the purpose, key steps, and any important details.

Guidelines:
- Do NOT restate the code or mention low-level implementation details like specific loops or conditionals.
- Do NOT explain generic Python concepts.
- Do NOT include any reasoning steps, preambles, or headings.

Format your response EXACTLY as:
SHORT: <short summary>
DETAILED: <detailed summary>"""

            response = await self._call_api(system_prompt, user_prompt, max_tokens=400)

            if not response:
                return SummaryResult(success=False, error="API call failed")

            # Parse response
            try:
                lines = response.split("\n", 1)
                short_line = lines[0] if lines else ""
                detailed_line = lines[1] if len(lines) > 1 else ""

                short = short_line.replace("SHORT:", "").strip()
                detailed = detailed_line.replace("DETAILED:", "").strip()

                if short and detailed:
                    return SummaryResult(
                        success=True, summary_short=short, summary_detailed=detailed
                    )
                else:
                    return SummaryResult(
                        success=False, error="Failed to parse response"
                    )

            except Exception as e:
                return SummaryResult(success=False, error=f"Parse error: {str(e)}")

        else:
            # FAST mode: only short summary (30-50% faster)
            user_prompt = f"""Analyze this {definition_type}:

```python
{code}
```

In 1-2 sentences, describe:
- What the {definition_type} does at a high level,
- The role of its key parameters,
- What it returns or what side effects it has.

Guidelines:
- Do NOT restate the code or mention low-level implementation details like specific loops or conditionals.
- Do NOT explain generic Python concepts.
- Do NOT include any reasoning steps, preambles, or headings.
- Respond with a single plain-text paragraph only."""

            response = await self._call_api(system_prompt, user_prompt, max_tokens=150)

            if response:
                return SummaryResult(
                    success=True, summary_short=response, summary_detailed=None
                )
            else:
                return SummaryResult(success=False, error="API call failed")

    async def summarize_class(
        self, class_representation: str, class_name: str
    ) -> SummaryResult:
        """
        Generate summary for a class using its method summaries.

        Uses the same prompts as the original class_summarizer.py
        """
        system_prompt = (
            "You are a technical documentation expert. Generate clear, concise "
            "summaries of code classes based on their method summaries."
        )

        user_prompt = f"""Analyze this class and its methods:

{class_representation}

Using only the information above, write a concise summary (2-4 sentences) that explains:
- The main purpose and responsibility of this class,
- What abstractions or patterns it implements (if any),
- How its methods work together conceptually.

Guidelines:
- Do NOT invent behavior or responsibilities that are not implied by the method summaries.
- Avoid generic phrases like "foundational component" or "crucial to the system".
- Do NOT explain generic Python or OOP basics.
- Respond as a single paragraph with no headings, bullet points, or labels."""

        response = await self._call_api(system_prompt, user_prompt, max_tokens=300)

        if response:
            return SummaryResult(success=True, summary_short=response)
        else:
            return SummaryResult(success=False, error="API call failed")

    async def summarize_file(
        self, file_representation: str, file_name: str
    ) -> SummaryResult:
        """
        Generate summary for a file using its class/function summaries.

        Uses the same prompts as the original file_summarizer.py
        """
        system_prompt = (
            "You are a technical documentation expert. Generate clear, concise "
            "summaries of code files based on their class and function summaries."
        )

        user_prompt = f"""Analyze this file's contents:

{file_representation}

Provide a concise summary (2-4 sentences) that describes:
- The main purpose of this file,
- The key functionality it provides,
- How it fits into the larger system/codebase.

If the file only defines an empty package, re-exports symbols, or contains minimal glue code:
- Say that it primarily serves as a thin namespace or entry point, and briefly mention what it exposes.
- Do NOT explain generic Python concepts like what __init__.py does.

Guidelines:
- Avoid vague phrases like "foundational component", "crucial part of the system", or long explanations of Python packaging.
- Focus on concrete responsibilities and how the file is actually used.
- Do NOT include headings, lists, or labels; respond as a single paragraph of plain text."""

        response = await self._call_api(system_prompt, user_prompt, max_tokens=300)

        if response:
            return SummaryResult(success=True, summary_short=response)
        else:
            return SummaryResult(success=False, error="API call failed")

    async def summarize_module(
        self, module_representation: str, module_name: str
    ) -> SummaryResult:
        """
        Generate summary for a module using its file summaries.

        Uses different prompts for leaf modules (no submodules) vs parent modules (with submodules).
        """
        system_prompt = (
            "You are a technical documentation expert. Generate clear, practical "
            "summaries of code modules/packages based on their file summaries."
        )

        # Detect if this module has submodules
        has_submodules = "Submodules:" in module_representation

        if has_submodules:
            # Top-/mid-level module prompt: Focus on subsystem organization
            user_prompt = f"""Analyze this module based on its submodule summaries and key local files:

{module_representation}

Provide a concise summary (3-5 sentences) that describes:
- The module's role in the project,
- The major subsystems it groups together,
- How those subsystems relate conceptually.

Guidelines:
- Focus on high-level organization and subsystem relationships.
- Don't explain generic packaging/namespace details.
- Don't list every file; stay high-level and conceptual.
- Avoid generic phrases like "foundational component" or "crucial to the system".
- Respond as a single paragraph of plain text with no headings or bullet points."""

        else:
            # Leaf module prompt: Focus on file-level functionality
            user_prompt = f"""Analyze this module's file summaries:

{module_representation}

Provide a concise summary (3-5 sentences) that describes:
- The module's main purpose and responsibility,
- The main kinds of functionality or abstractions it provides,
- When developers are likely to interact with or depend on this module.

If the module only contains trivial files (e.g., empty __init__.py or minimal glue code):
- State briefly that it primarily serves as a thin namespace or entry point.
- Do NOT explain generic Python packaging behavior.

Guidelines:
- Focus on concrete responsibilities evident from the file summaries.
- Avoid vague phrases like "foundational component" or "crucial to the system".
- Respond as a single paragraph of plain text with no headings or bullet points."""

        response = await self._call_api(system_prompt, user_prompt, max_tokens=400)

        if response:
            return SummaryResult(success=True, summary_short=response)
        else:
            return SummaryResult(success=False, error="API call failed")

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
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=temperature,
                    max_tokens=2000,  # Larger for IA generation (JSON output)
                )
                content = response.choices[0].message.content
                if content:
                    return (True, content.strip(), None)
                else:
                    return (False, None, "Empty response from API")
            except Exception as e:
                return (False, None, str(e))

    async def close(self):
        """Close the HTTP client."""
        await self.client.close()
