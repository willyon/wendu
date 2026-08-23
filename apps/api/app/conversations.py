from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .errors import AppError
from .models import Conversation, Message

TITLE_MAX = 24
MANUAL_TITLE_MAX = 80


def title_from_question(question: str) -> str:
    q = " ".join(question.strip().split())
    if not q:
        return ""
    if len(q) <= TITLE_MAX:
        return q
    return q[: TITLE_MAX - 1] + "…"


def _normalize_manual_title(title: str) -> str:
    t = " ".join((title or "").strip().split())
    if len(t) > MANUAL_TITLE_MAX:
        return t[:MANUAL_TITLE_MAX]
    return t


def _touch(conv: Conversation, question: str | None = None) -> None:
    from datetime import datetime, timezone

    conv.updated_at = datetime.now(timezone.utc)
    if question and not (conv.title or "").strip():
        conv.title = title_from_question(question)


def get_conversation(db: Session, user_id: UUID, conversation_id: UUID) -> Conversation:
    conv = db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id,
        )
    ).scalar_one_or_none()
    if not conv:
        raise AppError("CONVERSATION_NOT_FOUND", 404)
    return conv


def list_conversations(db: Session, user_id: UUID) -> list[dict]:
    rows = (
        db.execute(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.updated_at.desc(), Conversation.created_at.desc())
        )
        .scalars()
        .all()
    )
    out = []
    for c in rows:
        display_title = (c.title or "").strip()
        if not display_title:
            first_q = db.execute(
                select(Message.content)
                .where(
                    Message.conversation_id == c.id,
                    Message.role == "user",
                )
                .order_by(Message.created_at.asc())
                .limit(1)
            ).scalar_one_or_none()
            display_title = title_from_question(first_q or "") if first_q else ""
        out.append(
            {
                "id": str(c.id),
                "title": display_title,
                "updatedAt": c.updated_at.isoformat(),
                "createdAt": c.created_at.isoformat(),
            }
        )
    return out


def create_conversation(db: Session, user_id: UUID) -> dict:
    conv = Conversation(user_id=user_id, title="")
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {
        "id": str(conv.id),
        "title": "",
        "updatedAt": conv.updated_at.isoformat(),
        "createdAt": conv.created_at.isoformat(),
    }


def rename_conversation(db: Session, user_id: UUID, conversation_id: UUID, title: str) -> dict:
    conv = get_conversation(db, user_id, conversation_id)
    conv.title = _normalize_manual_title(title)
    db.commit()
    db.refresh(conv)
    return {
        "id": str(conv.id),
        "title": conv.title,
        "updatedAt": conv.updated_at.isoformat(),
        "createdAt": conv.created_at.isoformat(),
    }


def delete_conversation(db: Session, user_id: UUID, conversation_id: UUID) -> None:
    conv = get_conversation(db, user_id, conversation_id)
    db.delete(conv)
    db.commit()


def touch_conversation(db: Session, conv: Conversation, question: str | None = None) -> None:
    _touch(conv, question)
    db.flush()
