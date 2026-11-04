"""Smoke test for a disposable PostgreSQL database migrated to Alembic head."""

import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient

if os.environ.get("RUN_POSTGRES_TESTS") != "1":
    pytest.skip("Set RUN_POSTGRES_TESTS=1 for a disposable test database.", allow_module_level=True)

from app.core.config import get_settings
from app.db.session import engine
from app.main import create_app


def test_migrated_postgres_startup_and_authenticated_api():
    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    scripts = ScriptDirectory.from_config(config)
    with engine.connect() as connection:
        assert set(MigrationContext.configure(connection).get_current_heads()) == set(
            scripts.get_heads()
        )

    settings = get_settings()
    with TestClient(create_app()) as client:
        health = client.get("/api/v1/health")
        assert health.status_code == 200
        assert health.json()["status"] == "ok"
        assert client.get("/api/v1/auth/me").status_code == 401

        login = client.post(
            "/api/v1/auth/login/json",
            json={
                "username": settings.bootstrap_admin_username,
                "password": settings.bootstrap_admin_password,
            },
        )
        assert login.status_code == 200, login.text
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        profile = client.get("/api/v1/auth/me", headers=headers)
        assert profile.status_code == 200, profile.text
        assert profile.json()["role"] == "admin"

        categories = client.get("/api/v1/categories", headers=headers)
        assert categories.status_code == 200, categories.text
        assert categories.json()

        name = f"CI one-time income {uuid4().hex}"
        created = client.post(
            "/api/v1/cost-items",
            headers=headers,
            json={
                "name": name,
                "amount": "120.00",
                "category_id": categories.json()[0]["id"],
                "entry_type": "income",
                "payment_interval": "one_time",
                "start_date": "2026-01-15",
                "currency": "EUR",
                "allocations": [{"is_household": True, "percentage": 100}],
            },
        )
        assert created.status_code == 201, created.text
        assert created.json()["entry_type"] == "income"
        assert created.json()["payment_interval"] == "one_time"
        assert created.json()["monthly_amount"] == "10.00"

        items = client.get("/api/v1/cost-items", headers=headers)
        assert items.status_code == 200, items.text
        assert any(item["id"] == created.json()["id"] for item in items.json())

        deleted = client.delete(
            f"/api/v1/cost-items/{created.json()['id']}", headers=headers
        )
        assert deleted.status_code == 204, deleted.text
