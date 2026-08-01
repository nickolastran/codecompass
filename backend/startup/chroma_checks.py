"""
    All the functions you would need to check if Chroma Vector DB is already setup or a fresh Chroma DB needs to be created to start storing user's vector embeddings in.
"""

import os

import chromadb
from chromadb.config import Settings

from config import CODE_CHROMA_DB_PATH, DOCUMENTATION_CHROMA_DB_PATH

class Chroma_Manager():
    def __init__(self):
        pass

    def is_docu_chormadb_created(self):
        """
            - Ensures the Chroma vector DB for documentation exists. 
            - If the directory doesn't exist, create it. 
        """

        db_path = CODE_CHROMA_DB_PATH

        # This will either:
        # - Load existing DB if it exists at db_path
        # - Create new DB if it doesn't exist
        client = chromadb.PersistentClient(path=db_path)

        db_path = DOCUMENTATION_CHROMA_DB_PATH
        client = chromadb.PersistentClient(path=db_path)

        return