"""
LSP Manager - Multi-Language LSP Client Management

Manages multiple LSP clients (one per language) and routes files to the appropriate
client based on file extension. This enables cross-language code analysis in polyglot repositories.
"""

from typing import Dict, List, Optional, Tuple
from pathlib import Path

from .lsp_client import LSPClient
from .lsp_config import (
    ensure_jsconfig,
    ensure_compile_commands,
    cleanup_generated_config,
    cleanup_compile_commands,
    has_js_ts_files,
    has_c_cpp_files,
)
from ..languages.language_handler import LanguageHandler


class LSPManager:
    """
    Manages multiple LSP clients for multi-language support.

    Each language has its own LSP server (e.g., Pyright for Python, tsserver for TypeScript).
    The LSPManager creates one client per language and routes file operations to the correct client.
    """

    def __init__(self, handlers: List[LanguageHandler], root_dir: str):
        """
        Initialize LSP clients for all enabled languages.

        Args:
            handlers: List of LanguageHandler instances defining supported languages
            root_dir: Root directory of the project (passed to LSP servers)
        """
        self.clients: Dict[str, Tuple[LSPClient, LanguageHandler]] = {}
        self.ext_to_lang: Dict[str, str] = {}
        # Resolve to absolute path to avoid relative path issues
        self.root_dir = str(Path(root_dir).resolve())
        self._generated_configs: List[Path] = []  # Track generated config files for cleanup
        self._generated_compile_commands = False  # Track if we generated compile_commands.json

        # Check once which file types exist in the project
        _has_js_ts = has_js_ts_files(self.root_dir)
        _has_c_cpp = has_c_cpp_files(self.root_dir)
        _c_cpp_config_done = False  # Only generate compile_commands once for both C and C++

        # Create one LSP client per language
        for handler in handlers:
            lang_id = handler.get_lsp_language_id()
            cmd = handler.get_lsp_server_command()

            # For TypeScript/JavaScript: ensure config exists for proper cross-file resolution
            # Only if JS/TS files actually exist in the project
            if lang_id == "typescript" and _has_js_ts:
                generated_config = ensure_jsconfig(self.root_dir)
                if generated_config:
                    self._generated_configs.append(generated_config)

            # For C/C++: ensure compile_commands.json exists
            # Only if C/C++ files actually exist and we haven't already generated it
            if lang_id in ("c", "cpp") and _has_c_cpp and not _c_cpp_config_done:
                result = ensure_compile_commands(self.root_dir)
                if result.get("status") == "generated":
                    self._generated_compile_commands = True
                _c_cpp_config_done = True

            # Initialize LSP client for this language
            client = LSPClient(cmd, root=self.root_dir)
            self.clients[lang_id] = (client, handler)

            # Map file extensions to language ID for routing
            for ext in handler.get_file_extensions():
                self.ext_to_lang[ext] = lang_id

    def get_client_for_file(self, file_path: str) -> Tuple[LSPClient, LanguageHandler]:
        """
        Get the LSP client and handler for a specific file.

        Args:
            file_path: Path to the file (can be URI or filesystem path)

        Returns:
            Tuple of (LSPClient, LanguageHandler) for the file's language

        Raises:
            KeyError: If no handler supports the file's extension
        """
        ext = Path(file_path).suffix.lower()
        lang_id = self.ext_to_lang.get(ext)

        if lang_id is None:
            # Fallback: try extracting extension from URI
            if file_path.startswith("file://"):
                # Extract extension from URI
                path_part = file_path.split("file://")[-1]
                ext = Path(path_part).suffix.lower()
                lang_id = self.ext_to_lang.get(ext)

        if lang_id is None:
            raise KeyError(f"No language handler for extension: {ext}")

        return self.clients[lang_id]

    def initialize_all(self, root_uri: str):
        """
        Initialize all LSP servers.

        Must be called before using any LSP functionality.

        Args:
            root_uri: Root URI of the project (file:// URI)
        """
        for lang_id, (client, handler) in self.clients.items():
            print(f"Initializing {lang_id} LSP server...")
            client._initialize()

    def shutdown_all(self, cleanup_generated: bool = True):
        """
        Shutdown all LSP servers gracefully.

        Should be called when done with LSP operations to clean up resources.

        Args:
            cleanup_generated: If True, remove any config files that were generated
                             by the LSPManager (e.g., jsconfig.json). Default True.
        """
        for lang_id, (client, handler) in self.clients.items():
            try:
                print(f"Shutting down {lang_id} LSP server...")
                client.shutdown()
            except Exception as e:
                print(f"Error shutting down {lang_id} LSP: {e}")

        # Clean up generated config files
        if cleanup_generated:
            for config_path in self._generated_configs:
                cleanup_generated_config(config_path)
            self._generated_configs.clear()

            # Clean up generated compile_commands.json
            if self._generated_compile_commands:
                cleanup_compile_commands(self.root_dir, was_generated=True)
                self._generated_compile_commands = False
