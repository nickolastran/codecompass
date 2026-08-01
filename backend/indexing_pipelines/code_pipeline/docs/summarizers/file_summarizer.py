"""
File-level summarizer for AI documentation generation.

Generates summaries for files using their classes' and functions' summaries as context.
Implements Sprint 2 of the bottom-up documentation approach from
FEATURE_AIDOCUMENTATION2.md.

Key insight: We send class/function SUMMARIES to the LLM, not full code.
This provides high-level context about what the file contains and its purpose.

Supports both sync (legacy) and async (concurrent) execution with pluggable LLM providers.
"""

import asyncio
import os
from typing import List, Optional

from openai import OpenAI

from indexing_pipelines.code_pipeline.core.graph_model import EdgeType, Graph, Node, NodeLabel
from indexing_pipelines.code_pipeline.docs.llm.async_executor import async_batch_process_with_tracking
from indexing_pipelines.code_pipeline.docs.llm.providers import LLMProvider


def _get_file_definitions(
    file_node: Node, graph: Graph
) -> tuple[List[Node], List[Node]]:
    """
    Collect all CLASS and FUNCTION nodes contained by a file.

    Args:
        file_node: FILE node
        graph: Graph containing nodes and edges

    Returns:
        Tuple of (class_nodes, function_nodes)
    """
    class_nodes = []
    function_nodes = []

    # Find all CONTAINS edges where this file is the source
    for edge in graph.edges:
        if edge.type == EdgeType.CONTAINS and edge.src == file_node.id:
            child_node = graph.nodes.get(edge.dst)
            if child_node:
                if child_node.label == NodeLabel.CLASS:
                    class_nodes.append(child_node)
                elif child_node.label == NodeLabel.FUNCTION:
                    function_nodes.append(child_node)

    return class_nodes, function_nodes


def _build_file_representation(
    file_node: Node, classes: List[Node], functions: List[Node]
) -> str:
    """
    Build compact representation of a file using class/function summaries.

    Format:
        File: filename.py

        Classes:
          - ClassName: Short summary of what it does
          - AnotherClass: Short summary

        Functions:
          - function_name: Short summary of what it does

    Args:
        file_node: FILE node
        classes: List of CLASS nodes in this file
        functions: List of FUNCTION nodes in this file

    Returns:
        Formatted string representation
    """
    lines = [f"File: {file_node.name}", ""]

    # Add classes section
    if classes:
        lines.append("Classes:")
        for cls in classes:
            summary = cls.summary_short or "(no summary available)"
            lines.append(f"  - {cls.name}: {summary}")
    else:
        lines.append("Classes: (none)")

    lines.append("")

    # Add functions section
    if functions:
        lines.append("Functions:")
        for func in functions:
            summary = func.summary_short or "(no summary available)"
            lines.append(f"  - {func.name}: {summary}")
    else:
        lines.append("Functions: (none)")

    return "\n".join(lines)


def summarize_file(
    file_node: Node,
    graph: Graph,
    api_key: Optional[str] = None,
    model: str = "gpt-4o-mini",
) -> bool:
    """
    Generate summary for a single file using its classes' and functions' summaries.

    Populates file_node.summary_short directly.

    Sprint 2: Uses class/function summaries (not full code) as context.
    This provides high-level understanding of what the file contains.

    Args:
        file_node: FILE node to summarize
        graph: Graph containing the file and its definitions
        api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
        model: OpenAI model to use (default: gpt-4o-mini)

    Returns:
        True if summarization succeeded, False otherwise
    """
    # Only summarize file nodes
    if file_node.label != NodeLabel.FILE:
        return False

    # Skip if already summarized
    if file_node.summary_short:
        return True

    # Collect classes and functions in this file
    classes, functions = _get_file_definitions(file_node, graph)

    # Build compact representation using summaries
    file_repr = _build_file_representation(file_node, classes, functions)

    # Initialize OpenAI client
    client = OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))

    # Build prompt
    prompt = f"""Analyze this file's contents and describe what this file is responsible for and how it fits into the system.

{file_repr}

Provide a concise summary (3-5 sentences) that describes:
1. The main purpose of this file
2. What functionality it provides
3. How it fits into the larger system/codebase

Format your response as a single paragraph without any prefix labels."""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a technical documentation expert. Generate clear, concise summaries of code files based on their class and function summaries.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=300,
        )

        content = response.choices[0].message.content
        if not content:
            return False

        # Store the summary
        file_node.summary_short = content.strip()

        return True

    except Exception as e:
        print(f"Error summarizing file {file_node.name}: {e}")
        return False


