"""
LSP-based edge builders for the knowledge graph.

This module provides functionality to add CALLS and IMPORTS edges to the graph
by using LSP (Language Server Protocol) to resolve symbols and dependencies.

Now supports multi-language codebases via LSPManager.
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set
from collections import defaultdict
from urllib.parse import urlparse, unquote
import ast

from ..core.graph_model import Graph, Node, NodeLabel, EdgeType
from .lsp_client import to_lsp_pos
from .lsp_manager import LSPManager


def _uri_to_path(uri: str) -> Path:
    """Convert a file:// URI to a filesystem Path."""
    if uri.startswith("file://"):
        parsed = urlparse(uri)
        # On Windows, the path will be like /C:/Users/... so remove leading /
        path_str = unquote(parsed.path)
        if path_str.startswith("/") and len(path_str) > 2 and path_str[2] == ":":
            path_str = path_str[1:]  # Remove leading / on Windows
        return Path(path_str)
    return Path(uri)


def build_span_index(graph: Graph) -> Dict[str, List[Tuple[int, int, str]]]:
    """
    Build a span index mapping file URIs to definition node spans.

    Returns a dictionary where:
    - Key: file URI (e.g., "file:///C:/path/to/file.py")
    - Value: List of (start_line, end_line, node_id) tuples, sorted by start_line

    This index is used to map LSP Location objects back to graph Node IDs.
    When LSP returns a location like "file.py:line 42", we can look up which
    definition node (class/function/method) contains that line.

    Args:
        graph: The knowledge graph containing nodes

    Returns:
        Dictionary mapping file URIs to lists of span tuples
    """
    index: Dict[str, List[Tuple[int, int, str]]] = defaultdict(list)

    for node in graph.nodes.values():
        # Only index definition nodes (not folders or files)
        if node.label in {NodeLabel.CLASS, NodeLabel.FUNCTION, NodeLabel.METHOD}:
            # Skip nodes without valid line numbers
            if node.start_line is None or node.end_line is None:
                continue

            # Convert filesystem path to file URI (or use existing URI)
            if node.path.startswith("file://"):
                # Already a URI
                uri = node.path
            else:
                # Filesystem path - convert to URI
                uri = Path(node.path).as_uri()

            # Normalize URI for consistent lookup
            uri = normalize_uri(uri)
            index[uri].append((node.start_line, node.end_line, node.id))

    # Sort by start_line for efficient lookup
    for uri in index:
        index[uri].sort(key=lambda x: x[0])

    return dict(index)


def map_location_to_node(span_index: Dict[str, List[Tuple[int, int, str]]],
                         uri: str,
                         line: int) -> Optional[str]:
    """
    Find the node ID that contains the given line in the specified file.

    This function is critical for mapping LSP definition results back to our graph nodes.
    When LSP tells us "the definition is at file.py:line 42", we need to find which
    CLASS/FUNCTION/METHOD node in our graph contains line 42.

    Args:
        span_index: The span index built by build_span_index()
        uri: File URI (e.g., "file:///C:/path/to/file.py")
        line: Line number (0-based or 1-based, depending on LSP response)

    Returns:
        Node ID if found, None otherwise
    """
    # Normalize URI to match span index format
    uri = normalize_uri(uri)
    spans = span_index.get(uri, [])

    # Find the most specific (smallest) span that contains the line
    # This is important because class spans contain method spans,
    # and we want to return the method, not the class
    best_match = None
    best_span_size = float('inf')

    for start, end, node_id in spans:
        if start <= line <= end:
            span_size = end - start
            if span_size < best_span_size:
                best_match = node_id
                best_span_size = span_size

    return best_match


def add_imports_edges(graph: Graph, lsp_manager: LSPManager) -> int:
    """
    Add IMPORTS edges between file nodes based on import statements.

    Process:
    1. For each FILE node in the graph
    2. Parse the file's import statements using Python's AST
    3. For each import, try to resolve it to a file in the graph
    4. If found, add IMPORTS edge

    Note: Currently implements Python imports. Can be extended for other languages
    by using language-specific import parsers.

    Args:
        graph: The knowledge graph to add edges to
        lsp_manager: LSP manager for multi-language support

    Returns:
        Number of IMPORTS edges added
    """
    edges_added = 0

    # Iterate through all FILE nodes
    file_nodes = [n for n in graph.nodes.values() if n.label == NodeLabel.FILE]

    for file_node in file_nodes:
        try:
            # Read the file content
            if file_node.path.startswith("file://"):
                file_path = _uri_to_path(file_node.path)
            else:
                file_path = Path(file_node.path)
            content = file_path.read_text(encoding='utf-8')

            # Parse with AST to find imports
            tree = ast.parse(content, filename=str(file_path))

            # Collect all import statements
            for node in ast.walk(tree):
                imported_modules = []

                if isinstance(node, ast.Import):
                    # import foo, bar
                    for alias in node.names:
                        imported_modules.append(alias.name)

                elif isinstance(node, ast.ImportFrom):
                    # from foo import bar
                    # We want to import the module 'foo', not 'bar'
                    if node.module:
                        imported_modules.append(node.module)

                # Resolve each imported module to a file
                for module_name in imported_modules:
                    target_file_id = _resolve_import_to_file_node(
                        graph, file_path, module_name
                    )

                    if target_file_id:
                        # Add IMPORTS edge: source file -> target file
                        graph.add_edge(file_node.id, target_file_id, EdgeType.IMPORTS)
                        edges_added += 1

        except Exception as e:
            # Skip files that can't be parsed (syntax errors, encoding issues, etc.)
            continue

    return edges_added


