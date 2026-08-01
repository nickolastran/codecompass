"""

"""

import os

from .core.code_indexing import CodeIndexer
from .languages.language_config import ENABLED_LANGUAGES

# LSP related imports
from .lsp.lsp_edges import build_span_index, add_imports_edges, add_calls_edges
from .lsp.lsp_manager import LSPManager
from .core.graph_model import NodeLabel

from pathlib import Path

# for vectorizing the graph and storing it in ChromDB
from .vectorization.process_graph import index_graph_into_vectors

from config import CODE_CHROMA_DB_PATH, KG_GRAPH_STORE_PATH

class Code_Indexing:
    def __init__(self, dir_path: str, repo_id: str, user_id: str):
        self.dir_path = dir_path
        self.repo_id = repo_id
        self.user_id = user_id

    def index_entire_repo(self):
        """
            1. Builds Basic KG
            2. Adds LSP Edges
            3. Vectorizes the Graph and stores the embeddings into ChromaDB
            4. Saves the Graph itself as a .json in /kg_store
        """

        # Build the Basic Knowledge Graph

        # Initialize indexer with language handlers
        indexer = CodeIndexer(self.dir_path, handlers=ENABLED_LANGUAGES)

        # Build the graph (folders → files → classes/functions/methods)
        KG = indexer.index_directory()

        print(f"Graph: {len(KG.nodes)} nodes, {len(KG.edges)} edges")

        # Add LSP Edges
        # Build span index (maps file URIs → definition spans)
        span_index = build_span_index(KG)

        # Initialize LSP manager
        lsp_manager = LSPManager(ENABLED_LANGUAGES, root_dir=self.dir_path)
        lsp_manager.initialize_all(Path(self.dir_path).resolve().as_uri())

        # Open files in LSP servers
        for file_node in [n for n in KG.nodes.values() if n.label == NodeLabel.FILE]:
            client, handler = lsp_manager.get_client_for_file(file_node.path)
            text = Path(file_node.path).read_text(encoding='utf-8')
            client.did_open(file_node.path, handler.get_lsp_language_id(), text)

        # Add edges
        add_imports_edges(KG, lsp_manager)   # IMPORTS edges
        add_calls_edges(KG, lsp_manager, span_index)  # CALLS edges

        # Cleanup
        lsp_manager.shutdown_all()

        # Index into ChromaDB (only class/function/method nodes are embedded)
        vectorstore = index_graph_into_vectors(
            KG,
            collection_name=self.user_id,
            repo_id=self.repo_id,
            persist_dir=CODE_CHROMA_DB_PATH,
        )

        # Save the created Knowledge Graph for retreival later
        KG.save(f"{KG_GRAPH_STORE_PATH}/graph_{self.user_id}_{self.repo_id}.json")
        return