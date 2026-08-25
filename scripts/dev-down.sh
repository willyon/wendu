#!/usr/bin/env bash
# 停止 Postgres（API / Web 在各自终端 Ctrl+C）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

docker compose stop postgres 2>/dev/null || true
echo "Postgres 已停止。API / Web 请在对应终端 Ctrl+C。"
