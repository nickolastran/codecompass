
# API

## Structure
The FastAPI endpoints live in two router files:

1. `routes_chat.py` -- `/chat/stream`
2. `routes_indexing.py` -- `/repos/index`

Router files define endpoints, but do no create the FastAPI app.

## Purpose
- Keep endpoint definitions modular.
- Prevent `main.py` from becoming too large.
