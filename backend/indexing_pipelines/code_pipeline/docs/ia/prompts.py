"""
LLM prompts for wiki IA generation.

Contains prompts for:
1. Global IA generation (top-level structure)
2. Per-module subpage generation (detailed breakdown)
"""

from typing import Dict, Any


def build_global_ia_prompt(
    project_name: str,
    top_level_modules: Dict[str, str],
    module_summaries: Dict[str, Dict[str, Any]]
) -> str:
    """
    Build prompt for generating the global (top-level) wiki IA.

    Args:
        project_name: Name of the project
        top_level_modules: Dict mapping module names to their summaries
        module_summaries: Full module summaries dict (for reference)

    Returns:
        Formatted prompt string
    """
    # Build module list with exact paths
    module_list = []
    exact_paths = []
    for module_name, summary in top_level_modules.items():
        module_list.append(f"- {module_name}/")
        module_list.append(f"  {summary}")
        module_list.append("")
        exact_paths.append(f'"{module_name}"')

    modules_text = "\n".join(module_list)
    exact_paths_text = ", ".join(exact_paths)

    return f"""You are designing the Information Architecture (IA) for a technical wiki documenting the "{project_name}" codebase.

Based on the following top-level modules and their summaries, design a clear, user-friendly wiki structure:

Top-level modules:
{modules_text}

Your task:
1. Create a top-level wiki structure with 4-8 main pages
2. Each page should have a clear purpose and scope
3. Use these page types:
   - "overview": Project introduction, getting started, high-level concepts
   - "module": Documentation for specific modules/packages
   - "architecture": System design, architecture patterns
   - "guide": How-to guides, tutorials
   - "reference": API reference, detailed technical docs
   - "concept": Conceptual explanations, domain concepts

Guidelines:
- Start with an overview page as the entry point
- Group related modules under CONCEPTUAL topics, not literal folder names
- Use clear, descriptive titles that describe WHAT the content is about
- Think about what developers NEED TO KNOW, not just what folders exist
- Keep the top level shallow (4-8 pages max) - detailed breakdown comes later
- For module pages, list which modules they cover in the "modules" field
- Avoid generic/redundant pages like "Introduction" AND "Overview"

CRITICAL - Title Naming:
GOOD titles (conceptual, user-oriented):
  - "Agent Architecture" (describes what it's about)
  - "Search Algorithms" (describes functionality)
  - "Gameplay Mechanics" (describes domain concept)
  - "Resource Management" (describes cross-cutting concern)

BAD titles (literal, folder-based):
  - "Agents Module" or "Agents Module Documentation" (too literal)
  - "Core Module" or "Core Package" (meaningless)
  - "Utils" or "Helpers" (vague)
  - ANY title ending in "Module", "Package", or "Documentation"

Think conceptually: What does this code DO? What problems does it solve? What will developers want to learn about?

CRITICAL CONSTRAINT - Module Paths:
When specifying modules in the "modules" field, you MUST use ONLY the exact module paths listed above.
Do NOT simplify, rename, or reorganize paths. Use them exactly as provided.
Valid module paths for this project: {exact_paths_text}

Output format:
Return a JSON array of page objects. Each page has:
{{
  "slug": "url-safe-identifier",
  "title": "Human Readable Title",
  "kind": "overview|module|architecture|guide|reference|concept",
  "modules": ["list", "of", "module/paths"],
  "description": "1-2 sentence description of what this page covers",
  "tags": ["optional", "tags"]
}}

Example output (notice the conceptual titles):
[
  {{
    "slug": "overview",
    "title": "Project Overview",
    "kind": "overview",
    "modules": [],
    "description": "Introduction to the project, key concepts, and getting started guide.",
    "tags": ["introduction"]
  }},
  {{
    "slug": "agent-architecture",
    "title": "Agent Architecture",
    "kind": "architecture",
    "modules": ["pacai/agents", "pacai/core"],
    "description": "Core agent system design, decision-making patterns, and base abstractions.",
    "tags": ["agents", "architecture"]
  }},
  {{
    "slug": "search-algorithms",
    "title": "Search Algorithms",
    "kind": "module",
    "modules": ["pacai/student"],
    "description": "Search and planning algorithms for intelligent agent behavior.",
    "tags": ["search", "algorithms", "ai"]
  }}
]

Return ONLY the JSON array, no other text."""


