# Self-Hosting CodeCompass

This guide covers deploying CodeCompass on your own infrastructure. Self-hosting is ideal for enterprises with data sensitivity requirements or teams who want complete control over their deployment.

## Overview

CodeCompass consists of four main components:

- **Frontend**: Next.js application
- **Backend**: FastAPI server
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **LLM**: Ollama for local model inference

All components run within your infrastructure, ensuring code never leaves your network.

---

## Prerequisites

### Hardware Requirements

**Minimum**:

- 16GB RAM (8GB for Ollama, 8GB for other services)
- 4 CPU cores
- 50GB disk space (models + vector storage)

**Recommended**:

- 32GB+ RAM
- 8+ CPU cores
- 100GB+ SSD storage
- NVIDIA GPU for faster inference (optional)

### Software Requirements

- Docker & Docker Compose
- Git
- (Optional) NVIDIA Container Toolkit for GPU support

---

## Quick Start

```bash
# 1. Clone repository
git clone https://github.com/your-org/codecompass.git
cd codecompass

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env with your configuration
nano .env

# 4. Start all services
docker-compose up -d

# 5. Initialize database
docker-compose exec backend python scripts/init_db.py

# 6. Pull Ollama model (8GB download)
docker-compose exec ollama ollama pull deepseek-r1

# 7. Access CodeCompass
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# Supabase Studio: http://localhost:54323
```

---

## Configuration

### Environment Variables

Edit `.env` with your settings:

```bash
=== GitHub Integration ===
Create a GitHub App at https://github.com/settings/apps
GITHUB_APP_ID=your_app_id
GITHUB_APP_CLIENT_ID=your_client_id
GITHUB_APP_CLIENT_SECRET=your_client_secret
GITHUB_APP_PRIVATE_KEY_PATH=/app/github-app-key.pem
GITHUB_WEBHOOK_SECRET=your_webhook_secret

=== Database (Supabase) ===
DATABASE_URL=postgresql://postgres:postgres@supabase-db:5432/postgres
SUPABASE_URL=http://supabase:8000
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

=== Ollama ===
OLLAMA_HOST=http://ollama:11434
OLLAMA_MODEL=deepseek-r1  or llama3.2, codellama, etc.

=== Backend ===
API_BASE_URL=http://localhost:8000
SECRET_KEY=generate_random_secret_here

=== Frontend ===
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### GitHub App Setup

CodeCompass requires a GitHub App to clone repositories:

1. Go to **Settings → Developer Settings → GitHub Apps → New GitHub App**
2. Configure:
   - **Name**: `CodeCompass (Self-Hosted)`
   - **Homepage URL**: `http://your-domain.com` (or `http://localhost:3000` for testing)
   - **Callback URL**: `http://your-domain.com/api/auth/callback/github`
   - **Webhook URL**: `http://your-domain.com/api/webhooks/github` (optional)
   - **Permissions**:
     - Repository permissions: Contents (Read-only), Metadata (Read-only)
   - **Where can this GitHub App be installed?**: Any account

3. Generate a private key and save as `github-app-key.pem`
4. Copy App ID, Client ID, and Client Secret to `.env`

### Sign-in Providers (GitHub / GitLab Login)

The "Continue with GitHub" and "Continue with GitLab" buttons go through **Supabase
Auth**, not the GitHub App above — they are separate credentials. If a provider is
not enabled in Supabase you get:

```json
{
  "code": 400,
  "error_code": "validation_failed",
  "msg": "Unsupported provider: provider is not enabled"
}
```

To enable GitHub login:

1. Create an **OAuth App** (not a GitHub App) at
   **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `https://<your-project-ref>.supabase.co/auth/v1/callback`
     (self-hosted Supabase: `http://localhost:54321/auth/v1/callback`)
2. In the Supabase dashboard, go to **Authentication → Providers → GitHub**, toggle it
   on, and paste the OAuth App's Client ID and Client Secret. Save.
3. Under **Authentication → URL Configuration**, set **Site URL** to
   `http://localhost:3000` and add `http://localhost:3000/api/auth/callback` to
   **Redirect URLs**. This must match `NEXT_PUBLIC_APP_URL` in `web/.env.local`.

