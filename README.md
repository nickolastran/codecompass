# CodeCompass

Interactive documentation with RAG-enabled chat over your codebase.

- `web/` — Next.js frontend + API routes
- `backend/` — FastAPI GraphRAG indexing/retrieval service

The frontend calls the backend over HTTP via `BACKEND_URL` (`/chat/stream`, `/repos/index`).
Backend CORS allows `http://localhost:3000`.

## Setup

```bash
# frontend
cd web && npm install            # then create web/.env.local

# backend
cd backend && python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt  # then create backend/.env
```

The full setup (Supabase, models, env variables, Git providers) is in the
[self-hosting guide](web/src/app/docs/self-hosting/SELF_HOSTING.md), also served at `/docs/self-hosting`.

## Run

```bash
./dev.sh          # both: web on :3000, backend on :8000
```

Or separately:

```bash
cd web && npm run dev
cd backend && . .venv/bin/activate && python3 main.py
```

Per-project details: [`web/README.md`](web/README.md), [`backend/README.md`](backend/README.md).
