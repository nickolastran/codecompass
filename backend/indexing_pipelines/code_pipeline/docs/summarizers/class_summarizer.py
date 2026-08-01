"""
Class-level summarizer for AI documentation generation.

Generates summaries for classes using their methods' summaries as context.
Implements Sprint 2 of the bottom-up documentation approach from
FEATURE_AIDOCUMENTATION2.md.

Key insight: We send method SUMMARIES to the LLM, not full method code.
This scales to large classes with many methods.

Supports both sync (legacy) and async (concurrent) execution with pluggable LLM providers.
"""

import asyncio
import os
from typing import List, Optional

from openai import OpenAI

from indexing_pipelines.code_pipeline.core.graph_model import EdgeType, Graph, Node, NodeLabel
from indexing_pipelines.code_pipeline.docs.llm.async_executor import async_batch_process_with_tracking
from indexing_pipelines.code_pipeline.docs.llm.providers import LLMProvider


def _get_class_methods(class_node: Node, graph: Graph) -> List[Node]:
    """
    Collect all METHOD nodes contained by a class.

    Args:
        class_node: CLASS node
        graph: Graph containing nodes and edges

    Returns:
        List of METHOD nodes that are children of this class
    """
    method_nodes = []

    # Find all CONTAINS edges where this class is the source
    for edge in graph.edges:
        if edge.type == EdgeType.CONTAINS and edge.src == class_node.id:
            child_node = graph.nodes.get(edge.dst)
            if child_node and child_node.label == NodeLabel.METHOD:
                method_nodes.append(child_node)

    return method_nodes


def _build_class_representation(class_node: Node, methods: List[Node]) -> str:
    """
    Build compact representation of a class using method summaries.

    Format:
        Class: ClassName
        Methods:
          - method_name(...): Short summary of what it does
          - another_method(...): Short summary

    Args:
        class_node: CLASS node
        methods: List of METHOD nodes belonging to this class

    Returns:
        Formatted string representation
    """
    lines = [f"Class: {class_node.name}", "Methods:"]

    if not methods:
        lines.append("  (no methods)")
    else:
        for method in methods:
            # Use summary_short if available, otherwise indicate no summary
            summary = method.summary_short or "(no summary available)"
            lines.append(f"  - {method.name}: {summary}")

    return "\n".join(lines)


def summarize_class(
    class_node: Node,
    graph: Graph,
    api_key: Optional[str] = None,
    model: str = "gpt-4o-mini",
) -> bool:
    """
    Generate summary for a single class using its methods' summaries.

    Populates class_node.summary_short directly.

    Sprint 2: Uses method summaries (not full code) as context.
    This allows scaling to large classes without token explosion.

    Args:
        class_node: CLASS node to summarize
        graph: Graph containing the class and its methods
        api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
        model: OpenAI model to use (default: gpt-4o-mini)

    Returns:
        True if summarization succeeded, False otherwise
    """
    # Only summarize class nodes
    if class_node.label != NodeLabel.CLASS:
        return False

    # Skip if already summarized
    if class_node.summary_short:
        return True

    # Collect methods belonging to this class
    methods = _get_class_methods(class_node, graph)

    # Build compact representation using method summaries
    class_repr = _build_class_representation(class_node, methods)

    # Initialize OpenAI client
    client = OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))

    # Build prompt
    prompt = f"""Analyze this class and its methods, then describe the class's purpose and responsibilities.

{class_repr}

Provide a concise summary (3-5 sentences) that describes:
1. What this class represents or manages
2. Its primary responsibilities
3. How its methods work together to fulfill its purpose

Format your response as a single paragraph without any prefix labels."""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a technical documentation expert. Generate clear, concise summaries of code classes based on their method summaries.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,  # Lower temperature for more consistent output
            max_tokens=300,
        )

        content = response.choices[0].message.content
        if not content:
            return False

        # Store the summary
        class_node.summary_short = content.strip()

        return True

    except Exception as e:
        print(f"Error summarizing class {class_node.name}: {e}")
        return False


