"""
Compute scope (node_ids) for wiki pages based on their module assignments.

Given a PageSpec with modules (e.g., ["pacai/agents"]), compute which graph
nodes are in scope for that page.
"""

from pathlib import Path
from typing import Any, Dict, List, Set

from indexing_pipelines.code_pipeline.core.graph_model import Graph, Node, NodeLabel
from indexing_pipelines.code_pipeline.docs.ia.page_spec import PageSpec, WikiIA


def compute_page_scope(
    page: PageSpec, graph: Graph, base_dir: str, verbose: bool = False
) -> List[str]:
    """
    Compute node IDs in scope for a page based on its module assignments.

    A node is in scope if:
    1. It's a FILE node under one of the page's modules, OR
    2. It's a definition node (CLASS/FUNCTION/METHOD) in one of those files

    Args:
        page: PageSpec with modules to scope
        graph: Knowledge graph
        base_dir: Base directory of the codebase (for path resolution)
        verbose: Print debug output

    Returns:
        List of node IDs in scope for this page
    """
    if not page.modules:
        return []

    node_ids = set()
    base_path = Path(base_dir).resolve()

    # Convert module paths to filesystem paths
    # e.g., "pacai/agents" -> "/path/to/example_repos/pacai/pacai/agents"
    # The LLM generates paths like "pacai/agents" which map to the actual directory structure
    module_paths = []
    for module in page.modules:
        # Module paths are relative to base_dir and may include project structure
        # e.g., "pacai/agents" -> base_path / "pacai/agents"
        module_path = base_path / module.replace(".", "/")
        module_paths.append(module_path)

    # Convert module_paths to relative paths for string matching
    # module_paths are absolute like "C:/Users/.../example_repos/pacai/agents"
    # node.path might be relative like "pacai/agents/cheating.py" or absolute
    module_relative_paths = []
    for module_path in module_paths:
        try:
            rel = module_path.relative_to(base_path)
            module_relative_paths.append(str(rel).replace("\\", "/"))
        except ValueError:
            # module_path not under base_path, skip
            continue

    # Find all FILE nodes under these module paths
    file_nodes = set()
    for node in graph.nodes.values():
        if node.label == NodeLabel.FILE:
            # Normalize node path to relative format
            node_path_str = str(node.path).replace("\\", "/")

            # Try both as-is and as relative to base_dir
            node_paths_to_check = [node_path_str]
            if Path(node.path).is_absolute():
                try:
                    rel = Path(node.path).relative_to(base_path)
                    node_paths_to_check.append(str(rel).replace("\\", "/"))
                except ValueError:
                    pass

            # Check if this file is under any of the module paths
            for node_check_path in node_paths_to_check:
                for module_rel_path in module_relative_paths:
                    if (
                        node_check_path.startswith(module_rel_path + "/")
                        or node_check_path == module_rel_path
                    ):
                        file_nodes.add(node.id)
                        node_ids.add(node.id)
                        break

    # Find all definition nodes (CLASS/FUNCTION/METHOD) in these files
    for node in graph.nodes.values():
        if node.label in {NodeLabel.CLASS, NodeLabel.FUNCTION, NodeLabel.METHOD}:
            # Normalize node path to relative format (now consistent with FILE nodes)
            node_path_str = str(node.path).replace("\\", "/")

            # Try both as-is and as relative to base_dir
            node_paths_to_check = [node_path_str]
            if Path(node.path).is_absolute():
                try:
                    rel = Path(node.path).relative_to(base_path)
                    node_paths_to_check.append(str(rel).replace("\\", "/"))
                except ValueError:
                    pass

            # Check if this definition's file is in scope
            for node_check_path in node_paths_to_check:
                for module_rel_path in module_relative_paths:
                    if (
                        node_check_path.startswith(module_rel_path + "/")
                        or node_check_path == module_rel_path
                    ):
                        node_ids.add(node.id)
                        break

    return sorted(node_ids)


def compute_all_scopes(
    ia: WikiIA, graph: Graph, base_dir: str, verbose: bool = False
) -> int:
    """
    Compute node_ids for all pages in the WikiIA.

    Modifies pages in-place by setting their node_ids field.

    Args:
        ia: WikiIA to compute scopes for
        graph: Knowledge graph
        base_dir: Base directory of the codebase
        verbose: Print progress updates

    Returns:
        Total number of pages processed
    """
    pages_processed = 0

    for page in ia.get_all_pages():
        page.node_ids = compute_page_scope(page, graph, base_dir, verbose=verbose)
        pages_processed += 1

        if verbose and page.node_ids:
            print(f"  {page.slug}: {len(page.node_ids)} nodes in scope")

    return pages_processed


