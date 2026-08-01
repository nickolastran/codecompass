"""
Definition-level summarizer for AI documentation generation.

Generates concise summaries for code definitions (classes, functions, methods)
using LLM analysis. Implements the bottom-up documentation approach from
FEATURE_AIDOCUMENTATION2.md.

Supports both sync (legacy) and async (concurrent) execution with pluggable LLM providers.
"""

import asyncio
import os
from pathlib import Path
from typing import List, Optional
from urllib.parse import unquote, urlparse

from openai import OpenAI

from indexing_pipelines.code_pipeline.core.graph_model import Graph, Node, NodeLabel
from indexing_pipelines.code_pipeline.docs.llm.async_executor import async_batch_process_with_tracking
from indexing_pipelines.code_pipeline.docs.llm.providers import LLMProvider


def _extract_source_code(node: Node) -> Optional[str]:
    """
    Extract source code for a node using its path and line range.

    Handles both file:// URIs and filesystem paths.

    Args:
        node: Node with path, start_line, end_line

    Returns:
        Source code string, or None if extraction fails
    """
    # Convert file:// URI to filesystem path if needed
    path_str = node.path
    if path_str.startswith("file://"):
        parsed = urlparse(path_str)
        # On Windows: file:///C:/path → C:/path
        # On Unix: file:///path → /path
        path_str = unquote(parsed.path)
        if path_str.startswith("/") and len(path_str) > 2 and path_str[2] == ":":
            # Windows: remove leading slash from /C:/path
            path_str = path_str[1:]

    file_path = Path(path_str)

    if not file_path.exists():
        return None

    try:
        lines = file_path.read_text(encoding="utf-8").splitlines()
    except Exception:
        return None

    # Extract line range (0-indexed, inclusive)
    if node.start_line is None or node.end_line is None:
        return None

    start = node.start_line
    end = node.end_line + 1  # Make end inclusive

    if start < 0 or end > len(lines):
        return None

    return "\n".join(lines[start:end])


def summarize_definition(
    node: Node, api_key: Optional[str] = None, model: str = "gpt-4o-mini"
) -> bool:
    """
    Generate summary for a single definition node using LLM.

    Populates node.summary_short, node.summary_detailed, and node.loc directly.

    Sprint 1: Only methods and functions (leaf nodes in bottom-up hierarchy).
    Classes will be summarized in Sprint 2 using method summaries as context.

    Args:
        node: Definition node (function/method only, not class)
        api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
        model: OpenAI model to use (default: gpt-4o-mini for cost efficiency)

    Returns:
        True if summarization succeeded, False otherwise
    """
    # Only summarize methods and functions (not classes - those come in Sprint 2)
    if node.label not in {NodeLabel.FUNCTION, NodeLabel.METHOD}:
        return False

    # Extract source code
    source_code = _extract_source_code(node)
    if not source_code:
        return False

    # Calculate LOC
    node.loc = len(source_code.splitlines())

    # Skip if already summarized
    if node.summary_short and node.summary_detailed:
        return True

    # Initialize OpenAI client
    client = OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))

    # Determine node type for prompt
    node_type = node.label.value  # "class", "function", or "method"
    class_name = node.extra.get("class", "") if node.label == NodeLabel.METHOD else ""
    context = f" in class {class_name}" if class_name else ""

    # Build prompt
    prompt = f"""Analyze this {node_type}{context} and provide two summaries:

1. SHORT SUMMARY (1-3 sentences): Describe what this {node_type} does and its primary purpose.
2. DETAILED SUMMARY (1-2 paragraphs): Include key details like parameters, return values, algorithms, side effects, and important implementation notes.

Code:
```
{source_code}
```

Format your response as:
SHORT: <your 1-3 sentence summary>
DETAILED: <your 1-2 paragraph detailed summary>"""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a technical documentation expert. Generate clear, concise summaries of code definitions.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,  # Lower temperature for more consistent output
            max_tokens=500,
        )

        content = response.choices[0].message.content
        if not content:
            return False

        # Parse response
        lines = content.strip().split("\n")
        short_summary = ""
        detailed_summary = ""

        for line in lines:
            if line.startswith("SHORT:"):
                short_summary = line[6:].strip()
            elif line.startswith("DETAILED:"):
                detailed_summary = line[9:].strip()
            elif (
                short_summary
                and not line.startswith("SHORT:")
                and not line.startswith("DETAILED:")
            ):
                # Continue detailed summary across multiple lines
                if detailed_summary:
                    detailed_summary += " " + line.strip()

        # Populate node fields
        node.summary_short = short_summary or None
        node.summary_detailed = detailed_summary or None

        return bool(short_summary and detailed_summary)

    except Exception as e:
        print(f"Error summarizing {node.id}: {e}")
        return False