def _resolve_import_to_file_node(graph: Graph,
                                  source_file: Path,
                                  module_name: str) -> Optional[str]:
    """
    Resolve a module name to a file node ID in the graph.

    This handles relative and absolute imports within the project.
    For example:
    - "foo" -> looks for foo.py or foo/__init__.py
    - "foo.bar" -> looks for foo/bar.py or foo/bar/__init__.py
    - Relative imports would need the source file's location

    Args:
        graph: The knowledge graph
        source_file: The file doing the importing
        module_name: The module being imported (e.g., "foo.bar")

    Returns:
        File node ID if found in graph, None otherwise
    """
    # Convert module name to possible file paths
    # e.g., "foo.bar" -> ["foo/bar.py", "foo/bar/__init__.py"]
    module_path = module_name.replace('.', '/')

    # Get the project root (parent directories to search)
    # Start from the source file's directory and work up
    search_dirs = [source_file.parent]
    current = source_file.parent
    for _ in range(10):  # Search up to 10 levels up
        current = current.parent
        if current.exists():
            search_dirs.append(current)
        else:
            break

    # Possible file variations
    possible_files = [
        f"{module_path}.py",
        f"{module_path}/__init__.py",
    ]

    # Try to find the file in the graph
    for search_dir in search_dirs:
        for possible_file in possible_files:
            candidate_path = search_dir / possible_file

            # Normalize and check if this file exists in our graph
            try:
                if candidate_path.exists():
                    # Convert to URI for comparison with graph nodes
                    candidate_uri = candidate_path.as_uri()

                    # Look for a FILE node with this path
                    for node in graph.nodes.values():
                        if node.label == NodeLabel.FILE:
                            # Handle both URI and filesystem path
                            if node.path.startswith("file://"):
                                node_uri = node.path
                            else:
                                node_uri = Path(node.path).as_uri()
                            if node_uri == candidate_uri:
                                return node.id
            except:
                continue

    return None


