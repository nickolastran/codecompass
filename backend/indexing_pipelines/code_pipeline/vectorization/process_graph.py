import os
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import unquote, urlparse

from langchain_chroma import Chroma
from langchain_core.documents import Document

from indexing_pipelines.code_pipeline.languages.language_config import ENABLED_LANGUAGES
from indexing_pipelines.code_pipeline.languages.language_handler import LanguageHandler
from indexing_pipelines.code_pipeline.vectorization.embeddings_config import DEFAULT_EMBEDDINGS

from config import CODE_CHROMA_DB_PATH, KG_GRAPH_STORE_PATH


def _to_fs_path(p: str) -> str:
    """Accept absolute path or any 'file:' URI (even with backslashes) and return a filesystem path."""
    if not p.startswith("file:"):
        return p
    # Normalize slashes and parse as a URL
    p_norm = p.replace("\\", "/")
    parsed = urlparse(p_norm)
    fs = unquote(parsed.path)  # '/C:/Users/...' on Windows, '/home/... ' on *nix
    # Windows drive-letter fix: strip leading slash if present (e.g. '/C:/...')
    if re.match(r"^/[A-Za-z]:", fs):
        fs = fs[1:]
    # Convert to OS separators
    return fs


def node_text(n) -> str:
    fs_path = _to_fs_path(n.path)
    text = Path(fs_path).read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    s = int(n.start_line or 0)
    e = int(n.end_line or s)
    return "".join(lines[s : e + 1])


def _get_handler_for_file(path: str, handlers: List[LanguageHandler]) -> Optional[LanguageHandler]:
    """Get the appropriate language handler for a file based on extension."""
    ext = Path(path).suffix.lower()
    for handler in handlers:
        if ext in handler.get_file_extensions():
            return handler
    return None


def nodes_to_documents(nodes: Iterable, G, handlers: Optional[List[LanguageHandler]] = None) -> List[Document]:
    # Use provided handlers or default to ENABLED_LANGUAGES
    if handlers is None:
        handlers = ENABLED_LANGUAGES

    # Build parent lookup once: child_id -> parent_node (for CONTAINS edges only)
    child_to_parent: Dict[str, Any] = {}
    for edge in G.edges:
        if edge.type.value == "CONTAINS":
            child_to_parent[edge.dst] = G.nodes.get(edge.src)

    docs: List[Document] = []
    class_count = 0
    class_success = 0
    class_failures = []

    for n in nodes:
        label_str = getattr(n.label, "value", str(n.label))

        # For classes: extract only header (variables + constructor)
        if label_str == "class":
            class_count += 1
            fs_path = _to_fs_path(n.path)
            try:
                # Read the source file
                file_content = Path(fs_path).read_text(encoding="utf-8")

                # Get handler for this file type and extract class header
                handler = _get_handler_for_file(fs_path, handlers)
                if handler:
                    content = handler.extract_class_header(n, file_content)
                else:
                    content = None

                if not content:
                    # Fallback: use just class signature if extraction fails
                    content = node_text(n).split("\n")[0]  # First line only
                    print(
                        f"  [WARN] Class header extraction returned None for {n.name}, using fallback"
                    )
            except Exception as e:
                # Skip this class if we can't extract header
                class_failures.append((n.name, str(e)))
                print(f"  [ERROR] Failed to extract class {n.name}: {e}")
                continue

            meta: Dict[str, Any] = {
                "node_id": n.id,
                "label": label_str,
                "name": n.name,
                "path": fs_path,
                "start_line": int(n.start_line or 0),
                "end_line": int(n.end_line or 0),
            }
            docs.append(Document(page_content=content, metadata=meta))
            class_success += 1
            continue

        # For functions/methods: extract full code
        if label_str not in {"function", "method"}:
            continue

        content = node_text(n)
        fs_path = _to_fs_path(n.path)

        # Find parent class for methods via lookup
        parent_class = None
        if label_str == "method":
            parent_node = child_to_parent.get(n.id)
            if parent_node and parent_node.label.value == "class":
                parent_class = parent_node.name

        meta: Dict[str, Any] = {
            "node_id": n.id,
            "label": label_str,
            "name": n.name,
            "path": fs_path,  # store filesystem path for readability
            "start_line": int(n.start_line or 0),
            "end_line": int(n.end_line or 0),
        }
        if parent_class:
            meta["parent_class"] = parent_class

        docs.append(Document(page_content=content, metadata=meta))

    # Print class extraction summary
    if class_count > 0:
        print(
            f"\n[CLASS EXTRACTION] Processed {class_count} classes: {class_success} successful, {len(class_failures)} failed"
        )
        if class_failures:
            print(
                f"  Failed classes: {', '.join(name for name, _ in class_failures[:5])}"
            )
            if len(class_failures) > 5:
                print(f"  ... and {len(class_failures) - 5} more")

    return docs


def index_graph_into_vectors(
    G, collection_name: str, repo_id: str, persist_dir=CODE_CHROMA_DB_PATH 
):
    """
    Index graph nodes into a ChromaDB vector database.

    Args:
        G: Graph object containing code nodes
        persist_dir: Directory to persist the vector database
        collection_name: Name of the ChromaDB collection (name of the user(user-id))
        repo_id: to distinguish between multiple projects of a single user.

    Returns:
        Chroma vectorstore instance
    """
    vs = Chroma(
        collection_name=collection_name,
        embedding_function=DEFAULT_EMBEDDINGS,
        persist_directory=persist_dir,
        collection_metadata={"hnsw:space": "cosine"},
    )
    defs = [n for n in G.nodes.values() if n.label in ("class", "function", "method")]
    docs = nodes_to_documents(defs, G)

    # Inject repo_id into metadata
    for d in docs:
        d.metadata["repo_id"] = repo_id

    ids = [d.metadata["node_id"] for d in docs]
    BATCH = 256
    for i in range(0, len(docs), BATCH):
        vs.add_documents(docs[i : i + BATCH], ids=ids[i : i + BATCH])
    return vs