def summarize_definitions(
    graph: Graph,
    api_key: Optional[str] = None,
    model: str = "gpt-4o-mini",
    verbose: bool = True,
) -> dict:
    """
    Generate summaries for all method and function nodes in a graph.

    Sprint 1: Only processes methods and functions (leaf nodes).
    Classes will be summarized in Sprint 2 using method summaries as context.

    Args:
        graph: Graph containing definition nodes
        api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
        model: OpenAI model to use
        verbose: Print progress updates

    Returns:
        Dictionary with statistics:
        {
            "total": int,
            "succeeded": int,
            "failed": int,
            "skipped": int
        }
    """
    # Collect method and function nodes (not classes - Sprint 2)
    definition_nodes = [
        node
        for node in graph.nodes.values()
        if node.label in {NodeLabel.FUNCTION, NodeLabel.METHOD}
    ]

    stats = {"total": len(definition_nodes), "succeeded": 0, "failed": 0, "skipped": 0}

    for i, node in enumerate(definition_nodes, 1):
        if verbose:
            print(
                f"[{i}/{stats['total']}] Summarizing {node.label.value} {node.name}..."
            )

        # Skip if already summarized
        if node.summary_short and node.summary_detailed:
            stats["skipped"] += 1
            if verbose:
                print(f"  → Skipped (already summarized)")
            continue

        success = summarize_definition(node, api_key=api_key, model=model)

        if success:
            stats["succeeded"] += 1
            if verbose:
                print(f"  → Success ({node.loc} LOC)")
        else:
            stats["failed"] += 1
            if verbose:
                print(f"  → Failed")

    if verbose:
        print(f"\nSummarization complete:")
        print(f"  Total: {stats['total']}")
        print(f"  Succeeded: {stats['succeeded']}")
        print(f"  Failed: {stats['failed']}")
        print(f"  Skipped: {stats['skipped']}")

    return stats


# ============================================================================
# Async provider-based functions (NEW - concurrent execution)
# ============================================================================


async def async_summarize_definitions(
    graph: Graph,
    provider: LLMProvider,
    verbose: bool = True,
    include_detailed: bool = False,
) -> dict:
    """
    Generate summaries for all method and function nodes using async provider.

    This is the FAST version - uses concurrent API calls for 10-30x speedup.

    Args:
        graph: Graph containing definition nodes
        provider: LLM provider (OpenAIProvider, OllamaProvider, etc.)
        verbose: Print progress updates
        include_detailed: If True, generate detailed summaries (slower, more tokens)
                         If False, only generate short summaries (DEFAULT - 30-50% faster)

    Returns:
        Dictionary with statistics:
        {
            "total": int,
            "succeeded": int,
            "failed": int,
            "skipped": int,
            "errors": List[str]
        }
    """
    # Collect method and function nodes
    definition_nodes = [
        node
        for node in graph.nodes.values()
        if node.label in {NodeLabel.FUNCTION, NodeLabel.METHOD}
    ]

    if verbose:
        print(f"Found {len(definition_nodes)} definitions to summarize")
        if not include_detailed:
            print("Using FAST mode (short summaries only)")

    # Process function for a single node
    async def process_node(
        node: Node, index: int, total: int
    ) -> tuple[Optional[bool], str]:
        """Process a single node. Returns (success, name)."""
        # Skip if already summarized (check based on what we're generating)
        if include_detailed:
            if node.summary_short and node.summary_detailed:
                return (None, node.name)  # None = skipped
        else:
            if node.summary_short:
                return (None, node.name)  # None = skipped

        # Extract source code
        source_code = _extract_source_code(node)
        if not source_code:
            return (False, node.name)

        # Calculate LOC
        node.loc = len(source_code.splitlines())

        # Call provider
        result = await provider.summarize_definition(
            code=source_code,
            definition_type=node.label.value,
            name=node.name,
            include_detailed=include_detailed,
        )

        if result.success and result.summary_short:
            node.summary_short = result.summary_short
            if include_detailed and result.summary_detailed:
                node.summary_detailed = result.summary_detailed

            if verbose:
                print(
                    f"[{index}/{total}] ✓ {node.label.value} {node.name} ({node.loc} LOC)"
                )

            return (True, node.name)
        else:
            if verbose:
                error_msg = result.error or "Unknown error"
                print(
                    f"[{index}/{total}] ✗ {node.label.value} {node.name}: {error_msg}"
                )

            return (False, node.name)

    # Run batch processing
    stats = await async_batch_process_with_tracking(
        definition_nodes, process_node, verbose=verbose, batch_name="definitions"
    )

    return stats


def async_summarize_definitions_sync(
    graph: Graph,
    provider: LLMProvider,
    verbose: bool = True,
    include_detailed: bool = False,
) -> dict:
    """
    Synchronous wrapper for async_summarize_definitions.

    Useful when calling from sync code. Manages event loop automatically.

    Args:
        graph: Graph containing definition nodes
        provider: LLM provider
        verbose: Print progress updates
        include_detailed: If True, generate detailed summaries (slower)

    Returns:
        Dictionary with statistics
    """
    try:
        # Try to get existing event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # We're already in an async context, create new loop in thread
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(
                    asyncio.run,
                    async_summarize_definitions(
                        graph, provider, verbose, include_detailed
                    ),
                )
                return future.result()
        else:
            # No running loop, run directly
            return loop.run_until_complete(
                async_summarize_definitions(graph, provider, verbose, include_detailed)
            )
    except RuntimeError:
        # No event loop exists, create one
        return asyncio.run(
            async_summarize_definitions(graph, provider, verbose, include_detailed)
        )
