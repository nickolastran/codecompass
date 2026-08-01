"""
Content generation for wiki pages using LLM.

This module generates comprehensive markdown documentation for each wiki page
by using gathered context (from context_gatherer.py) and calling an LLM API.
"""

import os
import re
from pathlib import Path
from typing import Optional, Dict
from dotenv import load_dotenv

from .wiki_structure import WikiStructure, WikiPage
from .context_gatherer import PageContext


# Load the documentation prompt template
DOCUMENTATION_PROMPT_TEMPLATE = """You are an expert technical writer and software architect.
Your task is to generate a comprehensive and accurate technical wiki page in Markdown format about a specific feature, system, or module within a given software project.

You will be given:
1. The "[WIKI_PAGE_TOPIC]" for the page you need to create.
2. A list of "[RELEVANT_SOURCE_FILES]" from the project that you MUST use as the sole basis for the content. You have access to the full content of these files. You MUST use AT LEAST 5 relevant source files for comprehensive coverage - if fewer are provided, search for additional related files in the codebase.

CRITICAL STARTING INSTRUCTION:
The very first thing on the page MUST be a `<details>` block listing ALL the `[RELEVANT_SOURCE_FILES]` you used to generate the content. There MUST be AT LEAST 5 source files listed - if fewer were provided, you MUST find additional related files to include.
Format it exactly like this:
<details>
<summary>Relevant source files</summary>

Remember, do not provide any acknowledgements, disclaimers, apologies, or any other preface before the `<details>` block. JUST START with the `<details>` block.
The following files were used as context for generating this wiki page:

- [path/to/file1.py]()
- [path/to/file2.py]()
<!-- Add additional relevant files if fewer than 5 were provided -->
</details>

Immediately after the `<details>` block, the main title of the page should be a H1 Markdown heading: `# {page_title}`.

Based ONLY on the content of the `[RELEVANT_SOURCE_FILES]`:

1.  **Introduction:** Start with a concise introduction (1-2 paragraphs) explaining the purpose, scope, and high-level overview of "{page_title}" within the context of the overall project. If relevant, and if information is available in the provided files, link to other potential wiki pages using the format `[Link Text](#page-anchor-or-id)`.

2.  **Detailed Sections:** Break down "{page_title}" into logical sections using H2 (`##`) and H3 (`###`) Markdown headings. For each section:
    *   Explain the architecture, components, data flow, or logic relevant to the section's focus, as evidenced in the source files.
    *   Identify key functions, classes, data structures, API endpoints, or configuration elements pertinent to that section.

3.  **Mermaid Diagrams:**
    *   EXTENSIVELY use Mermaid diagrams (e.g., `flowchart TD`, `sequenceDiagram`, `classDiagram`, `erDiagram`, `graph TD`) to visually represent architectures, flows, relationships, and schemas found in the source files.
    *   Ensure diagrams are accurate and directly derived from information in the `[RELEVANT_SOURCE_FILES]`.
    *   Provide a brief explanation before or after each diagram to give context.
    *   CRITICAL: All diagrams MUST follow strict vertical orientation:
       - Use "graph TD" (top-down) directive for flow diagrams
       - NEVER use "graph LR" (left-right)
       - Maximum node width should be 3-4 words
       - For sequence diagrams:
         - Start with "sequenceDiagram" directive on its own line
         - Define ALL participants at the beginning using "participant" keyword
         - Optionally specify participant types: actor, boundary, control, entity, database, collections, queue
         - Use descriptive but concise participant names, or use aliases: "participant A as Alice"
         - Use the correct Mermaid arrow syntax (8 types available):
           - -> solid line without arrow (rarely used)
           - --> dotted line without arrow (rarely used)
           - ->> solid line with arrowhead (most common for requests/calls)
           - -->> dotted line with arrowhead (most common for responses/returns)
           - ->x solid line with X at end (failed/error message)
           - -->x dotted line with X at end (failed/error response)
           - -) solid line with open arrow (async message, fire-and-forget)
           - --) dotted line with open arrow (async response)
           - Examples: A->>B: Request, B-->>A: Response, A->xB: Error, A-)B: Async event
         - Use +/- suffix for activation boxes: A->>+B: Start (activates B), B-->>-A: End (deactivates B)
         - Group related participants using "box": box GroupName ... end
         - Use structural elements for complex flows:
           - loop LoopText ... end (for iterations)
           - alt ConditionText ... else ... end (for conditionals)
           - opt OptionalText ... end (for optional flows)
           - par ParallelText ... and ... end (for parallel actions)
           - critical CriticalText ... option ... end (for critical regions)
           - break BreakText ... end (for breaking flows/exceptions)
         - Add notes for clarification: "Note over A,B: Description", "Note right of A: Detail"
         - Use autonumber directive to add sequence numbers to messages
         - NEVER use flowchart-style labels like A--|label|-->B. Always use a colon for labels: A->>B: My Label

4.  **Tables:**
    *   Use Markdown tables to summarize information such as:
        *   Key features or components and their descriptions.
        *   API endpoint parameters, types, and descriptions.
        *   Configuration options, their types, and default values.
        *   Data model fields, types, constraints, and descriptions.

5.  **Code Snippets (ENTIRELY OPTIONAL):**
    *   Include short, relevant code snippets (e.g., Python, Java, JavaScript, SQL, JSON, YAML) directly from the `[RELEVANT_SOURCE_FILES]` to illustrate key implementation details, data structures, or configurations.
    *   Ensure snippets are well-formatted within Markdown code blocks with appropriate language identifiers.

6.  **Source Citations (EXTREMELY IMPORTANT):**
    *   For EVERY piece of significant information, explanation, diagram, table entry, or code snippet, you MUST cite the specific source file(s) and relevant line numbers from which the information was derived.
    *   Place citations at the end of the paragraph, under the diagram/table, or after the code snippet.
    *   Use the exact format: `Sources: [filename.ext:start_line-end_line]()` for a range, or `Sources: [filename.ext:line_number]()` for a single line. Multiple files can be cited: `Sources: [file1.ext:1-10](), [file2.ext:5](), [dir/file3.ext]()` (if the whole file is relevant and line numbers are not applicable or too broad).
    *   If an entire section is overwhelmingly based on one or two files, you can cite them under the section heading in addition to more specific citations within the section.
    *   IMPORTANT: You MUST cite AT LEAST 5 different source files throughout the wiki page to ensure comprehensive coverage.

7.  **Technical Accuracy:** All information must be derived SOLELY from the `[RELEVANT_SOURCE_FILES]`. Do not infer, invent, or use external knowledge about similar systems or common practices unless it's directly supported by the provided code. If information is not present in the provided files, do not include it or explicitly state its absence if crucial to the topic.

8.  **Clarity and Conciseness:** Use clear, professional, and concise technical language suitable for other developers working on or learning about the project. Avoid unnecessary jargon, but use correct technical terms where appropriate.

9.  **Conclusion/Summary:** End with a brief summary paragraph if appropriate for "{page_title}", reiterating the key aspects covered and their significance within the project.

Remember:
- Ground every claim in the provided source files.
- Prioritize accuracy and direct representation of the code's functionality and structure.
- Structure the document logically for easy understanding by other developers.

----------------------------------------------------------------------
WIKI_PAGE_TOPIC: {page_title}
WIKI_PAGE_DESCRIPTION: {page_description}
----------------------------------------------------------------------

RELEVANT_SOURCE_FILES:
{file_list}

----------------------------------------------------------------------
SOURCE CODE CONTENT:
{source_code}
----------------------------------------------------------------------

Generate the complete markdown documentation for this wiki page now.
"""


