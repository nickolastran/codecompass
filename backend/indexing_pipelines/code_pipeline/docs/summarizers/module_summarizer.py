"""
Module-level summarizer for AI documentation generation.

Generates summaries for modules/folders using their files' summaries as context.
Implements Sprint 2 Task 3 of the bottom-up documentation approach from
FEATURE_AIDOCUMENTATION2.md.

Key insight: We send file SUMMARIES to the LLM, not full code or even class summaries.
This provides high-level context about what the module contains and its purpose.

Note: Unlike file/class/function summaries, module summaries are stored separately
in .codecompass/module_summaries.json rather than in graph nodes.

Supports both sync (legacy) and async (concurrent) execution with pluggable LLM providers.
"""

import asyncio
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from openai import OpenAI

from indexing_pipelines.code_pipeline.core.graph_model import EdgeType, Graph, Node, NodeLabel
from indexing_pipelines.code_pipeline.docs.llm.async_executor import async_batch_process_with_tracking
from indexing_pipelines.code_pipeline.docs.llm.providers import LLMProvider


def _get_folder_files(folder_node: Node, graph: Graph) -> List[Node]:
    """
    Collect all FILE nodes contained by a folder.

    Args:
        folder_node: FOLDER node
        graph: Graph containing nodes and edges

    Returns:
        List of FILE nodes
    """
    file_nodes = []

    # Find all CONTAINS edges where this folder is the source
    for edge in graph.edges:
        if edge.type == EdgeType.CONTAINS and edge.src == folder_node.id:
            child_node = graph.nodes.get(edge.dst)
            if child_node and child_node.label == NodeLabel.FILE:
                file_nodes.append(child_node)

    return file_nodes


def _get_folder_submodules(
    folder_node: Node, graph: Graph, module_summaries: Dict[str, Dict[str, Any]]
) -> List[Dict[str, str]]:
    """
    Collect direct submodule summaries for a folder.

    Args:
        folder_node: FOLDER node
        graph: Graph containing nodes and edges
        module_summaries: Dict mapping folder_id -> {name, path, summary, ...}

    Returns:
        List of dicts with {"name": str, "summary": str} for each submodule
    """
    submodules = []

    # Find all CONTAINS edges where this folder is the source
    for edge in graph.edges:
        if edge.type == EdgeType.CONTAINS and edge.src == folder_node.id:
            child_node = graph.nodes.get(edge.dst)
            if child_node and child_node.label == NodeLabel.FOLDER:
                # Check if this submodule has been summarized
                if child_node.id in module_summaries:
                    submodules.append(
                        {
                            "name": child_node.name,
                            "summary": module_summaries[child_node.id]["summary"],
                        }
                    )

    return submodules


def _build_module_representation(
    folder_node: Node,
    files: List[Node],
    graph: Graph,
    submodules: Optional[List[Dict[str, str]]] = None,
) -> str:
    """
    Build compact representation of a module using file summaries, imports, and submodules.

    Format:
        Module: pacai/agents (12 files, 3 submodules)

        Submodules:
          greedy/
            Summary: Implements greedy search algorithms...

          minimax/
            Summary: Implements minimax and alpha-beta pruning...

        Architecture:
          File: base.py
            Summary: Defines the base Agent class with core decision-making interface...
            Imported by: greedy.py, minimax.py, random.py (3 files)

          File: greedy.py
            Summary: Implements greedy action selection strategy...
            Imports: base.py

    Args:
        folder_node: FOLDER node
        files: List of FILE nodes in this folder
        graph: Graph containing IMPORTS edges
        submodules: Optional list of {"name": str, "summary": str} dicts for submodules

    Returns:
        Formatted string representation
    """
    # Header with counts
    header_parts = [f"{len(files)} files"]
    if submodules:
        header_parts.append(f"{len(submodules)} submodules")
    header = f"Module: {folder_node.name} ({', '.join(header_parts)})"

    lines = [header, ""]

    # Build import relationship maps
    imports_map = {}  # file_id -> [imported_file_names]
    imported_by_map = {}  # file_id -> [importing_file_names]

    # File ID to name mapping for this module
    file_id_to_name = {f.id: f.name for f in files}

    for edge in graph.edges:
        if edge.type == EdgeType.IMPORTS:
            src_node = graph.nodes.get(edge.src)
            dst_node = graph.nodes.get(edge.dst)

            # Only track imports within this module (or from/to this module)
            if src_node and dst_node:
                # Track imports (A imports B)
                if edge.src in file_id_to_name:
                    imports_map.setdefault(edge.src, []).append(dst_node.name)

                # Track imported_by (A is imported by B)
                if edge.dst in file_id_to_name:
                    imported_by_map.setdefault(edge.dst, []).append(src_node.name)

    # Add submodules section (if any)
    if submodules:
        lines.append("Submodules:")
        for submodule in submodules:
            lines.append(f"  {submodule['name']}/")
            lines.append(f"    Summary: {submodule['summary']}")
            lines.append("")
        lines.append("")  # Extra blank line after submodules section

    # Add architecture section with file summaries and imports
    if files:
        lines.append("Architecture:")
        for file_node in files:
            summary = file_node.summary_short or "(no summary available)"
            lines.append(f"  File: {file_node.name}")
            lines.append(f"    Summary: {summary}")

            # Show what this file imports (dependencies)
            if file_node.id in imports_map:
                imports = imports_map[file_node.id]
                if imports:
                    imports_str = ", ".join(imports[:5])  # Limit to first 5
                    if len(imports) > 5:
                        imports_str += f", ... ({len(imports)} total)"
                    lines.append(f"    Imports: {imports_str}")

            # Show what imports this file (dependents)
            if file_node.id in imported_by_map:
                imported_by = imported_by_map[file_node.id]
                if imported_by:
                    imported_by_str = ", ".join(imported_by[:5])  # Limit to first 5
                    if len(imported_by) > 5:
                        imported_by_str += f", ... ({len(imported_by)} total)"
                    lines.append(f"    Imported by: {imported_by_str}")

            lines.append("")  # Blank line between files
    else:
        lines.append("Files: (none)")

    return "\n".join(lines)


