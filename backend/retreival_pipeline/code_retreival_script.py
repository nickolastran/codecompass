"""
    This file contains all the code for retreiving from the ChromaDB that contains the code embeddings and retreiving the context from the graph
"""

import os
import json

from indexing_pipelines.code_pipeline.retrieval import graphrag_context

from indexing_pipelines.code_pipeline.vectorization.embeddings_config import DEFAULT_EMBEDDINGS


from config import CODE_CHROMA_DB_PATH, KG_GRAPH_STORE_PATH

from langchain_chroma import Chroma

from indexing_pipelines.code_pipeline.core.graph_model import Graph

class Code_Retreival:
    def __init__(self, user_id: str, repo_id: str):
        self.user_id = user_id
        self.repo_id = repo_id

    def retreive_from_DB(self, query):
        """
            Given the query this function retreives the relevant code snippet context and returns it.

            Args:
                query (str): User Query
            Return:
                context (str):
                chunks_list (List[str]): 
                filepaths_list (List[str]):
        """

        # load users KG for this repo

        KG = Graph.load(f"{KG_GRAPH_STORE_PATH}/graph_{self.user_id}_{self.repo_id}.json")

        # make the chroma client with correct collection name

        vs = Chroma(
            collection_name=self.user_id,
            embedding_function=DEFAULT_EMBEDDINGS,
            persist_directory=CODE_CHROMA_DB_PATH,
            collection_metadata={"hnsw:space": "cosine"},
        )

        context, chunks_list, filepaths_list, linenums_list = graphrag_context(KG, vs, query, repo_id=self.repo_id, user_id=self.user_id)

        return context, chunks_list, filepaths_list
