import uuid
from datetime import timedelta

from fastapi import Cookie, Depends, Response
from itsdangerous import BadSignature, SignatureExpired, TimestampSigner
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .errors import AppError
from .models import User

COOKIE = "wendu_session"
signer = TimestampSigner(settings.session_secret)


def set_session(response: Response, user_id: uuid.UUID) -> None:
    token = signer.sign(str(user_id))
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        max_age=60 * 60 * 24 * 14,
        path="/",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")


def current_user(
    wendu_session: str | None = Cookie(default=None, alias=COOKIE),
    db: Session = Depends(get_db),
) -> User:
    if not wendu_session:
        raise AppError("UNAUTHORIZED", 401)
    try:
        raw = signer.unsign(wendu_session, max_age=int(timedelta(days=14).total_seconds()))
        user_id = uuid.UUID(raw.decode("utf-8"))
    except (BadSignature, SignatureExpired, ValueError) as exc:
        raise AppError("UNAUTHORIZED", 401) from exc
    user = db.get(User, user_id)
    if not user:
        raise AppError("UNAUTHORIZED", 401)
    return user


def current_admin(user: User = Depends(current_user)) -> User:
    if not user.is_admin:
        raise AppError("FORBIDDEN", 403)
    return user