GitLab is the same flow: create an application at **GitLab → Preferences →
Applications** with scopes `read_user` + `openid`, redirect URI pointing at the same
Supabase `/auth/v1/callback`, then enable the GitLab provider in Supabase.

These credentials live in Supabase only — no `.env` entry in this repo.

### Supabase Configuration

The Docker Compose setup includes a self-hosted Supabase instance. On first run:

1. Access Supabase Studio at `http://localhost:54323`
2. Default credentials:
   - Email: `admin@codecompass.local`
   - Password: `password` (change this in `.env`)
3. Run database migrations:
   ```bash
   docker-compose exec backend python scripts/migrate.py
   ```

---

## Docker Compose Architecture

The `docker-compose.yml` orchestrates all services:

```yaml
version: "3.8"

services:
  # Next.js Frontend
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
    depends_on:
      - backend

  # FastAPI Backend
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./chroma_db:/app/chroma_db # Vector store persistence
      - ./cloned_repos:/app/cloned_repos # Temporary repo storage
      - ./github-app-key.pem:/app/github-app-key.pem:ro
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - OLLAMA_HOST=${OLLAMA_HOST}
      - GITHUB_APP_ID=${GITHUB_APP_ID}
      - GITHUB_APP_PRIVATE_KEY_PATH=/app/github-app-key.pem
    depends_on:
      - supabase-db
      - ollama

  # Ollama LLM Server
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_models:/root/.ollama # Persist models between restarts
    # Uncomment for GPU support:
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]

  # PostgreSQL (via Supabase)
  supabase-db:
    image: supabase/postgres:15.1.0.117
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Supabase Studio (Admin UI)
  supabase-studio:
    image: supabase/studio:latest
    ports:
      - "54323:3000"
    environment:
      SUPABASE_URL: http://supabase-kong:8000
      STUDIO_PG_META_URL: http://supabase-db:5432
    depends_on:
      - supabase-db

  # Supabase Kong (API Gateway)
  supabase-kong:
    image: kong:2.8-alpine
    ports:
      - "54321:8000"
      - "54322:8443"
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
    volumes:
      - ./supabase/kong.yml:/var/lib/kong/kong.yml
    depends_on:
      - supabase-db

volumes:
  postgres_data:
  ollama_models:
```

---

## Usage

### Starting Services

```bash
Start all services in background
docker-compose up -d

View logs
docker-compose logs -f

View specific service logs
docker-compose logs -f backend
```

### Stopping Services

```bash
Stop all services
docker-compose down

Stop and remove all data (destructive)
docker-compose down -v
```

### Updating

```bash
Pull latest code
git pull origin main

Rebuild containers
docker-compose build

Restart services
docker-compose up -d
```

---

## Model Management

### Available Models

CodeCompass supports any Ollama-compatible model. Recommended options:

| Model              | Size | RAM Required | Speed  | Quality |
| ------------------ | ---- | ------------ | ------ | ------- |
| deepseek-r1:7b     | 7B   | 8GB          | Fast   | Good    |
| llama3.2:7b        | 7B   | 8GB          | Fast   | Good    |
| codellama:13b      | 13B  | 16GB         | Medium | Better  |
| deepseek-coder:33b | 33B  | 32GB         | Slow   | Best    |

### Changing Models

```bash
Pull new model
docker-compose exec ollama ollama pull llama3.2

Update .env
OLLAMA_MODEL=llama3.2

Restart backend
docker-compose restart backend
```

### Managing Disk Space

Models are stored in the `ollama_models` volume. To clean up:

```bash
List downloaded models
docker-compose exec ollama ollama list

Remove unused model
docker-compose exec ollama ollama rm old-model-name
```

---

## Indexing a Repository

Once deployed:

1. Navigate to `http://localhost:3000`
2. Sign in with GitHub
3. Install the CodeCompass GitHub App on your repos
4. Select a repository to index
5. Click "Index Repository"
6. Monitor progress in the dashboard

**Indexing Time**:

- Small repo (<100 files): 2-5 minutes
- Medium repo (100-500 files): 10-20 minutes
- Large repo (500+ files): 30-60 minutes

Times assume CPU-only inference. GPU reduces time by 50-70%.

---

## Troubleshooting

### Ollama Model Not Found

**Error**: `Model 'deepseek-r1' not found`

