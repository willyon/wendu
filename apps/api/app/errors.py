from fastapi import HTTPException
from fastapi.responses import JSONResponse

from .i18n import t


class AppError(HTTPException):
    def __init__(self, code: str, status_code: int = 400):
        super().__init__(status_code=status_code, detail=code)
        self.code = code


def error_response(code: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"code": code, "message": t(code)},
    )


def ok_message(code: str, **extra) -> dict:
    """成功体附带可展示 message（仍含 code 便于分支）。"""
    body = {"code": code, "message": t(code)}
    body.update(extra)
    return body