def summarize_classes(
    graph: Graph,
    api_key: Optional[str] = None,
    model: str = "gpt-4o-mini",
    verbose: bool = True,
) -> dict:
    """
    Generate summaries for all class nodes in a graph.

    Sprint 2: Processes CLASS nodes using their methods' summaries as context.
    Requires that methods have already been summarized (Sprint 1).

    Args:
        graph: Graph containing class nodes with summarized methods
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
            "missing_method_summaries": int  # Classes skipped due to unsummarized methods
        }
    """
    # Collect all class nodes
    class_nodes = [
        node for node in graph.nodes.values() if node.label == NodeLabel.CLASS
    ]

    stats = {
        "total": len(class_nodes),
        "succeeded": 0,
        "failed": 0,
        "skipped": 0,
        "missing_method_summaries": 0,
    }

    for i, class_node in enumerate(class_nodes, 1):
        if verbose:
            print(f"[{i}/{stats['total']}] Summarizing class {class_node.name}...")

        # Skip if already summarized
        if class_node.summary_short:
            stats["skipped"] += 1
            if verbose:
                print(f"  → Skipped (already summarized)")
            continue

        # Check if methods have summaries (warn if not)
        methods = _get_class_methods(class_node, graph)
        unsummarized_methods = [m for m in methods if not m.summary_short]

        if unsummarized_methods and verbose:
            print(
                f"  Warning: {len(unsummarized_methods)}/{len(methods)} methods lack summaries"
            )
            # We'll still attempt to summarize, but note this
            stats["missing_method_summaries"] += 1

        success = summarize_class(class_node, graph, api_key=api_key, model=model)

        if success:
            stats["succeeded"] += 1
            if verbose:
                print(f"  → Success ({len(methods)} methods)")
        else:
            stats["failed"] += 1
            if verbose:
                print(f"  → Failed")

    if verbose:
        print(f"\nClass summarization complete:")
        print(f"  Total: {stats['total']}")
        print(f"  Succeeded: {stats['succeeded']}")
        print(f"  Failed: {stats['failed']}")
        print(f"  Skipped: {stats['skipped']}")
        if stats["missing_method_summaries"] > 0:
            print(
                f"  Classes with unsummarized methods: {stats['missing_method_summaries']}"
            )

    return stats


# ============================================================================
# Async provider-based functions (NEW - concurrent execution)
# ============================================================================


async def async_summarize_classes(
    graph: Graph, provider: LLMProvider, verbose: bool = True
) -> dict:
    """
    Generate summaries for all class nodes using async provider.

    This is the FAST version - uses concurrent API calls for 10-30x speedup.

    Args:
        graph: Graph containing class nodes with summarized methods
        provider: LLM provider (OpenAIProvider, OllamaProvider, etc.)
        verbose: Print progress updates

    Returns:
        Dictionary with statistics
    """
    # Collect all class nodes
    class_nodes = [
        node for node in graph.nodes.values() if node.label == NodeLabel.CLASS
    ]

    if verbose:
        print(f"Found {len(class_nodes)} classes to summarize")

    # Process function for a single class
    async def process_node(
        class_node: Node, index: int, total: int
    ) -> tuple[Optional[bool], str]:
        """Process a single class. Returns (success, name)."""
        # Skip if already summarized
        if class_node.summary_short:
            return (None, class_node.name)  # None = skipped

        # Collect methods and build representation
        methods = _get_class_methods(class_node, graph)
        class_repr = _build_class_representation(class_node, methods)

        # Check for unsummarized methods
        unsummarized_methods = [m for m in methods if not m.summary_short]
        if unsummarized_methods and verbose:
            print(
                f"[{index}/{total}] {class_node.name}: {len(unsummarized_methods)}/{len(methods)} methods lack summaries"
            )

        # Call provider
        result = await provider.summarize_class(
            class_representation=class_repr, class_name=class_node.name
        )

        if result.success and result.summary_short:
            class_node.summary_short = result.summary_short

            if verbose:
                print(f"[{index}/{total}] ✓ {class_node.name} ({len(methods)} methods)")

            return (True, class_node.name)
        else:
            if verbose:
                error_msg = result.error or "Unknown error"
                print(f"[{index}/{total}] ✗ {class_node.name}: {error_msg}")

            return (False, class_node.name)

    # Run batch processing
    stats = await async_batch_process_with_tracking(
        class_nodes, process_node, verbose=verbose, batch_name="classes"
    )

    return stats


def async_summarize_classes_sync(
    graph: Graph, provider: LLMProvider, verbose: bool = True
) -> dict:
    """
    Synchronous wrapper for async_summarize_classes.

    Useful when calling from sync code. Manages event loop automatically.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(
                    asyncio.run, async_summarize_classes(graph, provider, verbose)
                )
                return future.result()
        else:
            return loop.run_until_complete(
                async_summarize_classes(graph, provider, verbose)
            )
    except RuntimeError:
        return asyncio.run(async_summarize_classes(graph, provider, verbose))