def summarize_files(
    graph: Graph,
    api_key: Optional[str] = None,
    model: str = "gpt-4o-mini",
    verbose: bool = True,
) -> dict:
    """
    Generate summaries for all file nodes in a graph.

    Sprint 2: Processes FILE nodes using their classes'/functions' summaries as context.
    Requires that classes and functions have already been summarized (Sprint 1 & 2).

    Args:
        graph: Graph containing file nodes with summarized definitions
        api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
        model: OpenAI model to use
        verbose: Print progress updates

    Returns:
        Dictionary with statistics:
        {
            "total": int,
            "succeeded": int,
            "failed": int,
            "skipped": int,
            "missing_definition_summaries": int
        }
    """
    # Collect all file nodes
    file_nodes = [node for node in graph.nodes.values() if node.label == NodeLabel.FILE]

    stats = {
        "total": len(file_nodes),
        "succeeded": 0,
        "failed": 0,
        "skipped": 0,
        "missing_definition_summaries": 0,
    }

    for i, file_node in enumerate(file_nodes, 1):
        if verbose:
            print(f"[{i}/{stats['total']}] Summarizing file {file_node.name}...")

        # Skip if already summarized
        if file_node.summary_short:
            stats["skipped"] += 1
            if verbose:
                print(f"  → Skipped (already summarized)")
            continue

        # Check if definitions have summaries (warn if not)
        classes, functions = _get_file_definitions(file_node, graph)
        all_definitions = classes + functions
        unsummarized_defs = [d for d in all_definitions if not d.summary_short]

        if unsummarized_defs and verbose:
            print(
                f"  Warning: {len(unsummarized_defs)}/{len(all_definitions)} definitions lack summaries"
            )
            stats["missing_definition_summaries"] += 1

        success = summarize_file(file_node, graph, api_key=api_key, model=model)

        if success:
            stats["succeeded"] += 1
            if verbose:
                print(
                    f"  → Success ({len(classes)} classes, {len(functions)} functions)"
                )
        else:
            stats["failed"] += 1
            if verbose:
                print(f"  → Failed")

    if verbose:
        print(f"\nFile summarization complete:")
        print(f"  Total: {stats['total']}")
        print(f"  Succeeded: {stats['succeeded']}")
        print(f"  Failed: {stats['failed']}")
        print(f"  Skipped: {stats['skipped']}")
        if stats["missing_definition_summaries"] > 0:
            print(
                f"  Files with unsummarized definitions: {stats['missing_definition_summaries']}"
            )

    return stats


# ============================================================================
# Async provider-based functions (NEW - concurrent execution)
# ============================================================================


async def async_summarize_files(
    graph: Graph, provider: LLMProvider, verbose: bool = True
) -> dict:
    """
    Generate summaries for all file nodes using async provider.

    This is the FAST version - uses concurrent API calls for 10-30x speedup.

    Args:
        graph: Graph containing file nodes with summarized definitions
        provider: LLM provider (OpenAIProvider, OllamaProvider, etc.)
        verbose: Print progress updates

    Returns:
        Dictionary with statistics
    """
    # Collect all file nodes
    file_nodes = [node for node in graph.nodes.values() if node.label == NodeLabel.FILE]

    if verbose:
        print(f"Found {len(file_nodes)} files to summarize")

    # Process function for a single file
    async def process_node(
        file_node: Node, index: int, total: int
    ) -> tuple[Optional[bool], str]:
        """Process a single file. Returns (success, name)."""
        # Skip if already summarized
        if file_node.summary_short:
            return (None, file_node.name)  # None = skipped

        # Collect definitions and build representation
        classes, functions = _get_file_definitions(file_node, graph)
        file_repr = _build_file_representation(file_node, classes, functions)

        # Check for unsummarized definitions
        all_definitions = classes + functions
        unsummarized_defs = [d for d in all_definitions if not d.summary_short]
        if unsummarized_defs and verbose:
            print(
                f"[{index}/{total}] {file_node.name}: {len(unsummarized_defs)}/{len(all_definitions)} definitions lack summaries"
            )

        # Call provider
        result = await provider.summarize_file(
            file_representation=file_repr, file_name=file_node.name
        )

        if result.success and result.summary_short:
            file_node.summary_short = result.summary_short

            if verbose:
                print(
                    f"[{index}/{total}] ✓ {file_node.name} ({len(classes)} classes, {len(functions)} functions)"
                )

            return (True, file_node.name)
        else:
            if verbose:
                error_msg = result.error or "Unknown error"
                print(f"[{index}/{total}] ✗ {file_node.name}: {error_msg}")

            return (False, file_node.name)

    # Run batch processing
    stats = await async_batch_process_with_tracking(
        file_nodes, process_node, verbose=verbose, batch_name="files"
    )

    return stats


def async_summarize_files_sync(
    graph: Graph, provider: LLMProvider, verbose: bool = True
) -> dict:
    """
    Synchronous wrapper for async_summarize_files.

    Useful when calling from sync code. Manages event loop automatically.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(
                    asyncio.run, async_summarize_files(graph, provider, verbose)
                )
                return future.result()
        else:
            return loop.run_until_complete(
                async_summarize_files(graph, provider, verbose)
            )
    except RuntimeError:
        return asyncio.run(async_summarize_files(graph, provider, verbose))
