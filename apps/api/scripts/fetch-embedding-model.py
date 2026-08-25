#!/usr/bin/env python3
"""Download multilingual-e5-small into apps/api/models (required before first API start)."""

from __future__ import annotations

import argparse
from pathlib import Path

from sentence_transformers import SentenceTransformer

DEFAULT_TARGET = Path(__file__).resolve().parent.parent / "models" / "multilingual-e5-small"
MODEL_NAME = "intfloat/multilingual-e5-small"


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch local embedding model for 问牍")
    parser.add_argument(
        "--target",
        type=Path,
        default=DEFAULT_TARGET,
        help=f"Directory to save model files (default: {DEFAULT_TARGET})",
    )
    args = parser.parse_args()
    target = args.target.expanduser().resolve()
    target.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {MODEL_NAME} …")
    model = SentenceTransformer(MODEL_NAME)
    model.save(str(target))
    print(f"Saved to {target}")
    print("API will load from this path on startup (see apps/api/models/README.md).")


if __name__ == "__main__":
    main()
