"""RAG retrieve + ask path.

Owns: vector+FTS retrieval (top-K), evidence gates, capability/summary question
detection, SSE answers, citation persistence.
Does not own: ingest/parsing (ingest.py), embedding inference (embed.py), Chat HTTP (llm.py).
Entry points: retrieve() · ask_stream() · history()
See: docs/implementation (ZH) §5; docs/spec/02 product design — Q&A bounds.
"""

import json
import re
from collections.abc import Iterator
from uuid import UUID

from sqlalchemy import bindparam, select, text
from sqlalchemy.orm import Session

from .config import settings
from .conversations import get_conversation, touch_conversation
from .embed import embed_query
from .errors import AppError
from .i18n import t
from .llm import citations_from_answer, is_no_evidence_reply, stream_answer
from .models import Citation, Conversation, File, Message

_CAPABILITY_PATTERNS = (
    r"你能?(做什么|回答什么|帮我什么|帮什么|查什么|说.*什么|提供什么)",
    r"你可以(做什么|回答什么|帮我什么)",
    r"能回答(什么|哪些)(问题)?",
    r"(总结|概括|归纳).*(材料|文档|文件|上传|内容|主题)",
    r"(材料|文档|文件|上传).*(主题|内容|讲什么|说什么|关于什么|涵盖)",
    r"what can you (do|answer|help with)",
    r"what (questions|topics) can you answer",
    r"summarize (the )?(uploaded )?(materials|documents|files|content)",
    r"what (topics|themes) (do|are) (the )?(materials|documents|files)",
)


def _is_capability_question(question: str) -> bool:
    q = question.strip()
    return any(re.search(p, q, re.I) for p in _CAPABILITY_PATTERNS)


def _resolve_file_ids(db: Session, user_id: UUID, file_ids: list[str] | None) -> list[UUID] | None:
    if not file_ids:
        return None
    uuids: list[UUID] = []
    for raw in file_ids:
        try:
            uuids.append(UUID(raw))
        except ValueError as exc:
            raise AppError("FILE_NOT_FOUND", 404) from exc
    unique = list(dict.fromkeys(uuids))
    rows = (
        db.execute(
            select(File.id).where(
                File.user_id == user_id,
                File.status == "ready",
                File.id.in_(unique),
            )
        )
        .scalars()
        .all()
    )
    if len(rows) != len(unique):
        raise AppError("FILE_NOT_FOUND", 404)
    return unique


def _ready_file_ids(db: Session, user_id: UUID, file_ids: list[UUID] | None) -> list[str]:
    stmt = select(File.id).where(File.user_id == user_id, File.status == "ready")
    if file_ids:
        stmt = stmt.where(File.id.in_(file_ids))
    return [str(x) for x in db.execute(stmt).scalars().all()]


def _best_chunk_for_file(
    db: Session,
    user_id: UUID,
    file_id: str,
    qvec: list[float] | None,
    question: str,
) -> dict | None:
    params: dict = {"uid": user_id, "fid": file_id, "q": question}
    if qvec is not None:
        params["qvec"] = "[" + ",".join(str(x) for x in qvec) + "]"
        row = db.execute(
            text(
                """
                SELECT c.id, c.file_id, c.text, f.filename,
                       (1 - (c.embedding <=> CAST(:qvec AS vector))) AS vec_score
                FROM chunks c
                JOIN files f ON f.id = c.file_id
                WHERE c.user_id = :uid
                  AND c.file_id = CAST(:fid AS uuid)
                  AND f.status = 'ready'
                  AND c.embedding IS NOT NULL
                ORDER BY c.embedding <=> CAST(:qvec AS vector)
                LIMIT 1
                """
            ),
            params,
        ).mappings().first()
        if row:
            return {
                "id": str(row["id"]),
                "file_id": str(row["file_id"]),
                "filename": row["filename"],
                "text": row["text"],
                "score": float(row["vec_score"]),
                "keyword_hit": False,
            }

    row = db.execute(
        text(
            """
            SELECT c.id, c.file_id, c.text, f.filename
            FROM chunks c
            JOIN files f ON f.id = c.file_id
            WHERE c.user_id = :uid
              AND c.file_id = CAST(:fid AS uuid)
              AND f.status = 'ready'
              AND c.tsv @@ plainto_tsquery('simple', :q)
            LIMIT 1
            """
        ),
        params,
    ).mappings().first()
    if not row:
        return None
    return {
        "id": str(row["id"]),
        "file_id": str(row["file_id"]),
        "filename": row["filename"],
        "text": row["text"],
        "score": settings.vector_min_score,
        "keyword_hit": True,
    }


