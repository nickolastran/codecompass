"""
    This file contains the main function that does all the startup checks, i.e., checks to see if all the dependencies that CodeCompass's backend uses is setup correctly and running.

    This script is run when the backend server is started for the very first time
"""

import os
import subprocess

from .ollama_checks import Ollama_Manager
from .chroma_checks import Chroma_Manager

from config import KG_GRAPH_STORE_PATH

# Simple colored print helpers
def info(msg): print(f"[INFO]  {msg}")
def ok(msg): print(f"[OK]    {msg}")
def warn(msg): print(f"[WARN]  {msg}")
def error(msg): print(f"[ERROR] {msg}")


async def run_startup_checks():

    # ---------------------------
    # OLLAMA CHECKS
    # ---------------------------
    info("Checking Ollama installation...")

    Ollama = Ollama_Manager()

    # Check if Ollama is installed
    if not Ollama.is_ollama_installed():
        error("Ollama is NOT installed. Exiting startup.")
        return
    ok("Ollama is installed.")


    # Start Ollama if it's not already running
    info("Checking if Ollama server is running...")
    if not Ollama.is_ollama_running():
        warn("Ollama server is NOT running. Attempting to start it...")
        try:
            subprocess.Popen(
                ["ollama", "serve"]
            )  # starts the Ollama server using subprocess
            time.sleep(2)  # waits 2 seconds to allow the server to start
            ok("Ollama server started.")
        except FileNotFoundError:
            error("Failed to start Ollama. Not found in PATH.")
            raise RuntimeError(
                "Ollama not found. Make sure it's installed and in PATH."
            )
    else:
        ok("Ollama server is already running.")


    # Check if Certain Ollama LLMs are installed
    # TODO
    
    # ---------------------------
    # CHROMA CHECKS
    # ---------------------------
    info("\nChecking ChromaDB setup...")

    Chroma = Chroma_Manager()
    # Check if ChromaDB for Documentation exists, if not create it
    Chroma.is_docu_chormadb_created()

    ok("ChromaDB is ready.")

    # ---------------------------
    # KNOWLEDGE GRAPH STORE DIR
    # ---------------------------
    info("\nEnsuring Knowledge Graph store directory exists...")
    # Check if a Directory to store Knowledge Graphs is created, if not create it
    os.makedirs(KG_GRAPH_STORE_PATH, exist_ok=True)
    
    ok(f"Directory ready at: {KG_GRAPH_STORE_PATH}")

    info("\nStartup checks complete. System is ready.\n")

