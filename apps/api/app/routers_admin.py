"""Admin HTTP: Chat settings triple, user create/reset/delete.

Owns: instance_settings read/write, admin-gated account ops.
Does not own: Embedding settings (fixed locally; no admin fields).
Prefix: /api/admin
"""

from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .accounts import is_login_valid, normalize_login
from .auth import current_admin
from .db import get_db
from .errors import AppError, ok_message
from .models import Conversation, File, InstanceSettings, User
from .passwords import hash_password, require_password
from .storage import get_storage

router = APIRouter(prefix="/admin", tags=["admin"])


class PasswordBody(BaseModel):
    password: str


class CreateUserBody(BaseModel):
    email: str = Field(max_length=320)
    password: str


class SettingsBody(BaseModel):
    openaiApiKey: str | None = None
    openaiBaseUrl: str | None = None
    openaiChatModel: str | None = None


def _settings_row(db: Session) -> InstanceSettings:
    row = db.get(InstanceSettings, 1)
    if not row:
        row = InstanceSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _require_login_name(value: str) -> str:
    name = normalize_login(value)
    if not is_login_valid(name):
        raise AppError("INVALID_LOGIN", 400)
    return name


@router.get("/settings")
def get_settings(_admin: User = Depends(current_admin), db: Session = Depends(get_db)):
    row = _settings_row(db)
    return {
        "openaiApiKey": row.openai_api_key,
        "openaiBaseUrl": row.openai_base_url,
        "openaiChatModel": row.openai_chat_model,
    }


@router.put("/settings")
def put_settings(
    body: SettingsBody,
    _admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    row = _settings_row(db)
    api_key = (body.openaiApiKey or "").strip()
    base_url = (body.openaiBaseUrl or "").strip()
    chat_model = (body.openaiChatModel or "").strip()
    if not all([api_key, base_url, chat_model]):
        raise AppError("SETTINGS_INCOMPLETE", 400)

    row.openai_api_key = api_key
    row.openai_base_url = base_url
    row.openai_chat_model = chat_model
    db.commit()
    return ok_message("SETTINGS_SAVED", ok=True)


@router.get("/users")
def list_users(_admin: User = Depends(current_admin), db: Session = Depends(get_db)):
    rows = db.execute(select(User).order_by(User.created_at.desc())).scalars().all()
    return {
        "users": [
            {
                "id": str(u.id),
                "email": u.email,
                "isAdmin": bool(u.is_admin),
                "createdAt": u.created_at.isoformat(),
            }
            for u in rows
        ]
    }


@router.post("/users")
def create_user(
    body: CreateUserBody,
    _admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    login_name = _require_login_name(body.email)
    require_password(body.password)
    exists = db.execute(select(User).where(User.email == login_name)).scalar_one_or_none()
    if exists:
        raise AppError("LOGIN_TAKEN", 409)
    user = User(
        email=login_name,
        password_hash=hash_password(body.password),
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": str(user.id), "email": user.email}


@router.put("/users/{user_id}/password")
def reset_user_password(
    user_id: UUID,
    body: PasswordBody,
    _admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    require_password(body.password)
    user = db.get(User, user_id)
    if not user:
        raise AppError("USER_NOT_FOUND", 404)
    user.password_hash = hash_password(body.password)
    db.commit()
    return ok_message("PASSWORD_UPDATED", ok=True)


@router.put("/me/password")
def change_admin_password(
    body: PasswordBody,
    admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    require_password(body.password)
    admin.password_hash = hash_password(body.password)
    db.commit()
    return ok_message("PASSWORD_UPDATED", ok=True)


def _purge_user_data(db: Session, user_id: UUID) -> None:
    files = db.execute(select(File).where(File.user_id == user_id)).scalars().all()
    storage = get_storage()
    for f in files:
        try:
            storage.delete(f.storage_key)
        except Exception:
            pass
    db.execute(delete(Conversation).where(Conversation.user_id == user_id))
    db.execute(delete(File).where(File.user_id == user_id))


@router.delete("/users/{user_id}")
def delete_user(
    user_id: UUID,
    admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise AppError("USER_NOT_FOUND", 404)
    if user.id == admin.id:
        raise AppError("CANNOT_DELETE_SELF", 400)
    if user.is_admin:
        raise AppError("CANNOT_DELETE_ADMIN", 400)
    _purge_user_data(db, user_id)
    db.delete(user)
    db.commit()
    return ok_message("USER_DELETED", ok=True)
