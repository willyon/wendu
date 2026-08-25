"""Built-in local embeddings (multilingual-e5-small, 384-dim, E5 prefixes).

Owns: load weights under models/, passage:/query: encode, startup preload.
Does not own: cloud /embeddings, admin UI fields (users never configure Embedding).
Constants: MODEL_NAME · EMBED_DIM (single source for schema + inference).
Entry points: embed_passages() · embed_query() · preload_model()
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

from .config import settings
from .errors import AppError

logger = logging.getLogger(__name__)

MODEL_NAME = "intfloat/multilingual-e5-small"
EMBED_DIM = 384
DEFAULT_MODEL_DIR = Path(__file__).resolve().parent.parent / "models" / "multilingual-e5-small"


def model_dir() -> Path:
    path = (settings.text_embedding_local_path or "").strip()
    if path:
        return Path(path).expanduser().resolve()
    return DEFAULT_MODEL_DIR


def _resolve_model_source() -> str:
    resolved = model_dir()
    if not resolved.is_dir():
        raise AppError("EMBED_MODEL_MISSING", 503)
    return str(resolved)


@lru_cache(maxsize=1)
def _get_model():
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise AppError("EMBED_MODEL_MISSING", 503) from exc

    source = _resolve_model_source()
    try:
        logger.info("loading embedding model from %s", source)
        return SentenceTransformer(source, local_files_only=True)
    except Exception as exc:
        logger.exception("failed to load embedding model from %s", source)
        raise AppError("EMBED_MODEL_MISSING", 503) from exc


def preload_model() -> None:
    """Load model at API startup; fail fast if weights are missing."""
    _get_model()
    logger.info("embedding model ready (%s, %s-dim)", MODEL_NAME, EMBED_DIM)


def _encode(texts: list[str], *, kind: str) -> list[list[float]]:
    if not texts:
        return []
    prefix = "query: " if kind == "query" else "passage: "
    indexed: list[tuple[int, str]] = []
    for i, text in enumerate(texts):
        raw = (text or "").strip()
        if raw:
            indexed.append((i, f"{prefix}{raw}"))

    out: list[list[float]] = [[0.0] * EMBED_DIM for _ in texts]
    if not indexed:
        return out

    model = _get_model()
    inputs = [item[1] for item in indexed]
    try:
        vectors = model.encode(inputs, normalize_embeddings=True, show_progress_bar=False)
    except Exception as exc:
        logger.exception("local embedding inference failed")
        raise AppError("EMBED_FAILED", 502) from exc

    for (idx, _), vec in zip(indexed, vectors):
        out[idx] = vec.tolist()
    return out


def embed_passages(texts: list[str]) -> list[list[float]]:
    return _encode(texts, kind="passage")


def embed_query(text: str) -> list[float]:
    return _encode([text], kind="query")[0]
