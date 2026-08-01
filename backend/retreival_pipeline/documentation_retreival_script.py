"""
    This file contains all the code for retreiving from the ChromaDB that contains all the documentation embeddings
"""

import os

import chromadb
from sentence_transformers import SentenceTransformer
from config import DOCUMENTATION_CHROMA_DB_PATH

class Documentation_Retreival:
    def __init__(self, user_id: str, repo_id: str):
        self.user_id = user_id
        self.repo_id = repo_id

        self.client = chromadb.PersistentClient(path=DOCUMENTATION_CHROMA_DB_PATH)
        self.model = SentenceTransformer(os.getenv("DOCUMENT_EMBEDDING_MODEL"))

    def retreive_from_DB(self, query: str):
        """
            Retrieve similar context chunks based on query from Chrom DB

            Args:
                query (str): Entered user query

            Returns:
                context (str): Retreived Context
                chunks_list (List[str]): 
                filepaths_list (List[str]):
        """
        
        # Get the collection
        collection = self.client.get_collection(name=self.user_id)

        # Generate query embedding
        query_embedding = self.model.encode(query, normalize_embeddings=True).tolist()
        
        # Retreive the collection
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=3,
            where={"repo_id": self.repo_id},   # ← FILTER BY METADATA
            include=["documents", "metadatas", "distances"]
        )

        # Parse the results
        # A list with each element being one of the retreived chunks
    

        # One string with all the context


        # A list with all the filepaths


        # Extract first batch from Chroma (because everything is batched)
        docs = results["documents"][0]
        metas = results["metadatas"][0]

        # 1. A list with each retrieved chunk (list of strings)
        chunks_list = docs

        # 2. One string with all the context
        full_context = "\n\n".join(docs)

        # 3. A list with all the file paths (from metadata["source"])
        filepaths_list = [m.get("source") for m in metas]


        #print("full_context=", full_context)
        #print("chunks_list=", chunks_list)
        #print("filepaths=", filepaths)

        return full_context, chunks_list, filepaths_list
