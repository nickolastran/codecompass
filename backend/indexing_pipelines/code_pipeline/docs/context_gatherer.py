"""
Context gathering for wiki pages using GraphRAG.

This module gathers relevant source code context for each wiki page
by combining:
1. Files explicitly listed in the wiki structure
2. Vector search for semantically relevant definitions
3. K-hop graph expansion to find related code
4. Smart file selection to ensure adequate coverage
"""

import os
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple
from dataclasses import dataclass, field
from dotenv import load_dotenv

from langchain_chroma import Chroma

from ..core.code_indexing import CodeIndexer
from ..core.graph_model import Graph, NodeLabel
from ..languages.language_config import ENABLED_LANGUAGES
from ..vectorization.process_graph import index_graph_into_vectors, node_text
from .wiki_structure import WikiStructure, WikiPage


# Constants for context gathering
MIN_FILES_PER_PAGE = 5
MAX_CONTEXT_CHARS = 12000  # ~3k tokens
K_SEEDS = 3  # Vector search seeds
HOPS = 2  # Graph expansion hops
MAX_NEIGHBORS = 30  # Max neighbors from graph expansion


@dataclass
class PageContext:
    """Context gathered for a single wiki page."""
    page_id: str
    page_title: str
    description: str

    # Files and definitions included
    file_paths: Set[str] = field(default_factory=set)
    definition_ids: Set[str] = field(default_factory=set)

    # Source code text (organized by file)
    sources: Dict[str, str] = field(default_factory=dict)  # file_path -> full text

    # Metadata
    total_chars: int = 0
    seed_ids: List[str] = field(default_factory=list)  # From vector search
    neighbor_ids: List[str] = field(default_factory=list)  # From graph expansion

    def get_formatted_context(self) -> str:
        """Format context as a single string for LLM prompt."""
        parts = []

        # Add description
        parts.append(f"# PAGE: {self.page_title}\n")
        parts.append(f"# DESCRIPTION: {self.description}\n\n")

        # Add source files
        parts.append("# SOURCE CODE:\n\n")
        for file_path in sorted(self.file_paths):
            parts.append(f"## File: {file_path}\n")
            parts.append("```\n")
            parts.append(self.sources.get(file_path, ""))
            parts.append("\n```\n\n")

        return "".join(parts)


