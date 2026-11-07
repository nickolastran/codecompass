"""
Generate wiki page markdown content using LLMs.

Takes PageSpec + Graph -> builds context -> generates markdown content.
"""

from typing import TYPE_CHECKING, Optional

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

