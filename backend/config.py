"""
    This config file is used to calculate the directory paths to the vector DB's
"""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DOCUMENTATION_CHROMA_DB_PATH = os.path.join(BASE_DIR, "document_chroma_db")

CODE_CHROMA_DB_PATH = os.path.join(BASE_DIR, "code_chroma_db")

KG_GRAPH_STORE_PATH = os.path.join(BASE_DIR, "kg_store")

