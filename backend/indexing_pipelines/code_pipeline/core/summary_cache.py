"""
Simple summary cache for persisting AI-generated summaries.
Provides lightweight caching of Node summaries without full graph serialization.
Summaries are stored in JSON format and merged back into freshly-built graphs.
"""

import json
from pathlib import Path
from typing import Any, Dict

from .graph_model import Graph, NodeLabel


def save_summaries(
    graph: Graph, cache_path: str = ".codecompass/summaries.json"
) -> int:
    """
    Save summaries from graph nodes to a JSON cache file.
    Only saves nodes that have at least one summary field populated.
    Creates the parent directory if it doesn't exist.

    Args:
        graph: Graph containing nodes with summaries
        cache_path: Path to cache file (default: .codecompass/summaries.json)

    Returns:
        Number of summaries saved
    """
    cache_file = Path(cache_path)
    cache_file.parent.mkdir(parents=True, exist_ok=True)

    summary_cache: Dict[str, Dict[str, Any]] = {}

    for node_id, node in graph.nodes.items():
        # Save nodes with summaries (definitions and files/folders)
        if node.label not in {
            NodeLabel.CLASS,
            NodeLabel.FUNCTION,
            NodeLabel.METHOD,
            NodeLabel.FILE,
            NodeLabel.FOLDER,
        }:
            continue

        # Check if node has any summary or metrics
        has_data = (
            node.summary_short
            or node.summary_detailed
            or node.loc is not None
            or node.fan_in > 0
            or node.fan_out > 0
        )

        if has_data:
            summary_cache[node_id] = {
                "summary_short": node.summary_short,
                "summary_detailed": node.summary_detailed,
                "loc": node.loc,
                "fan_in": node.fan_in,
                "fan_out": node.fan_out,
            }

    # Write to file
    cache_file.write_text(json.dumps(summary_cache, indent=2), encoding="utf-8")
    return len(summary_cache)


def load_summaries(
    graph: Graph, cache_path: str = ".codecompass/summaries.json"
) -> int:
    """
    Load summaries from JSON cache and merge into graph nodes.
    Only updates nodes that exist in the current graph.
    Silently skips missing nodes (e.g., if code was deleted).

    Args:
        graph: Graph to populate with cached summaries
        cache_path: Path to cache file (default: .codecompass/summaries.json)

    Returns:
        Number of summaries loaded (may be less than saved if nodes were deleted)
    """
    cache_file = Path(cache_path)

    if not cache_file.exists():
        return 0

    try:
        summary_cache = json.loads(cache_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, IOError):
        # Corrupted or unreadable cache - skip loading
        return 0

    loaded_count = 0

    for node_id, summaries in summary_cache.items():
        # Only update if node exists in current graph
        if node_id in graph.nodes:
            node = graph.nodes[node_id]

            # Merge cached data into node
            node.summary_short = summaries.get("summary_short")
            node.summary_detailed = summaries.get("summary_detailed")
            node.loc = summaries.get("loc")
            node.fan_in = summaries.get("fan_in", 0)
            node.fan_out = summaries.get("fan_out", 0)

            loaded_count += 1

    return loaded_count
