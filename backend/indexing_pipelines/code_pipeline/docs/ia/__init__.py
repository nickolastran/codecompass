"""
Wiki Information Architecture (IA) generation.

This package provides tools for generating structured wiki page hierarchies
using LLMs, based on module summaries and code graph structure.
"""

from .ia_generator import (
    generate_global_ia,
    generate_ia,
    generate_module_subpages,
)
from .page_spec import (
    PageKind,
    PageSpec,
    WikiIA,
    create_page,
)
from .scope_computer import (
    compute_all_scopes,
    compute_page_scope,
    validate_coverage,
)

__all__ = [
    "PageSpec",
    "PageKind",
    "WikiIA",
    "create_page",
    "generate_ia",
    "generate_global_ia",
    "generate_module_subpages",
    "compute_page_scope",
    "compute_all_scopes",
    "validate_coverage",
]
