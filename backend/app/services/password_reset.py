"""Password reset token creation and e-mail delivery."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.models import PasswordResetToken, SmtpSettings, User
from app.services.mail import send_email, settings_ready


GENERIC_RESET_MESSAGE = (
    "Falls ein Konto mit diesen Angaben existiert und eine E-Mail hinterlegt ist, "
    "wurde eine Nachricht mit weiteren Schritten gesendet."
)


def hash_reset_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_reset_token(db: Session, user: User) -> str:
    """Invalidate prior unused tokens and create a new one. Returns the raw token."""
    now = datetime.now(UTC)
    pending = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
        .all()
    )
    for row in pending:
        row.used_at = now

    settings = get_settings()
    raw = secrets.token_urlsafe(32)
    row = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_reset_token(raw),
        expires_at=now + timedelta(minutes=settings.password_reset_expire_minutes),
    )
    db.add(row)
    db.commit()
    return raw


def find_valid_reset_token(db: Session, raw_token: str) -> PasswordResetToken | None:
    token_hash = hash_reset_token(raw_token)
    row = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
        .first()
    )
    if not row or row.used_at is not None:
        return None
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires < datetime.now(UTC):
        return None
    return row


def consume_reset_token(db: Session, row: PasswordResetToken, new_password: str) -> User:
    user = row.user
    user.password_hash = hash_password(new_password)
    row.used_at = datetime.now(UTC)
    # Invalidate any other pending tokens for this user
    siblings = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.id != row.id,
            PasswordResetToken.used_at.is_(None),
        )
        .all()
    )
    for sibling in siblings:
        sibling.used_at = row.used_at
    db.commit()
    db.refresh(user)
    return user


def resolve_user_by_identifier(db: Session, identifier: str) -> User | None:
    value = identifier.strip()
    if not value:
        return None
    user = db.query(User).filter(User.username == value).first()
    if user:
        return user
    return (
        db.query(User)
        .filter(User.email.isnot(None), User.email == value)
        .first()
    )


def send_password_reset_email(
    smtp: SmtpSettings,
    *,
    user: User,
    raw_token: str,
) -> None:
    if not user.email:
        raise ValueError("Keine E-Mail-Adresse hinterlegt")
    settings = get_settings()
    reset_url = f"{settings.resolved_frontend_url}/passwort-zuruecksetzen?token={raw_token}"
    minutes = settings.password_reset_expire_minutes
    subject = "Passwort zurücksetzen – HaushaltsRadar"
    body = (
        f"Hallo {user.username},\n\n"
        "du hast das Zurücksetzen deines Passworts für HaushaltsRadar angefordert.\n\n"
        f"Öffne den folgenden Link, um ein neues Passwort zu setzen "
        f"(gültig etwa {minutes} Minuten):\n\n"
        f"{reset_url}\n\n"
        "Wenn du diese Anfrage nicht gestellt hast, kannst du diese Nachricht ignorieren.\n"
    )
    send_email(smtp, to_addrs=[user.email], subject=subject, body=body)


def smtp_password_reset_ready(smtp: SmtpSettings | None) -> bool:
    return bool(smtp and settings_ready(smtp))
