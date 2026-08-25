#!/usr/bin/env bash
# 问牍本地开发：只负责起 Postgres；前后端请各开一个终端手动跑
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ 启动 Postgres…"
docker compose up -d postgres

for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U wendu >/dev/null 2>&1; then
    echo "  Postgres ready (localhost:5432)"
    break
  fi
  sleep 1
done

if [[ ! -f apps/api/.env ]]; then
  cp apps/api/.env.example apps/api/.env
  echo "  已复制 apps/api/.env.example → .env"
fi

echo "  Postgres 就绪。Agent 请后台启动 API 与 Web，见 .cursor/skills/dev-up/SKILL.md"
