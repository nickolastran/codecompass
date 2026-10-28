"""
API routes for repository indexing and documentation generation.

Integrates the complete 5-phase CodeCompass pipeline:
1. Code Indexing - Build knowledge graph
2. Summarization - Generate AI summaries
3. IA Generation - Generate wiki information architecture
4. Content Generation - Generate markdown wiki pages
5. Vectorization - Index knowledge graph into ChromaDB for semantic search
"""

import os
import shutil

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request
from git import GitCommandError, Repo
from pydantic import BaseModel

from indexing_pipelines.code_pipeline.docs.llm.ollama_provider import OllamaProvider

# Import LLM providers
from indexing_pipelines.code_pipeline.docs.llm.openai_provider import OpenAIProvider

# Import documentation pipeline functions from documentation.py
from indexing_pipelines.code_pipeline.documentation import (
    build_knowledge_graph,
    generate_summaries,
    generate_wiki_content,
    generate_wiki_ia,
)


from services.github_app import github_app
from services.create_client import supabase
from services.pages_service import insert_wiki_pages


from indexing_pipelines.indexing_script import Indexing_Pipeline_Head

# Load environment variables
load_dotenv()

router = APIRouter()

# ============================================================================
# PIPELINE CONFIGURATION
# ============================================================================

# LLM Provider configuration
DEFAULT_PROVIDER = "openai"  # Options: "openai", "ollama"
DEFAULT_MODEL = "gpt-4o-mini"  # For OpenAI
DEFAULT_OLLAMA_MODEL = "deepseek-r1"  # For Ollama
MAX_CONCURRENT = 10  # For OpenAI (lower due to rate limits)
OLLAMA_CONCURRENT = 50  # For Ollama (higher, no rate limits)

# Pipeline options
FAST_MODE = False  # Skip detailed summaries (30-50% faster)
NO_SUBPAGES = False  # Skip generating detailed subpages in IA
VERBOSE = True  # Print detailed progress


def _mark_failed(repo_id, message: str):
    """Record a failed run so the UI shows an error instead of spinning forever."""
    if not repo_id:
        return
    try:
        supabase.table("repositories").update(
            {"index_status": "failed", "metadata": {"index_error": message}}
        ).eq("id", repo_id).execute()
    except Exception as e:
        print(f"Failed to mark repo {repo_id} as failed: {e}")


class IndexRequest(BaseModel):
    repo_url: str
    installation_id: str
    branch: str


