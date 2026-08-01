"""
TypeScript/JavaScript Language Handler

Implements language-specific operations for TypeScript and JavaScript code
using Tree-sitter and typescript-language-server LSP.

Handles both TypeScript (.ts, .tsx) and JavaScript (.js, .jsx) files.
"""

import platform
import re
import shutil
from bisect import bisect_right
from pathlib import Path
from typing import List, Optional, Tuple

import tree_sitter_typescript
from tree_sitter import Language as TS_Language
from tree_sitter import Parser, Query, QueryCursor

from indexing_pipelines.code_pipeline.core.graph_model import Node, NodeLabel
from indexing_pipelines.code_pipeline.languages.language_handler import LanguageHandler

# JavaScript/TypeScript keywords for identifier filtering
JS_TS_KEYWORDS = {
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "new",
    "null",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "let",
    "static",
    "implements",
    "interface",
    "package",
    "private",
    "protected",
    "public",
    "yield",
    "async",
    "await",
    "type",
    "namespace",
    "declare",
    "abstract",
    "as",
    "from",
    "get",
    "set",
    "readonly",
    "require",
    "module",
    "exports",
}

IDENT = re.compile(r"[A-Za-z_$][A-Za-z0-9_$]*")


class TypeScriptHandler(LanguageHandler):
    """Handler for TypeScript and JavaScript (.ts, .tsx, .js, .jsx files)"""

    def __init__(self):
        super().__init__()
        # Load TypeScript Tree-sitter grammar (handles both TS and JS)
        self.ts_language = TS_Language(tree_sitter_typescript.language_typescript())
        self.tsx_language = TS_Language(tree_sitter_typescript.language_tsx())
        self.ts_parser = Parser(self.ts_language)
        self.tsx_parser = Parser(self.tsx_language)

    def get_file_extensions(self) -> List[str]:
        return [".ts", ".tsx", ".js", ".jsx"]

    def _get_parser_for_file(self, file_path: str) -> Parser:
        """Select appropriate parser based on file extension"""
        ext = Path(file_path).suffix.lower()
        if ext in {".tsx", ".jsx"}:
            return self.tsx_parser
        return self.ts_parser

    def get_tree_sitter_language(self) -> TS_Language:
        # Return TypeScript as the primary language
        return self.ts_language

    def extract_definitions(self, file_path: str, source_code: str) -> List[Node]:
        """
        Extract TypeScript/JavaScript classes, functions, and methods using Tree-sitter.

        Uses TypeScript/JavaScript-specific AST queries:
        - class_declaration with method_definition (methods)
        - function_declaration (top-level functions)
        - arrow functions assigned to const (common pattern)
        - Handles export declarations

        Returns:
            List of Node objects with accurate line ranges
        """
        parser = self._get_parser_for_file(file_path)
        tree = parser.parse(source_code.encode("utf-8"))
        root = tree.root_node
        code_bytes = source_code.encode("utf-8")

        def text(node):
            return code_bytes[node.start_byte : node.end_byte].decode("utf-8")

        def first(x):
            return x[0] if isinstance(x, list) else x

        def char_to_line_indices(src: str):
            starts = [0]
            for i, ch in enumerate(src):
                if ch == "\n":
                    starts.append(i + 1)
            return starts

        def byte_to_char_index(byte_idx: int) -> int:
            return len(code_bytes[:byte_idx].decode("utf-8"))

        line_starts = char_to_line_indices(source_code)
        # Use resolved filesystem path (consistent with FILE nodes in code_indexing.py)
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
                # File outside repo - use basename as fallback
                rel_path_str = Path(file_path).name
        else:
            # No repo_root set - use basename
            rel_path_str = Path(file_path).name

        # Query for classes with methods
        q_methods = Query(
            self.ts_language,
            r"""
        (class_declaration
          name: (type_identifier) @class.name
          body: (class_body
            (method_definition
              name: (property_identifier) @method.name) @method.def
          )) @class.def
        """,
        )

        # Query for top-level functions
        q_functions = Query(
            self.ts_language,
            r"""
        [
          (function_declaration
            name: (identifier) @func.name) @func.def
          (export_statement
            declaration: (function_declaration
              name: (identifier) @func.name) @func.def)
        ]
        """,
        )

        # Query for arrow functions (const foo = () => {})
        q_arrow_functions = Query(
            self.ts_language,
            r"""
        (lexical_declaration
          (variable_declarator
            name: (identifier) @func.name
            value: (arrow_function) @func.def))
        """,
        )

        nodes: List[Node] = []

        # Helper: stable node IDs (repo-relative, no line numbers)
        def def_id(label: NodeLabel, name: str, class_name: str = "") -> str:
            if class_name:
                # Method: include class name for uniqueness
                return f"{label.value}:{rel_path_str}:{class_name}.{name}"
            else:
                # Class or top-level function
                return f"{label.value}:{rel_path_str}:{name}"

        # Track classes and functions we've seen (to avoid duplicates)
        have_class: set[str] = set()
        have_function: set[str] = set()

        # Extract classes and methods
        for _, caps in QueryCursor(q_methods).matches(root):
            # Class captures
            cls_name_node = caps["class.name"][0]
            cls_def_node = caps["class.def"][0]

            cls_name = text(cls_name_node)

            c_start_b, c_end_b = cls_def_node.start_byte, cls_def_node.end_byte
            c_start_c, c_end_c = (
                byte_to_char_index(c_start_b),
                byte_to_char_index(c_end_b),
            )
            # Store 0-indexed line numbers (subtract 1 from bisect_right which returns 1-indexed)
            c_start_line = bisect_right(line_starts, c_start_c) - 1
            c_end_line = bisect_right(line_starts, max(0, c_end_c - 1)) - 1

            class_id = def_id(NodeLabel.CLASS, cls_name)
            if class_id not in have_class:
                nodes.append(
                    Node(
                        id=class_id,
                        label=NodeLabel.CLASS,
                        path=resolved_path,
                        name=cls_name,
                        start_line=c_start_line,
                        end_line=c_end_line,
                    )
                )
                have_class.add(class_id)

            # Method captures
            name_nodes = caps.get("method.name", [])
            def_nodes = caps.get("method.def", [])
            if not isinstance(name_nodes, list):
                name_nodes = [name_nodes] if name_nodes else []
            if not isinstance(def_nodes, list):
                def_nodes = [def_nodes] if def_nodes else []

            for name_node, def_node in zip(name_nodes, def_nodes):
                m_name = text(name_node)

                m_start_b, m_end_b = def_node.start_byte, def_node.end_byte
                m_start_c, m_end_c = (
                    byte_to_char_index(m_start_b),
                    byte_to_char_index(m_end_b),
                )
                # Store 0-indexed line numbers
                m_start_line = bisect_right(line_starts, m_start_c) - 1
                m_end_line = bisect_right(line_starts, max(0, m_end_c - 1)) - 1

                method_id = def_id(NodeLabel.METHOD, m_name, class_name=cls_name)
                nodes.append(
                    Node(
                        id=method_id,
                        label=NodeLabel.METHOD,
                        path=resolved_path,
                        name=m_name,
                        start_line=m_start_line,
                        end_line=m_end_line,
                        extra={"class": cls_name},
                    )
                )

        # Extract top-level functions
        cursor = QueryCursor(q_functions)
        for _, caps in cursor.matches(root):
            func_name_node = first(caps["func.name"])
            def_node = first(caps["func.def"])

            f_name = text(func_name_node)
            f_start_b, f_end_b = def_node.start_byte, def_node.end_byte
            f_start_c, f_end_c = (
                byte_to_char_index(f_start_b),
                byte_to_char_index(f_end_b),
            )
            # Store 0-indexed line numbers
            f_start_line = bisect_right(line_starts, f_start_c) - 1
            f_end_line = bisect_right(line_starts, max(0, f_end_c - 1)) - 1

            func_id = def_id(NodeLabel.FUNCTION, f_name)
            if func_id not in have_function:
                nodes.append(
                    Node(
                        id=func_id,
                        label=NodeLabel.FUNCTION,
                        path=resolved_path,
                        name=f_name,
                        start_line=f_start_line,
                        end_line=f_end_line,
                    )
                )
                have_function.add(func_id)

        # Extract arrow functions
        cursor = QueryCursor(q_arrow_functions)
        for _, caps in cursor.matches(root):
            func_name_node = first(caps["func.name"])
            def_node = first(caps["func.def"])

            f_name = text(func_name_node)
            f_start_b, f_end_b = def_node.start_byte, def_node.end_byte
            f_start_c, f_end_c = (
                byte_to_char_index(f_start_b),
                byte_to_char_index(f_end_b),
            )
            # Store 0-indexed line numbers
            f_start_line = bisect_right(line_starts, f_start_c) - 1
            f_end_line = bisect_right(line_starts, max(0, f_end_c - 1)) - 1

            func_id = def_id(NodeLabel.FUNCTION, f_name)
            if func_id not in have_function:
                nodes.append(
                    Node(
                        id=func_id,
                        label=NodeLabel.FUNCTION,
                        path=resolved_path,
                        name=f_name,
                        start_line=f_start_line,
                        end_line=f_end_line,
                    )
                )
                have_function.add(func_id)

        return nodes

    def get_lsp_server_command(self) -> List[str]:
        """Return command to launch typescript-language-server"""
        # On Windows, npm creates .cmd wrappers
        if platform.system() == "Windows":
            # Try .cmd first (npm wrapper), then plain name
            cmd = shutil.which("typescript-language-server.cmd") or shutil.which(
                "typescript-language-server"
            )
        else:
            cmd = shutil.which("typescript-language-server")

        if not cmd:
            raise FileNotFoundError(
                "typescript-language-server not found. Install with: npm install -g typescript-language-server typescript"
            )

        return [cmd, "--stdio"]

    def get_lsp_language_id(self) -> str:
        """
        Return LSP language identifier.

        Note: TypeScript LSP server handles both 'typescript' and 'javascript'.
        We return 'typescript' as the primary identifier.
        """
        return "typescript"

    def collect_identifiers(
        self,
        file_path: str,
        source_code: str,
        start_line: int,
        end_line: int
    ) -> List[Tuple[str, int, int]]:
        """
        Extract identifiers from a TypeScript/JavaScript code range for LSP queries.

        Uses Tree-sitter to extract only identifiers from actual code,
        excluding comments, docstrings, and string literals.

        Args:
            file_path: Path to the source file (used to select TS vs TSX parser)
            source_code: Full source code of the file
            start_line: Starting line number (0-indexed)
            end_line: Ending line number (0-indexed, inclusive)

        Returns:
            List of (identifier_name, line, column) tuples
        """
        parser = self._get_parser_for_file(file_path)
        tree = parser.parse(source_code.encode('utf-8'))
        root = tree.root_node
        code_bytes = source_code.encode("utf-8")

        # Build line starts (byte positions where each line begins)
        line_starts = [0]
        for i, byte in enumerate(code_bytes):
            if byte == ord("\n"):
                line_starts.append(i + 1)

        out: List[Tuple[str, int, int]] = []
        seen = set()

        def traverse(node):
            # Only process identifier nodes
            if node.type == "identifier":
                # Check if this identifier is in a call position
                is_call = False
                parent = node.parent

                if parent:
                    # Case 1: Direct function call - func()
                    # AST: call_expression(function: identifier)
                    if parent.type == "call_expression":
                        func_node = parent.child_by_field_name("function")
                        if func_node == node:
                            is_call = True

                    # Case 2: Method call - obj.method()
                    # AST: call_expression(function: member_expression(property: identifier))
                    elif parent.type == "member_expression":
                        prop_node = parent.child_by_field_name("property")
                        if prop_node == node:
                            grandparent = parent.parent
                            if grandparent and grandparent.type == "call_expression":
                                func_node = grandparent.child_by_field_name("function")
                                if func_node == parent:
                                    is_call = True

                # Only collect identifiers that are in call positions
                if not is_call:
                    return

                # Get line number for this identifier
                ident_line = bisect_right(line_starts, node.start_byte) - 1

                # Check if identifier is within our target range
                if start_line <= ident_line <= end_line:
                    name = code_bytes[node.start_byte : node.end_byte].decode("utf-8")

                    # Skip keywords and duplicates
                    if name not in JS_TS_KEYWORDS and name not in seen:
                        seen.add(name)
                        # Calculate column (offset from line start)
                        line_start_byte = (
                            line_starts[ident_line]
                            if ident_line < len(line_starts)
                            else 0
                        )
                        col = node.start_byte - line_start_byte
                        out.append((name, ident_line, col))

            # Recursively traverse children
            for child in node.children:
                traverse(child)

        traverse(root)
        return out

    def extract_class_header(
        self, node: Node, source_code: str
    ) -> Optional[str]:
        """
        Extract TypeScript/JavaScript class header (properties + constructor).

        Extracts:
        - Class declaration line
        - Property/field declarations
        - constructor method (if present)
        """
        if node.label != NodeLabel.CLASS:
            return None

        parser = self._get_parser_for_file(node.path)
        tree = parser.parse(source_code.encode("utf-8"))
        root = tree.root_node
        code_bytes = source_code.encode("utf-8")

        def text(ts_node):
            return code_bytes[ts_node.start_byte : ts_node.end_byte].decode("utf-8")

        # Find the class node matching our line range (0-indexed)
        class_node = self._find_class_node(
            root, node.start_line or 0, node.end_line or 0
        )
        if not class_node:
            # Fallback: return just class signature
            lines = source_code.splitlines()
            start_line = node.start_line or 0
            if start_line < len(lines):
                return lines[start_line].strip()
            return None

        # Get class body
        class_body = None
        for child in class_node.children:
            if child.type == "class_body":
                class_body = child
                break

        if not class_body:
            return None

        header_parts = []

        # Add class declaration line
        class_start_line = class_node.start_point[0]
        class_signature = source_code.splitlines()[class_start_line].strip()
        header_parts.append(class_signature)

        # Extract properties and constructor
        constructor_node = None
        for child in class_body.children:
            # Property declarations (public/private/static fields)
            if child.type in {"field_definition", "public_field_definition"}:
                header_parts.append(f"  {text(child)}")

            # Constructor method
            elif child.type == "method_definition":
                name_node = child.child_by_field_name("name")
                if name_node and text(name_node) == "constructor":
                    constructor_node = child

        # Add constructor if found
        if constructor_node:
            constructor_text = text(constructor_node)
            header_parts.append(f"\n  {constructor_text}")

        return "\n".join(header_parts) if len(header_parts) > 1 else None

    def _find_class_node(self, root, start_line: int, end_line: int):
        """Find the class_declaration node matching the given line range."""

        def traverse(ts_node):
            if ts_node.type == "class_declaration":
                node_start = ts_node.start_point[0]
                node_end = ts_node.end_point[0]
                # Match based on 0-indexed line numbers
                if node_start == start_line and node_end == end_line:
                    return ts_node

            for child in ts_node.children:
                result = traverse(child)
                if result:
                    return result
            return None

        return traverse(root)
