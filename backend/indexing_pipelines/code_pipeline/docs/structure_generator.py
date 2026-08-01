"""
Wiki structure generator using LLM analysis.

Analyzes a codebase (file tree + README) and generates a logical
wiki structure with sections and pages.
"""

import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

from ..core.code_indexing import CodeIndexer
from ..languages.language_config import ENABLED_LANGUAGES
from .tree_generator import generate_tree_from_graph
from .wiki_structure import WikiStructure


def read_readme(repo_path: str) -> Optional[str]:
    """
    Find and read README file in repository.

    Args:
        repo_path: Path to repository root

    Returns:
        README content or None if not found
    """
    repo = Path(repo_path)
    readme_names = ['README.md', 'README.txt', 'README.rst', 'README', 'readme.md']

    for name in readme_names:
        readme_path = repo / name
        if readme_path.exists():
            try:
                return readme_path.read_text(encoding='utf-8')
            except Exception as e:
                print(f"Warning: Could not read {readme_path}: {e}")
                return None

    return None


def build_structure_prompt(
    repo_name: str,
    file_tree: str,
    readme: Optional[str],
    comprehensive: bool = False
) -> str:
    """
    Build prompt for wiki structure generation.

    Args:
        repo_name: Name of the repository
        file_tree: ASCII tree structure of repository
        readme: README content (or None)
        comprehensive: If True, generate 8-12 pages; if False, 4-6 pages

    Returns:
        Formatted prompt string
    """
    readme_section = f"""
2. The README file of the project:
<readme>
{readme}
</readme>
""" if readme else """
2. No README file was found in this repository.
"""

    num_pages = "8-12" if comprehensive else "4-6"
    mode = "comprehensive" if comprehensive else "concise"

    sections_guide = ""
    if comprehensive:
        sections_guide = """
Create a structured wiki with the following main sections:
- Overview (general information about the project)
- System Architecture (how the system is designed)
- Core Features (key functionality)
- Data Management/Flow (if applicable, how data is stored, processed, accessed)
- Frontend Components (UI elements, if applicable)
- Backend Systems (server-side components, if applicable)
- Model Integration (AI model connections, if applicable)
- Deployment/Infrastructure (how to deploy, infrastructure details)
- Extensibility and Customization (if applicable, how to extend or customize)

Each section should contain relevant pages. For example, the "Frontend Components" section might include pages for "Home Page", "Repository Wiki Page", "Ask Component", etc.
"""

    xml_format = """
<wiki_structure>
  <title>[Overall title for the wiki]</title>
  <description>[Brief description of the repository]</description>
  <sections>
    <section id="section-1">
      <title>[Section title]</title>
      <pages>
        <page_ref>page-1</page_ref>
        <page_ref>page-2</page_ref>
      </pages>
      <subsections>
        <section_ref>section-2</section_ref>
      </subsections>
    </section>
    <!-- More sections as needed -->
  </sections>
  <pages>
    <page id="page-1">
      <title>[Page title]</title>
      <description>[Brief description of what this page will cover]</description>
      <importance>high|medium|low</importance>
      <relevant_files>
        <file_path>[Path to a relevant file]</file_path>
        <!-- More file paths as needed -->
      </relevant_files>
      <related_pages>
        <related>page-2</related>
        <!-- More related page IDs as needed -->
      </related_pages>
      <parent_section>section-1</parent_section>
    </page>
    <!-- More pages as needed -->
  </pages>
</wiki_structure>
""" if comprehensive else """
<wiki_structure>
  <title>[Overall title for the wiki]</title>
  <description>[Brief description of the repository]</description>
  <pages>
    <page id="page-1">
      <title>[Page title]</title>
      <description>[Brief description of what this page will cover]</description>
      <importance>high|medium|low</importance>
      <relevant_files>
        <file_path>[Path to a relevant file]</file_path>
        <!-- More file paths as needed -->
      </relevant_files>
      <related_pages>
        <related>page-2</related>
        <!-- More related page IDs as needed -->
      </related_pages>
    </page>
    <!-- More pages as needed -->
  </pages>
</wiki_structure>
"""

    prompt = f"""Analyze this repository '{repo_name}' and create a wiki structure for it.

1. The complete file tree of the project:
<file_tree>
{file_tree}
</file_tree>
{readme_section}
I want to create a wiki for this repository. Determine the most logical structure for a wiki based on the repository's content.

When designing the wiki structure, include pages that would benefit from visual diagrams, such as:
- Architecture overviews
- Data flow descriptions
- Component relationships
- Process workflows
- State machines
- Class hierarchies
{sections_guide}
Return your analysis in the following XML format:
{xml_format}
IMPORTANT FORMATTING INSTRUCTIONS:
- Return ONLY the valid XML structure specified above
- DO NOT wrap the XML in markdown code blocks (no ``` or ```xml)
- DO NOT include any explanation text before or after the XML
- Ensure the XML is properly formatted and valid
- Start directly with <wiki_structure> and end with </wiki_structure>

IMPORTANT:
1. Create {num_pages} pages that would make a {mode} wiki for this repository
2. Each page should focus on a specific aspect of the codebase (e.g., architecture, key features, setup)
3. The relevant_files MUST be actual file paths WITH EXTENSIONS (e.g., .py, .js, .ts, .java, .md) from the repository, NOT directories
   - ✓ CORRECT: pacai/core/agent.py, pacai/pacman/game.py, README.md
   - ✗ WRONG: pacai/core/, pacai/agents, pacai/ui/ (these are directories with trailing slashes)
   - Include 3-8 specific source files per page that are most relevant to that topic
   - Look at the file tree to find actual .py, .js, .ts files, NOT directory names
4. Return ONLY valid XML with the structure specified above, with no markdown code block delimiters
"""

    return prompt