def summarize_module(
    folder_node: Node,
    graph: Graph,
    api_key: Optional[str] = None,
    model: str = "gpt-4o-mini",
) -> Optional[str]:
    """
    Generate summary for a single module using its files' summaries.

    Returns the generated summary as a string (does NOT modify graph nodes).

    Sprint 2 Task 3: Uses file summaries (not class/function summaries) as context.
    This provides high-level understanding of what the module/package contains.

    Args:
        folder_node: FOLDER node to summarize
        graph: Graph containing the folder and its files
        api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
        model: OpenAI model to use (default: gpt-4o-mini)

    Returns:
        Generated summary string if successful, None otherwise
    """
    # Only summarize folder nodes
    if folder_node.label != NodeLabel.FOLDER:
        return None

    # Collect files in this folder
    files = _get_folder_files(folder_node, graph)

    # Skip empty folders
    if not files:
        return None

    # Build compact representation using file summaries and imports
    module_repr = _build_module_representation(folder_node, files, graph)

    # Initialize OpenAI client
    client = OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))

    # Build prompt
    prompt = f"""Analyze this module's contents and describe this module's role in the project.

{module_repr}

Provide a comprehensive summary (4-6 sentences) that describes:
1. The module's main role and purpose in the project
2. The main abstractions or patterns it provides
3. When developers should use this module
4. How it relates to other modules or the broader system

Format your response as a single paragraph without any prefix labels."""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a technical documentation expert. Generate clear, comprehensive summaries of code modules/packages based on their file summaries.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=400,
        )

        content = response.choices[0].message.content
        if not content:
            return None

        return content.strip()

    except Exception as e:
        print(f"Error summarizing module {folder_node.name}: {e}")
        return None


