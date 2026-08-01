"""
Tree structure generator for repositories.

Generates ASCII tree visualizations from the knowledge graph, showing:
- Folder hierarchy
- Files within folders
- Definition statistics (classes, functions, methods) per file
"""

from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from collections import defaultdict

from ..core.graph_model import Graph, Node, NodeLabel, EdgeType


class TreeNode:
    """Represents a node in the tree structure."""

    def __init__(self, node: Node, depth: int = 0):
        self.node = node
        self.depth = depth
        self.children: List[TreeNode] = []
        self.stats: Dict[str, int] = {}  # For file nodes: counts of classes/functions/methods

    def add_child(self, child: 'TreeNode'):
        self.children.append(child)

    def sort_children(self):
        """Sort children: folders first (alphabetically), then files (alphabetically)."""
        self.children.sort(key=lambda tn: (
            0 if tn.node.label == NodeLabel.FOLDER else 1,
            tn.node.name.lower()
        ))
        for child in self.children:
            child.sort_children()


def count_definitions_per_file(G: Graph) -> Dict[str, Dict[str, int]]:
    """
    Count the number of definitions (classes, functions, methods) for each file.

    Args:
        G: The knowledge graph

    Returns:
        Dict mapping file_id to counts: {"class": n, "function": m, "method": k}
    """
    file_def_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: {
        "class": 0,
        "function": 0,
        "method": 0
    })

    # Iterate through CONTAINS edges from file nodes to definition nodes
    for edge in G.edges:
        if edge.type != EdgeType.CONTAINS:
            continue

        src_node = G.nodes.get(edge.src)
        dst_node = G.nodes.get(edge.dst)

        if not src_node or not dst_node:
            continue

        # We want edges from FILE nodes to definition nodes
        if src_node.label == NodeLabel.FILE:
            if dst_node.label == NodeLabel.CLASS:
                file_def_counts[edge.src]["class"] += 1
            elif dst_node.label == NodeLabel.FUNCTION:
                file_def_counts[edge.src]["function"] += 1
            elif dst_node.label == NodeLabel.METHOD:
                file_def_counts[edge.src]["method"] += 1

    return dict(file_def_counts)


def build_tree_structure(G: Graph, root_path: str) -> Optional[TreeNode]:
    """
    Build a tree structure from the graph starting at the given root path.

    Args:
        G: The knowledge graph
        root_path: The root directory path to start from

    Returns:
        TreeNode representing the root, or None if root not found
    """
    # Find the root folder node
    root_path_resolved = str(Path(root_path).resolve())
    root_node = None

    for node in G.nodes.values():
        if node.label == NodeLabel.FOLDER:
            node_path_resolved = str(Path(node.path).resolve())
            if node_path_resolved == root_path_resolved:
                root_node = node
                break

    if not root_node:
        return None

    # Get definition counts per file
    file_stats = count_definitions_per_file(G)

    # Build adjacency list for CONTAINS edges
    children_map: Dict[str, List[str]] = defaultdict(list)
    for edge in G.edges:
        if edge.type == EdgeType.CONTAINS:
            children_map[edge.src].append(edge.dst)

    # Recursively build tree
    def build_subtree(node_id: str, depth: int) -> Optional[TreeNode]:
        node = G.nodes.get(node_id)
        if not node:
            return None

        # Only include folders and files in the tree (skip definition nodes)
        if node.label not in {NodeLabel.FOLDER, NodeLabel.FILE}:
            return None

        tree_node = TreeNode(node, depth)

        # Add statistics for file nodes
        if node.label == NodeLabel.FILE:
            tree_node.stats = file_stats.get(node_id, {"class": 0, "function": 0, "method": 0})

        # Add children
        for child_id in children_map.get(node_id, []):
            child_tree_node = build_subtree(child_id, depth + 1)
            if child_tree_node:
                tree_node.add_child(child_tree_node)

        tree_node.sort_children()
        return tree_node

    return build_subtree(root_node.id, 0)


