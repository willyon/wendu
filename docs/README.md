# Docs · Wendu

**English** | [中文](README.zh.md)

## Language policy

| Audience | Language |
|----------|----------|
| GitHub landing & contributing | [README.md](../README.md) · [CONTRIBUTING.md](../CONTRIBUTING.md) (English primary) |
| Chinese readers | [README.zh.md](../README.zh.md) · [CONTRIBUTING.zh.md](../CONTRIBUTING.zh.md) |
| **Product / tech specs (source of truth)** | Chinese under [`spec/`](spec/00-索引.md) |
| Pipeline deep-dive | Chinese [`implementation/底层实现逻辑.md`](implementation/底层实现逻辑.md) |
| Code module headers | **English** |

Full English translations of every spec file are **not** required for every change. When you change a **user-visible promise**, update this English hub (and Chinese spec) in the same PR. Deeper EN ports of individual specs can land later as `spec/*.en.md` if needed.

## Product snapshot

- **Self-hosted Web only** (current). Desktop install is specified as future, not implemented.
- **Local Embedding** (`multilingual-e5-small`, 384-d). Users do not configure Embedding in Admin.
- **Chat** via OpenAI-compatible API: Admin requires API key, base URL, chat model.
- **RAG:** each ask retrieves up to ~**8** chunks (pgvector + FTS). No promise of whole-corpus or full-document summary in one answer.
- Capability / summary questions only adjust the **prompt** (shorter + disclaimer); retrieve path stays the same.
- Missing evidence → refuse (`no_evidence`), no world-knowledge fill-in.
- Answers must cite passages; UI shows sources after the stream completes.

## Where code lives

| Concern | Code |
|---------|------|
| Embed | `apps/api/app/embed.py` |
| Ingest / chunk | `apps/api/app/ingest.py` |
| Retrieve + ask SSE | `apps/api/app/rag.py` |
| Chat / prompts | `apps/api/app/llm.py` |
| Files HTTP | `apps/api/app/routers_files.py` |
| Ask HTTP | `apps/api/app/routers_ask.py` |
| Admin HTTP | `apps/api/app/routers_admin.py` |
| Schema | `apps/api/app/models.py` |
| Ask UI state | `apps/web/src/composables/useAskSession.js` |
| Workspace | `apps/web/src/views/Workspace.vue` |

## Spec index (Chinese filenames)

| File | Topic |
|------|--------|
| [`spec/00-索引.md`](spec/00-索引.md) | Index |
| [`spec/01-PRD.md`](spec/01-PRD.md) | PRD |
| [`spec/02-产品设计.md`](spec/02-产品设计.md) | Product design & Q&A bounds |
| [`spec/03-UI交互.md`](spec/03-UI交互.md) | UI |
| [`spec/04-技术设计.md`](spec/04-技术设计.md) | Technical design |
| [`spec/CHANGELOG.md`](spec/CHANGELOG.md) | Spec changelog |

## Tests

See root README: `npm run e2e` · `npm run e2e:quality` under `apps/web`.
