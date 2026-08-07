from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_token(
    subject: str,
    expires_delta: timedelta,
    token_type: str,
    *,
    remember: bool = False,
) -> str:
    settings = get_settings()
    expire = datetime.now(UTC) + expires_delta
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "type": token_type,
        "remember": remember,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(subject: str, *, remember: bool = False) -> str:
    settings = get_settings()
    minutes = (
        settings.access_token_expire_minutes_remember
        if remember
        else settings.access_token_expire_minutes
    )
    return create_token(
        subject,
        timedelta(minutes=minutes),
        "access",
        remember=remember,
    )


def create_refresh_token(subject: str, *, remember: bool = False) -> str:
    settings = get_settings()
    days = (
        settings.refresh_token_expire_days_remember
        if remember
        else settings.refresh_token_expire_days
    )
    return create_token(
        subject,
        timedelta(days=days),
        "refresh",
        remember=remember,
    )


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


def get_subject(token: str, expected_type: str) -> str | None:
    try:
        payload = decode_token(token)
        if payload.get("type") != expected_type:
            return None
        subject = payload.get("sub")
        return str(subject) if subject is not None else None
    except JWTError:
        return None


def get_remember_flag(token: str, expected_type: str) -> bool:
    try:
        payload = decode_token(token)
        if payload.get("type") != expected_type:
            return False
        return bool(payload.get("remember", False))
    except JWTError:
        return False