class ContentGenerator:
    """Generates markdown content for wiki pages using LLM."""

    def __init__(
        self,
        llm_provider: str = "openai",
        model: str = "gpt-4",
        api_key: Optional[str] = None
    ):
        """
        Initialize content generator.

        Args:
            llm_provider: LLM provider ("openai" or "anthropic")
            model: Model name (e.g., "gpt-4", "claude-sonnet-4")
            api_key: API key (if None, reads from environment)
        """
        self.llm_provider = llm_provider
        self.model = model
        self.api_key = api_key

        # Load environment
        load_dotenv()

        # Get API key from environment if not provided
        if self.api_key is None:
            if llm_provider == "openai":
                self.api_key = os.getenv("OPENAI_API_KEY")
            elif llm_provider == "anthropic":
                self.api_key = os.getenv("ANTHROPIC_API_KEY")

        if not self.api_key:
            raise ValueError(f"{llm_provider.upper()} API key not found. Set {llm_provider.upper()}_API_KEY environment variable or pass api_key parameter")

    def generate_page_content(
        self,
        page: WikiPage,
        context: PageContext,
        debug: bool = False
    ) -> str:
        """
        Generate markdown content for a wiki page.

        Args:
            page: WikiPage object with metadata
            context: PageContext with gathered source code
            debug: Enable debug logging

        Returns:
            Generated markdown content
        """
        if debug:
            print(f"\n[GENERATE] Page: {page.title}")
            print(f"[GENERATE] Context: {len(context.file_paths)} files, {context.total_chars} chars")

        # Build prompt
        prompt = self._build_prompt(page, context)

        if debug:
            print(f"[GENERATE] Prompt length: {len(prompt)} chars")

        # Call LLM
        if debug:
            print(f"[GENERATE] Calling {self.llm_provider} ({self.model})...")

        markdown = self._call_llm(prompt)

        if debug:
            print(f"[GENERATE] Generated {len(markdown)} chars of markdown")

        # Post-process
        markdown = self._post_process_markdown(markdown, context, debug)

        return markdown

    def _build_prompt(self, page: WikiPage, context: PageContext) -> str:
        """Build LLM prompt from template."""
        # Build file list
        file_list = "\n".join(f"- {fp}" for fp in sorted(context.file_paths))

        # Build source code section
        source_parts = []
        for file_path in sorted(context.file_paths):
            source_parts.append(f"### File: {file_path}\n")
            source_parts.append("```\n")
            source_parts.append(context.sources.get(file_path, ""))
            source_parts.append("\n```\n\n")
        source_code = "".join(source_parts)

        # Format prompt
        prompt = DOCUMENTATION_PROMPT_TEMPLATE.format(
            page_title=page.title,
            page_description=page.description,
            file_list=file_list,
            source_code=source_code
        )

        return prompt

    def _call_llm(self, prompt: str) -> str:
        """Call LLM API to generate markdown."""
        if self.llm_provider == "openai":
            return self._call_openai(prompt)
        elif self.llm_provider == "anthropic":
            return self._call_anthropic(prompt)
        else:
            raise ValueError(f"Unsupported LLM provider: {self.llm_provider}")

    def _call_openai(self, prompt: str) -> str:
        """Call OpenAI API."""
        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError("OpenAI package not installed. Run: pip install openai")

        client = OpenAI(api_key=self.api_key)

        response = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,  # Lower temperature for more consistent output
        )

        return response.choices[0].message.content

    def _call_anthropic(self, prompt: str) -> str:
        """Call Anthropic API."""
        try:
            from anthropic import Anthropic
        except ImportError:
            raise ImportError("Anthropic package not installed. Run: pip install anthropic")

        client = Anthropic(api_key=self.api_key)

        response = client.messages.create(
            model=self.model,
            max_tokens=8192,  # Large token limit for comprehensive docs
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}]
        )

        return response.content[0].text

    def _post_process_markdown(
        self,
        markdown: str,
        context: PageContext,
        debug: bool = False
    ) -> str:
        """
        Post-process generated markdown.

        Checks:
        - Validates Mermaid diagram syntax
        - Checks source citations exist
        - Validates minimum file count
        """
        if debug:
            print("[POST-PROCESS] Validating markdown...")

        # Check for <details> block
        if not re.search(r'<details>', markdown, re.IGNORECASE):
            if debug:
                print("  [WARN] No <details> block found")

        # Check for minimum file citations
        cited_files = set(re.findall(r'\[([^\]]+\.[a-z]+)(?::\d+-?\d*)?\]\(\)', markdown, re.IGNORECASE))
        if len(cited_files) < 5:
            if debug:
                print(f"  [WARN] Only {len(cited_files)} files cited (minimum: 5)")
                print(f"  [WARN] Cited files: {cited_files}")

        # Check for Mermaid diagrams
        mermaid_blocks = re.findall(r'```mermaid\n(.*?)\n```', markdown, re.DOTALL)
        if debug:
            print(f"  [INFO] Found {len(mermaid_blocks)} Mermaid diagrams")

        # Validate Mermaid syntax (basic check for LR instead of TD)
        for i, block in enumerate(mermaid_blocks):
            if 'graph LR' in block or 'flowchart LR' in block:
                if debug:
                    print(f"  [WARN] Diagram {i+1} uses LR (left-right) instead of TD (top-down)")

        # Check for source citations
        citation_count = len(re.findall(r'Sources?:\s*\[', markdown, re.IGNORECASE))
        if debug:
            print(f"  [INFO] Found {citation_count} source citations")

        if citation_count == 0:
            if debug:
                print("  [WARN] No source citations found")

        return markdown


