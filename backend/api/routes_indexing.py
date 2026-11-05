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
import subprocess
import sys
import time
import zipfile

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
from indexing_pipelines.code_pipeline.core.summary_cache import save_summaries
from indexing_pipelines.code_pipeline.docs.llm.async_executor import index_progress


from services.github_app import github_app
from services.create_client import supabase
from services.pages_service import insert_wiki_pages
from services.upload_zip import extract_upload


from indexing_pipelines.indexing_script import Indexing_Pipeline_Head

# Load environment variables
load_dotenv()

router = APIRouter()

# ============================================================================
# PIPELINE CONFIGURATION
# ============================================================================

# LLM Provider configuration
DEFAULT_PROVIDER = "openai"  # Options: "openai", "ollama"
DEFAULT_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")  # Any OpenAI-compatible model
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


def _progress_writer(repo_id):
    """Returns report(text, force=False) that shows text on the repo's indexing screen (it polls every 5s)."""
    last = 0.0

    def report(text: str, force: bool = False):
        nonlocal last
        # Per-call batch updates are throttled; phase changes always go through
        if not repo_id or (not force and time.monotonic() - last < 3):
            return
        last = time.monotonic()
        try:
            supabase.table("repositories").update(
                {"metadata": {"index_progress": text}}
            ).eq("id", repo_id).execute()
        except Exception as e:
            print(f"Could not report progress: {e}")

    return report


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
        access_token = body.get("access_token")  # GitLab / Bitbucket OAuth token
        object_path = body.get("object_path")  # local upload in the local_repos bucket
        report = _progress_writer(repo_id)
        index_progress.set(report)
        git_provider = body.get("provider", "github")
        latest_version = body.get("version")
        branch = body.get("branch")

        is_upload = git_provider == "local"
        if not user_id or not (
            object_path
            if is_upload
            else url and (git_provider == "mercurial" or installation_id or access_token)
        ):
            raise HTTPException(status_code=400, detail="Missing required fields")

        # Fail before cloning if the LLM provider can't run
        if not os.getenv("LLM_API_KEY") and DEFAULT_PROVIDER == "openai":
            raise HTTPException(
                status_code=500,
                detail="LLM_API_KEY is not set. Add it to backend/.env and restart the backend.",
            )

        if is_upload:
            # Folder name comes from repo_id; repo (the docs title) is the user's name for it
            owner, repo, token = "local", body.get("name") or "upload", None
        else:
            owner, repo = url.rstrip("/").split("/")[-2:]

            if git_provider == "mercurial":
                # Public repos only; https keeps hg off ssh:// and the server's own files
                token = None
                if not url.startswith("https://"):
                    raise HTTPException(status_code=400, detail="Mercurial URL must start with https://")
            elif access_token:
                # GitLab and Bitbucket take an OAuth token as the password for a fixed username
                token = access_token
                username = "oauth2" if git_provider == "gitlab" else "x-token-auth"
                auth_url = url.replace("https://", f"https://{username}:{token}@", 1) + ".git"
            else:
                token = github_app.get_installation_token(installation_id=int(installation_id))
                auth_url = f"https://x-access-token:{token}@github.com/{owner}/{repo}.git"

        # Create a directory for cloning within the project
        clone_base_dir = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "cloned_repos"
        )
        os.makedirs(clone_base_dir, exist_ok=True)

        # Create a unique directory for this repo
        temp_dir = os.path.join(
            clone_base_dir, f"local_{repo_id}" if is_upload else f"{owner}_{repo}"
        )
        # A failed run's summaries live beside the clone (which gets deleted) so a retry skips finished LLM calls
        resume_cache = temp_dir + ".summaries.json"

        # A previous run (successful, or killed mid-way) leaves the clone behind; git won't clone into it
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

        # ====================================================================
        # STEP 1: Clone Repository
        # ====================================================================
        print("STARTING CLONE REPO")
        report("Cloning repository", force=True)
        if is_upload:
            # Older rows hold the full public URL; newer ones just the bucket path
            path = object_path.split("/local_repos/")[-1]
            try:
                data = supabase.storage.from_("local_repos").download(path)
            except Exception as e:
                raise HTTPException(status_code=404, detail=f"Uploaded zip not found: {e}")
            try:
                temp_dir = extract_upload(data, temp_dir)
            except zipfile.BadZipFile:
                raise HTTPException(status_code=400, detail="Upload is not a valid zip file")
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
            branch = "upload"
        elif git_provider == "mercurial":
            # dev.sh activates the venv; fall back to the venv's hg if PATH doesn't have it
            hg = shutil.which("hg") or os.path.join(os.path.dirname(sys.executable), "hg")
            try:
                subprocess.run(
                    [hg, "clone", "--", url, temp_dir],
                    check=True, capture_output=True, text=True, timeout=600,
                )
            except FileNotFoundError:
                raise HTTPException(status_code=500, detail="Mercurial isn't installed on the server (pip install mercurial)")
            except subprocess.TimeoutExpired:
                raise HTTPException(status_code=504, detail="hg clone took longer than 10 minutes")
            except subprocess.CalledProcessError as e:
                raise HTTPException(status_code=400, detail=f"hg clone failed: {e.stderr.strip()}")
            branch = "default"
        else:
            try:
                # Shallow clone; no branch given = the repo's default branch
                cloned = Repo.clone_from(
                    auth_url, temp_dir, depth=1, **({"branch": branch} if branch else {})
                )
                branch = cloned.active_branch.name

            except GitCommandError as git_error:
                # Clean up temp directory on failure
                if os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir)

                # Check for specific git errors
                error_message = (
                    str(git_error.stderr) if git_error.stderr else str(git_error)
                ).replace(token, "***")  # str(git_error) includes the authed URL

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
        report("Embedding code for search", force=True)

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
        report("Building knowledge graph", force=True)
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

        # Phase 2: Generate AI summaries (generate_summaries loads summaries_path and skips nodes it already has)
        # ponytail: resumed summaries aren't checked against code changes since the failed run; add a source hash if that matters
        if os.path.exists(resume_cache):
            os.makedirs(codecompass_dir, exist_ok=True)
            shutil.copyfile(resume_cache, summaries_path)

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

            # Don't build a wiki out of mostly-failed summaries
            if getattr(provider, "quota_exhausted", False):
                raise RuntimeError(
                    "Every model in LLM_MODEL hit its daily free-tier quota. "
                    "Try again after it resets (midnight Pacific) or add more models to LLM_MODEL."
                )

            # Phase 3: Generate wiki IA
            report("Planning documentation pages", force=True)
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
            report("Writing documentation pages", force=True)
            content_stats = await generate_wiki_content(
                graph=graph,
                ia=ia,
                provider=provider,
                repo_path=temp_dir,
                output_dir=wiki_output_dir,
                verbose=VERBOSE,
            )

            # Phase 6: Database operations (wrapped in try-except for graceful error handling)
            report("Saving documentation", force=True)
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

        if os.path.exists(resume_cache):
            os.remove(resume_cache)

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
        # Currently files are kept in: cloned_repos/{owner}_{repo}/
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
        if "graph" in locals():
            try:
                save_summaries(graph, cache_path=resume_cache)
            except Exception as save_error:
                print(f"Could not keep summaries for a retry: {save_error}")

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