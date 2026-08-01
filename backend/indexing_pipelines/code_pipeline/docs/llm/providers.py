"""
Abstract LLM provider interface for AI documentation generation.

Provides a pluggable interface for different LLM backends (OpenAI, Ollama, etc.)
All providers implement async methods for concurrent summarization.
"""

from abc import ABC, abstractmethod
from typing import Optional, Tuple
from dataclasses import dataclass


@dataclass
class SummaryResult:
    """Result from a summarization operation."""
    success: bool
    summary_short: Optional[str] = None
    summary_detailed: Optional[str] = None
    error: Optional[str] = None


class LLMProvider(ABC):
    """
    Abstract base class for LLM providers.

    All methods are async to enable concurrent batch processing.
    Implementations handle their own rate limiting and error handling.
    """

    @abstractmethod
    async def summarize_definition(
        self,
        code: str,
        definition_type: str,
        name: str,
        include_detailed: bool = False
    ) -> SummaryResult:
        """
        Generate summary for a function or method definition.

        Args:
            code: Source code of the definition
            definition_type: "function" or "method"
            name: Name of the definition
            include_detailed: If True, generate detailed summary (slower, more tokens)
                            If False, only generate short summary (faster)

        Returns:
            SummaryResult with short summary (and optionally detailed summary)
        """
        pass

    @abstractmethod
    async def summarize_class(
        self,
        class_representation: str,
        class_name: str
    ) -> SummaryResult:
        """
        Generate summary for a class using its method summaries.

        Args:
            class_representation: Formatted string with class name and method summaries
            class_name: Name of the class

        Returns:
            SummaryResult with short summary
        """
        pass

    @abstractmethod
    async def summarize_file(
        self,
        file_representation: str,
        file_name: str
    ) -> SummaryResult:
        """
        Generate summary for a file using its class/function summaries.

        Args:
            file_representation: Formatted string with file contents overview
            file_name: Name of the file

        Returns:
            SummaryResult with short summary
        """
        pass

    @abstractmethod
    async def summarize_module(
        self,
        module_representation: str,
        module_name: str
    ) -> SummaryResult:
        """
        Generate summary for a module using its file summaries.

        Args:
            module_representation: Formatted string with module files overview
            module_name: Name of the module

        Returns:
            SummaryResult with short summary
        """
        pass

    @abstractmethod
    async def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Generate text using a custom prompt (for non-summarization tasks like IA generation).

        Args:
            system_prompt: System message defining the assistant's role
            user_prompt: User message with the task
            temperature: Sampling temperature (0.0 = deterministic, 1.0 = creative)

        Returns:
            Tuple of (success, response_text, error_message)
        """
        pass

    @abstractmethod
    async def close(self):
        """Clean up resources (close HTTP clients, etc.)"""
        pass
