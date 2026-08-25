# Wendu（问牍）

**English** | [中文](README.zh.md)

Upload your documents, ask questions grounded in those files, and get answers with citations. Current release: **open-source self-hosted Web** — local Embedding built in; configure **Chat** in Admin.

## Capability bounds (read first)

- Each question retrieves at most about **8** chunks into the chat model. We **do not** promise a full summary of every uploaded file or an entire long document in one answer.
- Capability / “what is this about” questions get a **short** reply and must state that the summary is based only on retrieved passages.
- If evidence is missing, the app refuses — it will not invent facts from world knowledge.
- Embedding is **not** configured in Admin; you only set **Chat** (API key, base URL, chat model).

Details (Chinese spec): [`docs/spec/02-产品设计.md`](docs/spec/02-产品设计.md). English overview: [`docs/README.md`](docs/README.md).

## Production security

- Default admin is `admin` / `admin` — **change the password immediately** and rotate `SESSION_SECRET`.
- Never commit `.env`, API keys, or real passwords (`.gitignore` already ignores `apps/api/.env`).
- Behind HTTPS, set `COOKIE_SECURE=true`.

## Repository map

```text
apps/api/app/              FastAPI: upload, retrieve, ask, admin
  embed.py / ingest.py / rag.py / llm.py
apps/api/models/           Local embedding weights (gitignored; download via script)
apps/web/src/              Vue workspace + admin UI
docs/spec/                 Product & tech specs (Chinese source of truth)
docs/implementation/       End-to-end pipeline notes (Chinese)
docs/README.md             English docs hub
scripts/                   Local start/stop helpers
apps/web/scripts/          e2e smoke + answer-quality suites
```

Change product behavior → `docs/spec/` (and mirror intent in English docs when you touch user-facing promises).  
How the pipeline works → `docs/implementation/` (ZH) + module headers in code (EN).  
Contributing → [CONTRIBUTING.md](CONTRIBUTING.md) · [中文](CONTRIBUTING.zh.md).

## Quick start (local)

### 1. Dependencies

- PostgreSQL 16 + [pgvector](https://github.com/pgvector/pgvector)
- Python 3.12+
- Node.js 20+

### 2. Database

```bash
createdb wendu
# Ensure pgvector is available (API runs CREATE EXTENSION on startup)
```

### 3. API

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Required: download embedding weights into models/ (~500MB, gitignored)
python scripts/fetch-embedding-model.py
python start.py
```

Weights live under `apps/api/models/multilingual-e5-small/`. After a fresh clone, run `fetch-embedding-model.py` again. Override with `TEXT_EMBEDDING_LOCAL_PATH` if needed.

### 4. Web

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:5173

### 5. First use

1. Default admin: `admin` / `admin` (`ADMIN_USER` / `ADMIN_PASSWORD` in `apps/api/.env`)
2. **Admin → Model**: fill Chat **API Key**, **Base URL**, **chat model**
3. Upload PDF / Word / Markdown / etc., wait until **Ready**, then ask

## Docker Compose

```bash
cp apps/api/.env.example apps/api/.env
# Edit .env: SESSION_SECRET, ADMIN_PASSWORD
docker compose up --build
```

Open http://localhost (web proxies API). The API image build downloads the embedding model.

## Architecture

| Piece | Notes |
|-------|--------|
| Embedding | Built-in `multilingual-e5-small` (384-d, E5 query/passage prefixes), local |
| Chat | OpenAI-compatible API, configured in Admin |
| Retrieve | pgvector + Postgres FTS, default top-8 |
| Storage | Original files on local disk; metadata/chunks in Postgres |

**Migrating from cloud Embedding (1024-d):** delete uploaded files and re-upload, or clear `chunks` and re-ingest.

## Tests

```bash
cd apps/web && npm run e2e          # UI smoke (Vite + API + Postgres)
cd apps/web && npm run e2e:quality  # Answer quality (API + Chat configured)
```

Optional env: `WENDU_ADMIN_USER` / `WENDU_ADMIN_PASSWORD`.

## Specs & docs

- English hub: [`docs/README.md`](docs/README.md)
- Chinese specs: [`docs/spec/00-索引.md`](docs/spec/00-索引.md) (desktop package is **future**, not implemented)

## API env vars

| Variable | Default | Notes |
|----------|---------|--------|
| `DATABASE_URL` | see `.env.example` | Postgres |
| `SESSION_SECRET` | — | Cookie signing; change in production |
| `COOKIE_SECURE` | false | `true` behind HTTPS |
| `ADMIN_USER` / `ADMIN_PASSWORD` | admin / admin | Seed admin |
| `TEXT_EMBEDDING_LOCAL_PATH` | `apps/api/models/multilingual-e5-small` | Override model dir |
| `VECTOR_MIN_SCORE` / `VECTOR_STRONG_SCORE` | 0.28 / 0.38 | Retrieve gates |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` / `RETRIEVE_K` | 500 / 80 / 8 | Chunking & top-K |
| `FILES_DIR` | data/files | Original files |

## License

Code is released under the [MIT License](LICENSE).

Downloaded embedding weights (e.g. `multilingual-e5-small`) remain under their upstream licenses; see the model card on Hugging Face.
