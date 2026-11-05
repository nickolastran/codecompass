import re


AGENT_SYS_PROMPT = """
You are a routing agent. Your job is to analyze the user’s query and choose the single best retrieval mode from the following options:

- "code_rag"             → DEFAULT. Use for any question about how the project works: what a component, file, function, route or feature does, where data comes from, how often something updates, configuration, errors, or behaviour.
- "docs_rag"             → ONLY when the user explicitly asks about the README or written documentation (e.g. "what does the README say", "what are the setup instructions").
- "conversation_history" → Use when the answer depends only on previous messages in the conversation rather than external data.

Rules:
1. Return only ONE option.
2. Do NOT return anything else besides the option name.
3. If unsure, choose "code_rag".
4. If the query is about code but not specific to the repository, still pick "code_rag".

Your output should ONLY be exactly one of:
"docs_rag"
"code_rag"
"conversation_history"

Now read the user's query and output the correct routing option.

USER QUERY:
"""


CHAT_SYS_PROMPT = """
You answer questions about a codebase using the provided context. Answer in prose.
"""

# Added only for structure/flow questions: small chat models can't judge when a diagram fits
DIAGRAM_PROMPT = """
End your answer with exactly ONE Mermaid diagram of the files involved, in this format:
```mermaid
graph TD
N1["FIRST_FILE"] --> N2["SECOND_FILE"]
```
- FIRST_FILE and SECOND_FILE are placeholders. Replace them with real paths from the context. Never write a path that is not in the context.
- Each file appears once: give it one node id (N1, N2, ...) and reuse that id for every edge.
- At most 10 nodes. One edge per line. Put every label in double quotes.
"""

# ponytail: keyword heuristic; route through the agent's tool choice if it misses too often
WANTS_DIAGRAM = re.compile(
    r"diagram|architect|structure|connect|relat|flow|depend|interact|overview|\bfrom\b.+\bto\b",
    re.IGNORECASE,
)


def chat_system_prompt(query: str) -> str:
    return CHAT_SYS_PROMPT + (DIAGRAM_PROMPT if WANTS_DIAGRAM.search(query) else "")


if __name__ == "__main__":
    for q in [
        "How do the pieces of the chat feature connect to each other?",
        "Draw the architecture of the chat backend",
        "How does a chat message get from the UI to the LLM?",
        "Show me a diagram of the indexing pipeline",
    ]:
        assert DIAGRAM_PROMPT in chat_system_prompt(q), q
    for q in ["What does select_tool return?", "Why does login fail?", "What is in config.py?"]:
        assert DIAGRAM_PROMPT not in chat_system_prompt(q), q
    print("chat prompt checks ok")
