"""
Data models for wiki Information Architecture (IA).

A PageSpec defines a single wiki page with:
- Metadata (slug, title, kind, description)
- Scope (modules, node_ids)
- Structure (children pages)

The WikiIA contains the full tree of PageSpecs.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any, Set
from enum import Enum
import json


class PageKind(str, Enum):
    """Types of wiki pages."""
    OVERVIEW = "overview"          # Top-level overview page
    MODULE = "module"              # Module/package documentation
    ARCHITECTURE = "architecture"  # Architecture/design docs
    GUIDE = "guide"                # How-to guides
    REFERENCE = "reference"        # API reference
    CONCEPT = "concept"            # Conceptual explanations


@dataclass
class PageSpec:
    """
    Specification for a single wiki page.

    Attributes:
        slug: URL-safe identifier (e.g., "getting-started", "core/agents")
        title: Human-readable title (e.g., "Getting Started", "Core Agents")
        kind: Type of page (overview, module, architecture, guide, reference, concept)
        modules: List of module paths this page covers (e.g., ["pacai/agents"])
        description: Brief description of page content (1-2 sentences)
        children: List of child page specs (for hierarchical structure)
        node_ids: Graph node IDs in scope for this page (computed, not LLM-generated)
        tags: Optional tags for categorization
    """
    slug: str
    title: str
    kind: PageKind
    modules: List[str] = field(default_factory=list)
    description: str = ""
    children: List["PageSpec"] = field(default_factory=list)
    node_ids: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)

    def __post_init__(self):
        """Validate and normalize fields."""
        # Ensure kind is PageKind enum
        if isinstance(self.kind, str):
            self.kind = PageKind(self.kind)

        # Normalize slug (lowercase, replace spaces with hyphens)
        self.slug = self.slug.lower().replace(" ", "-")

        # Recursively ensure children are PageSpec objects
        self.children = [
            child if isinstance(child, PageSpec) else PageSpec(**child)
            for child in self.children
        ]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "slug": self.slug,
            "title": self.title,
            "kind": self.kind.value,
            "modules": self.modules,
            "description": self.description,
            "tags": self.tags,
            "node_ids": self.node_ids,
        }

        # Include children recursively
        if self.children:
            result["children"] = [child.to_dict() for child in self.children]

        return result

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "PageSpec":
        """Create PageSpec from dictionary."""
        # Handle children recursively
        children_data = data.pop("children", [])
        children = [PageSpec.from_dict(child) for child in children_data]

        return PageSpec(
            slug=data["slug"],
            title=data["title"],
            kind=PageKind(data["kind"]),
            modules=data.get("modules", []),
            description=data.get("description", ""),
            children=children,
            node_ids=data.get("node_ids", []),
            tags=data.get("tags", []),
        )

    def get_all_slugs(self) -> Set[str]:
        """Get all slugs in this page and descendants."""
        slugs = {self.slug}
        for child in self.children:
            slugs.update(child.get_all_slugs())
        return slugs

    def find_page(self, slug: str) -> Optional["PageSpec"]:
        """Find a page by slug in this page or descendants."""
        if self.slug == slug:
            return self
        for child in self.children:
            result = child.find_page(slug)
            if result:
                return result
        return None

    def depth(self) -> int:
        """Get the maximum depth of this page tree."""
        if not self.children:
            return 1
        return 1 + max(child.depth() for child in self.children)

    def count_pages(self) -> int:
        """Count total pages in this tree (including self)."""
        return 1 + sum(child.count_pages() for child in self.children)


@dataclass
class WikiIA:
    """
    Complete wiki Information Architecture.

    Contains the full tree of wiki pages, starting from root-level pages.
    """
    pages: List[PageSpec] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "pages": [page.to_dict() for page in self.pages],
            "metadata": self.metadata,
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "WikiIA":
        """Create WikiIA from dictionary."""
        return WikiIA(
            pages=[PageSpec.from_dict(page) for page in data.get("pages", [])],
            metadata=data.get("metadata", {}),
        )

    def save(self, path: str):
        """Save to JSON file."""
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)

    @staticmethod
    def load(path: str) -> "WikiIA":
        """Load from JSON file."""
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return WikiIA.from_dict(data)

    def validate(self) -> List[str]:
        """
        Validate the IA structure.

        Returns:
            List of validation error messages (empty if valid)
        """
        errors = []

        # Check for duplicate slugs
        all_slugs = []
        for page in self.pages:
            all_slugs.extend(page.get_all_slugs())

        slug_counts = {}
        for slug in all_slugs:
            slug_counts[slug] = slug_counts.get(slug, 0) + 1

        duplicates = [slug for slug, count in slug_counts.items() if count > 1]
        if duplicates:
            errors.append(f"Duplicate slugs found: {duplicates}")

        # Check for empty required fields
        for page in self.pages:
            self._validate_page(page, errors)

        return errors

    def _validate_page(self, page: PageSpec, errors: List[str]):
        """Recursively validate a page and its children."""
        if not page.slug:
            errors.append(f"Page has empty slug: {page.title}")

        if not page.title:
            errors.append(f"Page has empty title: {page.slug}")

        # Validate children
        for child in page.children:
            self._validate_page(child, errors)

    def get_all_pages(self) -> List[PageSpec]:
        """Get a flat list of all pages."""
        all_pages = []
        for page in self.pages:
            all_pages.extend(self._collect_pages(page))
        return all_pages

    def _collect_pages(self, page: PageSpec) -> List[PageSpec]:
        """Recursively collect all pages."""
        result = [page]
        for child in page.children:
            result.extend(self._collect_pages(child))
        return result

    def find_page(self, slug: str) -> Optional[PageSpec]:
        """Find a page by slug."""
        for page in self.pages:
            result = page.find_page(slug)
            if result:
                return result
        return None

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the IA."""
        all_pages = self.get_all_pages()

        kind_counts = {}
        for page in all_pages:
            kind = page.kind.value
            kind_counts[kind] = kind_counts.get(kind, 0) + 1

        return {
            "total_pages": len(all_pages),
            "max_depth": max((page.depth() for page in self.pages), default=0),
            "pages_by_kind": kind_counts,
            "pages_with_modules": sum(1 for page in all_pages if page.modules),
            "pages_with_node_ids": sum(1 for page in all_pages if page.node_ids),
        }


def create_page(
    slug: str,
    title: str,
    kind: PageKind,
    modules: Optional[List[str]] = None,
    description: str = "",
    children: Optional[List[PageSpec]] = None,
    tags: Optional[List[str]] = None,
) -> PageSpec:
    """
    Convenience function to create a PageSpec.

    Args:
        slug: URL-safe identifier
        title: Human-readable title
        kind: Type of page
        modules: List of module paths this page covers
        description: Brief description
        children: List of child pages
        tags: Optional tags

    Returns:
        PageSpec instance
    """
    return PageSpec(
        slug=slug,
        title=title,
        kind=kind,
        modules=modules or [],
        description=description,
        children=children or [],
        tags=tags or [],
    )