def _ensure_per_file_coverage(
    db: Session,
    user_id: UUID,
    question: str,
    passages: list[dict],
    file_ids: list[UUID] | None,
    qvec: list[float] | None,
) -> list[dict]:
    k = settings.retrieve_k
    target_files = _ready_file_ids(db, user_id, file_ids)
    if len(target_files) <= 1 or len(target_files) > k:
        return passages[:k]

    result = passages[:k]
    represented = {p["file_id"] for p in result}
    missing = [fid for fid in target_files if fid not in represented]
    if not missing:
        return result

    for fid in missing:
        extra = _best_chunk_for_file(db, user_id, fid, qvec, question)
        if not extra or extra["id"] in {p["id"] for p in result}:
            continue
        if len(result) >= k:
            result = sorted(result, key=lambda x: x["score"], reverse=True)
            result.pop()
        result.append(extra)

    return sorted(result, key=lambda x: x["score"], reverse=True)[:k]


def retrieve(db: Session, user_id: UUID, question: str, file_ids: list[UUID] | None = None) -> list[dict]:
    """向量 top-k 与关键词命中合并后按分数取前 k；向量化失败时降级为仅关键词。"""
    k = settings.retrieve_k
    file_filter = ""
    params: dict = {"uid": user_id, "k": k, "q": question}
    if file_ids:
        file_filter = " AND c.file_id IN :file_ids"
        params["file_ids"] = [str(x) for x in file_ids]

    vec_rows = []
    qvec = None
    try:
        qvec = embed_query(question)
        vec_literal = "[" + ",".join(str(x) for x in qvec) + "]"
        params["qvec"] = vec_literal
        vec_sql = f"""
            SELECT c.id, c.file_id, c.text, f.filename,
                   (1 - (c.embedding <=> CAST(:qvec AS vector))) AS vec_score
            FROM chunks c
            JOIN files f ON f.id = c.file_id
            WHERE c.user_id = :uid
              AND f.status = 'ready'
              AND c.embedding IS NOT NULL
              {file_filter}
            ORDER BY c.embedding <=> CAST(:qvec AS vector)
            LIMIT :k
            """
        vec_stmt = text(vec_sql)
        if file_ids:
            vec_stmt = vec_stmt.bindparams(bindparam("file_ids", expanding=True))
        vec_rows = db.execute(vec_stmt, params).mappings().all()
    except AppError as exc:
        if exc.code not in ("EMBED_FAILED", "EMBED_MODEL_MISSING"):
            raise

    kw_sql = f"""
            SELECT c.id, c.file_id, c.text, f.filename
            FROM chunks c
            JOIN files f ON f.id = c.file_id
            WHERE c.user_id = :uid
              AND f.status = 'ready'
              AND c.tsv @@ plainto_tsquery('simple', :q)
              {file_filter}
            LIMIT :k
            """
    kw_stmt = text(kw_sql)
    if file_ids:
        kw_stmt = kw_stmt.bindparams(bindparam("file_ids", expanding=True))
    kw_rows = db.execute(kw_stmt, params).mappings().all()

    by_id: dict[str, dict] = {}
    for row in vec_rows:
        cid = str(row["id"])
        by_id[cid] = {
            "id": cid,
            "file_id": str(row["file_id"]),
            "filename": row["filename"],
            "text": row["text"],
            "score": float(row["vec_score"]),
            "keyword_hit": False,
        }
    for row in kw_rows:
        cid = str(row["id"])
        if cid in by_id:
            by_id[cid]["score"] += 0.05
            by_id[cid]["keyword_hit"] = True
        else:
            by_id[cid] = {
                "id": cid,
                "file_id": str(row["file_id"]),
                "filename": row["filename"],
                "text": row["text"],
                "score": settings.vector_min_score,
                "keyword_hit": True,
            }

    scored = sorted(by_id.values(), key=lambda x: x["score"], reverse=True)
    return _ensure_per_file_coverage(db, user_id, question, scored, file_ids, qvec)


def _passages_sufficient(passages: list[dict]) -> bool:
    if not passages:
        return False
    top = passages[0]
    if top["score"] < settings.vector_min_score:
        return False
    if top["score"] >= settings.vector_strong_score:
        return True
    return bool(top.get("keyword_hit"))


def _yield_no_evidence(
    db: Session, user_id: UUID, conversation_id: UUID, conv: Conversation
) -> Iterator[str]:
    done = _save_no_evidence(db, user_id, conversation_id, conv)
    yield f"event: done\ndata: {json.dumps(done, ensure_ascii=False)}\n\n"


def _save_no_evidence(db: Session, user_id: UUID, conversation_id: UUID, conv: Conversation) -> dict:
    msg = Message(
        user_id=user_id,
        conversation_id=conversation_id,
        role="assistant",
        response_type="no_evidence",
        content="",
    )
    db.add(msg)
    touch_conversation(db, conv)
    db.commit()
    return {"type": "no_evidence", "code": "NO_EVIDENCE", "message": t("NO_EVIDENCE")}


