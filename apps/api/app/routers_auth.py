from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .accounts import is_login_valid, normalize_login
from .auth import clear_session, current_user, set_session
from .db import get_db
from .errors import AppError
from .models import User
from .passwords import verify_password


router = APIRouter(prefix="/auth", tags=["auth"])


class AuthBody(BaseModel):
    email: str = Field(max_length=320)
    password: str


def _user_json(user: User) -> dict:
    return {"id": str(user.id), "email": user.email, "isAdmin": bool(user.is_admin)}


@router.post("/login")
def login(body: AuthBody, response: Response, db: Session = Depends(get_db)):
    login_name = normalize_login(body.email)
    if not is_login_valid(login_name) or not body.password:
        raise AppError("INVALID_CREDENTIALS", 401)
    user = db.execute(select(User).where(User.email == login_name)).scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise AppError("INVALID_CREDENTIALS", 401)
    set_session(response, user.id)
    return _user_json(user)


@router.post("/logout")
def logout(response: Response):
    clear_session(response)
    return {}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return _user_json(user)
