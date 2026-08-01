"""
Generate wiki Information Architecture using LLMs.

Two-phase process:
1. Global IA: Generate top-level page structure based on module summaries
2. Per-module subpages: For each module page, generate detailed subpages
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from indexing_pipelines.code_pipeline.core.graph_model import Graph, NodeLabel
from indexing_pipelines.code_pipeline.docs.ia.page_spec import PageKind, PageSpec, WikiIA
from indexing_pipelines.code_pipeline.docs.ia.prompts import (
    SYSTEM_PROMPT,
    build_global_ia_prompt,
    build_module_subpages_prompt,
)
from indexing_pipelines.code_pipeline.docs.ia.scope_computer import (
    compute_all_scopes,
    validate_coverage,
)
from indexing_pipelines.code_pipeline.docs.llm.providers import LLMProvider


async def generate_global_ia(
    provider: LLMProvider,
    project_name: str,
    module_summaries: Dict[str, Dict[str, Any]],
    base_dir: str,
    verbose: bool = False,
) -> List[PageSpec]:
    """
    Generate the top-level wiki IA using LLM.

    Args:
        provider: LLM provider to use
        project_name: Name of the project
        module_summaries: Full module summaries dict
        base_dir: Base directory of the codebase (for extracting relative paths)
        verbose: Print progress updates

    Returns:
        List of top-level PageSpec objects
    """
    if verbose:
        print("Generating global wiki IA...")

    # Get top-level modules (those without '/' or with only one '/')
    # Extract relative paths from the full filesystem paths
    from pathlib import Path as PathLib

    base_path = PathLib(base_dir).resolve() if base_dir else None

    top_level_modules = {}
    for node_id, summary_data in module_summaries.items():
        full_path = summary_data.get("path", "")
        summary = summary_data.get("summary", "")

        if not full_path:
            continue

        # Convert to relative path
        try:
            rel_path = (
                PathLib(full_path).resolve().relative_to(base_path)
                if base_path
                else PathLib(full_path)
            )
            rel_path_str = str(rel_path).replace("\\", "/")
        except (ValueError, TypeError):
            continue

        # Consider top-level if path has 0 or 1 separators
        if rel_path_str.count("/") <= 1:
            top_level_modules[rel_path_str] = summary

    if verbose:
        print(f"  Found {len(top_level_modules)} top-level modules")

    # Build prompt
    prompt = build_global_ia_prompt(
        project_name=project_name,
        top_level_modules=top_level_modules,
        module_summaries=module_summaries,
    )

    # Call LLM
    success, response, error = await provider.generate_text(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=prompt,
        temperature=0.4,  # Slightly higher for creativity in IA design
    )

    if not success or not response:
        raise RuntimeError(f"Failed to generate global IA: {error}")

    # Parse JSON response
    try:
        # Clean response (remove markdown code blocks if present)
        response_cleaned = response.strip()
        if response_cleaned.startswith("```"):
            # Remove markdown code blocks
            lines = response_cleaned.split("\n")
            # Find start and end of JSON
            start_idx = 0
            end_idx = len(lines)
            for i, line in enumerate(lines):
                if line.strip().startswith("["):
                    start_idx = i
                    break
            for i in range(len(lines) - 1, -1, -1):
                if lines[i].strip().endswith("]"):
                    end_idx = i + 1
                    break
            response_cleaned = "\n".join(lines[start_idx:end_idx])

        pages_data = json.loads(response_cleaned)

        if not isinstance(pages_data, list):
            raise ValueError("Expected JSON array of pages")

        pages = [PageSpec.from_dict(page_dict) for page_dict in pages_data]

        if verbose:
            print(f"  Generated {len(pages)} top-level pages:")
            for page in pages:
                print(f"    - {page.title} ({page.kind.value})")

        return pages

    except json.JSONDecodeError as e:
        if verbose:
            print(f"  Failed to parse LLM response as JSON:")
            print(f"  Response: {response[:500]}")
        raise RuntimeError(f"Failed to parse global IA JSON: {e}")


async def generate_module_subpages(
    provider: LLMProvider,
    page: PageSpec,
    module_summaries: Dict[str, Dict[str, Any]],
    base_dir: str,
    verbose: bool = False,
) -> List[PageSpec]:
    """
    Generate subpages for a specific module page.

    Args:
        provider: LLM provider to use
        page: Parent page (must have kind="module" and modules list)
        module_summaries: Full module summaries dict
        base_dir: Base directory of the codebase
        verbose: Print progress updates

    Returns:
        List of child PageSpec objects
    """
    if not page.modules:
        if verbose:
            print(f"  Skipping {page.title}: no modules assigned")
        return []

    if verbose:
        print(f"  Generating subpages for: {page.title}")

    # Collect module information
    modules = {}
    module_details = {}

    # Helper: Get relative module path from full filesystem path
    def get_relative_module_path(full_path: str, base_dir: str) -> str:
        """Extract relative module path like 'pacai/agents' from full path."""
        from pathlib import Path

        try:
            full = Path(full_path).resolve()
            base = Path(base_dir).resolve()
            rel = full.relative_to(base)
            return str(rel).replace("\\", "/")
        except:
            return ""

    # Build a map of relative_path -> summary_data for easier matching
    path_to_summary = {}
    for node_id, summary_data in module_summaries.items():
        full_path = summary_data.get("path", "")
        if full_path:
            # Get relative path like "pacai/agents"
            rel_path = get_relative_module_path(full_path, base_dir)
            if rel_path:
                path_to_summary[rel_path] = summary_data

    # Match requested modules to summaries (exact match only)
    for module_path in page.modules:
        if module_path in path_to_summary:
            summary_data = path_to_summary[module_path]
            modules[module_path] = summary_data.get("summary", "")
            module_details[module_path] = summary_data
        else:
            # No match found - this shouldn't happen if LLM follows constraints
            if verbose:
                print(
                    f"    WARNING: Module path '{module_path}' not found in summaries (LLM may have hallucinated path)"
                )

    if not modules:
        if verbose:
            print(f"    No module data found for {page.modules}")
        return []

    # Build prompt
    prompt = build_module_subpages_prompt(
        page_title=page.title,
        page_description=page.description,
        modules=modules,
        module_details=module_details,
    )

    # Call LLM
    success, response, error = await provider.generate_text(
        system_prompt=SYSTEM_PROMPT, user_prompt=prompt, temperature=0.4
    )

    if not success or not response:
        if verbose:
            print(f"    Failed: {error}")
        return []

    # Parse JSON response
    try:
        # Clean response (remove markdown code blocks if present)
        response_cleaned = response.strip()
        if response_cleaned.startswith("```"):
            lines = response_cleaned.split("\n")
            start_idx = 0
            end_idx = len(lines)
            for i, line in enumerate(lines):
                if line.strip().startswith("["):
                    start_idx = i
                    break
            for i in range(len(lines) - 1, -1, -1):
                if lines[i].strip().endswith("]"):
                    end_idx = i + 1
                    break
            response_cleaned = "\n".join(lines[start_idx:end_idx])

        subpages_data = json.loads(response_cleaned)

        if not isinstance(subpages_data, list):
            if verbose:
                print(f"    Expected JSON array, got {type(subpages_data)}")
            return []

        subpages = [PageSpec.from_dict(page_dict) for page_dict in subpages_data]

        # Ensure slugs are prefixed with parent slug
        for subpage in subpages:
            if not subpage.slug.startswith(page.slug + "/"):
                subpage.slug = f"{page.slug}/{subpage.slug}"

        if verbose:
            print(f"    Generated {len(subpages)} subpages")

        return subpages

    except json.JSONDecodeError as e:
        if verbose:
            print(f"    Failed to parse subpages JSON: {e}")
            print(f"    Response: {response[:300]}")
        return []


async def generate_ia(
    graph: Graph,
    module_summaries: Dict[str, Dict[str, Any]],
    provider: LLMProvider,
    base_dir: str,
    project_name: str = "Project",
    generate_subpages: bool = True,
    verbose: bool = False,
) -> WikiIA:
    """
    Generate complete wiki IA using LLMs.

    Process:
    1. Generate global (top-level) IA
    2. For each module page, generate subpages
    3. Compute scope (node_ids) for all pages
    4. Validate coverage

    Args:
        graph: Knowledge graph
        module_summaries: Module summaries dict from module_summarizer
        provider: LLM provider to use
        base_dir: Base directory of the codebase
        project_name: Name of the project
        generate_subpages: Whether to generate detailed subpages (slower)
        verbose: Print progress updates

    Returns:
        WikiIA with complete page tree and scopes
    """
    if verbose:
        print("=" * 60)
        print("WIKI IA GENERATION")
        print("=" * 60)

    # Phase 1: Generate global IA
    if verbose:
        print("\nPhase 1: Generating top-level page structure...")

    top_level_pages = await generate_global_ia(
        provider=provider,
        project_name=project_name,
        module_summaries=module_summaries,
        base_dir=base_dir,
        verbose=verbose,
    )

    # Phase 2: Generate subpages for module pages
    if generate_subpages:
        if verbose:
            print("\nPhase 2: Generating detailed subpages...")

        module_pages = [p for p in top_level_pages if p.kind == PageKind.MODULE]

        if verbose:
            print(f"  Found {len(module_pages)} module pages to expand")

        for page in module_pages:
            subpages = await generate_module_subpages(
                provider=provider,
                page=page,
                module_summaries=module_summaries,
                base_dir=base_dir,
                verbose=verbose,
            )
            page.children = subpages

    # Create WikiIA
    ia = WikiIA(
        pages=top_level_pages,
        metadata={
            "project_name": project_name,
            "base_dir": base_dir,
            "generated_with_subpages": generate_subpages,
        },
    )

    # Phase 3: Compute scope for all pages
    if verbose:
        print("\nPhase 3: Computing node scope for pages...")

    pages_processed = compute_all_scopes(
        ia=ia, graph=graph, base_dir=base_dir, verbose=verbose
    )

    if verbose:
        print(f"  Computed scope for {pages_processed} pages")

    # Phase 4: Validate IA
    if verbose:
        print("\nPhase 4: Validating IA...")

    errors = ia.validate()
    if errors:
        print("  Validation errors:")
        for error in errors:
            print(f"    - {error}")
    else:
        if verbose:
            print("  [OK] IA structure is valid")

    # Get coverage statistics
    if verbose:
        coverage_stats = validate_coverage(ia, graph, verbose=True)
    else:
        coverage_stats = validate_coverage(ia, graph, verbose=False)

    # Add coverage to metadata
    ia.metadata["coverage_stats"] = coverage_stats

    # Print summary
    if verbose:
        print("\n" + "=" * 60)
        print("IA GENERATION COMPLETE")
        print("=" * 60)
        stats = ia.get_stats()
        print(f"Total pages: {stats['total_pages']}")
        print(f"Max depth: {stats['max_depth']}")
        print(f"Pages by kind:")
        for kind, count in stats["pages_by_kind"].items():
            print(f"  - {kind}: {count}")
        print(f"Coverage: {coverage_stats['coverage_percentage']:.1f}%")

    return ia
