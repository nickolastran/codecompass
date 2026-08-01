
# API

## Structure
CodeCompass Backend has 4 Main FastAPI Endpoints, contained in the following router files:

1. `routes_chat.py` -- contains `/chat/stream` and `/chat/context-snippets??`
2. `routes_documentation.py` -- contains ` ` 
3. `routes_indexing.py` -- contains ` `

Router files define endpoints, but do no create the FastAPI app.

## Purpose
- Keep endpoint definitions modular.
- Prevent `main.py` from becoming too large.
