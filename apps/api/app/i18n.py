"""请求语言上下文（X-Accept-Language / Accept-Language）。"""

from __future__ import annotations

from contextvars import ContextVar

from .i18n_messages import EN, ZH, _PACKS

_lang: ContextVar[str] = ContextVar("wendu_lang", default="zh")


def parse_lang(header: str | None) -> str:
    raw = (header or "zh").strip().lower()
    # 支持 "zh" / "zh-CN" / "zh,en;q=0.9"
    primary = raw.split(",")[0].split(";")[0].strip()
    return "zh" if primary.startswith("zh") else "en"


def set_request_lang(lang: str) -> None:
    _lang.set(lang if lang in _PACKS else "zh")


def get_request_lang() -> str:
    return _lang.get()


def t(code: str) -> str:
    lang = get_request_lang()
    pack = _PACKS.get(lang) or ZH
    return pack.get(code) or EN.get(code) or ZH.get(code) or code