def add_calls_edges(graph: Graph,
                    lsp_manager: LSPManager,
                    span_index: Dict[str, List[Tuple[int, int, str]]],
                    debug: bool = False) -> int:
    """
    Add CALLS edges between definition nodes based on function/method calls.

    Process:
    1. For each definition node (CLASS/FUNCTION/METHOD)
    2. Use language handler to extract identifiers from the node's code
    3. For each identifier:
       a. Query LSP definition() to resolve it (using the correct LSP server for the file)
       b. Map the LSP Location back to a Node ID using span_index
       c. Add CALLS edge from caller to callee

    Now supports multi-language codebases by routing files to appropriate LSP servers.

    Args:
        graph: The knowledge graph to add edges to
        lsp_manager: LSP manager providing language-specific LSP clients
        span_index: Mapping from file URIs to definition spans
        debug: Enable debug logging

    Returns:
        Number of CALLS edges added
    """
    edges_added = 0
    identifiers_found = 0
    lsp_resolved = 0
    mapped_to_nodes = 0

    # Get all executable definition nodes (FUNCTION, METHOD)
    # Note: CLASS nodes are NOT included because classes don't execute code
    def_nodes = [n for n in graph.nodes.values()
                 if n.label in {NodeLabel.FUNCTION, NodeLabel.METHOD}]

    if debug:
        print(f"  [DEBUG] Processing {len(def_nodes)} definition nodes for CALLS edges")
        print(f"  [DEBUG] Span index contains {len(span_index)} URIs:")
        for uri in list(span_index.keys())[:3]:  # Show first 3
            print(f"  [DEBUG]   - {uri}")

    for caller_node in def_nodes:
        try:
            # Skip nodes without line numbers
            if caller_node.start_line is None or caller_node.end_line is None:
                continue

            # Read the node's code
            if caller_node.path.startswith("file://"):
                # Already a URI - convert to filesystem path
                file_uri = caller_node.path
                file_path = _uri_to_path(caller_node.path)
            else:
                # Filesystem path
                file_path = Path(caller_node.path)
                file_uri = file_path.as_uri()
            content = file_path.read_text(encoding='utf-8')

            # Get the appropriate LSP client and handler for this file
            try:
                lsp_client, handler = lsp_manager.get_client_for_file(caller_node.path)
            except KeyError:
                # No handler for this file type, skip
                continue

            # Get identifiers using language-specific handler
            identifiers = handler.collect_identifiers(
                caller_node.path,
                content,
                caller_node.start_line,
                caller_node.end_line
            )

            identifiers_found += len(identifiers)
            if debug and identifiers:
                print(f"  [DEBUG] Found {len(identifiers)} identifiers in {caller_node.name} ({caller_node.label.value})")

            # For each identifier, try to resolve its definition
            for ident_name, line, col in identifiers:
                # Skip very common keywords/builtins that won't be in our graph
                if ident_name in {'self', 'cls', 'super', 'print', 'len', 'range',
                                  'str', 'int', 'list', 'dict', 'set', 'tuple',
                                  'True', 'False', 'None', 'if', 'for', 'while'}:
                    continue

                try:
                    # Convert to LSP position (0-based line, UTF-16 column)
                    lsp_pos = to_lsp_pos(content, line, col)

                    # Query LSP for definition
                    result = lsp_client.definition(file_uri, lsp_pos, debug=True)

                    # Handle both single Location and Location[]
                    if result is None:
                        if debug and caller_node.name in ['add', 'multiply', 'subtract', '_validate', '_log_operation']:
                            print(f"  [DEBUG] LSP returned None for '{ident_name}' in {caller_node.name} at line {line}")
                        continue

                    lsp_resolved += 1
                    locations = result if isinstance(result, list) else [result]

                    # Process each location (usually just one)
                    for loc in locations:
                        if not loc or 'uri' not in loc or 'range' not in loc:
                            continue

                        target_uri = loc['uri']
                        target_line = loc['range']['start']['line']

                        # Debug: show first LSP URI
                        if debug and lsp_resolved == 1:
                            print(f"  [DEBUG] Example LSP URI: {target_uri}")

                        # Map the location to a node in our graph
                        target_node_id = map_location_to_node(
                            span_index,
                            target_uri,
                            target_line
                        )

                        if debug and target_node_id is None and caller_node.name in ['add', 'multiply', 'subtract', '_validate']:
                            print(f"  [DEBUG] Failed to map LSP location to node: {ident_name} -> {target_uri}:{target_line}")

                        if target_node_id:
                            mapped_to_nodes += 1

                            # Don't create CALLS edges to CLASS nodes
                            # (class references aren't function calls)
                            target_node = graph.nodes.get(target_node_id)
                            if target_node and target_node.label == NodeLabel.CLASS:
                                if debug:
                                    print(f"  [DEBUG] Skipping CALLS edge to CLASS: {caller_node.name} -> {target_node.name}")
                                continue

                            if target_node_id != caller_node.id:
                                # Add CALLS edge: caller -> callee
                                graph.add_edge(
                                    caller_node.id,
                                    target_node_id,
                                    EdgeType.CALLS
                                )
                                edges_added += 1
                                if debug:
                                    print(f"  [DEBUG] CALLS edge: {caller_node.name} -> {graph.nodes[target_node_id].name}")

                except Exception:
                    # Skip identifiers that can't be resolved
                    continue

        except Exception:
            # Skip nodes that can't be processed
            continue

    if debug:
        print(f"  [DEBUG] Summary:")
        print(f"  [DEBUG]   - Identifiers found: {identifiers_found}")
        print(f"  [DEBUG]   - LSP resolved: {lsp_resolved}")
        print(f"  [DEBUG]   - Mapped to nodes: {mapped_to_nodes}")
        print(f"  [DEBUG]   - CALLS edges created: {edges_added}")

    return edges_added


# Helper function for URI normalization
def normalize_uri(uri: str) -> str:
    """
    Normalize a file URI to a consistent format.

    Handles differences in URI formatting across platforms and LSP servers.
    For example, ensures consistent casing for drive letters on Windows.

    Args:
        uri: File URI to normalize

    Returns:
        Normalized URI (lowercase, URL-decoded)
    """
    # URL decode first (e.g., %3A -> :)
    uri = unquote(uri)

    # Normalize to lowercase for case-insensitive comparison on Windows
    uri = uri.lower()

    return uri