def generate_wiki_structure(
    repo_path: str,
    comprehensive: bool = False,
    llm_provider: str = "openai",
    model: str = "gpt-4",
    api_key: Optional[str] = None
) -> WikiStructure:
    """
    Generate wiki structure for a repository using LLM.

    Args:
        repo_path: Path to repository root
        comprehensive: If True, generate comprehensive structure (8-12 pages)
        llm_provider: LLM provider ("openai" or "anthropic")
        model: Model name (e.g., "gpt-4", "claude-sonnet-4")
        api_key: API key (if None, reads from environment)

    Returns:
        WikiStructure object

    Raises:
        ValueError: If LLM provider is not supported
        Exception: If LLM API call fails
    """
    repo_path = str(Path(repo_path).resolve())
    repo_name = Path(repo_path).name

    print(f"Generating wiki structure for {repo_name}...")

    # 1. Generate file tree
    print("  Building file tree...")
    indexer = CodeIndexer(repo_path, handlers=ENABLED_LANGUAGES)
    KG = indexer.index_directory()
    file_tree = generate_tree_from_graph(
        KG,
        repo_path,
        max_depth=None,
        include_stats=False,
        include_summary=False
    )

    # 2. Read README
    print("  Reading README...")
    readme = read_readme(repo_path)
    if readme:
        print(f"    Found README ({len(readme)} chars)")
    else:
        print("    No README found")

    # 3. Build prompt
    print("  Building prompt...")
    prompt = build_structure_prompt(repo_name, file_tree, readme, comprehensive)

    # 4. Call LLM
    print(f"  Calling {llm_provider} API ({model})...")
    xml_response = call_llm(prompt, llm_provider, model, api_key)

    # 5. Parse XML
    print("  Parsing XML response...")
    wiki_structure = parse_xml_response(xml_response)

    # 6. Validate
    print("  Validating structure...")
    errors = wiki_structure.validate()
    if errors:
        print("  Validation warnings:")
        for error in errors:
            print(f"    - {error}")

    print(f"  Generated {wiki_structure.get_page_count()} pages in {wiki_structure.get_section_count()} sections")

    return wiki_structure


def call_llm(prompt: str, provider: str, model: str, api_key: Optional[str]) -> str:
    """
    Call LLM API to generate wiki structure.

    Args:
        prompt: The formatted prompt
        provider: LLM provider name
        model: Model name
        api_key: API key (optional)

    Returns:
        XML response string

    Raises:
        ValueError: If provider is not supported
        Exception: If API call fails
    """
    if provider == "openai":
        return call_openai(prompt, model, api_key)
    elif provider == "anthropic":
        return call_anthropic(prompt, model, api_key)
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")


def call_openai(prompt: str, model: str, api_key: Optional[str]) -> str:
    """Call OpenAI API."""
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError("OpenAI package not installed. Run: pip install openai")

    if api_key is None:
        load_dotenv()
        api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise ValueError("OpenAI API key not found. Set OPENAI_API_KEY environment variable or pass api_key parameter")

    client = OpenAI(api_key=api_key)

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,  # Lower temperature for more consistent structure
    )

    return response.choices[0].message.content


def call_anthropic(prompt: str, model: str, api_key: Optional[str]) -> str:
    """Call Anthropic API."""
    try:
        from anthropic import Anthropic
    except ImportError:
        raise ImportError("Anthropic package not installed. Run: pip install anthropic")

    if api_key is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        raise ValueError("Anthropic API key not found. Set ANTHROPIC_API_KEY environment variable or pass api_key parameter")

    client = Anthropic(api_key=api_key)

    response = client.messages.create(
        model=model,
        max_tokens=4096,
        temperature=0.3,
        messages=[{"role": "user", "content": prompt}]
    )

    return response.content[0].text


def parse_xml_response(response: str) -> WikiStructure:
    """
    Parse XML response from LLM into WikiStructure.

    Args:
        response: Raw LLM response (may contain markdown or extra text)

    Returns:
        WikiStructure object

    Raises:
        ValueError: If XML cannot be parsed
    """
    # Clean up response: remove markdown code blocks if present
    response = response.strip()

    # Remove markdown code block delimiters
    if response.startswith("```xml"):
        response = response[6:]
    elif response.startswith("```"):
        response = response[3:]

    if response.endswith("```"):
        response = response[:-3]

    response = response.strip()

    # Extract XML if there's extra text before/after
    start_idx = response.find("<wiki_structure>")
    end_idx = response.find("</wiki_structure>")

    if start_idx == -1 or end_idx == -1:
        raise ValueError("Could not find <wiki_structure> tags in LLM response")

    xml_content = response[start_idx:end_idx + len("</wiki_structure>")]

    try:
        return WikiStructure.from_xml_string(xml_content)
    except Exception as e:
        raise ValueError(f"Failed to parse XML: {e}\n\nXML content:\n{xml_content}")