def summarize_modules(
    graph: Graph,
    api_key: Optional[str] = None,
    model: str = "gpt-4o-mini",
    verbose: bool = True,
    output_path: str = ".codecompass/module_summaries.json",
) -> Dict[str, Any]:
    """
    Generate summaries for all folder nodes in a graph.

    Sprint 2 Task 3: Processes FOLDER nodes using their files' summaries as context.
    Requires that files have already been summarized (Sprint 2 Task 2).

    Unlike file/class summaries, module summaries are stored separately in JSON
    rather than in graph nodes.

    Args:
        graph: Graph containing folder nodes with summarized files
        api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
        model: OpenAI model to use
        verbose: Print progress updates
        output_path: Path to save module summaries JSON

    Returns:
        Dictionary with statistics and summaries:
        {
            "total": int,
            "succeeded": int,
            "failed": int,
            "skipped": int,
            "missing_file_summaries": int,
            "summaries": {
                "folder_id": {
                    "name": str,
                    "path": str,
                    "file_count": int,
                    "summary": str
                },
                ...
            }
        }
    """
    # Collect all folder nodes
    folder_nodes = [
        node for node in graph.nodes.values() if node.label == NodeLabel.FOLDER
    ]

    stats = {
        "total": len(folder_nodes),
        "succeeded": 0,
        "failed": 0,
        "skipped": 0,
        "missing_file_summaries": 0,
        "summaries": {},
    }

    # Load existing module summaries if they exist
    output_file = Path(output_path)
    if output_file.exists():
        try:
            existing_data = json.loads(output_file.read_text(encoding="utf-8"))
            stats["summaries"] = existing_data.get("summaries", {})
            if verbose:
                print(
                    f"Loaded {len(stats['summaries'])} existing module summaries from cache"
                )
        except (json.JSONDecodeError, IOError):
            if verbose:
                print(
                    "Warning: Could not load existing module summaries, starting fresh"
                )

    for i, folder_node in enumerate(folder_nodes, 1):
        if verbose:
            print(f"[{i}/{stats['total']}] Summarizing module {folder_node.name}...")

        # Skip if already summarized
        if folder_node.id in stats["summaries"]:
            stats["skipped"] += 1
            if verbose:
                print(f"  → Skipped (already summarized)")
            continue

        # Collect files in this folder
        files = _get_folder_files(folder_node, graph)

        # Skip empty folders
        if not files:
            stats["skipped"] += 1
            if verbose:
                print(f"  → Skipped (no files)")
            continue

        # Check if files have summaries (warn if not)
        unsummarized_files = [f for f in files if not f.summary_short]

        if unsummarized_files and verbose:
            print(
                f"  Warning: {len(unsummarized_files)}/{len(files)} files lack summaries"
            )
            stats["missing_file_summaries"] += 1

        summary = summarize_module(folder_node, graph, api_key=api_key, model=model)

        if summary:
            stats["succeeded"] += 1
            stats["summaries"][folder_node.id] = {
                "name": folder_node.name,
                "path": folder_node.path,
                "file_count": len(files),
                "summary": summary,
            }
            if verbose:
                print(f"  → Success ({len(files)} files)")
        else:
            stats["failed"] += 1
            if verbose:
                print(f"  → Failed")

    # Save module summaries to file
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_data = {
        "total_modules": stats["succeeded"] + stats["skipped"],
        "summaries": stats["summaries"],
    }
    output_file.write_text(json.dumps(output_data, indent=2), encoding="utf-8")

    if verbose:
        print(f"\nModule summarization complete:")
        print(f"  Total: {stats['total']}")
        print(f"  Succeeded: {stats['succeeded']}")
        print(f"  Failed: {stats['failed']}")
        print(f"  Skipped: {stats['skipped']}")
        if stats["missing_file_summaries"] > 0:
            print(
                f"  Modules with unsummarized files: {stats['missing_file_summaries']}"
            )
        print(f"\nSaved {len(stats['summaries'])} module summaries to {output_path}")

    return stats


# ============================================================================
# Async provider-based functions (NEW - concurrent execution)
# ============================================================================


