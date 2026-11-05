# Self-Hosting CodeCompass

Run CodeCompass on your own machine or server. With the fully local model setup below, your code and questions never leave your infrastructure.

There is no Docker setup: you run the web app and the backend as two processes, next to Ollama and a Supabase project.

---

## What You'll Run

| Piece | What it does | Default address |
| --- | --- | --- |
| **Web** (`web/`, Next.js) | UI, sign-in, repo management. Talks to the backend server-side. | `http://localhost:3000` |
| **Backend** (`backend/`, FastAPI) | Clones/unzips repos, indexes them, generates docs, answers chat. | `http://localhost:8000` |
| **Supabase** | Postgres (users, orgs, repos, docs, chats), auth, and storage for uploaded zips. | Hosted project or local CLI |
| **Ollama** | Runs the chat model locally (and optionally the indexing model). | `http://localhost:11434` |

Data the backend keeps on disk, inside `backend/`:

- `code_chroma_db/`, `document_chroma_db/`: vector indexes used by chat.
- `kg_store/`: the code knowledge graph per repo, used by chat.
- `cloned_repos/`: scratch copies made while indexing. Chat doesn't read them; safe to delete (re-indexing recreates them).

Back up those first three folders plus your Supabase database.

---

## Requirements

- **OS**: Linux, macOS, or Windows via WSL2.
- **Node.js** 20+ and **Python** 3.12.
- **Git**.
- **Ollama**: [ollama.com/download](https://ollama.com/download).
- **Language servers** (used to link calls and imports while indexing):
  - Python repos: `npm install -g pyright`
  - TypeScript/JavaScript repos: `npm install -g typescript-language-server typescript`
  - C/C++ repos only: `clangd` (from LLVM or your package manager)
- **Hardware**: a GPU is optional. CodeCompass has been run on a 12-core, 16 GB RAM machine with no NVIDIA GPU. On CPU, local code embeddings take about 0.7 s per function, so indexing a few hundred files takes a while.

---

## 1. Clone and Install

```bash
git clone <your fork or this repo's URL> codecompass
cd codecompass

# Web
cd web && npm install && cd ..

# Backend
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

`requirements.txt` pins CUDA builds of PyTorch (about 3 GB of `nvidia-*` packages). They also run on CPU. On a machine without an NVIDIA GPU you can skip them:

```bash
grep -vE '^(nvidia-|triton)' requirements.txt > /tmp/requirements-cpu.txt
pip install torch==2.9.1 --index-url https://download.pytorch.org/whl/cpu
pip install -r /tmp/requirements-cpu.txt
```

This also installs Mercurial (`hg`), used for Mercurial repos.

---

## 2. Supabase

### Option A: hosted project (simplest)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run each file in `supabase/migrations/`, **in filename order**. They create the tables, row-level security policies, the user sync trigger, and the private `local_repos` storage bucket.
   (Or with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.)
3. From **Project Settings → API Keys**, copy the **publishable** key and the **secret** key. The project URL is `https://<ref>.supabase.co`.

### Option B: local, with the Supabase CLI

```bash
# From the repo root (needs Docker, used by the Supabase CLI itself)
supabase init      # creates supabase/config.toml, keeps the existing migrations
supabase start     # starts Supabase and applies supabase/migrations/
supabase status    # prints the API URL and keys
```

### Auth settings (both options)

Under **Authentication → URL Configuration** (local: `[auth]` in `supabase/config.toml`):

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: add `http://localhost:3000/api/auth/callback`

Use your real domain instead of `localhost:3000` when deploying. It must match `NEXT_PUBLIC_APP_URL`.

Email sign-in (magic link) works out of the box using Supabase's built-in mailer, which is rate-limited. Set up custom SMTP in Supabase for real use.

---

## 3. Models

### Chat (Ollama)

Chat always runs on Ollama. Pull a model and name it in `backend/.env`:

```bash
ollama pull qwen2.5:3b
```

`OLLAMA_AGENT_MODEL` picks where to look for an answer (code vs. README); `OLLAMA_CHAT_MODEL` writes the answer. They can be the same model. Larger models give better answers and diagrams if your hardware allows.

On startup the backend checks that Ollama is installed and starts `ollama serve` if it isn't running. It does **not** pull models for you.

### Indexing / docs generation (`LLM_*`)

Indexing makes many LLM calls (a ~250-file repo needs around 1,200) to summarize code and write the docs. It uses any OpenAI-compatible API. Pick one:

**Fully local (Ollama).** Nothing leaves your machine. Slow on CPU.

```env
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama            # any non-empty value
LLM_MODEL=qwen2.5:3b
```

**Gemini free tier.** Fast and free, but limited to about 500 requests per day **per model**, and Google may use free-tier inputs for training: don't use it for private code.

```env
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_API_KEY=<key from aistudio.google.com>
LLM_MODEL=gemini-3.1-flash-lite,gemini-3.6-flash   # falls back to the next one when a model's daily quota runs out
LLM_REASONING_EFFORT=none     # stops "thinking" from using up the token budget
LLM_RPM=14                    # spaces calls to stay under the per-minute limit
```

**OpenAI (or another OpenAI-compatible provider).**

```env
LLM_BASE_URL=                 # empty = api.openai.com
LLM_API_KEY=<key>
LLM_MODEL=gpt-4o-mini
```

### Embeddings

Downloaded from Hugging Face on first use and run locally:

```env
DOCUMENT_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5    # required
CODE_EMBEDDING_MODEL=Qwen/Qwen3-Embedding-0.6B     # leave unset to use Voyage AI instead (needs VOYAGE_API_KEY)
```

---

## 4. Environment Files

### `backend/.env`

```env
# Supabase (backend uses the secret key: it reads uploaded zips and writes results)
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_KEY=<secret key>

# Chat (Ollama)
OLLAMA_AGENT_MODEL=qwen2.5:3b
OLLAMA_CHAT_MODEL=qwen2.5:3b

# Indexing LLM: see section 3
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
LLM_REASONING_EFFORT=
LLM_RPM=

# Embeddings
DOCUMENT_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
CODE_EMBEDDING_MODEL=Qwen/Qwen3-Embedding-0.6B
VOYAGE_API_KEY=                 # only if CODE_EMBEDDING_MODEL is unset

# GitHub App: section 5 (only for GitHub repos)
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY_PATH=/absolute/path/to/github-app.pem
```

### `web/.env.local`

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SECRET_KEY=<secret key>

# GitHub App: section 5 (only for GitHub repos)
NEXT_PUBLIC_GITHUB_APP_CLIENT_ID=   # the numeric App ID, despite the name
GITHUB_APP_CLIENT_ID=               # the app's Client ID
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_PRIVATE_KEY_PATH=/absolute/path/to/github-app.pem   # or GITHUB_APP_PRIVATE_KEY with \n line breaks
GITHUB_APP_SLUG=                    # the name in github.com/apps/<slug>

# GitLab: section 5 (only for GitLab repos)
NEXT_PUBLIC_GITLAB_APP_CLIENT_ID=
GITLAB_APP_SECRET=

# Bitbucket: section 5 (only for Bitbucket repos)
BITBUCKET_APP_CLIENT_ID=
BITBUCKET_APP_SECRET=
```

---

## 5. Repository Sources

Set up only the ones you need.

### GitHub (public and private repos)

CodeCompass clones GitHub repos through a **GitHub App** you own.

1. Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Fill in:
   - **Homepage URL**: `http://localhost:3000`
   - **Setup URL**: `http://localhost:3000/api/github/installation`, and tick **Redirect on update**
   - **Webhook**: untick **Active** (CodeCompass doesn't use webhooks)
   - **Repository permissions**: Contents → Read-only, Metadata → Read-only
3. Create it, then **Generate a private key** and save the `.pem` file.
4. Fill in the GitHub variables in both env files: App ID, Client ID, a new client secret, the `.pem` path, and the slug from the app's public URL.

Users connect GitHub the first time they add a GitHub repo, and choose which repos the app can read.

### GitLab (gitlab.com)

1. **GitLab → Preferences → Applications → Add new application**.
2. **Redirect URI**: `http://localhost:3000/api/gitlab/installation`. **Scopes**: `read_api`, `read_repository`.
3. Put the Application ID in `NEXT_PUBLIC_GITLAB_APP_CLIENT_ID` and the secret in `GITLAB_APP_SECRET`.

Self-managed GitLab instances aren't supported yet; only gitlab.com.

### Bitbucket (bitbucket.org)

1. **Bitbucket → Workspace settings → OAuth consumers → Add consumer**.
2. **Callback URL**: `http://localhost:3000/api/bitbucket/installation`. **Permissions**: Account → Read, Repositories → Read.
3. Put the consumer's **Key** in `BITBUCKET_APP_CLIENT_ID` and its **Secret** in `BITBUCKET_APP_SECRET`.

### Mercurial

Public repos only, added by their `https://` URL (for example from Heptapod or SourceHut). Nothing to configure beyond `hg`, which `requirements.txt` installs.

### Local folders

Zip the project folder and upload it (up to 100 MB, and 1 GB unpacked). Zips are stored in the private `local_repos` bucket; only the backend can read them.

---

## 6. Sign-In Providers (optional)

Email sign-in works without this. The **Continue with GitHub / GitLab / Bitbucket** buttons use Supabase Auth, which needs its **own** OAuth app per provider, separate from section 5. If a provider isn't enabled you'll see `Unsupported provider: provider is not enabled`.

For each provider, create an OAuth app with the callback URL set to Supabase's, then paste its ID and secret into **Supabase → Authentication → Providers**:

- **Callback URL**: `https://<ref>.supabase.co/auth/v1/callback` (local Supabase: `http://localhost:54321/auth/v1/callback`)
- **GitHub**: an **OAuth App** (not a GitHub App) under **Settings → Developer settings → OAuth Apps**.
- **GitLab**: an application under **Preferences → Applications** with scopes `read_user` and `openid`.
- **Bitbucket**: an OAuth consumer with **Account → Read**.

These credentials live only in Supabase, not in the env files.

---

## 7. Run It

```bash
./dev.sh    # starts the web app on :3000 and the backend on :8000; Ctrl-C stops both
```

Then open `http://localhost:3000`, sign in, create an organization, add a repository, and click **Index** on its page. Watch the backend terminal for progress. If indexing fails, the error shows on the repo page.

### Deploying on a server

```bash
cd web && npm run build && npm start
cd backend && . .venv/bin/activate && uvicorn main:app --host 127.0.0.1 --port 8000
```

- **Keep the backend private.** Its endpoints have no authentication. Only the web server should be able to reach port 8000 (bind it to `127.0.0.1` or a private network), and set `BACKEND_URL` to match.
- Replace `http://localhost:3000` everywhere above (`NEXT_PUBLIC_APP_URL`, Supabase URL settings, GitHub/GitLab/Bitbucket callback URLs) with your HTTPS domain.

---

## Troubleshooting

| Error | Fix |
| --- | --- |
| `Could not reach the indexing service. Make sure the backend is running.` | Start the backend and check `BACKEND_URL` in `web/.env.local`. |
| `LLM_API_KEY is not set. Add it to backend/.env and restart the backend.` | Set `LLM_API_KEY` (any value for local Ollama). |
| `Every model in LLM_MODEL hit its daily free-tier quota.` | Wait for the reset (midnight Pacific for Gemini) or add more models to `LLM_MODEL`. A failed run starts over, so all of it counts again. |
| `pyright-langserver not found` / `typescript-language-server not found` | Install the language server from **Requirements** and restart the backend. |
| `clangd not found` | Only needed for C/C++ repos: install LLVM/clangd. |
| `Ollama error: ... Please check if the model '...' is installed.` | `ollama pull <OLLAMA_CHAT_MODEL>` (and `OLLAMA_AGENT_MODEL`). |
| `Repository data not found ... Please index the repository first.` | The repo hasn't been indexed on **this** backend (indexes live in `backend/`, not in Supabase). Index it. |
| `Unsupported provider: provider is not enabled` | Enable that provider in Supabase (section 6). |
| `Mercurial isn't installed on the server (pip install mercurial)` | Install it in the backend venv. |
| `Couldn't find that repository on GitLab/Bitbucket, or your account can't access it.` | Check the URL and that the connected account can read the repo. |
| Diagram shows as code in chat | The chat model wrote invalid Mermaid. A larger `OLLAMA_CHAT_MODEL` helps. |