def build_module_subpages_prompt(
    page_title: str,
    page_description: str,
    modules: Dict[str, str],
    module_details: Dict[str, Dict[str, Any]]
) -> str:
    """
    Build prompt for generating subpages for a specific module page.

    Args:
        page_title: Title of the parent page
        page_description: Description of the parent page
        modules: Dict mapping module names to their summaries (for this page)
        module_details: Full module details dict (including file summaries, submodules)

    Returns:
        Formatted prompt string
    """
    # Build detailed module information and collect exact paths
    module_info = []
    exact_paths = []
    for module_name, summary in modules.items():
        exact_paths.append(f'"{module_name}"')
        module_info.append(f"## {module_name}/")
        module_info.append(f"Summary: {summary}")

        # Add file information if available
        details = module_details.get(module_name, {})
        files = details.get("files", [])
        if files:
            module_info.append(f"Files ({len(files)}):")
            for file_info in files[:10]:  # Limit to first 10 files
                file_name = file_info.get("name", "unknown")
                file_summary = file_info.get("summary", "")
                if file_summary:
                    module_info.append(f"  - {file_name}: {file_summary}")
            if len(files) > 10:
                module_info.append(f"  ... and {len(files) - 10} more files")

        # Add submodule information if available
        submodules = details.get("submodules", [])
        if submodules:
            module_info.append(f"Submodules ({len(submodules)}):")
            for submodule in submodules[:8]:  # Limit to first 8 submodules
                sub_name = submodule.get("name", "unknown")
                sub_summary = submodule.get("summary", "")
                module_info.append(f"  - {sub_name}/: {sub_summary}")
            if len(submodules) > 8:
                module_info.append(f"  ... and {len(submodules) - 8} more submodules")

        module_info.append("")

    modules_text = "\n".join(module_info)
    exact_paths_text = ", ".join(exact_paths)

    return f"""You are designing subpages for the "{page_title}" section of a technical wiki.

Parent page description: {page_description}

This section covers the following modules:
{modules_text}

Your task:
1. Break down this section into 2-6 focused subpages
2. Each subpage should cover a specific aspect or subsystem
3. Subpages can be:
   - Conceptual (explaining key abstractions/patterns)
   - Module-focused (deep dive into specific module(s))
   - Guide-oriented (how to use certain features)
   - Reference-oriented (API details, configuration options)

Guidelines:
- Create subpages that help developers understand and use these modules
- Group related modules together when it makes sense
- Use clear, CONCEPTUAL titles that describe functionality, not folder names
- For module-focused pages, list the specific modules in the "modules" field
- Each subpage should have a clear, distinct purpose
- Consider common developer questions: "How do I...", "What is...", "When to use..."
- Avoid creating a subpage for every single module - group intelligently
- DO NOT use module/folder names as page titles - focus on concepts and functionality

CRITICAL CONSTRAINT - Module Paths:
When specifying modules in the "modules" field, you MUST use ONLY the exact module paths listed above.
Do NOT simplify, rename, or reorganize paths. Use them exactly as provided.
Valid module paths for this section: {exact_paths_text}

Output format:
Return a JSON array of subpage objects. Each subpage has:
{{
  "slug": "url-safe-identifier",
  "title": "Human Readable Title",
  "kind": "overview|module|architecture|guide|reference|concept",
  "modules": ["specific/modules", "covered/here"],
  "description": "1-2 sentence description of what this subpage covers",
  "tags": ["optional", "tags"]
}}

Example output:
[
  {{
    "slug": "agent-basics",
    "title": "Agent Basics",
    "kind": "concept",
    "modules": ["pacai/agents"],
    "description": "Core concepts and abstractions in the agent system, including base agent classes and decision-making patterns.",
    "tags": ["agents", "concepts"]
  }},
  {{
    "slug": "search-algorithms",
    "title": "Search Algorithms",
    "kind": "module",
    "modules": ["pacai/agents/search"],
    "description": "Implementation of search algorithms for agent navigation and planning.",
    "tags": ["agents", "search", "algorithms"]
  }}
]

Return ONLY the JSON array, no other text."""


# System prompt used for both global and module-specific IA generation
SYSTEM_PROMPT = """You are an expert technical writer and information architect specializing in software documentation.

Your goal is to create clear, user-friendly documentation structures that help developers:
- Understand the codebase quickly
- Find relevant information easily
- Learn concepts progressively (from high-level to detailed)

Key principles:
1. **User-first**: Think about developer needs and questions
2. **Clear hierarchy**: Logical grouping with clear parent-child relationships
3. **Actionable titles**: Use specific, descriptive titles that set clear expectations
4. **Balanced scope**: Each page should be focused but comprehensive
5. **Progressive disclosure**: Start high-level, drill down as needed

Return valid JSON only. No markdown, no explanations, just the JSON array."""