**Solution**:

```bash
docker-compose exec ollama ollama pull deepseek-r1
```

### Out of Memory

**Error**: Container crashes or system becomes unresponsive

**Solution**:

- Use a smaller model (7B instead of 13B)
- Increase Docker memory limit in Docker Desktop settings
- Add swap space to host system

### GitHub App Authentication Failed

**Error**: `Invalid GitHub App credentials`

**Solution**:

1. Verify `GITHUB_APP_ID` matches your GitHub App
2. Ensure `github-app-key.pem` is mounted correctly
3. Check GitHub App permissions include "Contents" and "Metadata"
4. Verify callback URL matches your deployment URL

### Database Connection Failed

**Error**: `Could not connect to PostgreSQL`

**Solution**:

```bash
Check if Supabase DB is running
docker-compose ps supabase-db

View database logs
docker-compose logs supabase-db

Restart database
docker-compose restart supabase-db
```

### ChromaDB Persistence Issues

**Error**: Vector store resets after restart

**Solution**:
Ensure `chroma_db` volume is mounted in `docker-compose.yml`:

```yaml
volumes:
  - ./chroma_db:/app/chroma_db
```

---

## Performance Tuning

### Using GPU Acceleration

If you have an NVIDIA GPU:

1. Install NVIDIA Container Toolkit:

   ```bash
   Ubuntu/Debian
   distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
   curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
   curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
   sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
   sudo systemctl restart docker
   ```

2. Uncomment GPU section in `docker-compose.yml`:

   ```yaml
   ollama:
     deploy:
       resources:
         reservations:
           devices:
             - driver: nvidia
               count: 1
               capabilities: [gpu]
   ```

3. Restart: `docker-compose up -d`

**Expected speedup**: 3-5x faster inference

### Concurrent Indexing

By default, the backend processes one repo at a time. To index multiple repos concurrently:

In `.env`:

```bash
MAX_CONCURRENT_INDEXING_JOBS=3
```

Increases memory usage proportionally.

### Reducing Indexing Time

To skip AI summarization (faster but lower quality):

In `.env`:

```bash
SKIP_AI_SUMMARIES=true
```

This indexes code into ChromaDB without generating natural language summaries. Chat will still work using raw code chunks.

---

## Security Considerations

### Network Isolation

For production deployments:

1. **Use a reverse proxy** (nginx/Caddy) with SSL/TLS
2. **Restrict external access** to only the frontend
3. **Use internal Docker networks** for service communication

Example `docker-compose.yml` addition:

```yaml
networks:
  public:
  internal:

services:
  frontend:
    networks:
      - public
      - internal
  backend:
    networks:
      - internal
  # Only frontend exposed to public network
```

### Secrets Management

**Don't commit** `.env` or `github-app-key.pem` to version control.

For production:

- Use Docker secrets or Kubernetes secrets
- Rotate keys regularly
- Use separate GitHub Apps for dev/staging/prod

### Database Backups

```bash
Backup Supabase database
docker-compose exec supabase-db pg_dump -U postgres > backup.sql

Backup ChromaDB vectors
tar -czf chroma_backup.tar.gz ./chroma_db/
```

Schedule regular backups via cron or your cloud provider's backup solution.

---

## Resource Limits

To prevent resource exhaustion:

```yaml
# In docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: "4"
          memory: 8G

  ollama:
    deploy:
      resources:
        limits:
          cpus: "4"
          memory: 16G
```

---

## Monitoring

### Health Checks

```bash
Check service health
curl http://localhost:8000/health

Response: {"status": "healthy", "ollama": "connected", "database": "connected"}
```

### Logs

```bash
Real-time logs
docker-compose logs -f

Last 100 lines
docker-compose logs --tail=100

Specific service
docker-compose logs backend --tail=50
```

### Metrics (Optional)

For production, consider adding:

- Prometheus for metrics collection
- Grafana for visualization
- Node exporter for system metrics

---

## Support

For issues or questions:

- **GitHub Issues**: https://github.com/your-org/codecompass/issues
- **Documentation**: https://docs.codecompass.dev
- **Enterprise Support**: enterprise@codecompass.dev

---

## License

CodeCompass is open-source under the MIT License. Self-hosting is free for all use cases.
