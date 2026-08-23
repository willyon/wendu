import json
import re
from collections.abc import Iterator

import httpx

from .config import settings
from .db import SessionLocal
from .errors import AppError
from .models import InstanceSettings

NO_EVIDENCE_SENTINEL = "__NO_EVIDENCE__"


def is_no_evidence_reply(text: str) -> bool:
    t = (text or "").strip()
    if not t:
        return True
    if t == NO_EVIDENCE_SENTINEL:
        return True
    if NO_EVIDENCE_SENTINEL in t:
        return True
    return False


def _llm_config() -> dict:
    db = SessionLocal()
    try:
        row = db.get(InstanceSettings, 1)
        if not row:
            raise AppError("LLM_NOT_CONFIGURED", 503)
        cfg = {
            "api_key": (row.openai_api_key or "").strip(),
            "base_url": (row.openai_base_url or "").strip(),
            "chat_model": (row.openai_chat_model or "").strip(),
            "embed_model": (row.openai_embed_model or "").strip(),
            "embed_dim": row.embed_dim or 1024,
        }
    finally:
        db.close()
    if not all(cfg[k] for k in ("api_key", "base_url", "chat_model", "embed_model")):
        raise AppError("LLM_NOT_CONFIGURED", 503)
    if not cfg["embed_dim"] or cfg["embed_dim"] < 1:
        raise AppError("LLM_NOT_CONFIGURED", 503)
    return cfg


def _headers() -> dict:
    cfg = _llm_config()
    return {
        "Authorization": f"Bearer {cfg['api_key']}",
        "Content-Type": "application/json",
    }


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    cfg = _llm_config()
    url = cfg["base_url"].rstrip("/") + "/embeddings"
    # 百炼等兼容接口常见上限 10；分批以免长文档切片超限
    batch_size = 10
    out: list[list[float]] = []
    try:
        with httpx.Client(timeout=60) as client:
            for i in range(0, len(texts), batch_size):
                batch = texts[i : i + batch_size]
                r = client.post(
                    url,
                    headers=_headers(),
                    json={
                        "model": cfg["embed_model"],
                        "input": batch,
                        "dimensions": cfg["embed_dim"],
                    },
                )
                r.raise_for_status()
                data = r.json()["data"]
                data.sort(key=lambda x: x["index"])
                out.extend(item["embedding"] for item in data)
        return out
    except AppError:
        raise
    except Exception as exc:
        raise AppError("EMBED_FAILED", 502) from exc


def embed_query(text: str) -> list[float]:
    return embed_texts([text])[0]


def _answer_prompt(question: str, passages: list[dict], *, capability: bool = False) -> tuple[str, str]:
    numbered = []
    for i, p in enumerate(passages, start=1):
        numbered.append(f"[{i}] file={p['filename']}\n{p['text']}")
    capability_rules = (
        "The user asks what you can answer or what the uploaded materials cover. "
        "Reply in 2–4 short sentences summarizing the main topics only; "
        "do not enumerate every passage, do not list more than four bullet points, "
        "and do not repeat the question.\n"
        if capability
        else ""
    )
    system = (
        "You answer ONLY from the numbered passages below.\n"
        "Use exactly the same language as the user's question; do not mix in English words or jargon "
        '(for example do not say "passages").\n'
        "Do not use world knowledge or information outside the passages.\n"
        "Do not role-play, chat socially, or discuss real-world activities unrelated to the materials.\n"
        f"{capability_rules}"
        "If the question is unrelated to the passage content, or the passages do not substantively "
        f"answer it, reply with exactly {NO_EVIDENCE_SENTINEL} and nothing else.\n"
        "When you do answer, cite passages with [1], [2], etc.\n"
        "Write clear prose. Light Markdown is OK (bold, lists, inline code). "
        "Do not use JSON or fenced code blocks."
    )
    user = (
        "Passages:\n"
        + "\n\n".join(numbered)
        + "\n\nQuestion:\n"
        + question
    )
    return system, user


def stream_answer(question: str, passages: list[dict], *, capability: bool = False) -> Iterator[str]:
    """Yield answer text deltas from OpenAI-compatible chat completions stream."""
    cfg = _llm_config()
    system, user = _answer_prompt(question, passages, capability=capability)
    url = cfg["base_url"].rstrip("/") + "/chat/completions"
    try:
        with httpx.Client(timeout=120) as client:
            with client.stream(
                "POST",
                url,
                headers=_headers(),
                json={
                    "model": cfg["chat_model"],
                    "temperature": 0,
                    "stream": True,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
            ) as r:
                r.raise_for_status()
                for line in r.iter_lines():
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if not payload or payload == "[DONE]":
                        continue
                    try:
                        chunk = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    text = delta.get("content")
                    if text:
                        yield text
    except AppError:
        raise
    except Exception as exc:
        raise AppError("ASK_TIMEOUT", 504) from exc


def citations_from_answer(text: str, passages: list[dict]) -> list[dict]:
    nums = sorted({int(n) for n in re.findall(r"\[(\d+)\]", text)})
    conclusions = []
    seen: set[str] = set()
    for idx in nums:
        if idx < 1 or idx > len(passages):
            continue
        src = passages[idx - 1]
        key = src["id"]
        if key in seen:
            continue
        seen.add(key)
        conclusions.append(
            {
                "chunk_id": src["id"],
                "file_id": src["file_id"],
                "filename": src["filename"],
                "snippet": src["text"],
            }
        )
    return conclusions
