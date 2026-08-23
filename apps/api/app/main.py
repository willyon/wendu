from fastapi import FastAPI, Request
from sqlalchemy import text

from .bootstrap import bootstrap
from .db import Base, SessionLocal, engine
from .errors import AppError, error_response
from .i18n import parse_lang, set_request_lang
from .routers_admin import router as admin_router
from .routers_ask import router as ask_router
from .routers_auth import router as auth_router
from .routers_files import router as files_router


def init_db() -> None:
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS chunks_tsv_idx ON chunks USING GIN (tsv)")
        )
        conn.commit()
    db = SessionLocal()
    try:
        bootstrap(db)
    finally:
        db.close()


app = FastAPI(title="问牍")


@app.middleware("http")
async def language_middleware(request: Request, call_next):
    header = request.headers.get("x-accept-language") or request.headers.get("accept-language")
    set_request_lang(parse_lang(header))
    return await call_next(request)


@app.exception_handler(AppError)
async def app_error_handler(_request: Request, exc: AppError):
    return error_response(exc.code, exc.status_code)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"ok": True}


app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(files_router, prefix="/api")
app.include_router(ask_router, prefix="/api")
