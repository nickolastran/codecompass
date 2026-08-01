"""
Language Handler Abstract Interface

Defines the contract for language-specific operations in CodeCompass.
Each language (Python, TypeScript, Go, Rust, etc.) implements this interface
to provide Tree-sitter parsing and LSP server configuration.
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Tuple

from tree_sitter import Language, Parser

from indexing_pipelines.code_pipeline.core.graph_model import Node


class LanguageHandler(ABC):
    """
    Abstract base class for language-specific code parsing and analysis.

    Each language handler encapsulates:
    1. Tree-sitter grammar and AST queries (language-specific)
    2. LSP server configuration (language-specific)
    3. Code definition extraction logic (language-specific)
    4. Identifier collection for CALLS edge building (language-specific)

    The graph model (Node/Edge) remains language-agnostic.

    Attributes:
        repo_root: Repository root path (set by CodeIndexer for repo-relative node IDs)
    """

    def __init__(self):
        self.repo_root = None  # Set by CodeIndexer after instantiation

    @abstractmethod
    def get_file_extensions(self) -> List[str]:
        """
        Return file extensions this handler supports.

        Examples:
            - Python: ['.py', '.pyi']
            - TypeScript: ['.ts', '.tsx', '.js', '.jsx']
            - Go: ['.go']
            - Rust: ['.rs']

        Returns:
            List of file extensions including the dot (e.g., '.py')
        """
        pass

    @abstractmethod
    def get_tree_sitter_language(self) -> Language:
        """
        Return the compiled Tree-sitter Language object.

        Each language has its own grammar compiled to a .so/.dll file.
        This method should return a Language instance loaded from that file.

        Example:
            return Language('build/python.so', 'python')

        Returns:
            Tree-sitter Language object for this language
        """
        pass

    @abstractmethod
    def extract_definitions(self, file_path: str, source_code: str) -> List[Node]:
        """
        Parse source code and extract definition nodes (CLASS/FUNCTION/METHOD).

        This is where language-specific Tree-sitter queries live.
        Each language has different AST node types:
        - Python: class_definition, function_definition
        - TypeScript: class_declaration, function_declaration, method_definition
        - Go: type_declaration (struct), function_declaration, method_declaration
        - Rust: struct_item, function_item, impl_item

        Args:
            file_path: Absolute filesystem path to the source file
            source_code: Full text content of the file

        Returns:
            List of Node objects representing classes, functions, and methods
            with accurate line ranges (start_line, end_line)
        """
        pass

    @abstractmethod
    def get_lsp_server_command(self) -> List[str]:
        """
        Return the command to launch the LSP server for this language.

        Different languages use different LSP servers:
        - Python: ['pyright-langserver', '--stdio'] or ['pylsp']
        - TypeScript: ['typescript-language-server', '--stdio']
        - Go: ['gopls']  # Note: --stdio is default for gopls
        - Rust: ['rust-analyzer']
        - C/C++: ['clangd']
        - Java: ['java', '-jar', '/path/to/jdtls.jar']

        The LSP protocol itself is standardized, so LSPClient works with all servers.

        Returns:
            Command as list of strings (executable and arguments)
        """
        pass

    @abstractmethod
    def get_lsp_language_id(self) -> str:
        """
        Return the LSP language identifier string.

        This is passed to the LSP server's textDocument/didOpen notification.

        Standard identifiers:
        - 'python'
        - 'typescript' or 'javascript'
        - 'go'
        - 'rust'
        - 'cpp' or 'c'
        - 'java'

        Returns:
            Language identifier string as defined by LSP spec
        """
        pass

    @abstractmethod
    def collect_identifiers(
        self,
        file_path: str,
        source_code: str,
        start_line: int,
        end_line: int
    ) -> List[Tuple[str, int, int]]:
        """
        Extract identifiers from a code range for LSP definition queries.

        Used for building CALLS edges: extract all identifiers (function names,
        method calls, class references) within a definition's body, then query
        LSP to resolve what they refer to.

        Each language has different call syntax:
        - Python: func(), obj.method(), Class()
        - JavaScript: func(), obj.method(), new Class(), arrow => functions
        - Go: Func(), obj.Method(), &Type{}
        - Rust: func!(), obj.method(), Type::new()

        Args:
            file_path: Path to the source file (used for language-variant selection)
            source_code: Full source code of the file
            start_line: Starting line number (0-indexed)
            end_line: Ending line number (0-indexed, inclusive)

        Returns:
            List of (identifier_name, line, column) tuples for LSP queries.
            Line and column are 0-indexed.
        """
        pass

    @abstractmethod
    def extract_class_header(
        self, node: Node, source_code: str
    ) -> Optional[str]:
        """
        Extract class header (variables + constructor) for vectorization.

        When vectorizing classes, we don't want to duplicate method code (since
        methods are vectorized separately). Instead, we extract just the class
        "header": class-level variables/properties and the constructor.

        Each language has different class structures:
        - Python: class vars, type annotations, __init__ method
        - TypeScript/JS: property declarations, constructor method
        - C++: member declarations, constructor(s)
        - Go: struct fields (Go has no constructors)
        - Rust: struct fields, impl new() if present

        Args:
            node: CLASS node from the graph with path, start_line, end_line
            source_code: Full source code of the file

        Returns:
            String containing class header (signature + vars + constructor),
            or None if extraction fails or node is not a class
        """
        pass