def generate_single_page(
    page: WikiPage,
    context: PageContext,
    output_dir: str,
    llm_provider: str = "openai",
    model: str = "gpt-4",
    api_key: Optional[str] = None,
    debug: bool = False
) -> str:
    """
    Generate markdown content for a single wiki page.

    Args:
        page: WikiPage object
        context: PageContext with gathered source code
        output_dir: Directory to save markdown file
        llm_provider: LLM provider ("openai" or "anthropic")
        model: Model name
        api_key: API key (optional)
        debug: Enable debug logging

    Returns:
        Path to generated markdown file
    """
    # Initialize generator
    generator = ContentGenerator(llm_provider, model, api_key)

    # Generate content
    markdown = generator.generate_page_content(page, context, debug)

    # Save to file
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Sanitize page ID for filename
    safe_id = page.id.replace("/", "_").replace("\\", "_")
    file_path = output_path / f"{safe_id}.md"

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(markdown)

    if debug:
        print(f"[SAVE] Markdown saved to {file_path}")

    return str(file_path)


def main():
    """CLI for testing content generation."""
    import argparse

    parser = argparse.ArgumentParser(description="Generate markdown content for wiki pages")
    parser.add_argument(
        "context_file",
        help="Path to context file (from gather command)"
    )
    parser.add_argument(
        "--page-id",
        required=True,
        help="Page ID to generate"
    )
    parser.add_argument(
        "--structure",
        required=True,
        help="Path to wiki structure XML file"
    )
    parser.add_argument(
        "--output",
        "-o",
        default="./wiki",
        help="Output directory (default: ./wiki)"
    )
    parser.add_argument(
        "--provider",
        choices=["openai", "anthropic"],
        default="openai",
        help="LLM provider (default: openai)"
    )
    parser.add_argument(
        "--model",
        default="gpt-4",
        help="Model name (default: gpt-4)"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )

    args = parser.parse_args()

    # Load wiki structure
    from docs.wiki_structure import WikiStructure
    wiki_structure = WikiStructure.load_from_file(args.structure)

    # Find page
    if args.page_id not in wiki_structure.pages:
        print(f"Error: Page '{args.page_id}' not found in wiki structure")
        return 1

    page = wiki_structure.pages[args.page_id]

    # Load context (simple text file for now)
    # In practice, this would come from PageContext objects
    print(f"Loading context from {args.context_file}...")
    context_text = Path(args.context_file).read_text(encoding='utf-8')

    # Parse context into PageContext (simplified)
    context = PageContext(
        page_id=page.id,
        page_title=page.title,
        description=page.description
    )

    # Extract file paths and sources from context file
    # This is a simplified parser - in practice we'd load from pickle/json
    lines = context_text.split('\n')
    current_file = None
    current_content = []

    for line in lines:
        if line.startswith('## File:'):
            # Save previous file
            if current_file and current_content:
                context.file_paths.add(current_file)
                context.sources[current_file] = '\n'.join(current_content)
                current_content = []

            # Start new file
            current_file = line.replace('## File:', '').strip()
        elif current_file and not line.startswith('```'):
            current_content.append(line)

    # Save last file
    if current_file and current_content:
        context.file_paths.add(current_file)
        context.sources[current_file] = '\n'.join(current_content)

    context.total_chars = sum(len(s) for s in context.sources.values())

    # Generate page
    print(f"\nGenerating page: {page.title}")
    output_path = generate_single_page(
        page,
        context,
        args.output,
        args.provider,
        args.model,
        debug=args.debug
    )

    print(f"\n✓ Page generated: {output_path}")


if __name__ == "__main__":
    main()