async def async_summarize_modules(
    graph: Graph,
    provider: LLMProvider,
    verbose: bool = True,
    output_path: str = ".codecompass/module_summaries.json",
) -> Dict[str, Any]:
    """
    Generate summaries for all folder nodes using async provider.

    This is the FAST version - uses concurrent API calls for 10-30x speedup.

    Processes folders in depth-first order (deepest first) so that submodule
    summaries are available when summarizing parent modules.

    Args:
        graph: Graph containing folder nodes with summarized files
        provider: LLM provider (OpenAIProvider, OllamaProvider, etc.)
        verbose: Print progress updates
        output_path: Path to save module summaries JSON

    Returns:
        Dictionary with statistics and summaries
    """
    # Collect all folder nodes
    folder_nodes = [
        node for node in graph.nodes.values() if node.label == NodeLabel.FOLDER
    ]

    # Sort by depth (deepest first) so submodules are processed before parents
    # Depth = number of path separators in the path
    def get_depth(node: Node) -> int:
        return node.path.count("/") + node.path.count("\\")

    folder_nodes.sort(key=get_depth, reverse=True)

    stats = {
        "total": len(folder_nodes),
        "succeeded": 0,
        "failed": 0,
        "skipped": 0,
        "missing_file_summaries": 0,
        "summaries": {},
    }

    # Load existing module summaries if they exist
    output_file = Path(output_path)
    if output_file.exists():
        try:
            existing_data = json.loads(output_file.read_text(encoding="utf-8"))
            stats["summaries"] = existing_data.get("summaries", {})
            if verbose:
                print(
                    f"Loaded {len(stats['summaries'])} existing module summaries from cache"
                )
        except (json.JSONDecodeError, IOError):
            if verbose:
                print(
                    "Warning: Could not load existing module summaries, starting fresh"
                )

    # Group folders by depth level for sequential batch processing
    # This ensures all children are processed before their parents
    from collections import defaultdict

    depth_groups = defaultdict(list)
    for node in folder_nodes:
        depth = get_depth(node)
        depth_groups[depth].append(node)

    # Get unique depths in descending order (deepest first)
    depths_sorted = sorted(depth_groups.keys(), reverse=True)

    if verbose:
        print(
            f"Found {len(folder_nodes)} folders across {len(depths_sorted)} depth levels"
        )
        print(f"Processing depth levels: {depths_sorted}")

    # Process function for a single module
    async def process_node(
        folder_node: Node, index: int, total: int
    ) -> tuple[Optional[bool], str]:
        """Process a single module. Returns (success, name)."""
        # Skip if already summarized
        if folder_node.id in stats["summaries"]:
            return (None, folder_node.name)  # None = skipped

        # Collect files in this folder
        files = _get_folder_files(folder_node, graph)

        # Collect submodules (using already-generated summaries)
        submodules = _get_folder_submodules(folder_node, graph, stats["summaries"])

        # Skip empty folders with no submodules
        if not files and not submodules:
            return (None, folder_node.name)

        # Build module representation with imports and submodules
        module_repr = _build_module_representation(
            folder_node, files, graph, submodules
        )

        # Check for unsummarized files
        unsummarized_files = [f for f in files if not f.summary_short]
        if unsummarized_files and verbose:
            print(
                f"[{index}/{total}] {folder_node.name}: {len(unsummarized_files)}/{len(files)} files lack summaries"
            )

        # Call provider
        result = await provider.summarize_module(
            module_representation=module_repr, module_name=folder_node.name
        )

        if result.success and result.summary_short:
            stats["summaries"][folder_node.id] = {
                "name": folder_node.name,
                "path": folder_node.path,
                "file_count": len(files),
                "submodule_count": len(submodules),
                "summary": result.summary_short,
            }

            if verbose:
                counts = [f"{len(files)} files"]
                if submodules:
                    counts.append(f"{len(submodules)} submodules")
                print(f"[{index}/{total}] ✓ {folder_node.name} ({', '.join(counts)})")

            return (True, folder_node.name)
        else:
            if verbose:
                error_msg = result.error or "Unknown error"
                print(f"[{index}/{total}] ✗ {folder_node.name}: {error_msg}")

            return (False, folder_node.name)

    # Process each depth level sequentially (deepest first)
    # Within each level, process folders concurrently
    total_processed = 0
    for depth in depths_sorted:
        folders_at_depth = depth_groups[depth]

        if verbose:
            print(
                f"\n--- Processing depth level {depth} ({len(folders_at_depth)} folders) ---"
            )

        if folders_at_depth:
            batch_stats = await async_batch_process_with_tracking(
                folders_at_depth,
                process_node,
                verbose=verbose,
                batch_name=f"depth-{depth} modules",
            )

            # Update cumulative stats
            stats["succeeded"] += batch_stats["succeeded"]
            stats["failed"] += batch_stats["failed"]
            stats["skipped"] += batch_stats["skipped"]
            total_processed += len(folders_at_depth)

    # Save module summaries to file
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_data = {
        "total_modules": stats["succeeded"] + stats["skipped"],
        "summaries": stats["summaries"],
    }
    output_file.write_text(json.dumps(output_data, indent=2), encoding="utf-8")

    if verbose:
        print(f"\nSaved {len(stats['summaries'])} module summaries to {output_path}")

    return stats


def async_summarize_modules_sync(
    graph: Graph,
    provider: LLMProvider,
    verbose: bool = True,
    output_path: str = ".codecompass/module_summaries.json",
) -> Dict[str, Any]:
    """
    Synchronous wrapper for async_summarize_modules.

    Useful when calling from sync code. Manages event loop automatically.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(
                    asyncio.run,
                    async_summarize_modules(graph, provider, verbose, output_path),
                )
                return future.result()
        else:
            return loop.run_until_complete(
                async_summarize_modules(graph, provider, verbose, output_path)
            )
    except RuntimeError:
        return asyncio.run(
            async_summarize_modules(graph, provider, verbose, output_path)
        )