def _save_answer(
    db: Session,
    user_id: UUID,
    conversation_id: UUID,
    conv: Conversation,
    text: str,
    cited: list[dict],
) -> dict:
    assistant = Message(
        user_id=user_id,
        conversation_id=conversation_id,
        role="assistant",
        response_type="answer",
        content=text,
    )
    db.add(assistant)
    db.flush()
    citations = []
    for c in cited:
        cit = Citation(
            message_id=assistant.id,
            file_id=UUID(c["file_id"]),
            chunk_id=UUID(c["chunk_id"]),
            snippet=c["snippet"],
            file_deleted=0,
        )
        db.add(cit)
        citations.append(
            {
                "filename": c["filename"],
                "snippet": c["snippet"],
                "fileDeleted": False,
            }
        )
    touch_conversation(db, conv)
    db.commit()
    return {"type": "answer", "text": text, "citations": citations}


def ask_stream(
    db: Session,
    user_id: UUID,
    conversation_id: UUID,
    question: str,
    file_ids: list[str] | None = None,
) -> Iterator[str]:
    """Yield SSE lines: event + data JSON."""
    try:
        conv = get_conversation(db, user_id, conversation_id)
        scoped = _resolve_file_ids(db, user_id, file_ids)
        if scoped:
            ready = db.execute(
                select(File).where(File.user_id == user_id, File.status == "ready", File.id.in_(scoped))
            ).scalars().first()
        else:
            ready = db.execute(
                select(File).where(File.user_id == user_id, File.status == "ready")
            ).scalars().first()
        if not ready:
            raise AppError("NO_READY_FILES", 400)

        db.add(
            Message(
                user_id=user_id,
                conversation_id=conversation_id,
                role="user",
                content=question,
            )
        )
        touch_conversation(db, conv, question)
        db.flush()

        try:
            passages = retrieve(db, user_id, question, scoped)
        except AppError as exc:
            if exc.code in ("EMBED_FAILED", "EMBED_MODEL_MISSING"):
                yield from _yield_no_evidence(db, user_id, conversation_id, conv)
                return
            raise
    except AppError as exc:
        db.rollback()
        err = {"code": exc.code, "message": t(exc.code)}
        yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n"
        return

    if not _passages_sufficient(passages):
        yield from _yield_no_evidence(db, user_id, conversation_id, conv)
        return

    capability = _is_capability_question(question)

    db.commit()

    parts: list[str] = []
    try:
        for delta in stream_answer(question, passages, capability=capability):
            parts.append(delta)
            if is_no_evidence_reply("".join(parts)):
                continue
            payload = json.dumps({"text": delta}, ensure_ascii=False)
            yield f"event: delta\ndata: {payload}\n\n"
    except GeneratorExit:
        text = "".join(parts).strip()
        if text:
            cited = citations_from_answer(text, passages)
            _save_answer(db, user_id, conversation_id, conv, text, cited)
        else:
            db.rollback()
        raise
    except AppError as exc:
        if exc.code == "LLM_NOT_CONFIGURED":
            db.rollback()
            err = {"code": exc.code, "message": t(exc.code)}
            yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n"
            return
        yield from _yield_no_evidence(db, user_id, conversation_id, conv)
        return
    except Exception:
        yield from _yield_no_evidence(db, user_id, conversation_id, conv)
        return

    text = "".join(parts).strip()
    if is_no_evidence_reply(text):
        yield from _yield_no_evidence(db, user_id, conversation_id, conv)
        return

    cited = citations_from_answer(text, passages)
    done = _save_answer(db, user_id, conversation_id, conv, text, cited)
    yield f"event: done\ndata: {json.dumps(done, ensure_ascii=False)}\n\n"


def history(db: Session, user_id: UUID, conversation_id: UUID) -> list[dict]:
    get_conversation(db, user_id, conversation_id)
    rows = (
        db.execute(
            select(Message)
            .where(Message.user_id == user_id, Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        .scalars()
        .all()
    )
    file_names = {
        str(f.id): f.filename
        for f in db.execute(select(File).where(File.user_id == user_id)).scalars()
    }
    out = []
    for m in rows:
        item = {
            "id": str(m.id),
            "role": m.role,
            "type": m.response_type,
            "content": m.content,
            "createdAt": m.created_at.isoformat(),
            "citations": [],
        }
        if m.role == "assistant":
            if m.response_type == "no_evidence":
                item["message"] = t("NO_EVIDENCE")
            for c in m.citations:
                fname = file_names.get(str(c.file_id)) if c.file_id else None
                item["citations"].append(
                    {
                        "filename": fname or "",
                        "snippet": c.snippet,
                        "fileDeleted": bool(c.file_deleted) or not fname,
                    }
                )
        out.append(item)
    return out