@router.post("/repos/index")
async def index_repo(request: Request):
    """
    Index a repository - clone and process it with the full documentation pipeline.

    Receives pre-validated repo info from Next.js API routes with GitHub App auth.

    Runs the complete 5-phase CodeCompass pipeline:
    1. Clone repository
    2. Build knowledge graph (code indexing)
    3. Generate AI summaries (definitions -> classes -> files -> modules)
    4. Generate wiki information architecture
    5. Generate markdown wiki pages
    6. Vectorize knowledge graph into ChromaDB for semantic search
    """
    provider = None
    repo_id = None

    try:
        body = await request.json()

        url = body.get("repo_url")
        user_id = body.get("user_id")
        repo_id = body.get("repo_id")
        installation_id = body.get("installation_id")
        latest_version = body.get("version")
        branch = body.get("branch")

        if not url or not user_id or not installation_id or not branch:
            raise HTTPException(status_code=400, detail="Missing required fields")

        # Fail before cloning if the LLM provider can't run
        if not os.getenv("OPENAI_API_KEY") and DEFAULT_PROVIDER == "openai":
            raise HTTPException(
                status_code=500,
                detail="OPENAI_API_KEY is not set. Add it to backend/.env and restart the backend.",
            )

        # Parse owner and repo from url
        owner, repo = url.split("/")[-2:]

        # Obtain installation token from github app
        token = github_app.get_installation_token(installation_id=int(installation_id))

        # Create a directory for cloning within the project
        clone_base_dir = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "cloned_repos"
        )
        os.makedirs(clone_base_dir, exist_ok=True)

        # Create a unique directory for this repo
        temp_dir = os.path.join(clone_base_dir, f"{owner}_{repo}_{branch}")

        # ====================================================================
        # STEP 1: Clone Repository
        # ====================================================================
        print("STARTING CLONE REPO")
        try:
            # Clone the repository using installation_id for auth (shallow clone with depth=1)
            auth_url = f"https://x-access-token:{token}@github.com/{owner}/{repo}.git"
            Repo.clone_from(auth_url, temp_dir, branch=branch, depth=1)

        except GitCommandError as git_error:
            # Clean up temp directory on failure
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

            # Check for specific git errors
            error_message = (
                str(git_error.stderr) if git_error.stderr else str(git_error)
            )

            if (
                "repository not found" in error_message.lower()
                or "not found" in error_message.lower()
            ):
                raise HTTPException(
                    status_code=404, detail=f"Repository not found: {url}"
                )
            elif (
                "invalid username or password" in error_message.lower()
                or "authentication failed" in error_message.lower()
            ):
                raise HTTPException(
                    status_code=401,
                    detail="Authentication failed. Invalid installation token.",
                )
            elif "not a git repository" in error_message.lower():
                raise HTTPException(
                    status_code=400, detail=f"Invalid repository URL: {url}"
                )
            else:
                raise HTTPException(
                    status_code=500, detail=f"Git clone failed: {error_message}"
                )

        # ====================================================================
        # STEP 1.5: Actual Indexing of Codebase
        # ====================================================================
        
        print("STARTING ACTUAL INDEXING")

        Indexer_obj = Indexing_Pipeline_Head(temp_dir, user_id, repo_id)
        Indexer_obj.dispatch_files()

        print("INDEXING COMPLETE")

        # ====================================================================
        # STEP 2-5: Run Documentation Pipeline
        # ====================================================================
        print("RUNNING DOCUMENTATION PIPELINE")

        # Initialize LLM provider
        if DEFAULT_PROVIDER == "openai":
            provider = OpenAIProvider(
                model=DEFAULT_MODEL, max_concurrent=MAX_CONCURRENT
            )
        else:
            provider = OllamaProvider(
                model=DEFAULT_OLLAMA_MODEL, max_concurrent=OLLAMA_CONCURRENT
            )

        # Define paths for outputs within cloned repo
        codecompass_dir = os.path.join(temp_dir, ".codecompass")
        graph_cache_path = os.path.join(codecompass_dir, "graph.json")
        summaries_path = os.path.join(codecompass_dir, "summaries.json")
        module_summaries_path = os.path.join(codecompass_dir, "module_summaries.json")
        ia_path = os.path.join(codecompass_dir, "wiki_ia.json")
        wiki_output_dir = os.path.join(temp_dir, "wiki")

        # Phase 1: Build knowledge graph
        graph = await build_knowledge_graph(
            repo_path=temp_dir,
            graph_cache_path=graph_cache_path,
            rebuild=False,  # Use cache if available
            verbose=VERBOSE,
        )

        # Count nodes for statistics
        from indexing_pipelines.code_pipeline.core.graph_model import NodeLabel

        graph_stats = {
            "folders": len(
                [n for n in graph.nodes.values() if n.label == NodeLabel.FOLDER]
            ),
            "files": len(
                [n for n in graph.nodes.values() if n.label == NodeLabel.FILE]
            ),
            "classes": len(
                [n for n in graph.nodes.values() if n.label == NodeLabel.CLASS]
            ),
            "methods": len(
                [n for n in graph.nodes.values() if n.label == NodeLabel.METHOD]
            ),
            "functions": len(
                [n for n in graph.nodes.values() if n.label == NodeLabel.FUNCTION]
            ),
            "total_nodes": len(graph.nodes),
            "total_edges": len(graph.edges),
        }

        # Phase 2: Generate AI summaries
        # Note: generate_summaries from documentation.py uses hardcoded paths
        # We need to temporarily change working directory or modify the function
        # For now, we'll call it and let it use default paths within temp_dir
        original_cwd = os.getcwd()
        try:
            os.chdir(temp_dir)  # Change to repo directory so .codecompass/ paths work

            summarization_stats = await generate_summaries(
                graph=graph,
                provider=provider,
                repo_path=temp_dir,
                fast_mode=FAST_MODE,
                verbose=VERBOSE,
            )

            # Phase 3: Generate wiki IA
            ia = await generate_wiki_ia(
                graph=graph,
                provider=provider,
                repo_path=temp_dir,
                no_subpages=NO_SUBPAGES,
                verbose=VERBOSE,
            )

            # Get IA stats
            ia_stats = ia.get_stats()
            coverage = ia.metadata.get("coverage_stats", {}).get(
                "coverage_percentage", 0
            )
            wiki_ia_stats = {
                "total_pages": ia_stats["total_pages"],
                "max_depth": ia_stats["max_depth"],
                "coverage_percentage": coverage,
            }

            # Phase 4: Generate wiki content
            content_stats = await generate_wiki_content(
                graph=graph,
                ia=ia,
                provider=provider,
                repo_path=temp_dir,
                output_dir=wiki_output_dir,
                verbose=VERBOSE,
            )

            # Phase 5: Vectorize knowledge graph
            vectorization_stats = None
            try:
                if VERBOSE:
                    print("\n" + "=" * 70)
                    print("PHASE 5: Knowledge Graph Vectorization")
                    print("=" * 70)

                # Import vectorization modules
                from Indexing_Pipeline.vectorization.embeddings_config import (
                    get_embeddings,
                )
                from Indexing_Pipeline.vectorization.process_graph import (
                    index_graph_into_vectors,
                )

                # Configuration
                use_local_embeddings = (
                    False  # Set to True for local nomic-embed-code, False for Voyage AI
                )

                # Use version-specific collection name and directory
                collection_name = f"code_graph_v{latest_version}"
                persist_dir = os.path.join(
                    codecompass_dir, f"chroma_db_v{latest_version}"
                )

                # Check for required API key if using Voyage AI
                if not use_local_embeddings and not os.getenv("VOYAGE_API_KEY"):
                    print(
                        "\n WARNING: VOYAGE_API_KEY not set, skipping vectorization"
                    )
                    print("  Set VOYAGE_API_KEY in .env to enable vector search")
                    vectorization_stats = {
                        "status": "skipped",
                        "reason": "VOYAGE_API_KEY not set",
                        "vectorized_count": 0,
                    }
                else:
                    if VERBOSE:
                        embedding_model = (
                            "nomic-embed-code (local)"
                            if use_local_embeddings
                            else "voyage-code-3 (Voyage AI)"
                        )
                        print(f"Vectorizing code definitions into {persist_dir}...")
                        print(f"  Collection name: {collection_name}")
                        print(f"  Embedding model: {embedding_model}")

                    # Get embeddings configuration
                    embeddings = get_embeddings(use_local=use_local_embeddings)

                    # Vectorize the graph with version-specific collection
                    vectorstore = index_graph_into_vectors(
                        graph, persist_dir=persist_dir, collection_name=collection_name
                    )

                    # Get statistics
                    collection = vectorstore._collection
                    count = collection.count()

                    vectorization_stats = {
                        "status": "success",
                        "vectorized_count": count,
                        "embedding_model": "nomic-embed-code"
                        if use_local_embeddings
                        else "voyage-code-3",
                        "vector_db_path": persist_dir,
                        "collection_name": collection_name,
                        "version": latest_version,
                    }

                    if VERBOSE:
                        print(f" Vectorized {count} code definitions")
                        print(f" Vector database: {persist_dir}")

            except Exception as vec_error:
                # Log vectorization error but don't fail the pipeline
                import traceback

                error_trace = traceback.format_exc()
                error_message = f"Vectorization failed: {str(vec_error)}"

                print(f"\n WARNING: {error_message}")
                if VERBOSE:
                    print(f"Error trace:\n{error_trace}")

                vectorization_stats = {
                    "status": "failed",
                    "error": error_message,
                    "vectorized_count": 0,
                }

            # Phase 6: Database operations (wrapped in try-except for graceful error handling)
            page_insertion_stats = None
            documentation_id = None

            try:
                # Update repository status in Supabase
                if VERBOSE:
                    print("\n=== Updating repository status in Supabase ===")

                # Update repository status - Supabase raises exceptions on errors
                response = (
                    supabase.table("repositories")
                    .update({"index_status": "indexed"})
                    .eq("id", repo_id)
                    .execute()
                )

                # Insert documentation row into Supabase
                if VERBOSE:
                    print("=== Inserting documentation record ===")

                doc_response = (
                    supabase.table("documentation")
                    .insert(
                        {
                            "repo_id": repo_id,
                            "title": repo,
                            "metadata": {
                                "status": "success",
                                "message": "Repository indexed and documented successfully",
                                "repo_url": url,
                                "branch": branch,
                                "temp_dir": temp_dir,
                                "indexing_results": {
                                    "graph_stats": graph_stats,
                                    "summarization_stats": summarization_stats,
                                    "wiki_ia_stats": wiki_ia_stats,
                                    "content_generation_stats": content_stats,
                                    "vectorization_stats": vectorization_stats,
                                    "output_paths": {
                                        "graph": os.path.join(
                                            temp_dir, ".codecompass", "graph.json"
                                        ),
                                        "summaries": os.path.join(
                                            temp_dir, ".codecompass", "summaries.json"
                                        ),
                                        "module_summaries": os.path.join(
                                            temp_dir,
                                            ".codecompass",
                                            "module_summaries.json",
                                        ),
                                        "wiki_ia": os.path.join(
                                            temp_dir, ".codecompass", "wiki_ia.json"
                                        ),
                                        "wiki_content": os.path.join(temp_dir, "wiki/"),
                                        "vector_db": os.path.join(
                                            temp_dir, ".codecompass", "chroma_db/"
                                        ),
                                    },
                                },
                            },
                            "version": latest_version,
                        }
                    )
                    .execute()
                )

                # Get the documentation_id from the insert response
                # Supabase raises exceptions on errors, no need to check doc_response.error
                documentation_id = (
                    doc_response.data[0]["id"] if doc_response.data else None
                )
                if not documentation_id:
                    raise Exception("Failed to retrieve documentation_id after insert")

                if VERBOSE:
                    print(f"Documentation record created with ID: {documentation_id}")

                # Phase 5b: Insert wiki pages into Supabase
                if VERBOSE:
                    print("\n=== Inserting wiki pages into Supabase ===")

                from pathlib import Path

                page_insertion_stats = await insert_wiki_pages(
                    supabase=supabase,
                    documentation_id=documentation_id,
                    documentation_version=latest_version,
                    wiki_ia=ia,
                    graph=graph,
                    wiki_dir=Path(wiki_output_dir),
                    verbose=VERBOSE,
                )

                if VERBOSE:
                    print(
                        f"\n Successfully inserted {page_insertion_stats['successful_inserts']} pages"
                    )

            except Exception as db_error:
                # Log the database error but don't fail the entire pipeline
                import traceback

                error_trace = traceback.format_exc()
                error_message = f"Database operation failed: {str(db_error)}"

                print(f"\n WARNING: {error_message}")
                if VERBOSE:
                    print(f"Error trace:\n{error_trace}")

                # Set default values for missing stats
                if page_insertion_stats is None:
                    page_insertion_stats = {
                        "total_pages": 0,
                        "successful_inserts": 0,
                        "failed_inserts": 0,
                        "pages_by_kind": {},
                        "error": error_message,
                    }

                # Continue execution - files are still saved locally

        finally:
            os.chdir(original_cwd)  # Restore original working directory

        return {
            "status": "success",
            "message": "Repository indexed and documented successfully",
            "repo_url": url,
            "branch": branch,
            "temp_dir": temp_dir,
            "documentation_id": documentation_id,
            "indexing_results": {
                "graph_stats": graph_stats,
                "summarization_stats": summarization_stats,
                "wiki_ia_stats": wiki_ia_stats,
                "content_generation_stats": content_stats,
                "vectorization_stats": vectorization_stats,
                "page_insertion_stats": page_insertion_stats,
                "output_paths": {
                    "graph": os.path.join(temp_dir, ".codecompass", "graph.json"),
                    "summaries": os.path.join(
                        temp_dir, ".codecompass", "summaries.json"
                    ),
                    "module_summaries": os.path.join(
                        temp_dir, ".codecompass", "module_summaries.json"
                    ),
                    "wiki_ia": os.path.join(temp_dir, ".codecompass", "wiki_ia.json"),
                    "wiki_content": os.path.join(temp_dir, "wiki/"),
                    "vector_db": os.path.join(temp_dir, ".codecompass", "chroma_db/"),
                },
            },
        }

        # TODO: Store generated documentation files in database
        # Currently files are kept in: cloned_repos/{owner}_{repo}_{branch}/
        # Files to store:
        # - .codecompass/graph.json (knowledge graph)
        # - .codecompass/summaries.json (node summaries)
        # - .codecompass/module_summaries.json (module summaries)
        # - .codecompass/wiki_ia.json (wiki information architecture)
        # - wiki/*.md files (generated wiki pages)
        # After database storage is implemented, add cleanup: shutil.rmtree(temp_dir)

    except HTTPException as e:
        _mark_failed(repo_id, str(e.detail))
        raise

    except Exception as e:
        # Clean up on failure
        if "temp_dir" in locals() and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

        import traceback

        error_detail = f"Indexing pipeline failed: {str(e)}\n{traceback.format_exc()}"
        _mark_failed(repo_id, f"Indexing pipeline failed: {e}")
        raise HTTPException(status_code=500, detail=error_detail)

    finally:
        # Always clean up provider
        if provider is not None:
            await provider.close()