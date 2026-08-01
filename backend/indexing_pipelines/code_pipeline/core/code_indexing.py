import fnmatch
import os
from pathlib import Path
from typing import Dict, List, Optional

from ..languages.language_handler import LanguageHandler
from .graph_model import Graph, Node, NodeLabel


class CodeIndexer:
    """
    Builds the hierarchy graph: folders → files → (classes/functions/methods).
    Now supports multiple languages via pluggable language handlers.
    """

    def __init__(self, base_dir: str, handlers: List[LanguageHandler]):
        """
        Initialize the indexer with a list of language handlers.

        Args:
            base_dir: Root directory to index
            handlers: List of LanguageHandler instances for supported languages
        """
        self.base_dir = Path(base_dir).resolve()
        self.handlers = handlers

        # Set repo_root on all handlers for stable node IDs
        for handler in handlers:
            handler.repo_root = str(self.base_dir)

        # Build mapping from file extension to handler
        self.ext_to_handler: Dict[str, LanguageHandler] = {}
        for handler in handlers:
            for ext in handler.get_file_extensions():
                self.ext_to_handler[ext] = handler

        # Exclusion patterns
        self.excluded_dirs = [
            "__pycache__",
            ".git",
            "node_modules",
            ".pytest_cache",
            "venv",
            ".venv",
            "env",
            ".env",
            "dist",
            "build",
            ".next",
            ".nuxt",
            "coverage",
            ".idea",
            ".vscode",
            "out",
            ".cache",
            ".parcel-cache",
            ".turbo",
        ]
        self.excluded_files = [
            "*.pyc",
            "*.pyo",
            "*.pyd",
            "*.so",
            "*.dll",
            "*.dylib",
            ".DS_Store",
            "*.log",
            "*.sqlite",
            "*.db",
            "package-lock.json",
            "yarn.lock",
            "pnpm-lock.yaml",
            ".gitignore",
            "*.min.js",
            "*.min.css",
            "*.d.ts.map",
            "*.js.map",
            "*.d.ts",
        ]

        self.graph = Graph()

    def should_process_dir(
        self, dirpath: Path, base_path: Optional[Path] = None
    ) -> bool:
        base = (base_path or self.base_dir).resolve()
        try:
            rel = dirpath.resolve().relative_to(base)
        except Exception:
            return False
        parts = [p for p in rel.parts if p not in ("", ".")]
        if not parts:
            return True
        return not any(part in self.excluded_dirs for part in parts)

    def should_process_file(self, filepath: Path) -> bool:
        """Check if file should be processed based on extension and exclusion patterns."""
        # Check if any handler supports this file extension
        if filepath.suffix.lower() not in self.ext_to_handler:
            return False

        filename = filepath.name
        if any(fnmatch.fnmatch(filename, pattern) for pattern in self.excluded_files):
            return False
        return True

    def _folder_id(self, path: Path) -> str:
        """Generate stable, repo-relative folder ID."""
        try:
            rel_path = path.resolve().relative_to(self.base_dir)
            rel_path_str = str(rel_path).replace("\\", "/")
            # Handle repo root folder
            if rel_path_str == ".":
                rel_path_str = path.name or "root"
        except ValueError:
            # Path outside repo - use just the name
            rel_path_str = path.name
        return f"folder:{rel_path_str}"

    def _file_id(self, path: Path) -> str:
        """Generate stable, repo-relative file ID."""
        try:
            rel_path = path.resolve().relative_to(self.base_dir)
            rel_path_str = str(rel_path).replace("\\", "/")
        except ValueError:
            # Path outside repo - use just the name
            rel_path_str = path.name
        return f"file:{rel_path_str}"

    def _ensure_folder_nodes(self, folder: Path) -> str:
        """Ensure nodes for each ancestor from base_dir → folder, wire CONTAINS edges."""
        base = self.base_dir
        cur_parent_id: Optional[str] = self._folder_id(base)
        self.graph.add_node(
            Node(
                id=cur_parent_id, label=NodeLabel.FOLDER, path=str(base), name=base.name
            )
        )

        rel_parts = folder.resolve().relative_to(base).parts
        cur_path = base
        for part in rel_parts:
            cur_path = cur_path / part
            nid = self._folder_id(cur_path)
            self.graph.add_node(
                Node(
                    id=nid,
                    label=NodeLabel.FOLDER,
                    path=str(cur_path),
                    name=cur_path.name,
                )
            )
            self.graph.add_contains(cur_parent_id, nid)
            cur_parent_id = nid
        return cur_parent_id  # id of the requested folder

    def index_directory(self) -> Graph:
        base = self.base_dir
        # ensure root folder node
        self._ensure_folder_nodes(base)

        for dirpath, dirnames, filenames in os.walk(base, topdown=True):
            current_dir = Path(dirpath)

            dirnames[:] = [
                d for d in dirnames if self.should_process_dir(current_dir / d, base)
            ]

            # create/ensure this folder node (and its ancestors)
            folder_node_id = self._ensure_folder_nodes(current_dir)

            for filename in filenames:
                filepath = current_dir / filename
                if not self.should_process_file(filepath):
                    continue
                self.index_file(filepath, parent_folder_id=folder_node_id)

        return self.graph

    def index_file(self, filepath: Path, parent_folder_id: str):
        """
        Index a single file: extract definitions and wire CONTAINS edges.
        Routes file to appropriate language handler based on extension.
        """
        # Get handler for this file extension
        ext = filepath.suffix.lower()
        handler = self.ext_to_handler.get(ext)
        if not handler:
            return  # No handler for this extension

        try:
            code = filepath.read_text(encoding="utf-8")
        except Exception as e:
            print(f"Error reading {filepath}: {e}")
            return

        # Create file node
        file_id = self._file_id(filepath)
        file_node = Node(
            id=file_id,
            label=NodeLabel.FILE,
            path=str(filepath.resolve()),
            name=filepath.name,
        )
        self.graph.add_node(file_node)
        self.graph.add_contains(parent_folder_id, file_id)

        # Extract definitions using language-specific handler
        def_nodes = handler.extract_definitions(str(filepath), code)

        # Add definition nodes and file→def edges
        for n in def_nodes:
            self.graph.add_node(n)
            self.graph.add_contains(file_id, n.id)

        # Build internal edges (class→method CONTAINS)
        # Group nodes by their location to infer containment
        class_nodes = {n.id: n for n in def_nodes if n.label == NodeLabel.CLASS}
        method_nodes = [n for n in def_nodes if n.label == NodeLabel.METHOD]

        for method in method_nodes:
            # Find the class that contains this method (overlapping line ranges)
            for class_id, class_node in class_nodes.items():
                if (
                    class_node.start_line is not None
                    and class_node.end_line is not None
                    and method.start_line is not None
                    and method.end_line is not None
                ):
                    # Method is inside class if its range is within class range
                    if (
                        class_node.start_line <= method.start_line
                        and method.end_line <= class_node.end_line
                    ):
                        self.graph.add_contains(class_id, method.id)
                        break  # Found the parent class
