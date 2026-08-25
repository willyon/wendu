# Contributing to Wendu

Thanks for your interest. The current goal is a **good self-hosted open-source Web** app. Desktop-install features described in the specs are **out of scope** for PRs unless an Issue explicitly asks for them.

**English** | [中文](CONTRIBUTING.zh.md)

## Dev setup

Follow the root [README.md](README.md) (Postgres, API, Web, download the local embedding model).

```bash
cd apps/web && npm run e2e          # UI smoke (needs Vite + API)
cd apps/web && npm run e2e:quality  # Answer quality (needs API + Chat configured)
```

## Where to read before coding

1. English overview: [docs/README.md](docs/README.md)  
2. Pipeline detail (Chinese): [docs/implementation/底层实现逻辑.md](docs/implementation/底层实现逻辑.md)  
3. File headers in code (English): module purpose / entry points  

| You want to change… | Read first | Then open |
|---------------------|------------|-----------|
| Upload / chunk / ingest | implementation §3–4 | `ingest.py` · `routers_files.py` |
| Retrieve / evidence / citations | §5 | `rag.py` |
| Answer style / Prompt / Chat | §6 | `llm.py` |
| Local embedding | §4.3 · §8 | `embed.py` · `config.py` |
| Admin Chat settings | — | `routers_admin.py` · `Admin.vue` |
| Frontend ask + streaming UI | §5.1 · §7 | `useAskSession.js` · `AskPanel.vue` |
| Frontend upload UI | §3.1 | `FileSidebar.vue` · `Workspace.vue` |
| DB schema | §2 | `models.py` |

Do **not** expect line-by-line comments — non-obvious rules live in file headers or specs.

## Specs vs code

| Change type | Process |
|-------------|---------|
| User-visible behavior, rules, API/tables, product promises | Update Chinese `docs/spec/` first, then code; add a line to `docs/spec/CHANGELOG.md`. If the change is user-facing for overseas readers, update [docs/README.md](docs/README.md) (English hub) in the same PR. |
| Internal refactor / bugfix with no product promise change | Code only |

Chinese spec index: [docs/spec/00-索引.md](docs/spec/00-索引.md).

## Before opening a PR

1. No `.env`, API keys, or real passwords in the commit  
2. Path works locally (manual click-through or e2e above)  
3. PR description states **why**, and any breaking change (e.g. re-upload required)

## Product bounds (do not “promise” in a PR)

- About **8** passages per question — not a full multi-file / full-document summary  
- Embedding is **local built-in**; Admin only configures Chat  
- Answers need citations; missing evidence → refuse, do not invent  

## Communication

GitHub Issues in **English or Chinese** are fine.
