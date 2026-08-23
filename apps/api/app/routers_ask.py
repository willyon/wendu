from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .auth import current_user
from .conversations import (
    create_conversation,
    delete_conversation,
    list_conversations,
    rename_conversation,
)
from .db import get_db
from .errors import AppError
from .models import User
from .rag import ask_stream, history

router = APIRouter(prefix="/ask", tags=["ask"])


class AskBody(BaseModel):
    question: str
    conversationId: str
    fileIds: Optional[list[str]] = None


class RenameBody(BaseModel):
    title: str = ""


@router.get("/conversations")
def get_conversations(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"conversations": list_conversations(db, user.id)}


@router.post("/conversations")
def post_conversation(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return create_conversation(db, user.id)


@router.patch("/conversations/{conversation_id}")
def patch_conversation(
    conversation_id: UUID,
    body: RenameBody,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    return rename_conversation(db, user.id, conversation_id, body.title)


@router.delete("/conversations/{conversation_id}")
def remove_conversation(
    conversation_id: UUID,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    delete_conversation(db, user.id, conversation_id)
    return {"ok": True}


@router.get("/conversations/{conversation_id}/messages")
def conversation_messages(
    conversation_id: UUID,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    return {"messages": history(db, user.id, conversation_id)}


@router.post("")
def post_ask(body: AskBody, user: User = Depends(current_user), db: Session = Depends(get_db)):
    question = (body.question or "").strip()
    if not question:
        raise AppError("REQUEST_FAILED", 400)
    try:
        conversation_id = UUID(body.conversationId)
    except (TypeError, ValueError) as exc:
        raise AppError("CONVERSATION_NOT_FOUND", 404) from exc
    file_ids = body.fileIds or None
    if file_ids is not None and len(file_ids) == 0:
        file_ids = None

    def event_generator():
        yield from ask_stream(db, user.id, conversation_id, question, file_ids)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
