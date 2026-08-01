"""
    This file contains all the functions pertaining to Indexing a users Documentation files(i.e. .txt, .md and .pdf files)
    If .pdf then the file is first parsed into .md.
    For .txt & .md, read the file, chunk the file and store embeddings in the Chroma VectorDB
    The collection name is the `user_id` and the chunks are tagged with `repo_id` in their metadata
"""

import os

import chromadb
from sentence_transformers import SentenceTransformer

from config import DOCUMENTATION_CHROMA_DB_PATH

import hashlib

class Document_Indexing:
    def __init__(self, user_id: str,repo_id: str):
        
        self.user_id = user_id  # used for collection name
        self.repo_id = repo_id  # used for metadata of chunk

        self.model = SentenceTransformer(os.getenv("DOCUMENT_EMBEDDING_MODEL")) # Loading the Embedding model
        
        # get or create a collection
        # collection name is always the user_id
        collection_name = self.user_id

        client = chromadb.PersistentClient(path=DOCUMENTATION_CHROMA_DB_PATH)

        self.collection = client.get_or_create_collection(name=collection_name, metadata={"hnsw:space": "cosine"})

    def Index_File(self, filepath: str):
        """ 
            Dispatched the file to either `Index_pdf(..)` or Index_text_md(..)

            Args: filpath (str) : file to be indexed
            Return: -
        """
        
        # Extract extension
        filename = os.path.basename(filepath)
        _, ext = os.path.splitext(filename)

        # There isn't a need for a default error check for the ext as that is handled earlir in the `indexing_script` before this function is called, we are gauranteed a valid file extension
        if ext.lower() == ".pdf":
            # TODO
            pass
        else:
            # The ext is .md or .txt
            self.Index_text_md(filepath)

        return

    def Index_pdf(self, filepath: str):
        """
            Parse the pdf into .md format using docling and then simply call `Index_text_md(..)` on this parsed markdown file.
        """

        # TODO
        # Parse the pdf into .md using Docling
        # Store the .md in a tmp folder and pass that .md file to Index_text_md

        return

    def Index_text_md(self, filepath: str):
        """
            Uses helper function `stream_chunks_from_file()` to generate chunks from file to be indexed and actually store the embedding of the chunk into the Chroma vector DB with appropriate metadata(`repo_id`) in the users collection.
        """
        # chunks is a generator object
        chunks = self.stream_chunks_from_file(filepath)

        # Store all chunks at once (more efficient)
        all_ids = []
        all_documents = []
        all_embeddings = []
        all_metadatas = []

        # Embed Each chunk into the Chroma Vector DB
        for i, chunk in enumerate(chunks):
            # Generate unique ID for each chunk
            # chunk_id = f"chunk_{i}_{self.repo_id}" <<-- old imp., causes collisions

            # Hash the full filepath, not just the filename
            file_hash = hashlib.md5(filepath.encode()).hexdigest()[:8]
            chunk_id = f"{self.repo_id}_{file_hash}_chunk_{i}"


            # Encode this chunk only
            embedding = self.model.encode(chunk, normalize_embeddings=True).tolist()

            # TODO THIS SOURCE filepath MAY NEED TO BE EDITED!!!
            metadata = {"repo_id": self.repo_id, 
            "user_id": self.user_id, "source": filepath}

            # Collect for batch insert
            all_ids.append(chunk_id)
            all_documents.append(chunk)
            all_embeddings.append(embedding)
            all_metadatas.append(metadata)            


        # Add all chunks to collection in one operation
        if all_ids:  # Only if there are chunks
            self.collection.add(
                ids=all_ids,
                documents=all_documents,
                embeddings=all_embeddings,
                metadatas=all_metadatas
            )
            print(f"Successfully stored {len(all_ids)} chunks")

        return

    # This is a modular function
    # Replace this with more Sophisticated Chunking Strategy later!
    def stream_chunks_from_file(self, filepath: str, chunk_size: int = 800, chunk_overlap: int = 200):
        """
        - Streams chunks from the .txt/.md file one by one. 
        - Chunks based on fixed size + paragraphs

        Args:
            filepath: Path to the text file
            chunk_size: Maximum chunk size in characters
            chunk_overlap: Overlap size between chunks in characters

        Yields:
            chunk (str): text chunk
        """ 
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                text = f.read()
        except FileNotFoundError:
            print(f"File not found: {filepath}")
            return
        except Exception as e:
            print(f"Error reading file: {e}")
            return

        text = text.replace("\r", "").strip()
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        current = ""
        for para in paragraphs:
            # If adding this paragraph would exceed chunk size and we have content
            if current and len(current) + len(para) > chunk_size:
                yield current.strip()
                # Start new chunk with overlap
                current = current[-chunk_overlap:] + "\n" + para
            else:
                # Add paragraph to current chunk
                if current:
                    current += "\n" + para
                else:
                    current = para  # First paragraph

        # Emit last chunk if not empty
        if current.strip():
            yield current.strip()


def main():
    return

if __name__ == "__main__":
    main()