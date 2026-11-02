"""
Embeddings Configuration

Centralized configuration for code embeddings.
Set CODE_EMBEDDING_MODEL in .env for a local model; unset uses Voyage API.
"""

import os
import torch
from typing import List, cast
from sentence_transformers import SentenceTransformer
import voyageai
from pathlib import Path
from dotenv import load_dotenv

class SimpleEmbeddings:
    """
    Lightweight wrapper around SentenceTransformer for Chroma.
    Implements the two methods Chroma needs: embed_documents and embed_query.
    """

    def __init__(self, model: SentenceTransformer, batch_size: int = 4):
        self.model = model
        self.batch_size = batch_size

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of documents"""
        embeddings = self.model.encode(
            texts,
            batch_size=self.batch_size,
            show_progress_bar=True,
            normalize_embeddings=True,
        )
        return embeddings.tolist()

    def embed_query(self, text: str) -> List[float]:
        """Embed a single query"""
        embedding = self.model.encode(
            [text],
            batch_size=1,
            show_progress_bar=False,
            normalize_embeddings=True,
            prompt_name="query" if "query" in self.model.prompts else None,
        )
        return embedding[0].tolist()

class VoyageEmbeddings:
    """
    Minimal wrapper around Voyage AI for Chroma.
    Uses voyage-code-3 model optimized for code.
    """

    def __init__(self):
        # Reads VOYAGE_API_KEY from environment automatically
        load_dotenv()
        self.client = voyageai.Client()  # type: ignore
        self.model = "voyage-code-3"

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of documents"""
        result = self.client.embed(
            texts=texts,
            model=self.model,
            input_type="document",
            output_dtype="float",  # Ensure float output
        )
        # Cast to handle Union[List[List[float]], List[List[int]]] type
        # output_dtype="float" ensures this is List[List[float]] at runtime
        return result.embeddings

    def embed_query(self, text: str) -> List[float]:
        """Embed a single query"""
        result = self.client.embed(
            texts=[text],
            model=self.model,
            input_type="query",
            output_dtype="float",  # Ensure float output
        )
        # Cast to handle Union[List[List[float]], List[List[int]]] type
        # output_dtype="float" ensures this is List[float] at runtime
        embeddings = result.embeddings
        return embeddings[0]

def get_embeddings():
    """
    Get the configured code embeddings model.

    CODE_EMBEDDING_MODEL set (Hugging Face id or local path) -> local SentenceTransformer, free.
    Otherwise -> Voyage AI voyage-code-3 (requires VOYAGE_API_KEY).

    Changing the model changes vector dimensions: re-index repos indexed with the old one.
    """
    load_dotenv()  # main.py imports routes (and this module) before it loads .env
    model_name = os.getenv("CODE_EMBEDDING_MODEL")

    if not model_name:
        print("[Embeddings] Using Voyage AI voyage-code-3")
        return VoyageEmbeddings()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[Embeddings] Loading {model_name} on {device.upper()}")
    model = SentenceTransformer(model_name, device=device)
    # ponytail: truncate long definitions to keep CPU embedding fast; chunk them if recall on huge functions matters
    model.max_seq_length = min(model.max_seq_length or 512, 512)
    return SimpleEmbeddings(model=model, batch_size=8)


# Built once at import; shared by indexing (process_graph) and chat (code_retreival_script)
DEFAULT_EMBEDDINGS = get_embeddings()
