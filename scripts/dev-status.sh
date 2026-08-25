#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "问牍 dev 状态"
if docker compose -f "$ROOT/docker-compose.yml" ps --status running postgres 2>/dev/null | grep -q postgres; then
  echo "  Postgres  running"
else
  echo "  Postgres  stopped"
fi
curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1 && echo "  API  OK  :8000" || echo "  API  down"
curl -fsS http://localhost:5173/ >/dev/null 2>&1 && echo "  Web  OK  :5173" || echo "  Web  down"
