"""
LLM prompts for generating wiki page content.

Different prompts for different page kinds to generate appropriate content style.
"""

from indexing_pipelines.code_pipeline.docs.ia.context_builder import PageContext

# System prompt used for all page types
SYSTEM_PROMPT = """You are an expert technical writer creating clear, accurate documentation for a Python codebase.

Your writing should be:
- **Accurate**: Based solely on the provided context
- **Clear**: Easy to understand for developers familiar with Python
- **Concise**: No unnecessary verbosity or filler
- **Well-structured**: Using proper Markdown headings and formatting

Important rules:
- Do NOT invent or hallucinate classes, functions, or features not mentioned in the context
- Do NOT include generic Python tutorials or explanations of basic concepts
- Do NOT add disclaimers, apologies, or meta-commentary about the documentation
- ONLY reference symbols (classes, functions, methods) that appear in the provided context"""


def build_overview_prompt(context: PageContext, wiki_pages_summary: str = "") -> str:
    """
    Build prompt for project overview pages.

    These pages introduce the codebase at a high level.
    """
    # Use wiki pages summary if no actual code nodes (files/classes/functions)
    has_code_nodes = (
        len(context.files) > 0
        or len(context.classes) > 0
        or len(context.functions) > 0
        or len(context.methods) > 0
    )

    if not has_code_nodes and wiki_pages_summary:
        context_section = wiki_pages_summary
    else:
        context_section = context.get_formatted_context()

    return f"""You are writing the **{context.page_title}** page for this project's wiki.

## Context

{context_section}

## Your Task

Write a comprehensive Markdown page that:

1. **Introduction** (1-2 paragraphs)
   - What is this project?
   - What problems does it solve?
   - Who is it for?

2. **Architecture Overview** (2-3 paragraphs)
   - What are the main components/subsystems?
   - How do they fit together?
   - What are the key design patterns or architectural choices?

3. **Key Modules** (organized section)
   - Brief description of each major module and its purpose
   - How modules relate to each other

4. **Getting Started** (practical guidance)
   - Where should a new contributor start?
   - What are the most important files or classes to understand first?

## Guidelines

- Use `#` for the page title, `##` for major sections, `###` for subsections
- Keep the total page to 800-1200 words
- Focus on the big picture, not implementation details
- Only reference modules, classes, and files mentioned in the context above
- DO NOT hallucinate or invent features not mentioned in the context

Generate the complete Markdown page now."""


def build_module_prompt(context: PageContext) -> str:
    """
    Build prompt for module documentation pages.

    These pages provide in-depth coverage of specific modules/packages.
    """
    return f"""You are writing the **{context.page_title}** documentation page.

## Page Description

{context.page_description}

## Context

{context.get_formatted_context()}

## Your Task

Write a comprehensive Markdown page that documents this module in depth:

1. **Overview** (1-2 paragraphs)
   - What is this module responsible for?
   - When and why would a developer use it?

2. **Key Components**
   - Main classes and their responsibilities
   - Important functions and what they do
   - How components interact with each other

3. **Architecture & Design**
   - Design patterns used
   - Key abstractions or interfaces
   - Data flow or control flow

4. **Usage Examples** (if applicable)
   - Common use cases
   - How to use the main classes/functions
   - Integration points with other modules

5. **Important Details**
   - Configuration or setup requirements
   - Caveats, gotchas, or important notes

## Guidelines

- Use `#` for the page title, `##` for major sections, `###` for subsections
- Reference actual class/function names from the context
- Do NOT invent new APIs or features
- Keep to 1000-1500 words
- Be specific and technical (assume reader knows Python)

Generate the complete Markdown page now."""


def build_guide_prompt(context: PageContext) -> str:
    """
    Build prompt for guide/tutorial pages.

    These pages teach how to accomplish specific tasks.
    """
    return f"""You are writing a **{context.page_title}** guide page.

## Page Description

{context.page_description}

## Context

{context.get_formatted_context()}

## Your Task

Write a practical, tutorial-style Markdown guide that:

1. **Introduction** (1 paragraph)
   - What will this guide teach?
   - Who is this for?

2. **Concepts** (if applicable)
   - Key concepts the reader needs to understand
   - How the relevant classes/functions fit together

3. **Step-by-Step Guide**
   - Clear, numbered steps or sections
   - Explain what to do and why
   - Reference actual classes/methods from the context

4. **Examples**
   - Show how to use the APIs mentioned in the context
   - Illustrate common patterns or workflows

5. **Common Pitfalls** (if applicable)
   - Things to watch out for
   - Common mistakes and how to avoid them

## Guidelines

- Use `#` for the page title, `##` for major sections, `###` for subsections
- Be practical and hands-on, not just theoretical
- Only use classes/functions that appear in the context
- Keep to 800-1200 words
- Use code snippets (simple examples, not full implementations)

Generate the complete Markdown page now."""


