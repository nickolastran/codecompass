"""
Embeddings Configuration

Centralized configuration for code embeddings.
Switch between Voyage API (remote) and local models here.
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
            prompt_name="query",
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


def get_embeddings(use_local: bool = True):
    """
    Get the configured embeddings model.

    Args:
        use_local: If True, use local nomic-embed-code model.
                   If False, use Voyage AI's voyage-code-3 (requires VOYAGE_API_KEY in .env).

    Returns:
        Embeddings instance compatible with Chroma
    """
    if use_local:
        # Local nomic-embed-code model (optimized for code)
        model_path = str(Path(__file__).parent / "models" / "nomic-embed-code")

        # Auto-detect best available device
        device = 'cpu' if not torch.cuda.is_available() else 'cuda'

        print(f"[Embeddings] Loading nomic-embed-code model on: {device.upper()}")

        # Load SentenceTransformer model
        model = SentenceTransformer(model_path, device=device, trust_remote_code=True)

        print(f"[Embeddings] Model loaded successfully")

        # Use smaller batch size for GPU to avoid OOM errors
        batch_size = 4

        # Wrap with our lightweight custom class
        return SimpleEmbeddings(model=model, batch_size=batch_size)
    else:
        # Voyage AI voyage-code-3 (requires VOYAGE_API_KEY in environment)
        print("[Embeddings] Using Voyage AI voyage-code-3")
        return VoyageEmbeddings()


# Default embedder - change use_local to switch models
DEFAULT_EMBEDDINGS = get_embeddings(use_local=False)
