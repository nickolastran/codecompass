"""
Generate wiki page markdown content using LLMs.

Takes PageSpec + Graph -> builds context -> generates markdown content.
"""

import asyncio
from pathlib import Path
from typing import TYPE_CHECKING, Dict, List, Optional

from indexing_pipelines.code_pipeline.core.graph_model import Graph
from indexing_pipelines.code_pipeline.docs.ia.content_prompts import get_prompt_for_page
from indexing_pipelines.code_pipeline.docs.ia.context_builder import build_page_context
from indexing_pipelines.code_pipeline.docs.ia.page_spec import PageSpec, WikiIA
from indexing_pipelines.code_pipeline.docs.llm.providers import LLMProvider

if TYPE_CHECKING:
    from docs.ia.page_spec import WikiIA


async def generate_page_markdown(
    graph: Graph,
    page: PageSpec,
    provider: LLMProvider,
    base_dir: str,
    wiki_ia: Optional["WikiIA"] = None,
    verbose: bool = False,
) -> str:
    """
    Generate markdown content for a single wiki page.

    Args:
        graph: Knowledge graph with summaries
        page: PageSpec with node_ids assigned
        provider: LLM provider to use
        base_dir: Base directory of the codebase
        wiki_ia: WikiIA (optional, needed for overview pages)
        verbose: Print progress updates

    Returns:
        Generated markdown content
    """
    if verbose:
        print(f"  Generating: {page.slug}")

    # Build context from graph
    context = build_page_context(
        graph=graph,
        page=page,
        base_dir=base_dir,
        verbose=False,  # Don't spam with context details
    )

    # For overview pages with no nodes, build summary from wiki pages
    wiki_pages_summary = ""
    if page.kind.value == "overview" and len(page.node_ids) == 0 and wiki_ia:
        from indexing_pipelines.code_pipeline.docs.ia.content_prompts import build_overview_prompt

        # Build summary of all top-level pages
        lines = []
        lines.append(f"Project: {wiki_ia.metadata.get('project_name', 'Unknown')}")
        lines.append("")
        lines.append("## Wiki Structure")
        lines.append("")

        for p in wiki_ia.pages:
            if p.slug != page.slug:  # Don't include self
                lines.append(f"### {p.title} ({p.kind.value})")
                if p.description:
                    lines.append(f"{p.description}")
                if p.modules:
                    lines.append(f"**Modules:** {', '.join(p.modules)}")
                lines.append("")

        wiki_pages_summary = "\n".join(lines)
    else:
        wiki_pages_summary = ""

    # Get prompts for this page kind
    system_prompt, user_prompt = get_prompt_for_page(context, wiki_pages_summary)

    # Call LLM
    success, markdown, error = await provider.generate_text(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.3,  # Lower temperature for more consistent documentation
    )

    if not success or not markdown:
        raise RuntimeError(f"Failed to generate content for '{page.slug}': {error}")

    return markdown.strip()


async def generate_all_pages(
    graph: Graph,
    ia: WikiIA,
    provider: LLMProvider,
    base_dir: str,
    output_dir: str = "wiki",
    verbose: bool = False,
    max_concurrent: int = 3,
) -> Dict[str, str]:
    """
    Generate markdown for all pages in the wiki IA.

    Args:
        graph: Knowledge graph with summaries
        ia: WikiIA with complete page tree
        provider: LLM provider to use
        base_dir: Base directory of the codebase
        output_dir: Output directory for wiki files (default: wiki/)
        verbose: Print progress updates
        max_concurrent: Max concurrent LLM calls (default: 3)

    Returns:
        Dict mapping slug -> markdown content
    """
    if verbose:
        print("=" * 60)
        print("WIKI CONTENT GENERATION")
        print("=" * 60)

    # Flatten page tree to list
    all_pages = ia.get_all_pages()

    if verbose:
        print(f"\nGenerating content for {len(all_pages)} pages...")
        print(f"Max concurrent requests: {max_concurrent}")

    results = {}

    # Semaphore to limit concurrent LLM calls
    semaphore = asyncio.Semaphore(max_concurrent)

    async def generate_with_limit(page: PageSpec) -> tuple[str, str]:
        """Generate with semaphore to limit concurrency."""
        async with semaphore:
            try:
                markdown = await generate_page_markdown(
                    graph=graph,
                    page=page,
                    provider=provider,
                    base_dir=base_dir,
                    wiki_ia=ia,
                    verbose=verbose,
                )
                return page.slug, markdown
            except Exception as e:
                if verbose:
                    print(f"  ERROR generating '{page.slug}': {e}")
                return page.slug, f"# {page.title}\n\n*Error generating content: {e}*"

    # Generate all pages concurrently (with limit)
    tasks = [generate_with_limit(page) for page in all_pages]
    completed = await asyncio.gather(*tasks)

    # Collect results
    for slug, markdown in completed:
        results[slug] = markdown

    if verbose:
        print(f"\n✓ Generated {len(results)} pages")

    return results


def save_wiki_pages(
    results: Dict[str, str], output_dir: str = "wiki", verbose: bool = False
) -> int:
    """
    Save generated markdown to files.

    Creates directory structure based on slugs:
    - "overview" -> wiki/overview.md
    - "agents/greedy" -> wiki/agents/greedy.md

    Args:
        results: Dict mapping slug -> markdown content
        output_dir: Output directory (default: wiki/)
        verbose: Print progress updates

    Returns:
        Number of files saved
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    if verbose:
        print(f"\nSaving wiki pages to {output_dir}/...")

    saved_count = 0

    for slug, markdown in results.items():
        # Convert slug to file path
        # "overview" -> "overview.md"
        # "agents/greedy" -> "agents/greedy.md"
        file_path = output_path / f"{slug}.md"

        # Create parent directories if needed
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Write markdown
        file_path.write_text(markdown, encoding="utf-8")
        saved_count += 1

        if verbose:
            print(f"  Saved: {file_path}")

    if verbose:
        print(f"\n✓ Saved {saved_count} files to {output_dir}/")

    return saved_count


async def generate_wiki(
    graph: Graph,
    ia: WikiIA,
    provider: LLMProvider,
    base_dir: str,
    output_dir: str = "wiki",
    max_concurrent: int = 3,
    verbose: bool = False,
) -> Dict[str, str]:
    """
    Complete wiki generation pipeline.

    1. Generate markdown for all pages
    2. Save to wiki/ directory

    Args:
        graph: Knowledge graph with summaries
        ia: WikiIA with complete page tree
        provider: LLM provider to use
        base_dir: Base directory of the codebase
        output_dir: Output directory for wiki files (default: wiki/)
        max_concurrent: Max concurrent LLM calls (default: 3)
        verbose: Print progress updates

    Returns:
        Dict mapping slug -> markdown content
    """
    # Generate all pages
    results = await generate_all_pages(
        graph=graph,
        ia=ia,
        provider=provider,
        base_dir=base_dir,
        output_dir=output_dir,
        verbose=verbose,
        max_concurrent=max_concurrent,
    )

    # Save to files
    save_wiki_pages(results=results, output_dir=output_dir, verbose=verbose)

    if verbose:
        print("\n" + "=" * 60)
        print("WIKI GENERATION COMPLETE")
        print("=" * 60)
        print(f"Output directory: {output_dir}/")
        print(f"Total pages: {len(results)}")

    return results
