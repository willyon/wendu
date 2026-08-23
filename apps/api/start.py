#!/usr/bin/env python3
"""本地启动问牍 API：python3 start.py（等同 uvicorn --reload）"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV_PYTHON = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
PORT = os.environ.get("PORT", "8000")


def main() -> None:
    os.chdir(ROOT)
    python = str(VENV_PYTHON if VENV_PYTHON.exists() else Path(sys.executable))
    if not VENV_PYTHON.exists():
        print("[WARN] 未找到 .venv，改用当前 python。建议先: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt")

    cmd = [
        python,
        "-m",
        "uvicorn",
        "app.main:app",
        "--reload",
        "--host",
        "127.0.0.1",
        "--port",
        PORT,
    ]
    print(" ".join(cmd))
    raise SystemExit(subprocess.call(cmd))


if __name__ == "__main__":
    main()
