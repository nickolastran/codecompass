"""
Service for inserting wiki pages into Supabase pages table.

This module handles the conversion of WikiIA structure and markdown files
into database records with proper parent-child relationships and metadata.
"""

import json
import logging
import os

# Import types from indexing pipeline
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import UUID

from supabase import Client

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from indexing_pipelines.code_pipeline.core.graph_model import Graph, NodeLabel
from indexing_pipelines.code_pipeline.docs.ia.page_spec import PageSpec, WikiIA

logger = logging.getLogger(__name__)

async def insert_wiki_pages(
    supabase: Client,
    documentation_id: str,
    documentation_version: int,
    wiki_ia: WikiIA,
    graph: Graph,
    wiki_dir: Path,
    verbose: bool = False,
) -> Dict[str, Any]:
    """
    Insert all wiki pages from WikiIA into Supabase pages table.

    Args:
        supabase: Supabase client instance
        documentation_id: UUID of the documentation record (foreign key)
        wiki_ia: WikiIA object containing page structure
        graph: Knowledge graph for extracting referenced files/symbols
        wiki_dir: Path to wiki directory containing markdown files
        verbose: Enable detailed logging

    Returns:
        Dictionary with insertion statistics:
        {
            "total_pages": int,
            "successful_inserts": int,
            "failed_inserts": int,
            "pages_by_kind": Dict[str, int]
        }
    """
    stats = {
        "total_pages": 0,
        "successful_inserts": 0,
        "failed_inserts": 0,
        "pages_by_kind": {},
    }

    # Map slug -> UUID for resolving parent relationships
    slug_to_uuid: Dict[str, str] = {}

    # Use breadth-first traversal to ensure parents are inserted before children
    queue: List[
        tuple[PageSpec, Optional[str], int]
    ] = []  # (page, parent_slug, order_index)

    # Initialize queue with root pages
    for idx, page in enumerate(wiki_ia.pages):
        queue.append((page, None, idx))

    while queue:
        page, parent_slug, order_index = queue.pop(0)
        stats["total_pages"] += 1

        # Track by kind
        kind_str = str(page.kind.value if hasattr(page.kind, "value") else page.kind)
        stats["pages_by_kind"][kind_str] = stats["pages_by_kind"].get(kind_str, 0) + 1

        try:
            # Read markdown content
            markdown_file = wiki_dir / f"{page.slug}.md"
            if not markdown_file.exists():
                logger.warning(
                    f"Markdown file not found for page '{page.slug}': {markdown_file}"
                )
                content = ""
            else:
                content = markdown_file.read_text(encoding="utf-8")

            # Extract referenced files and symbols from node_ids
            referenced_files = _extract_referenced_files(page, graph)
            referenced_symbols = _extract_referenced_symbols(page, graph)

            # Build metadata
            metadata = {
                "kind": kind_str,
                "modules": page.modules,
                "tags": page.tags,
                "depth": page.depth(),
                "description": page.description,
                "node_count": len(page.node_ids),
            }

            # Resolve parent_page_id
            parent_page_id = slug_to_uuid.get(parent_slug) if parent_slug else None

            # Insert page into database
            insert_data = {
                "documentation_id": documentation_id,
                "title": page.title,
                "slug": page.slug,
                "content": content,
                "order_index": order_index,
                "parent_page_id": parent_page_id,
                "referenced_files": json.dumps(referenced_files),
                "referenced_symbols": json.dumps(referenced_symbols),
                "metadata": json.dumps(metadata),
                "repo_version": documentation_version,
            }

            response = supabase.table("pages").insert(insert_data).execute()

            # Store the inserted page's UUID for child references
            if response.data and len(response.data) > 0:
                page_uuid = response.data[0]["id"]
                slug_to_uuid[page.slug] = page_uuid
                stats["successful_inserts"] += 1

                if verbose:
                    logger.info(f"✓ Inserted page: {page.slug} (UUID: {page_uuid})")
            else:
                logger.error(f"Failed to insert page '{page.slug}': No data returned")
                stats["failed_inserts"] += 1
                continue

            # Add children to queue
            for child_idx, child in enumerate(page.children):
                queue.append((child, page.slug, child_idx))

        except Exception as e:
            logger.error(f"Error inserting page '{page.slug}': {e}")
            stats["failed_inserts"] += 1
            # Continue with other pages instead of failing completely

    if verbose:
        logger.info(f"\n=== Page Insertion Complete ===")
        logger.info(
            f"Total: {stats['total_pages']}, Success: {stats['successful_inserts']}, Failed: {stats['failed_inserts']}"
        )
        logger.info(f"Pages by kind: {stats['pages_by_kind']}")

    return stats


def _extract_referenced_files(page: PageSpec, graph: Graph) -> List[str]:
    """
    Extract unique file paths from page's node_ids.

    Args:
        page: PageSpec with node_ids
        graph: Knowledge graph

    Returns:
        List of unique file paths
    """
    files = set()

    for node_id in page.node_ids:
        node = graph.nodes.get(node_id)
        if node and node.label == NodeLabel.FILE:
            files.add(node.path)
        elif node and hasattr(node, "path") and node.path:
            # For non-FILE nodes, extract parent file path
            files.add(node.path)

    return sorted(list(files))


def _extract_referenced_symbols(page: PageSpec, graph: Graph) -> List[Dict[str, str]]:
    """
    Extract symbol information from page's node_ids.

    Args:
        page: PageSpec with node_ids
        graph: Knowledge graph

    Returns:
        List of symbol dictionaries with name, type, node_id, file
    """
    symbols = []

    for node_id in page.node_ids:
        node = graph.nodes.get(node_id)
        if node and node.label in [
            NodeLabel.CLASS,
            NodeLabel.METHOD,
            NodeLabel.FUNCTION,
        ]:
            symbol = {
                "name": node.name,
                "type": str(node.label.value)
                if hasattr(node.label, "value")
                else str(node.label),
                "node_id": node_id,
                "file": node.path if hasattr(node, "path") else None,
            }
            symbols.append(symbol)

    return symbols


async def delete_pages_by_documentation_id(
    supabase: Client, documentation_id: str, verbose: bool = False
) -> int:
    """
    Delete all pages associated with a documentation_id.

    Useful for cleanup after failed insertions or re-indexing.

    Args:
        supabase: Supabase client instance
        documentation_id: UUID of the documentation record
        verbose: Enable detailed logging

    Returns:
        Number of pages deleted
    """
    try:
        response = (
            supabase.table("pages")
            .delete()
            .eq("documentation_id", documentation_id)
            .execute()
        )
        count = len(response.data) if response.data else 0

        if verbose:
            logger.info(
                f"Deleted {count} pages for documentation_id: {documentation_id}"
            )

        return count
    except Exception as e:
        logger.error(
            f"Error deleting pages for documentation_id {documentation_id}: {e}"
        )
        return 0