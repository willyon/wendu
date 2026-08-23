import hashlib
import hmac
import time
from pathlib import Path
from urllib.parse import quote
from uuid import UUID

from .config import settings


ALLOWED_EXT = {".pdf", ".md", ".txt", ".docx", ".pptx", ".csv", ".xlsx"}
MAX_BYTES = 20 * 1024 * 1024

_EXT_ALIASES = {
    ".pdf": ".pdf",
    ".md": ".md",
    ".markdown": ".md",
    ".txt": ".txt",
    ".docx": ".docx",
    ".pptx": ".pptx",
    ".csv": ".csv",
    ".xlsx": ".xlsx",
}


def normalize_ext(filename: str) -> str:
    name = filename.lower().strip()
    for suffix, canon in sorted(_EXT_ALIASES.items(), key=lambda x: -len(x[0])):
        if name.endswith(suffix):
            return canon
    return ""


class Storage:
    def object_exists(self, key: str) -> bool:
        raise NotImplementedError

    def get_bytes(self, key: str) -> bytes:
        raise NotImplementedError

    def delete(self, key: str) -> None:
        raise NotImplementedError

    def credential(self, *, user_id: UUID, file_id: UUID, ext: str, content_type: str) -> dict:
        raise NotImplementedError


class LocalStorage(Storage):
    """原文件落在部署机本地磁盘。"""

    def __init__(self):
        self.root = Path(settings.files_dir)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        if ".." in key or key.startswith("/"):
            raise ValueError("bad key")
        return self.root / key

    def object_exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def get_bytes(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def delete(self, key: str) -> None:
        p = self._path(key)
        if p.is_file():
            p.unlink()

    def put_bytes(self, key: str, data: bytes) -> None:
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

    def credential(self, *, user_id: UUID, file_id: UUID, ext: str, content_type: str) -> dict:
        key = f"{user_id}/{file_id}{ext}"
        exp = int(time.time()) + 600
        token = sign_storage_token(key, exp)
        url = f"/api/storage/{quote(key)}?exp={exp}&sig={token}"
        return {
            "mode": "put",
            "key": key,
            "url": url,
            "headers": {"Content-Type": content_type},
        }


def sign_storage_token(key: str, exp: int) -> str:
    msg = f"{key}:{exp}".encode()
    return hmac.new(settings.session_secret.encode(), msg, hashlib.sha256).hexdigest()


def verify_storage_token(key: str, exp: int, sig: str) -> bool:
    if exp < int(time.time()):
        return False
    expected = sign_storage_token(key, exp)
    return hmac.compare_digest(expected, sig)


def get_storage() -> Storage:
    return LocalStorage()
