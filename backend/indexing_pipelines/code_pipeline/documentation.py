"""
AI Documentation Generation Pipeline

Runs the complete 4-phase documentation generation process:
1. Code Indexing - Build knowledge graph
2. Summarization - Generate AI summaries (definitions -> classes -> files -> modules)
3. IA Generation - Generate wiki information architecture
4. Content Generation - Generate markdown wiki pages

Usage:
    python documentation.py

Requirements:
    - OPENAI_API_KEY environment variable (in .env file)
    - Target repository with Python code
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import find_dotenv, load_dotenv

from .core.code_indexing import CodeIndexer
from .core.graph_model import Graph, NodeLabel
from .core.summary_cache import load_summaries, save_summaries

# Import content generation
from .docs.ia.content_generator import generate_page_markdown

# Import IA generation
from .docs.ia.ia_generator import generate_ia
from .docs.ia.page_spec import WikiIA

# Import providers
from .docs.llm.openai_provider import OpenAIProvider
from .docs.summarizers.class_summarizer import async_summarize_classes

# Import async summarizers
from .docs.summarizers.definition_summarizer import async_summarize_definitions
from .docs.summarizers.file_summarizer import async_summarize_files
from .docs.summarizers.module_summarizer import async_summarize_modules
from .languages.python_handler import PythonHandler
from .languages.typescript_handler import TypeScriptHandler


def print_phase_header(phase_num: int, phase_name: str):
    """Print a formatted phase header."""
    print("\n" + "=" * 70)
    print(f"PHASE {phase_num}: {phase_name}")
    print("=" * 70)


def print_section(title: str):
    """Print a formatted section header."""
    print(f"\n{title}")
    print("-" * len(title))


async def build_knowledge_graph(
    repo_path: str, graph_cache_path: str, rebuild: bool, verbose: bool
) -> Graph:
    """
    Build or load knowledge graph from repository code.

    Args:
        repo_path: Path to repository to analyze
        graph_cache_path: Path to graph cache file
        rebuild: Force rebuild even if cache exists
        verbose: Print detailed progress

    Returns:
        Graph object
    """
    print_phase_header(1, "Code Indexing")

    # Try to load existing graph if not rebuilding
    if not rebuild and Path(graph_cache_path).exists():
        if verbose:
            print(f"Loading cached graph from {graph_cache_path}...")
        graph = Graph.load(graph_cache_path)
        if verbose:
            print(f"  Loaded graph: {len(graph.nodes)} nodes, {len(graph.edges)} edges")
        return graph

    # Build fresh graph
    if verbose:
        print(f"Building knowledge graph from {repo_path}...")

    indexer = CodeIndexer(
        base_dir=repo_path,
        handlers=[PythonHandler(), TypeScriptHandler()]
    )
    graph = indexer.index_directory()

    # Count nodes by type
    folder_nodes = [n for n in graph.nodes.values() if n.label == NodeLabel.FOLDER]
    file_nodes = [n for n in graph.nodes.values() if n.label == NodeLabel.FILE]
    class_nodes = [n for n in graph.nodes.values() if n.label == NodeLabel.CLASS]
    method_nodes = [n for n in graph.nodes.values() if n.label == NodeLabel.METHOD]
    function_nodes = [n for n in graph.nodes.values() if n.label == NodeLabel.FUNCTION]

    print(f"\nGraph built successfully:")
    print(f"  Folders: {len(folder_nodes)}")
    print(f"  Files: {len(file_nodes)}")
    print(f"  Classes: {len(class_nodes)}")
    print(f"  Methods: {len(method_nodes)}")
    print(f"  Functions: {len(function_nodes)}")
    print(f"  Total nodes: {len(graph.nodes)}")
    print(f"  Total edges: {len(graph.edges)}")

    # Save graph cache for future runs
    Path(graph_cache_path).parent.mkdir(parents=True, exist_ok=True)
    graph.save(graph_cache_path)
    if verbose:
        print(f"\nSaved graph cache to {graph_cache_path}")

    return graph


async def generate_summaries(
    graph: Graph,
    provider: OpenAIProvider,
    repo_path: str,
    fast_mode: bool,
    verbose: bool,
) -> dict:
    """
    Generate AI summaries for all code elements bottom-up.

    Args:
        graph: Knowledge graph
        provider: LLM provider
        repo_path: Path to repository
        fast_mode: Skip detailed summaries for speed
        verbose: Print detailed progress

    Returns:
        Statistics dict
    """
    print_phase_header(2, "AI Summarization")

    # Load existing summaries from cache
    summaries_path = ".codecompass/summaries.json"
    if Path(summaries_path).exists():
        if verbose:
            print(f"Loading existing summaries from {summaries_path}...")
        loaded_count = load_summaries(graph, cache_path=summaries_path)
        print(f"  Loaded {loaded_count} cached summaries")

    all_stats = {}

    # Sprint 1: Definition summaries (methods/functions)
    print_section("Sprint 1: Definition Summaries (methods/functions)")
    if fast_mode:
        print("Mode: FAST (short summaries only - 30-50% faster)")
    else:
        print("Mode: DETAILED (short + detailed summaries)")

    stats = await async_summarize_definitions(
        graph, provider, verbose=verbose, include_detailed=not fast_mode
    )
    all_stats["definitions"] = stats
    print(
        f"  Result: {stats['succeeded']} succeeded, {stats['failed']} failed, {stats['skipped']} skipped"
    )

    # Sprint 2 Task 1: Class summaries
    print_section("Sprint 2 Task 1: Class Summaries")
    stats = await async_summarize_classes(graph, provider, verbose=verbose)
    all_stats["classes"] = stats
    print(
        f"  Result: {stats['succeeded']} succeeded, {stats['failed']} failed, {stats['skipped']} skipped"
    )

    # Sprint 2 Task 2: File summaries
    print_section("Sprint 2 Task 2: File Summaries")
    stats = await async_summarize_files(graph, provider, verbose=verbose)
    all_stats["files"] = stats
    print(
        f"  Result: {stats['succeeded']} succeeded, {stats['failed']} failed, {stats['skipped']} skipped"
    )

    # Sprint 2 Task 3: Module summaries
    print_section("Sprint 2 Task 3: Module Summaries")

    # Build IMPORTS edges for module architecture
    if verbose:
        print("Building IMPORTS edges for module architecture...")

    try:
        from lsp.lsp_edges import add_imports_edges
        from lsp.lsp_manager import LSPManager

        lsp_manager = LSPManager(handlers=[PythonHandler()], root_dir=repo_path)

        imports_count = add_imports_edges(graph, lsp_manager)
        if verbose:
            print(f"  Added {imports_count} IMPORTS edges")

        lsp_manager.shutdown_all(cleanup_generated=False)

    except Exception as e:
        print(f"  Warning: Could not build IMPORTS edges: {e}")
        print("  Module summaries will not include import architecture")

    stats = await async_summarize_modules(graph, provider, verbose=verbose)
    all_stats["modules"] = stats
    print(
        f"  Result: {stats['succeeded']} succeeded, {stats['failed']} failed, {stats['skipped']} skipped"
    )

    # Save all summaries to cache
    print_section("Saving Summaries to Cache")
    saved_count = save_summaries(graph, cache_path=summaries_path)
    print(f"  Saved {saved_count} summaries to {summaries_path}")

    return all_stats


async def generate_wiki_ia(
    graph: Graph,
    provider: OpenAIProvider,
    repo_path: str,
    no_subpages: bool,
    verbose: bool,
) -> WikiIA:
    """
    Generate wiki information architecture (page structure + node assignments).

    Args:
        graph: Knowledge graph (should have summaries loaded)
        provider: LLM provider
        repo_path: Path to repository
        no_subpages: Skip generating detailed subpages
        verbose: Print detailed progress

    Returns:
        WikiIA object
    """
    print_phase_header(3, "Wiki Information Architecture Generation")

    # Load module summaries
    module_summaries_path = Path(".codecompass/module_summaries.json")

    if not module_summaries_path.exists():
        print(f"ERROR: Module summaries not found at {module_summaries_path}")
        print("Run summarization first to generate module summaries.")
        sys.exit(1)

    if verbose:
        print(f"Loading module summaries from {module_summaries_path}...")

    module_data = json.loads(module_summaries_path.read_text(encoding="utf-8"))
    module_summaries = module_data.get("summaries", {})
    print(f"  Loaded {len(module_summaries)} module summaries")

    # Load node summaries into graph (IMPORTANT: enables hybrid context strategy)
    node_summaries_path = ".codecompass/summaries.json"
    if Path(node_summaries_path).exists():
        if verbose:
            print(f"Loading node summaries from {node_summaries_path}...")
        loaded_count = load_summaries(graph, node_summaries_path)
        if verbose:
            print(f"  Loaded {loaded_count} node summaries into graph")

    # Extract project name
    project_name = Path(repo_path).name

    # Generate IA
    if verbose:
        print(f"\nGenerating wiki structure for '{project_name}'...")

    ia = await generate_ia(
        graph=graph,
        module_summaries=module_summaries,
        provider=provider,
        base_dir=repo_path,
        project_name=project_name,
        generate_subpages=not no_subpages,
        verbose=verbose,
    )

    # Save IA
    ia_path = ".codecompass/wiki_ia.json"
    Path(ia_path).parent.mkdir(parents=True, exist_ok=True)
    ia.save(ia_path)

    # Print stats
    stats = ia.get_stats()
    coverage = ia.metadata.get("coverage_stats", {}).get("coverage_percentage", 0)

    print(f"\nWiki IA generated successfully:")
    print(f"  Total pages: {stats['total_pages']}")
    print(f"  Max depth: {stats['max_depth']}")
    print(f"  Coverage: {coverage:.1f}%")
    print(f"  Saved to: {ia_path}")

    return ia


async def generate_wiki_content(
    graph: Graph,
    ia: WikiIA,
    provider: OpenAIProvider,
    repo_path: str,
    output_dir: str,
    verbose: bool,
) -> dict:
    """
    Generate markdown content for all wiki pages.

    Args:
        graph: Knowledge graph (should have summaries loaded)
        ia: Wiki information architecture
        provider: LLM provider
        repo_path: Path to repository
        output_dir: Output directory for markdown files
        verbose: Print detailed progress

    Returns:
        Statistics dict
    """
    print_phase_header(4, "Wiki Content Generation")

    # Load node summaries into graph (CRITICAL for hybrid context strategy)
    node_summaries_path = ".codecompass/summaries.json"
    if Path(node_summaries_path).exists():
        if verbose:
            print(f"Loading node summaries from {node_summaries_path}...")
        loaded_count = load_summaries(graph, node_summaries_path)
        if verbose:
            print(f"  Loaded {loaded_count} node summaries into graph")
    else:
        print(f"WARNING: No summaries found at {node_summaries_path}")
        print(
            "  Wiki content will be generated without code summaries (may be lower quality)"
        )

    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Generate pages
    pages = ia.get_all_pages()
    print(f"\nGenerating {len(pages)} wiki pages...")

    succeeded = 0
    failed = 0

    for i, page in enumerate(pages, 1):
        try:
            if verbose:
                print(f"  [{i}/{len(pages)}] {page.title} ({page.slug})")
            else:
                # Show progress every 5 pages
                if i % 5 == 0 or i == len(pages):
                    print(f"  Progress: {i}/{len(pages)} pages")

            # Generate markdown
            markdown = await generate_page_markdown(
                graph=graph,
                page=page,
                provider=provider,
                base_dir=repo_path,
                wiki_ia=ia,  # Pass IA for overview pages
                verbose=verbose,
            )

            # Save to file
            page_file = output_path / f"{page.slug}.md"
            page_file.parent.mkdir(parents=True, exist_ok=True)
            page_file.write_text(markdown, encoding="utf-8")

            succeeded += 1

        except Exception as e:
            print(f"    ERROR: Failed to generate page {page.slug}: {e}")
            failed += 1
            if verbose:
                import traceback

                traceback.print_exc()

    print(f"\nContent generation complete:")
    print(f"  Succeeded: {succeeded}")
    print(f"  Failed: {failed}")
    print(f"  Output directory: {output_path}")

    return {"succeeded": succeeded, "failed": failed}


def main():
    """Main entry point for documentation generation pipeline."""
    load_dotenv(find_dotenv(usecwd=True))

    # ============================================================================
    # CONFIGURATION - Edit these values to customize the pipeline
    # ============================================================================

    # Repository to analyze
    repo_path = "example_repos/zod"

    # Output directory for wiki pages
    output_dir = "./wiki"

    # Graph cache path (optional, saves ~15s per phase if used)
    graph_cache_path = ".codecompass/graph.json"

    # OpenAI configuration
    model = (
        "gpt-4o-mini"  # Model to use (gpt-4o-mini is cheaper, gpt-4o is higher quality)
    )
    max_concurrent = 10  # Max concurrent LLM requests

    # Pipeline options
    rebuild_graph = False  # Force rebuild graph even if cache exists
    fast_mode = False  # Skip detailed summaries (30-50% faster, lower quality)
    no_subpages = False  # Skip generating detailed subpages in IA
    verbose = True  # Print detailed progress information

    # ============================================================================
    # END CONFIGURATION
    # ============================================================================

    print("=" * 70)
    print("CodeCompass AI Documentation Generation Pipeline")
    print("=" * 70)
    print(f"Repository: {repo_path}")
    print(f"Output: {output_dir}")
    print(f"Provider: OpenAI ({model})")
    print(f"Concurrency: {max_concurrent}")
    print(
        f"Mode: {'FAST (short summaries only)' if fast_mode else 'DETAILED (short + detailed)'}"
    )

    # Validate environment
    if not os.getenv("OPENAI_API_KEY"):
        print("\nERROR: OPENAI_API_KEY environment variable not set")
        print("Please set it in your .env file or environment")
        sys.exit(1)

    # Initialize provider
    provider = OpenAIProvider(model=model, max_concurrent=max_concurrent)

    async def run_pipeline():
        try:
            # Build/load knowledge graph (automatically caches to graph.json)
            graph = await build_knowledge_graph(
                repo_path, graph_cache_path, rebuild_graph, verbose
            )

            # Generate AI summaries
            await generate_summaries(graph, provider, repo_path, fast_mode, verbose)

            # Generate wiki information architecture
            ia = await generate_wiki_ia(
                graph, provider, repo_path, no_subpages, verbose
            )

            # Generate wiki content
            await generate_wiki_content(
                graph, ia, provider, repo_path, output_dir, verbose
            )

        finally:
            # Clean up provider
            await provider.close()

        # Final summary
        print("\n" + "=" * 70)
        print("PIPELINE COMPLETE!")
        print("=" * 70)
        print(f"✓ Knowledge graph: {graph_cache_path}")
        print(f"✓ Node summaries: .codecompass/summaries.json")
        print(f"✓ Module summaries: .codecompass/module_summaries.json")
        print(f"✓ Wiki IA: .codecompass/wiki_ia.json")
        print(f"✓ Wiki pages: {output_dir}/")
        print("\nYour AI-generated documentation is ready!")

    # Run async pipeline
    asyncio.run(run_pipeline())


if __name__ == "__main__":
    main()