def validate_coverage(
    ia: WikiIA, graph: Graph, verbose: bool = False
) -> Dict[str, Any]:
    """
    Validate that the IA provides good coverage of the codebase.

    Returns statistics about:
    - How many nodes are covered by at least one page
    - How many nodes are orphaned (not covered by any page)
    - Which pages have overlapping scope

    Args:
        ia: WikiIA to validate
        graph: Knowledge graph
        verbose: Print detailed warnings

    Returns:
        Dictionary with coverage statistics
    """
    # Collect all node_ids covered by any page
    covered_nodes = set()
    page_coverage = {}

    for page in ia.get_all_pages():
        page_nodes = set(page.node_ids)
        covered_nodes.update(page_nodes)
        page_coverage[page.slug] = page_nodes

    # Find all definition nodes in the graph
    all_definition_nodes = {
        n.id
        for n in graph.nodes.values()
        if n.label in {NodeLabel.CLASS, NodeLabel.FUNCTION, NodeLabel.METHOD}
    }

    # Filter covered_nodes to only include definition nodes (not FILE nodes)
    # node_ids can be: "file:...", "class:...", "method:...", "function:..."
    covered_definition_nodes = {
        nid
        for nid in covered_nodes
        if nid.startswith(("class:", "method:", "function:"))
    }

    # Find orphaned nodes
    orphaned_nodes = all_definition_nodes - covered_definition_nodes

    # Find overlapping pages
    overlaps = []
    pages = list(page_coverage.items())
    for i, (slug1, nodes1) in enumerate(pages):
        for slug2, nodes2 in pages[i + 1 :]:
            overlap = nodes1 & nodes2
            if overlap:
                overlaps.append(
                    {"page1": slug1, "page2": slug2, "overlap_count": len(overlap)}
                )

    coverage_pct = (
        len(covered_definition_nodes) / len(all_definition_nodes) * 100
        if all_definition_nodes
        else 0
    )

    stats = {
        "total_definition_nodes": len(all_definition_nodes),
        "covered_nodes": len(covered_definition_nodes),
        "orphaned_nodes": len(orphaned_nodes),
        "coverage_percentage": coverage_pct,
        "pages_with_scope": sum(1 for nodes in page_coverage.values() if nodes),
        "overlapping_page_pairs": len(overlaps),
    }

    if verbose:
        print(f"\nCoverage Statistics:")
        print(f"  Total definition nodes: {stats['total_definition_nodes']}")
        print(f"  Covered nodes: {stats['covered_nodes']} ({coverage_pct:.1f}%)")
        print(f"  Orphaned nodes: {stats['orphaned_nodes']}")
        print(f"  Pages with scope: {stats['pages_with_scope']}")

        if orphaned_nodes and len(orphaned_nodes) <= 20:
            print(f"\nOrphaned nodes:")
            for node_id in sorted(orphaned_nodes)[:20]:
                node = graph.nodes.get(node_id)
                if node:
                    print(f"  - {node.name} ({node.label.value}) in {node.path}")

        if overlaps:
            print(f"\nOverlapping pages: {len(overlaps)} pairs")
            for overlap in overlaps[:5]:  # Show first 5
                print(
                    f"  - {overlap['page1']} <-> {overlap['page2']}: "
                    f"{overlap['overlap_count']} nodes"
                )

    return stats


def get_module_tree(graph: Graph, base_dir: str) -> Dict[str, Any]:
    """
    Build a tree representation of modules in the codebase.

    Useful for understanding the module hierarchy when generating IA.

    Args:
        graph: Knowledge graph
        base_dir: Base directory of the codebase

    Returns:
        Dictionary representing the module tree
    """
    base_path = Path(base_dir).resolve()
    module_tree = {}

    # Collect all folders
    for node in graph.nodes.values():
        if node.label == NodeLabel.FOLDER:
            folder_path = Path(node.path).resolve()
            try:
                # Get relative path from base
                rel_path = folder_path.relative_to(base_path)
                parts = rel_path.parts

                # Build nested dict
                current = module_tree
                for part in parts:
                    if part not in current:
                        current[part] = {}
                    current = current[part]

            except ValueError:
                # Folder not under base_dir
                continue

    return module_tree


def format_module_tree(tree: Dict[str, Any], indent: int = 0) -> str:
    """
    Format module tree as a readable string.

    Args:
        tree: Module tree from get_module_tree()
        indent: Current indentation level

    Returns:
        Formatted tree string
    """
    lines = []
    for name, subtree in sorted(tree.items()):
        lines.append("  " * indent + f"{name}/")
        if subtree:
            lines.append(format_module_tree(subtree, indent + 1))

    return "\n".join(lines)