class ContextGatherer:
    """Gathers context for wiki pages using GraphRAG."""

    def __init__(
        self,
        repo_path: str,
        graph: Optional[Graph] = None,
        vectorstore: Optional[Chroma] = None,
        rebuild_index: bool = False
    ):
        """
        Initialize context gatherer.

        Args:
            repo_path: Path to repository root
            graph: Pre-built knowledge graph (if None, builds new one)
            vectorstore: Pre-built vector store (if None, builds new one)
            rebuild_index: Force rebuild of graph and vectors
        """
        self.repo_path = Path(repo_path).resolve()

        # Build or load graph
        if graph is None or rebuild_index:
            print("Building knowledge graph...")
            indexer = CodeIndexer(str(self.repo_path), handlers=ENABLED_LANGUAGES)
            self.graph = indexer.index_directory()
            print(f"  Graph built: {len(self.graph.nodes)} nodes, {len(self.graph.edges)} edges")
        else:
            self.graph = graph

        # Build or load vectorstore
        if vectorstore is None or rebuild_index:
            print("Vectorizing code definitions...")
            persist_dir = str(self.repo_path / ".codecompass" / "chroma_db")
            self.vectorstore = index_graph_into_vectors(self.graph, persist_dir=persist_dir)
            print("  Vectorization complete")
        else:
            self.vectorstore = vectorstore

    def gather_context_for_page(
        self,
        page: WikiPage,
        min_files: int = MIN_FILES_PER_PAGE,
        max_chars: int = MAX_CONTEXT_CHARS,
        debug: bool = False
    ) -> PageContext:
        """
        Gather context for a single wiki page.

        Args:
            page: WikiPage to gather context for
            min_files: Minimum number of files to include
            max_chars: Maximum characters in context
            debug: Enable debug logging

        Returns:
            PageContext with gathered source code
        """
        context = PageContext(
            page_id=page.id,
            page_title=page.title,
            description=page.description
        )

        if debug:
            print(f"\n[GATHER] Page: {page.title}")
            print(f"[GATHER] Description: {page.description}")

        # Step 1: Add explicitly listed files
        explicit_files = self._resolve_file_paths(page.relevant_files)
        if debug:
            print(f"[GATHER] Explicit files: {len(explicit_files)}")
            if explicit_files:
                print(f"[GATHER]   {', '.join(Path(f).name for f in explicit_files)}")

        for file_path in explicit_files:
            added = self._add_file_to_context(context, file_path, max_chars)
            if added and debug:
                file_name = Path(file_path).name
                file_size = len(context.sources[file_path])
                print(f"[GATHER]   Added (explicit): {file_name} ({file_size} chars, total: {context.total_chars})")

        # Step 2: Use GraphRAG to find more relevant code
        if len(context.file_paths) < min_files:
            if debug:
                print(f"[GATHER] Need more files ({len(context.file_paths)}/{min_files}), using GraphRAG...")

            # Build search query from page title + description
            query = f"{page.title}. {page.description}"

            # Vector search for seed definitions
            seeds = self.vectorstore.similarity_search_with_relevance_scores(query, k=K_SEEDS)
            seed_docs = [doc for (doc, _score) in seeds]
            seed_ids = [doc.metadata["node_id"] for (doc, _score) in seeds]
            context.seed_ids = seed_ids

            if debug:
                print(f"[GATHER] Vector search returned {len(seed_ids)} seeds")

            # Show which files seeds map to
            if debug and seed_ids:
                seed_files = set()
                for def_id in seed_ids:
                    node = self.graph.nodes.get(def_id)
                    if node and node.path:
                        file_path = self._normalize_path(node.path)
                        seed_files.add(Path(file_path).name)
                print(f"[GATHER]   Seeds map to files: {', '.join(sorted(seed_files))}")

            # K-hop expansion
            allowed_labels = {NodeLabel.CLASS, NodeLabel.FUNCTION, NodeLabel.METHOD}
            neighbor_ids = self.graph.khop(
                seeds=seed_ids,
                hops=HOPS,
                allowed=allowed_labels
            )
            # Remove seeds and cap
            neighbor_ids = [nid for nid in neighbor_ids if nid not in seed_ids][:MAX_NEIGHBORS]
            context.neighbor_ids = neighbor_ids

            if debug:
                print(f"[GATHER] Graph expansion found {len(neighbor_ids)} neighbors")

            # Show which files neighbors map to
            if debug and neighbor_ids:
                neighbor_files = set()
                for def_id in neighbor_ids:
                    node = self.graph.nodes.get(def_id)
                    if node and node.path:
                        file_path = self._normalize_path(node.path)
                        neighbor_files.add(Path(file_path).name)
                print(f"[GATHER]   Neighbors map to files: {', '.join(sorted(neighbor_files))}")

            # Collect candidate files with source tracking
            seed_file_paths = []
            neighbor_file_paths = []

            for def_id in seed_ids:
                node = self.graph.nodes.get(def_id)
                if node and node.path:
                    file_path = self._normalize_path(node.path)
                    if file_path not in context.file_paths and file_path not in seed_file_paths:
                        seed_file_paths.append(file_path)

            for def_id in neighbor_ids:
                node = self.graph.nodes.get(def_id)
                if node and node.path:
                    file_path = self._normalize_path(node.path)
                    if file_path not in context.file_paths and file_path not in seed_file_paths and file_path not in neighbor_file_paths:
                        neighbor_file_paths.append(file_path)

            # Combine: seeds first (higher relevance), then neighbors
            candidate_files = seed_file_paths + neighbor_file_paths

            if debug:
                print(f"[GATHER] Found {len(candidate_files)} candidate files ({len(seed_file_paths)} from seeds, {len(neighbor_file_paths)} from neighbors)")

            # Phase 1: Add files that fit within max_chars
            if debug:
                print(f"[GATHER] Phase 1: Adding files within limit")

            chars_before_phase1 = context.total_chars
            for file_path in candidate_files:
                if len(context.file_paths) >= min_files:
                    break

                # Determine source before using it
                source = "seed" if file_path in seed_file_paths else "neighbor"
                added = self._add_file_to_context(context, file_path, max_chars, force=False)

                if added and debug:
                    file_name = Path(file_path).name
                    file_size = len(context.sources[file_path])
                    print(f"[GATHER]   Added ({source}): {file_name} ({file_size} chars, total: {context.total_chars})")
                elif debug and not added:
                    file_name = Path(file_path).name
                    # Try to read just to get size for logging
                    try:
                        test_size = len(Path(file_path).read_text(encoding='utf-8'))
                        print(f"[GATHER]   Skipped ({source}): {file_name} ({test_size} chars would exceed limit)")
                    except:
                        print(f"[GATHER]   Skipped ({source}): {file_name} (could not read)")

            # Phase 2: If still need more files, force add them (prioritize min_files over max_chars)
            if len(context.file_paths) < min_files:
                if debug:
                    print(f"[GATHER] Phase 2: Still need more files ({len(context.file_paths)}/{min_files}), forcing additions...")
                for file_path in candidate_files:
                    if len(context.file_paths) >= min_files:
                        break
                    if file_path not in context.file_paths:
                        # Determine source before using it
                        source = "seed" if file_path in seed_file_paths else "neighbor"
                        added = self._add_file_to_context(context, file_path, max_chars, force=True)
                        if added and debug:
                            file_name = Path(file_path).name
                            file_size = len(context.sources[file_path])
                            print(f"[GATHER]   Forced ({source}): {file_name} ({file_size} chars, total: {context.total_chars})")

        if debug:
            print(f"[GATHER] Final: {len(context.file_paths)} files, {context.total_chars} chars")

        return context

    def gather_all_contexts(
        self,
        wiki_structure: WikiStructure,
        min_files: int = MIN_FILES_PER_PAGE,
        max_chars: int = MAX_CONTEXT_CHARS,
        debug: bool = False
    ) -> Dict[str, PageContext]:
        """
        Gather context for all pages in wiki structure.

        Args:
            wiki_structure: WikiStructure to process
            min_files: Minimum files per page
            max_chars: Maximum chars per page
            debug: Enable debug logging

        Returns:
            Dict mapping page_id -> PageContext
        """
        contexts = {}

        print(f"\nGathering context for {len(wiki_structure.pages)} pages...")
        for i, page in enumerate(wiki_structure.pages.values(), 1):
            print(f"  [{i}/{len(wiki_structure.pages)}] {page.title}")
            context = self.gather_context_for_page(page, min_files, max_chars, debug)
            contexts[page.id] = context
            print(f"      -> {len(context.file_paths)} files, {context.total_chars} chars")

        return contexts

    def _resolve_file_paths(self, paths: List[str]) -> List[str]:
        """
        Resolve file paths from wiki structure to actual filesystem paths.
        If a path is a directory, expands to all files within that directory from the graph.

        Args:
            paths: List of paths (may be relative or absolute, files or directories)

        Returns:
            List of absolute filesystem paths that exist
        """
        resolved = []
        for path in paths:
            # Try as absolute path first
            abs_path = Path(path)
            if abs_path.is_absolute() and abs_path.exists():
                if abs_path.is_file():
                    resolved.append(str(abs_path))
                elif abs_path.is_dir():
                    # Expand directory to all files within it
                    resolved.extend(self._expand_directory(str(abs_path)))
                continue

            # Try as relative to repo root
            rel_path = self.repo_path / path
            if rel_path.exists():
                if rel_path.is_file():
                    resolved.append(str(rel_path))
                elif rel_path.is_dir():
                    # Expand directory to all files within it
                    resolved.extend(self._expand_directory(str(rel_path)))
                continue

            # Try finding in graph nodes (exact file match)
            for node in self.graph.nodes.values():
                if node.label == NodeLabel.FILE:
                    node_path = self._normalize_path(node.path)
                    if node_path.endswith(path) or Path(node_path).name == Path(path).name:
                        resolved.append(node_path)
                        break

        return resolved

    def _expand_directory(self, dir_path: str) -> List[str]:
        """
        Expand a directory path to all file nodes within it from the graph.

        Args:
            dir_path: Absolute directory path

        Returns:
            List of file paths within the directory
        """
        files = []
        dir_path_normalized = str(Path(dir_path).resolve())

        for node in self.graph.nodes.values():
            if node.label == NodeLabel.FILE:
                node_path = self._normalize_path(node.path)
                # Check if this file is within the directory
                if node_path.startswith(dir_path_normalized):
                    files.append(node_path)

        return files

    def _normalize_path(self, path: str) -> str:
        """Convert path (URI or filesystem) to absolute filesystem path."""
        if path.startswith("file://"):
            # Convert URI to filesystem path
            from lsp.lsp_edges import _uri_to_path
            return str(_uri_to_path(path))
        else:
            # Already filesystem path, make absolute
            p = Path(path)
            if not p.is_absolute():
                p = self.repo_path / p
            return str(p.resolve())

    def _add_file_to_context(
        self,
        context: PageContext,
        file_path: str,
        max_chars: int,
        force: bool = False
    ) -> bool:
        """
        Add a file's full source code to context.

        Args:
            context: PageContext to update
            file_path: Absolute path to source file
            max_chars: Maximum total chars allowed
            force: If True, add file even if it exceeds max_chars (for min_files)

        Returns:
            True if file was added, False otherwise
        """
        if file_path in context.file_paths:
            return False

        # Skip directories
        path_obj = Path(file_path)
        if not path_obj.exists() or path_obj.is_dir():
            return False

        try:
            # Read file content
            source_text = path_obj.read_text(encoding='utf-8')

            # Check if adding this would exceed limit
            if not force and context.total_chars + len(source_text) > max_chars:
                # Don't add if it would exceed and not forced
                return False

            # Add to context
            context.file_paths.add(file_path)
            context.sources[file_path] = source_text
            context.total_chars += len(source_text)

            # Track definition nodes in this file
            for node in self.graph.nodes.values():
                if node.label in {NodeLabel.CLASS, NodeLabel.FUNCTION, NodeLabel.METHOD}:
                    node_path = self._normalize_path(node.path)
                    if node_path == file_path:
                        context.definition_ids.add(node.id)

            return True

        except Exception as e:
            print(f"    Warning: Could not read {file_path}: {e}")
            return False


