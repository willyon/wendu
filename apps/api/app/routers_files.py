"""Library HTTP: prepare → signed PUT → complete → background ingest; list/delete.

Owns: dedupe, ext/size checks, storage URL credentials, schedule ingest_file.
Does not own: parse/chunk/embed details (ingest), disk I/O impl (storage).
Prefixes: /api/files · /api/storage
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import current_user
from .db import SessionLocal, get_db
from .errors import AppError
from .i18n import t
from .ingest import ingest_file
from .models import Citation, File, User
from .storage import ALLOWED_EXT, MAX_BYTES, get_storage, normalize_ext, verify_storage_token

router = APIRouter(tags=["files"])


class PrepareBody(BaseModel):
    filename: str
    byteSize: int
    contentHash: str
    contentType: Optional[str] = None


class CompleteBody(BaseModel):
    fileId: str


def _file_json(f: File) -> dict:
    out = {
        "id": str(f.id),
        "filename": f.filename,
        "status": f.status,
        "failReason": f.fail_reason,
        "byteSize": f.byte_size,
        "createdAt": f.created_at.isoformat(),
    }
    if f.fail_reason:
        out["failReasonMessage"] = t(f.fail_reason)
    return out


def _run_ingest(file_id: UUID) -> None:
    db = SessionLocal()
    try:
        ingest_file(db, file_id)
    finally:
        db.close()


def _start_ingest(db: Session, f: File, tasks: BackgroundTasks) -> None:
    storage = get_storage()
    if not storage.object_exists(f.storage_key):
        raise AppError("OBJECT_MISSING", 400)
    if f.status == "ready":
        return
    f.status = "processing"
    db.commit()
    tasks.add_task(_run_ingest, f.id)


@router.get("/files")
def list_files(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = (
        db.execute(select(File).where(File.user_id == user.id).order_by(File.created_at.desc()))
        .scalars()
        .all()
    )
    return {"files": [_file_json(f) for f in rows]}


@router.post("/files/prepare")
def prepare(body: PrepareBody, user: User = Depends(current_user), db: Session = Depends(get_db)):
    ext = normalize_ext(body.filename)
    if ext not in ALLOWED_EXT:
        raise AppError("FILE_TYPE", 400)
    if body.byteSize <= 0 or body.byteSize > MAX_BYTES:
        raise AppError("FILE_TOO_LARGE", 400)
    if not body.contentHash or len(body.contentHash) < 32:
        raise AppError("FILE_TYPE", 400)

    existing = db.execute(
        select(File).where(File.user_id == user.id, File.content_hash == body.contentHash)
    ).scalar_one_or_none()
    if existing and existing.status in ("ready", "pending", "processing"):
        return {"type": "instant", "file": _file_json(existing)}

    storage = get_storage()
    if existing and existing.status == "failed":
        cred = storage.credential(
            user_id=user.id,
            file_id=existing.id,
            ext=ext,
            content_type=body.contentType or "application/octet-stream",
        )
        existing.filename = body.filename
        existing.ext = ext
        existing.storage_key = cred["key"]
        existing.status = "pending"
        existing.fail_reason = None
        existing.byte_size = body.byteSize
        db.commit()
        return {"type": "upload", "file": _file_json(existing), "credential": cred}

    f = File(
        user_id=user.id,
        filename=body.filename,
        ext=ext,
        content_hash=body.contentHash,
        storage_key="pending",
        status="pending",
        byte_size=body.byteSize,
    )
    db.add(f)
    db.flush()
    cred = storage.credential(
        user_id=user.id,
        file_id=f.id,
        ext=ext,
        content_type=body.contentType or "application/octet-stream",
    )
    f.storage_key = cred["key"]
    db.commit()
    db.refresh(f)
    return {"type": "upload", "file": _file_json(f), "credential": cred}


@router.post("/files/complete")
def complete(
    body: CompleteBody,
    tasks: BackgroundTasks,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    try:
        fid = UUID(body.fileId)
    except ValueError as exc:
        raise AppError("FILE_NOT_FOUND", 404) from exc
    f = db.get(File, fid)
    if not f or f.user_id != user.id:
        raise AppError("FILE_NOT_FOUND", 404)
    _start_ingest(db, f, tasks)
    db.refresh(f)
    return {"file": _file_json(f)}


@router.delete("/files/{file_id}")
def delete_file(file_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    f = db.get(File, file_id)
    if not f or f.user_id != user.id:
        raise AppError("FILE_NOT_FOUND", 404)
    db.query(Citation).filter(Citation.file_id == f.id).update({"file_deleted": 1})
    storage = get_storage()
    try:
        storage.delete(f.storage_key)
    except Exception:
        pass
    db.delete(f)
    db.commit()
    return {}


@router.put("/storage/{key:path}")
async def storage_put(key: str, request: Request, exp: int = 0, sig: str = ""):
    storage = get_storage()
    if not verify_storage_token(key, exp, sig):
        raise AppError("UNAUTHORIZED", 401)
    data = await request.body()
    if len(data) > MAX_BYTES:
        raise AppError("FILE_TOO_LARGE", 400)
    storage.put_bytes(key, data)
    return {"ok": True}
