#!/usr/bin/env python3
"""开发阶段清空问牍测试数据：库表 + 本地原文件；保留种子管理员并重建 instance_settings。"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sqlalchemy import delete, select, text

from app.bootstrap import bootstrap
from app.config import settings
from app.db import SessionLocal, engine
from app.embed import EMBED_DIM
from app.models import (
    Citation,
    Chunk,
    Conversation,
    File,
    InstanceSettings,
    Message,
    User,
)


def _clear_files_dir() -> None:
    root = Path(settings.files_dir)
    if not root.exists():
        return
    for child in root.iterdir():
        if child.is_dir():
            shutil.rmtree(child)
        elif child.is_file():
            child.unlink()
    print(f"Cleared files under {root}")


def reset() -> None:
    db = SessionLocal()
    try:
        db.execute(delete(Citation))
        db.execute(delete(Message))
        db.execute(delete(Conversation))
        db.execute(delete(Chunk))
        db.execute(delete(File))
        db.execute(delete(User))
        db.execute(delete(InstanceSettings))
        db.commit()

        # 去掉已废弃的配额/邮件表（若仍存在）
        for table in (
            "usage_daily",
            "global_usage",
            "email_verification_tokens",
            "password_reset_tokens",
        ):
            db.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
        db.commit()

        # 开发重置：清空向量后对齐 pgvector 列维度（非日常启动迁移）
        db.execute(text(f"ALTER TABLE chunks ALTER COLUMN embedding TYPE vector({EMBED_DIM})"))
        db.commit()

        bootstrap(db)
        row = db.get(InstanceSettings, 1)
        if row:
            row.openai_api_key = ""
            row.openai_base_url = ""
            row.openai_chat_model = ""
            db.commit()

        admin = db.execute(select(User.email).where(User.is_admin.is_(True))).scalar_one_or_none()
        print(f"Database reset complete. Admin: {admin or '(none)'}")
    finally:
        db.close()

    _clear_files_dir()
    engine.dispose()


if __name__ == "__main__":
    reset()