def format_tree(
    tree_root: TreeNode,
    max_depth: Optional[int] = None,
    include_stats: bool = True,
    prefix: str = "",
    is_last: bool = True
) -> List[str]:
    """
    Format a tree structure as ASCII art with optional statistics.

    Args:
        tree_root: The root TreeNode to format
        max_depth: Maximum depth to display (None = unlimited)
        include_stats: Whether to include definition statistics for files
        prefix: Current line prefix (for recursion)
        is_last: Whether this is the last child (for recursion)

    Returns:
        List of formatted lines
    """
    lines = []

    # Check depth limit
    if max_depth is not None and tree_root.depth > max_depth:
        return lines

    # Format current node
    if tree_root.depth == 0:
        # Root node
        line = tree_root.node.name + "/"
    else:
        # Non-root node
        connector = "└── " if is_last else "├── "
        name = tree_root.node.name

        if tree_root.node.label == NodeLabel.FOLDER:
            name += "/"
        elif tree_root.node.label == NodeLabel.FILE and include_stats:
            # Add statistics for files
            stats_parts = []
            if tree_root.stats.get("class", 0) > 0:
                stats_parts.append(f"{tree_root.stats['class']} class" +
                                 ("es" if tree_root.stats['class'] != 1 else ""))
            if tree_root.stats.get("function", 0) > 0:
                stats_parts.append(f"{tree_root.stats['function']} function" +
                                 ("s" if tree_root.stats['function'] != 1 else ""))
            if tree_root.stats.get("method", 0) > 0:
                stats_parts.append(f"{tree_root.stats['method']} method" +
                                 ("s" if tree_root.stats['method'] != 1 else ""))

            if stats_parts:
                name += f" ({', '.join(stats_parts)})"

        line = prefix + connector + name

    lines.append(line)

    # Check depth limit for children
    if max_depth is not None and tree_root.depth >= max_depth:
        return lines

    # Format children
    for i, child in enumerate(tree_root.children):
        is_last_child = (i == len(tree_root.children) - 1)

        if tree_root.depth == 0:
            child_prefix = ""
        else:
            extension = "    " if is_last else "│   "
            child_prefix = prefix + extension

        lines.extend(format_tree(
            child,
            max_depth=max_depth,
            include_stats=include_stats,
            prefix=child_prefix,
            is_last=is_last_child
        ))

    return lines


def generate_tree_from_graph(
    G: Graph,
    root_path: str,
    max_depth: Optional[int] = None,
    include_stats: bool = True,
    include_summary: bool = True
) -> str:
    """
    Generate a tree structure from the knowledge graph.

    Args:
        G: The knowledge graph
        root_path: Repository root path
        max_depth: Maximum depth to display (None = unlimited)
        include_stats: Whether to include definition counts per file
        include_summary: Whether to include summary statistics at the end

    Returns:
        Formatted tree string
    """
    tree_root = build_tree_structure(G, root_path)

    if not tree_root:
        return f"Error: Could not find root folder at {root_path}"

    lines = format_tree(tree_root, max_depth=max_depth, include_stats=include_stats)

    # Add summary statistics
    if include_summary:
        lines.append("")

        # Count totals
        total_folders = 0
        total_files = 0
        total_classes = 0
        total_functions = 0
        total_methods = 0

        def count_nodes(tn: TreeNode):
            nonlocal total_folders, total_files, total_classes, total_functions, total_methods

            if tn.node.label == NodeLabel.FOLDER:
                total_folders += 1
            elif tn.node.label == NodeLabel.FILE:
                total_files += 1
                total_classes += tn.stats.get("class", 0)
                total_functions += tn.stats.get("function", 0)
                total_methods += tn.stats.get("method", 0)

            for child in tn.children:
                count_nodes(child)

        count_nodes(tree_root)

        lines.append("Summary:")
        lines.append(f"  Folders: {total_folders}")
        lines.append(f"  Files: {total_files}")
        lines.append(f"  Classes: {total_classes}")
        lines.append(f"  Functions: {total_functions}")
        lines.append(f"  Methods: {total_methods}")
        lines.append(f"  Total definitions: {total_classes + total_functions + total_methods}")

    return "\n".join(lines)


def save_tree_to_file(
    G: Graph,
    root_path: str,
    output_path: str,
    max_depth: Optional[int] = None,
    include_stats: bool = True,
    include_summary: bool = True
):
    """
    Generate and save a tree structure to a file.

    Args:
        G: The knowledge graph
        root_path: Repository root path
        output_path: Path to save the tree output
        max_depth: Maximum depth to display (None = unlimited)
        include_stats: Whether to include definition counts per file
        include_summary: Whether to include summary statistics
    """
    tree_str = generate_tree_from_graph(
        G, root_path,
        max_depth=max_depth,
        include_stats=include_stats,
        include_summary=include_summary
    )

    Path(output_path).write_text(tree_str, encoding='utf-8')
    print(f"Tree saved to {output_path}")
