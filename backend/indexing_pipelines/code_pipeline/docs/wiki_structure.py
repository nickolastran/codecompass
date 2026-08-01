"""
Wiki structure data models and XML serialization/deserialization.

Defines the structure for AI-generated documentation wikis:
- WikiPage: Individual documentation pages with metadata
- WikiSection: Hierarchical sections containing pages
- WikiStructure: Overall wiki structure with sections and pages
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
import xml.etree.ElementTree as ET


@dataclass
class WikiPage:
    """Represents a single wiki page."""
    id: str
    title: str
    description: str
    importance: str  # high, medium, low
    relevant_files: List[str] = field(default_factory=list)
    related_pages: List[str] = field(default_factory=list)
    parent_section: Optional[str] = None

    def to_xml(self) -> ET.Element:
        """Convert to XML element."""
        page = ET.Element("page", id=self.id)

        title = ET.SubElement(page, "title")
        title.text = self.title

        desc = ET.SubElement(page, "description")
        desc.text = self.description

        importance = ET.SubElement(page, "importance")
        importance.text = self.importance

        if self.relevant_files:
            rel_files = ET.SubElement(page, "relevant_files")
            for file_path in self.relevant_files:
                file_elem = ET.SubElement(rel_files, "file_path")
                file_elem.text = file_path

        if self.related_pages:
            related = ET.SubElement(page, "related_pages")
            for page_id in self.related_pages:
                related_elem = ET.SubElement(related, "related")
                related_elem.text = page_id

        if self.parent_section:
            parent = ET.SubElement(page, "parent_section")
            parent.text = self.parent_section

        return page

    @staticmethod
    def from_xml(elem: ET.Element) -> 'WikiPage':
        """Parse from XML element."""
        page_id = elem.get("id", "")
        title = elem.findtext("title", "")
        description = elem.findtext("description", "")
        importance = elem.findtext("importance", "medium")

        relevant_files = []
        rel_files_elem = elem.find("relevant_files")
        if rel_files_elem is not None:
            relevant_files = [f.text for f in rel_files_elem.findall("file_path") if f.text]

        related_pages = []
        related_elem = elem.find("related_pages")
        if related_elem is not None:
            related_pages = [r.text for r in related_elem.findall("related") if r.text]

        parent_section = elem.findtext("parent_section")

        return WikiPage(
            id=page_id,
            title=title,
            description=description,
            importance=importance,
            relevant_files=relevant_files,
            related_pages=related_pages,
            parent_section=parent_section
        )


@dataclass
class WikiSection:
    """Represents a hierarchical section containing pages."""
    id: str
    title: str
    pages: List[str] = field(default_factory=list)  # page IDs
    subsections: List[str] = field(default_factory=list)  # section IDs

    def to_xml(self) -> ET.Element:
        """Convert to XML element."""
        section = ET.Element("section", id=self.id)

        title = ET.SubElement(section, "title")
        title.text = self.title

        if self.pages:
            pages_elem = ET.SubElement(section, "pages")
            for page_id in self.pages:
                page_ref = ET.SubElement(pages_elem, "page_ref")
                page_ref.text = page_id

        if self.subsections:
            subsections_elem = ET.SubElement(section, "subsections")
            for section_id in self.subsections:
                section_ref = ET.SubElement(subsections_elem, "section_ref")
                section_ref.text = section_id

        return section

    @staticmethod
    def from_xml(elem: ET.Element) -> 'WikiSection':
        """Parse from XML element."""
        section_id = elem.get("id", "")
        title = elem.findtext("title", "")

        pages = []
        pages_elem = elem.find("pages")
        if pages_elem is not None:
            pages = [p.text for p in pages_elem.findall("page_ref") if p.text]

        subsections = []
        subsections_elem = elem.find("subsections")
        if subsections_elem is not None:
            subsections = [s.text for s in subsections_elem.findall("section_ref") if s.text]

        return WikiSection(
            id=section_id,
            title=title,
            pages=pages,
            subsections=subsections
        )


@dataclass
class WikiStructure:
    """Overall wiki structure with title, description, sections, and pages."""
    title: str
    description: str
    sections: Dict[str, WikiSection] = field(default_factory=dict)
    pages: Dict[str, WikiPage] = field(default_factory=dict)

    def to_xml_string(self, pretty: bool = True) -> str:
        """Convert to XML string."""
        root = ET.Element("wiki_structure")

        title = ET.SubElement(root, "title")
        title.text = self.title

        desc = ET.SubElement(root, "description")
        desc.text = self.description

        if self.sections:
            sections_elem = ET.SubElement(root, "sections")
            for section in self.sections.values():
                sections_elem.append(section.to_xml())

        if self.pages:
            pages_elem = ET.SubElement(root, "pages")
            for page in self.pages.values():
                pages_elem.append(page.to_xml())

        if pretty:
            self._indent(root)

        return ET.tostring(root, encoding='unicode')

    @staticmethod
    def _indent(elem: ET.Element, level: int = 0):
        """Add pretty-printing indentation to XML."""
        indent = "\n" + "  " * level
        if len(elem):
            if not elem.text or not elem.text.strip():
                elem.text = indent + "  "
            if not elem.tail or not elem.tail.strip():
                elem.tail = indent
            for child in elem:
                WikiStructure._indent(child, level + 1)
            if not child.tail or not child.tail.strip():
                child.tail = indent
        else:
            if level and (not elem.tail or not elem.tail.strip()):
                elem.tail = indent

    @staticmethod
    def from_xml_string(xml_string: str) -> 'WikiStructure':
        """Parse from XML string."""
        root = ET.fromstring(xml_string)

        title = root.findtext("title", "")
        description = root.findtext("description", "")

        sections = {}
        sections_elem = root.find("sections")
        if sections_elem is not None:
            for section_elem in sections_elem.findall("section"):
                section = WikiSection.from_xml(section_elem)
                sections[section.id] = section

        pages = {}
        pages_elem = root.find("pages")
        if pages_elem is not None:
            for page_elem in pages_elem.findall("page"):
                page = WikiPage.from_xml(page_elem)
                pages[page.id] = page

        return WikiStructure(
            title=title,
            description=description,
            sections=sections,
            pages=pages
        )

    def save_to_file(self, filepath: str):
        """Save wiki structure to XML file."""
        xml_string = self.to_xml_string(pretty=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
            f.write(xml_string)

    @staticmethod
    def load_from_file(filepath: str) -> 'WikiStructure':
        """Load wiki structure from XML file."""
        with open(filepath, 'r', encoding='utf-8') as f:
            # Skip XML declaration if present
            content = f.read()
            if content.startswith('<?xml'):
                content = content.split('\n', 1)[1]
            return WikiStructure.from_xml_string(content)

    def get_page_count(self) -> int:
        """Get total number of pages."""
        return len(self.pages)

    def get_section_count(self) -> int:
        """Get total number of sections."""
        return len(self.sections)

    def get_pages_by_importance(self, importance: str) -> List[WikiPage]:
        """Get all pages with specific importance level."""
        return [p for p in self.pages.values() if p.importance == importance]

    def validate(self) -> List[str]:
        """
        Validate wiki structure for consistency.

        Returns list of validation errors (empty if valid).
        """
        errors = []

        # Check that all page_refs in sections exist
        for section in self.sections.values():
            for page_id in section.pages:
                if page_id not in self.pages:
                    errors.append(f"Section '{section.id}' references non-existent page '{page_id}'")

        # Check that all section_refs in sections exist
        for section in self.sections.values():
            for subsection_id in section.subsections:
                if subsection_id not in self.sections:
                    errors.append(f"Section '{section.id}' references non-existent subsection '{subsection_id}'")

        # Check that all parent_section references exist
        for page in self.pages.values():
            if page.parent_section and page.parent_section not in self.sections:
                errors.append(f"Page '{page.id}' references non-existent parent section '{page.parent_section}'")

        # Check that all related_pages references exist
        for page in self.pages.values():
            for related_id in page.related_pages:
                if related_id not in self.pages:
                    errors.append(f"Page '{page.id}' references non-existent related page '{related_id}'")

        return errors