def save_contexts_to_dir(
    contexts: Dict[str, PageContext],
    output_dir: str
):
    """
    Save gathered contexts to individual files for inspection.

    Args:
        contexts: Dict of page_id -> PageContext
        output_dir: Directory to save context files
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    for page_id, context in contexts.items():
        # Sanitize page_id for filename
        safe_id = page_id.replace("/", "_").replace("\\", "_")
        file_path = output_path / f"{safe_id}.txt"

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(context.get_formatted_context())

    print(f"\nContexts saved to {output_dir}/")


def main():
    """CLI for testing context gathering."""
    import argparse

    parser = argparse.ArgumentParser(description="Gather context for wiki pages")
    parser.add_argument(
        "structure_file",
        help="Path to wiki structure XML file"
    )
    parser.add_argument(
        "--repo",
        help="Repository path (if not cwd)",
        default="."
    )
    parser.add_argument(
        "--output",
        "-o",
        help="Output directory for context files",
        default="./wiki_contexts"
    )
    parser.add_argument(
        "--min-files",
        type=int,
        default=MIN_FILES_PER_PAGE,
        help=f"Minimum files per page (default: {MIN_FILES_PER_PAGE})"
    )
    parser.add_argument(
        "--max-chars",
        type=int,
        default=MAX_CONTEXT_CHARS,
        help=f"Maximum chars per page (default: {MAX_CONTEXT_CHARS})"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )

    args = parser.parse_args()

    # Load environment
    load_dotenv()

    # Load wiki structure
    print(f"Loading wiki structure from {args.structure_file}...")
    wiki_structure = WikiStructure.load_from_file(args.structure_file)
    print(f"  Loaded: {len(wiki_structure.pages)} pages")

    # Initialize gatherer
    gatherer = ContextGatherer(args.repo)

    # Gather contexts
    contexts = gatherer.gather_all_contexts(
        wiki_structure,
        min_files=args.min_files,
        max_chars=args.max_chars,
        debug=args.debug
    )

    # Save to files
    save_contexts_to_dir(contexts, args.output)

    # Print summary
    print("\nSummary:")
    print(f"  Total pages: {len(contexts)}")
    print(f"  Average files per page: {sum(len(c.file_paths) for c in contexts.values()) / len(contexts):.1f}")
    print(f"  Average chars per page: {sum(c.total_chars for c in contexts.values()) / len(contexts):.0f}")


if __name__ == "__main__":
    main()
