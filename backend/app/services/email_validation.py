"""Shared helpers for e-mail format checks."""

from __future__ import annotations

import re

_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def normalize_email(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def is_valid_email(value: str) -> bool:
    return bool(_EMAIL_RE.match(value))


def require_valid_email(value: str | None) -> str | None:
    """Return normalized e-mail or None; raise ValueError if non-empty and invalid."""
    email = normalize_email(value)
    if email is None:
        return None
    if not is_valid_email(email):
        raise ValueError("Ungültige E-Mail-Adresse")
    return email
