"""Tests for self-service profile, remember-me tokens, and password reset."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from jose import jwt

from app.core.config import get_settings
from app.core.security import hash_password
from app.models import PasswordResetToken, SmtpSettings, User, UserRole
from app.services.password_reset import GENERIC_RESET_MESSAGE, hash_reset_token


def _login(client, username="admin", password="admin", remember_me=False):
    return client.post(
        "/api/v1/auth/login/json",
        json={"username": username, "password": password, "remember_me": remember_me},
    )


def _auth_headers(client, **kwargs):
    login = _login(client, **kwargs)
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}, login.json()


def _enable_smtp(db_session, *, enabled=True):
    row = db_session.query(SmtpSettings).first()
    if not row:
        row = SmtpSettings(id=1)
        db_session.add(row)
    row.enabled = enabled
    row.host = "smtp.example.test"
    row.port = 587
    row.from_email = "noreply@example.test"
    row.from_name = "HaushaltsRadar"
    row.use_tls = True
    db_session.commit()
    return row


def test_update_own_profile_email_and_username(client, db_session):
    headers, _ = _auth_headers(client)
    response = client.patch(
        "/api/v1/auth/me",
        headers=headers,
        json={"email": "admin@example.test", "username": "admin"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "admin@example.test"

    bad = client.patch(
        "/api/v1/auth/me",
        headers=headers,
        json={"email": "not-an-email"},
    )
    assert bad.status_code == 400
    assert "E-Mail" in bad.json()["detail"]


def test_change_own_password_requires_current(client, db_session):
    headers, _ = _auth_headers(client)

    missing = client.patch(
        "/api/v1/auth/me",
        headers=headers,
        json={"new_password": "newpass1"},
    )
    assert missing.status_code == 400
    assert "Aktuelles Passwort" in missing.json()["detail"]

    wrong = client.patch(
        "/api/v1/auth/me",
        headers=headers,
        json={"current_password": "wrong", "new_password": "newpass1"},
    )
    assert wrong.status_code == 400

    ok = client.patch(
        "/api/v1/auth/me",
        headers=headers,
        json={"current_password": "admin", "new_password": "newpass1"},
    )
    assert ok.status_code == 200

    fail_old = _login(client, password="admin")
    assert fail_old.status_code == 401
    ok_new = _login(client, password="newpass1")
    assert ok_new.status_code == 200


def test_viewer_can_update_own_profile(client, db_session):
    viewer = User(
        username="reader",
        password_hash=hash_password("reader1"),
        email="reader@example.test",
        role=UserRole.viewer,
        is_active=True,
    )
    db_session.add(viewer)
    db_session.commit()

    headers, _ = _auth_headers(client, username="reader", password="reader1")
    response = client.patch(
        "/api/v1/auth/me",
        headers=headers,
        json={"email": "reader2@example.test"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "reader2@example.test"
    assert response.json()["role"] == "viewer"


def test_remember_me_extends_token_lifetime(client):
    settings = get_settings()
    short = _login(client, remember_me=False)
    long = _login(client, remember_me=True)
    assert short.status_code == 200
    assert long.status_code == 200

    short_payload = jwt.get_unverified_claims(short.json()["refresh_token"])
    long_payload = jwt.get_unverified_claims(long.json()["refresh_token"])
    assert short_payload.get("remember") is False
    assert long_payload.get("remember") is True

    short_exp = datetime.fromtimestamp(short_payload["exp"], tz=UTC)
    long_exp = datetime.fromtimestamp(long_payload["exp"], tz=UTC)
    now = datetime.now(UTC)
    short_days = (short_exp - now).total_seconds() / 86400
    long_days = (long_exp - now).total_seconds() / 86400
    assert short_days < settings.refresh_token_expire_days + 0.1
    assert long_days > settings.refresh_token_expire_days + 1
    assert abs(long_days - settings.refresh_token_expire_days_remember) < 0.2

    refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": long.json()["refresh_token"]},
    )
    assert refresh.status_code == 200
    refreshed = jwt.get_unverified_claims(refresh.json()["refresh_token"])
    assert refreshed.get("remember") is True


def test_password_reset_available_depends_on_smtp(client, db_session):
    _enable_smtp(db_session, enabled=False)
    off = client.get("/api/v1/auth/password-reset/available")
    assert off.status_code == 200
    assert off.json()["available"] is False

    _enable_smtp(db_session, enabled=True)
    on = client.get("/api/v1/auth/password-reset/available")
    assert on.status_code == 200
    assert on.json()["available"] is True


def test_password_reset_flow_no_enumeration(client, db_session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    admin.email = "admin@example.test"
    db_session.commit()
    _enable_smtp(db_session, enabled=True)

    with patch("app.api.v1.auth.send_password_reset_email") as send_mock:
        known = client.post(
            "/api/v1/auth/password-reset/request",
            json={"identifier": "admin"},
        )
        unknown = client.post(
            "/api/v1/auth/password-reset/request",
            json={"identifier": "does-not-exist"},
        )
    assert known.status_code == 200
    assert unknown.status_code == 200
    assert known.json()["detail"] == GENERIC_RESET_MESSAGE
    assert unknown.json()["detail"] == GENERIC_RESET_MESSAGE
    assert send_mock.call_count == 1

    token_row = (
        db_session.query(PasswordResetToken)
        .filter(PasswordResetToken.user_id == admin.id, PasswordResetToken.used_at.is_(None))
        .first()
    )
    assert token_row is not None
    # Recover raw token via creating a known one for confirm test
    raw = "test-reset-token-value-abc"
    token_row.token_hash = hash_reset_token(raw)
    token_row.expires_at = datetime.now(UTC) + timedelta(hours=1)
    db_session.commit()

    confirm = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": raw, "new_password": "resetpass1"},
    )
    assert confirm.status_code == 200

    reuse = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": raw, "new_password": "another1"},
    )
    assert reuse.status_code == 400

    assert _login(client, password="admin").status_code == 401
    assert _login(client, password="resetpass1").status_code == 200


def test_password_reset_unavailable_without_smtp(client, db_session):
    _enable_smtp(db_session, enabled=False)
    response = client.post(
        "/api/v1/auth/password-reset/request",
        json={"identifier": "admin"},
    )
    assert response.status_code == 503
