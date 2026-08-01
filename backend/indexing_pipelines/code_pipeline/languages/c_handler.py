"""
C Language Handler

Implements language-specific operations for C code using Tree-sitter and clangd LSP.
"""

import shutil
from bisect import bisect_right
from pathlib import Path
from typing import List, Optional, Tuple

import tree_sitter_c
from tree_sitter import Language as TS_Language
from tree_sitter import Parser, QueryCursor

from indexing_pipelines.code_pipeline.core.graph_model import Node, NodeLabel
from indexing_pipelines.code_pipeline.languages.language_handler import LanguageHandler

# C keywords for identifier filtering
C_KEYWORDS = {
    "auto", "break", "case", "char", "const", "continue", "default", "do",
    "double", "else", "enum", "extern", "float", "for", "goto", "if",
    "inline", "int", "long", "register", "restrict", "return", "short",
    "signed", "sizeof", "static", "struct", "switch", "typedef", "union",
    "unsigned", "void", "volatile", "while", "_Alignas", "_Alignof",
    "_Atomic", "_Bool", "_Complex", "_Generic", "_Imaginary", "_Noreturn",
    "_Static_assert", "_Thread_local", "NULL", "true", "false",
}


class CHandler(LanguageHandler):
    """Handler for C language (.c, .h files)"""

    def __init__(self):
        super().__init__()
        self.language = TS_Language(tree_sitter_c.language())
        self.parser = Parser(self.language)

    def get_file_extensions(self) -> List[str]:
        return [".c"]  # .h handled by CppHandler (C++ superset)

    def get_tree_sitter_language(self) -> TS_Language:
        return self.language

    def extract_definitions(self, file_path: str, source_code: str) -> List[Node]:
        """
        Extract C structs, enums, and functions using Tree-sitter.

        C has no classes, so we extract:
        - struct_specifier (named structs) -> CLASS nodes
        - enum_specifier (named enums) -> CLASS nodes
        - function_definition (top-level functions) -> FUNCTION nodes
        """
        tree = self.parser.parse(source_code.encode("utf-8"))
        root = tree.root_node
        code_bytes = source_code.encode("utf-8")

        def text(node):
            return code_bytes[node.start_byte : node.end_byte].decode("utf-8")

        def char_to_line_indices(src: str):
            starts = [0]
            for i, ch in enumerate(src):
                if ch == "\n":
                    starts.append(i + 1)
            return starts

        def byte_to_char_index(byte_idx: int) -> int:
            return len(code_bytes[:byte_idx].decode("utf-8"))

        line_starts = char_to_line_indices(source_code)
        resolved_path = str(Path(file_path).resolve())

        # Compute repo-relative path for stable node IDs
        if self.repo_root:
            try:
                rel_path = (
                    Path(file_path)
                    .resolve()
                    .relative_to(Path(self.repo_root).resolve())
                )
                rel_path_str = str(rel_path).replace("\\", "/")
            except ValueError:
                rel_path_str = Path(file_path).name
        else:
            rel_path_str = Path(file_path).name

        nodes: List[Node] = []
        seen_ids: set[str] = set()

        def def_id(label: NodeLabel, name: str) -> str:
            return f"{label.value}:{rel_path_str}:{name}"

        def get_line_range(node):
            start_b, end_b = node.start_byte, node.end_byte
            start_c = byte_to_char_index(start_b)
            end_c = byte_to_char_index(end_b)
            start_line = bisect_right(line_starts, start_c) - 1
            end_line = bisect_right(line_starts, max(0, end_c - 1)) - 1
            return start_line, end_line

        def traverse(node):
            # Extract named structs: struct Name { ... }
            if node.type == "struct_specifier":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = text(name_node)
                    start_line, end_line = get_line_range(node)
                    node_id = def_id(NodeLabel.CLASS, name)
                    if node_id not in seen_ids:
                        nodes.append(Node(
                            id=node_id,
                            label=NodeLabel.CLASS,
                            path=resolved_path,
                            name=name,
                            start_line=start_line,
                            end_line=end_line,
                            extra={"kind": "struct"},
                        ))
                        seen_ids.add(node_id)

            # Extract named enums: enum Name { ... }
            elif node.type == "enum_specifier":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = text(name_node)
                    start_line, end_line = get_line_range(node)
                    node_id = def_id(NodeLabel.CLASS, name)
                    if node_id not in seen_ids:
                        nodes.append(Node(
                            id=node_id,
                            label=NodeLabel.CLASS,
                            path=resolved_path,
                            name=name,
                            start_line=start_line,
                            end_line=end_line,
                            extra={"kind": "enum"},
                        ))
                        seen_ids.add(node_id)

            # Extract typedef'd anonymous structs/enums: typedef struct { ... } Name;
            elif node.type == "type_definition":
                type_node = node.child_by_field_name("type")
                if type_node and type_node.type in {"struct_specifier", "enum_specifier"}:
                    # Check if the struct/enum is anonymous (no name)
                    inner_name = type_node.child_by_field_name("name")
                    if not inner_name:
                        # Get name from typedef declarator
                        declarator = node.child_by_field_name("declarator")
                        if declarator and declarator.type == "type_identifier":
                            name = text(declarator)
                            start_line, end_line = get_line_range(node)
                            kind = "struct" if type_node.type == "struct_specifier" else "enum"
                            node_id = def_id(NodeLabel.CLASS, name)
                            if node_id not in seen_ids:
                                nodes.append(Node(
                                    id=node_id,
                                    label=NodeLabel.CLASS,
                                    path=resolved_path,
                                    name=name,
                                    start_line=start_line,
                                    end_line=end_line,
                                    extra={"kind": kind},
                                ))
                                seen_ids.add(node_id)

            # Extract function definitions
            elif node.type == "function_definition":
                # Get function name from declarator
                declarator = node.child_by_field_name("declarator")
                if declarator:
                    # Navigate to the identifier (function name)
                    name_node = self._find_function_name(declarator)
                    if name_node:
                        name = text(name_node)
                        start_line, end_line = get_line_range(node)
                        node_id = def_id(NodeLabel.FUNCTION, name)
                        if node_id not in seen_ids:
                            nodes.append(Node(
                                id=node_id,
                                label=NodeLabel.FUNCTION,
                                path=resolved_path,
                                name=name,
                                start_line=start_line,
                                end_line=end_line,
                            ))
                            seen_ids.add(node_id)

            # Recurse into children
            for child in node.children:
                traverse(child)

        traverse(root)
        return nodes

    def _find_function_name(self, declarator) -> Optional[object]:
        """Navigate declarator tree to find the function identifier."""
        if declarator.type == "identifier":
            return declarator
        if declarator.type == "function_declarator":
            inner = declarator.child_by_field_name("declarator")
            if inner:
                return self._find_function_name(inner)
        if declarator.type == "pointer_declarator":
            inner = declarator.child_by_field_name("declarator")
            if inner:
                return self._find_function_name(inner)
        if declarator.type == "parenthesized_declarator":
            for child in declarator.children:
                result = self._find_function_name(child)
                if result:
                    return result
        return None

    def get_lsp_server_command(self) -> List[str]:
        """Return command to launch clangd LSP server."""
        cmd = shutil.which("clangd")
        # if not cmd:
        #     # Check common Windows installation paths
        #     common_paths = [
        #         Path("C:/Program Files/LLVM/bin/clangd.exe"),
        #         Path("C:/Program Files (x86)/LLVM/bin/clangd.exe"),
        #         Path.home() / "AppData/Local/Programs/LLVM/bin/clangd.exe",
        #         # Android Studio bundled clangd
        #         Path("C:/Program Files/Android/Android Studio/plugins/c-clangd/bin/clang/win/x64/bin/clangd.exe"),
        #     ]
        #     for path in common_paths:
        #         if path.exists():
        #             cmd = str(path)
        #             break
        if not cmd:
            raise FileNotFoundError(
                "clangd not found. Install LLVM/Clang or use your system package manager."
            )
        return [cmd]

    def get_lsp_language_id(self) -> str:
        return "c"

    def collect_identifiers(
        self,
        file_path: str,
        source_code: str,
        start_line: int,
        end_line: int,
    ) -> List[Tuple[str, int, int]]:
        """
        Extract call-site identifiers from C code for LSP queries.
        """
        tree = self.parser.parse(source_code.encode("utf-8"))
        root = tree.root_node
        code_bytes = source_code.encode("utf-8")

        line_starts = [0]
        for i, byte in enumerate(code_bytes):
            if byte == ord("\n"):
                line_starts.append(i + 1)

        out: List[Tuple[str, int, int]] = []
        seen = set()

        def traverse(node):
            # Look for call_expression nodes
            if node.type == "call_expression":
                func_node = node.child_by_field_name("function")
                if func_node:
                    # Get the identifier being called
                    ident = self._get_call_identifier(func_node, code_bytes)
                    if ident:
                        name, start_byte = ident
                        ident_line = bisect_right(line_starts, start_byte) - 1
                        if start_line <= ident_line <= end_line:
                            if name not in C_KEYWORDS and name not in seen:
                                seen.add(name)
                                line_start_byte = (
                                    line_starts[ident_line]
                                    if ident_line < len(line_starts)
                                    else 0
                                )
                                col = start_byte - line_start_byte
                                out.append((name, ident_line, col))

            for child in node.children:
                traverse(child)

        traverse(root)
        return out

    def _get_call_identifier(self, func_node, code_bytes) -> Optional[Tuple[str, int]]:
        """Extract identifier name and position from a call function node."""
        if func_node.type == "identifier":
            name = code_bytes[func_node.start_byte : func_node.end_byte].decode("utf-8")
            return (name, func_node.start_byte)
        elif func_node.type == "field_expression":
            # obj->method() or obj.method()
            field = func_node.child_by_field_name("field")
            if field and field.type == "field_identifier":
                name = code_bytes[field.start_byte : field.end_byte].decode("utf-8")
                return (name, field.start_byte)
        return None

    def extract_class_header(
        self, node: Node, source_code: str
    ) -> Optional[str]:
        """
        Extract C struct/enum definition for vectorization.

        For C, we extract the full struct/enum definition since they're
        typically compact (just field declarations).
        """
        if node.label != NodeLabel.CLASS:
            return None

        tree = self.parser.parse(source_code.encode("utf-8"))
        root = tree.root_node
        code_bytes = source_code.encode("utf-8")

        def text(ts_node):
            return code_bytes[ts_node.start_byte : ts_node.end_byte].decode("utf-8")

        # Find the struct/enum matching our line range
        target_node = self._find_type_node(
            root, node.start_line or 0, node.end_line or 0
        )

        if target_node:
            return text(target_node)

        # Fallback: extract lines directly
        lines = source_code.splitlines()
        start = node.start_line or 0
        end = node.end_line or start
        if start < len(lines):
            return "\n".join(lines[start : end + 1])
        return None

    def _find_type_node(self, root, start_line: int, end_line: int):
        """Find struct_specifier or enum_specifier matching line range."""
        def traverse(ts_node):
            if ts_node.type in {"struct_specifier", "enum_specifier"}:
                node_start = ts_node.start_point[0]
                node_end = ts_node.end_point[0]
                if node_start == start_line and node_end == end_line:
                    return ts_node

            for child in ts_node.children:
                result = traverse(child)
                if result:
                    return result
            return None

        return traverse(root)
