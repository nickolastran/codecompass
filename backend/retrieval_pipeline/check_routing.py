"""Routing self-check against the live Ollama agent model: .venv/bin/python -m retrieval_pipeline.check_routing"""
from retrieval_pipeline.rag_agent import RAG_Agent

CASES = {
    "How often does the contributions data refresh?": "code_rag",
    "Where does the GitHub contributions component get its data from?": "code_rag",
    "Does the GitHub contributions graph need an API key?": "code_rag",
    "What happens if the contributions fail to load?": "code_rag",
    "What does the sudoku store do?": "code_rag",
    "What does the README say about how to run the project?": "docs_rag",
    "Can you summarize what you just told me?": "conversation_history",
}

if __name__ == "__main__":
    agent = RAG_Agent("check", "check")
    fails = 0
    for q, want in CASES.items():
        got = agent.select_tool(q)
        ok = got == want
        fails += not ok
        print(f"{'ok  ' if ok else 'FAIL'} {got:<20} {q}")
    raise SystemExit(fails)
