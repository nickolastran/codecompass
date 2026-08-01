"""
Build hybrid context for wiki pages using summaries + selective code.

This module builds token-efficient context for each wiki page by:
1. Grouping nodes by type (files, classes, methods, functions)
2. Using pre-computed summaries for breadth
3. Organizing hierarchically (classes with their methods)
4. Staying within token budget (~15-20k tokens per page)
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Set

from indexing_pipelines.code_pipeline.core.graph_model import Graph, Node, NodeLabel
from indexing_pipelines.code_pipeline.docs.ia.page_spec import PageSpec


@dataclass
class PageContext:
    """Context for generating a single wiki page."""

    page_slug: str
    page_title: str
    page_kind: str
    page_description: str
    modules: List[str]

    # Organized nodes
    files: List[Node] = field(default_factory=list)
    classes: List[Node] = field(default_factory=list)
    functions: List[Node] = field(default_factory=list)
    methods: List[Node] = field(default_factory=list)

    # Class -> methods mapping for hierarchy
    class_methods: Dict[str, List[Node]] = field(default_factory=dict)

    def get_formatted_context(self) -> str:
        """Format context as a string for LLM prompt."""
        lines = []

        # Page metadata
        lines.append(f"Page: {self.page_title}")
        lines.append(f"Type: {self.page_kind}")
        if self.page_description:
            lines.append(f"Description: {self.page_description}")
        lines.append("")

        if self.modules:
            lines.append("Modules in scope:")
            for mod in self.modules:
                lines.append(f"  - {mod}/")
            lines.append("")

        # Files section
        if self.files:
            lines.append("## Files")
            lines.append("")
            for f in self.files[:20]:  # Cap at 20 files
                lines.append(f"### {f.path}")
                summary = f.summary_short or f.extra.get("summary_short", "")
                if summary:
                    lines.append(f"{summary}")
                lines.append("")

        # Classes section (with methods)
        if self.classes:
            lines.append("## Classes")
            lines.append("")
            for cls in self.classes:
                lines.append(f"### {cls.name}")
                lines.append(f"**Location:** {cls.path}")
                if cls.start_line and cls.end_line:
                    lines.append(f"**Lines:** {cls.start_line}-{cls.end_line}")
                lines.append("")

                summary = cls.summary_short or cls.extra.get("summary_short", "")
                if summary:
                    lines.append(f"**Summary:** {summary}")
                    lines.append("")

                # Add methods for this class
                methods = self.class_methods.get(cls.id, [])
                if methods:
                    lines.append("**Methods:**")
                    for method in methods[:10]:  # Cap at 10 methods per class
                        method_summary = method.summary_short or method.extra.get(
                            "summary_short", ""
                        )
                        if method_summary:
                            lines.append(f"- `{method.name}`: {method_summary}")
                        else:
                            lines.append(f"- `{method.name}`")
                    lines.append("")

        # Functions section
        if self.functions:
            lines.append("## Functions")
            lines.append("")
            for func in self.functions[:30]:  # Cap at 30 functions
                func_summary = func.summary_short or func.extra.get("summary_short", "")
                if func_summary:
                    lines.append(f"- **`{func.name}`** ({func.path}): {func_summary}")
                else:
                    lines.append(f"- **`{func.name}`** ({func.path})")
            lines.append("")

        return "\n".join(lines)

    def estimate_tokens(self) -> int:
        """Rough estimate of token count (4 chars ≈ 1 token)."""
        context_str = self.get_formatted_context()
        return len(context_str) // 4


def build_page_context(
    graph: Graph, page: PageSpec, base_dir: str, verbose: bool = False
) -> PageContext:
    """
    Build hybrid context for a wiki page.

    Args:
        graph: Knowledge graph with summaries
        page: PageSpec with node_ids assigned
        base_dir: Base directory of the codebase
        verbose: Print debug info

    Returns:
        PageContext with organized nodes
    """
    context = PageContext(
        page_slug=page.slug,
        page_title=page.title,
        page_kind=page.kind.value,
        page_description=page.description,
        modules=page.modules,
    )

    # Group nodes by type
    for node_id in page.node_ids:
        node = graph.nodes.get(node_id)
        if not node:
            continue

        if node.label == NodeLabel.FILE:
            context.files.append(node)
        elif node.label == NodeLabel.CLASS:
            context.classes.append(node)
        elif node.label == NodeLabel.FUNCTION:
            context.functions.append(node)
        elif node.label == NodeLabel.METHOD:
            context.methods.append(node)

    # Build class -> methods mapping
    for cls in context.classes:
        class_methods = []
        for method in context.methods:
            # Check if method belongs to this class (same file, within class line range)
            if method.path == cls.path:
                if cls.start_line and cls.end_line and method.start_line:
                    if cls.start_line <= method.start_line <= cls.end_line:
                        class_methods.append(method)

        if class_methods:
            # Sort by line number
            class_methods.sort(key=lambda m: m.start_line or 0)
            context.class_methods[cls.id] = class_methods

    # Remove methods that are already associated with classes from standalone methods
    # (This avoids duplicating method info)
    associated_method_ids = set()
    for methods in context.class_methods.values():
        associated_method_ids.update(m.id for m in methods)

    # Sort for consistent output
    context.files.sort(key=lambda n: n.path)
    context.classes.sort(key=lambda n: n.name)
    context.functions.sort(key=lambda n: n.name)

    if verbose:
        token_est = context.estimate_tokens()
        print(f"  Built context for '{page.slug}':")
        print(f"    Files: {len(context.files)}")
        print(f"    Classes: {len(context.classes)}")
        print(f"    Functions: {len(context.functions)}")
        print(f"    Methods: {len(context.methods)}")
        print(f"    Estimated tokens: ~{token_est:,}")

    return context
