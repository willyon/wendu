"""Login-name and password rules (self-host; not public SaaS strength)."""

import re

MIN_LOGIN_LEN = 2
MAX_LOGIN_LEN = 64
LOGIN_RE = re.compile(r"^[a-z0-9@._-]+$")

MIN_PASSWORD_LEN = 6
MAX_PASSWORD_LEN = 128


def normalize_login(value: str) -> str:
    return value.lower().strip()


def is_login_valid(value: str) -> bool:
    if not value:
        return False
    n = normalize_login(value)
    if len(n) < MIN_LOGIN_LEN or len(n) > MAX_LOGIN_LEN:
        return False
    return bool(LOGIN_RE.fullmatch(n))


def is_password_valid(password: str) -> bool:
    return bool(password and MIN_PASSWORD_LEN <= len(password) <= MAX_PASSWORD_LEN)