def build_reference_prompt(context: PageContext) -> str:
    """
    Build prompt for API reference pages.

    These pages provide detailed API documentation.
    """
    return f"""You are writing the **{context.page_title}** API reference page.

## Page Description

{context.page_description}

## Context

{context.get_formatted_context()}

## Your Task

Write a detailed API reference page in Markdown:

1. **Overview** (1 paragraph)
   - What APIs are covered on this page?
   - What are they used for?

2. **Classes**
   - For each important class:
     - Purpose and responsibility
     - Key methods and what they do
     - Important attributes or properties

3. **Functions**
   - For each important function:
     - What it does
     - When to use it
     - Key parameters and return values (if apparent from summary)

4. **Usage Notes**
   - Common patterns for using these APIs
   - How different classes/functions work together

## Guidelines

- Use `#` for the page title, `##` for major sections, `###` for class/function names
- Be concise and factual
- Organize by class/module, not alphabetically
- Only document APIs that appear in the context
- Keep to 1000-1500 words
- Focus on "what" and "when", not "how" (implementation details)

Generate the complete Markdown page now."""


def build_architecture_prompt(context: PageContext) -> str:
    """
    Build prompt for architecture/design pages.

    These pages explain system design and patterns.
    """
    return f"""You are writing the **{context.page_title}** architecture documentation.

## Page Description

{context.page_description}

## Context

{context.get_formatted_context()}

## Your Task

Write an architectural overview page in Markdown:

1. **System Overview** (1-2 paragraphs)
   - What part of the system does this cover?
   - What are the high-level goals or design principles?

2. **Architecture**
   - Key components and their roles
   - How components interact
   - Data flow or control flow
   - Design patterns used

3. **Key Abstractions**
   - Important interfaces or base classes
   - Extension points or customization mechanisms

4. **Design Decisions**
   - Why was it designed this way?
   - Trade-offs and considerations

## Guidelines

- Use `#` for the page title, `##` for major sections, `###` for subsections
- Focus on design and structure, not implementation
- Reference actual classes/interfaces from the context
- Use diagrams if helpful (Mermaid syntax)
- Keep to 800-1200 words

Generate the complete Markdown page now."""


def build_concept_prompt(context: PageContext) -> str:
    """
    Build prompt for conceptual explanation pages.

    These pages explain important concepts or abstractions.
    """
    return f"""You are writing a **{context.page_title}** concept explanation page.

## Page Description

{context.page_description}

## Context

{context.get_formatted_context()}

## Your Task

Write a conceptual explanation page in Markdown:

1. **What Is It?** (1-2 paragraphs)
   - Define the concept
   - Why does it matter in this codebase?

2. **How It Works** (detailed explanation)
   - Explain the concept using the classes/functions from the context
   - Show how different pieces fit together
   - Explain the flow or lifecycle

3. **Key Classes/Functions**
   - Which classes/functions implement this concept?
   - What role does each play?

4. **Examples** (if applicable)
   - Concrete examples showing the concept in action
   - Common usage patterns

## Guidelines

- Use `#` for the page title, `##` for major sections, `###` for subsections
- Explain concepts clearly for someone new to this codebase
- Reference actual symbols from the context
- Keep to 800-1200 words
- Balance theory with practical examples

Generate the complete Markdown page now."""


def get_prompt_for_page(
    context: PageContext, wiki_pages_summary: str = ""
) -> tuple[str, str]:
    """
    Get the appropriate (system, user) prompt pair for a page.

    Args:
        context: PageContext with page kind and metadata
        wiki_pages_summary: Optional wiki structure summary (for overview pages)

    Returns:
        Tuple of (system_prompt, user_prompt)
    """
    if context.page_kind == "overview":
        user_prompt = build_overview_prompt(context, wiki_pages_summary)
    elif context.page_kind == "module":
        user_prompt = build_module_prompt(context)
    elif context.page_kind == "guide":
        user_prompt = build_guide_prompt(context)
    elif context.page_kind == "reference":
        user_prompt = build_reference_prompt(context)
    elif context.page_kind == "architecture":
        user_prompt = build_architecture_prompt(context)
    elif context.page_kind == "concept":
        user_prompt = build_concept_prompt(context)
    else:
        # Fallback to module prompt
        user_prompt = build_module_prompt(context)

    return SYSTEM_PROMPT, user_prompt
