import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from .accounts import normalize_login
from .config import settings
from .models import InstanceSettings, User
from .passwords import hash_password

logger = logging.getLogger(__name__)


def bootstrap(db: Session) -> None:
    login_name = normalize_login(settings.admin_user)
    user = db.execute(select(User).where(User.email == login_name)).scalar_one_or_none()
    if not user:
        user = User(
            email=login_name,
            password_hash=hash_password(settings.admin_password),
            is_admin=True,
        )
        db.add(user)
        logger.info("created seed admin %s", login_name)
    else:
        if not user.is_admin:
            user.is_admin = True

    if not db.get(InstanceSettings, 1):
        db.add(InstanceSettings(id=1))

    db.commit()
