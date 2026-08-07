import json

from fastapi.testclient import TestClient


def _admin_headers(client: TestClient) -> dict[str, str]:
    login = client.post(
        "/api/v1/auth/login/json",
        json={"username": "admin", "password": "admin"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_export_requires_admin(client: TestClient):
    response = client.get("/api/v1/admin/export")
    assert response.status_code == 401


def test_export_import_roundtrip(client: TestClient):
    headers = _admin_headers(client)

    # Seed a person so export has domain content beyond categories/users
    created = client.post("/api/v1/persons", json={"name": "ExportTim"}, headers=headers)
    assert created.status_code == 201

    export = client.get("/api/v1/admin/export", headers=headers)
    assert export.status_code == 200
    assert "attachment" in export.headers.get("content-disposition", "")
    bundle = export.json()
    assert bundle["app"] == "haushaltsradar"
    assert bundle["schema_version"] == 1
    assert any(p["name"] == "ExportTim" for p in bundle["data"]["persons"])
    assert len(bundle["data"]["users"]) >= 1

    # Change data, then restore
    client.post("/api/v1/persons", json={"name": "ShouldVanish"}, headers=headers)
    persons_before = client.get("/api/v1/persons", headers=headers)
    assert any(p["name"] == "ShouldVanish" for p in persons_before.json())

    restore = client.post(
        "/api/v1/admin/import",
        headers=headers,
        files={"file": ("backup.json", json.dumps(bundle).encode("utf-8"), "application/json")},
    )
    assert restore.status_code == 200, restore.text
    assert restore.json()["status"] == "ok"

    # Re-login after user table replace (same credentials from backup)
    headers = _admin_headers(client)
    persons_after = client.get("/api/v1/persons", headers=headers)
    names = [p["name"] for p in persons_after.json()]
    assert "ExportTim" in names
    assert "ShouldVanish" not in names


def test_import_accepts_legacy_app_id(client: TestClient):
    """Backups exported before the product rename still use app id 'kostenpilot'."""
    headers = _admin_headers(client)
    export = client.get("/api/v1/admin/export", headers=headers)
    assert export.status_code == 200
    bundle = export.json()
    bundle["app"] = "kostenpilot"

    restore = client.post(
        "/api/v1/admin/import",
        headers=headers,
        files={"file": ("legacy.json", json.dumps(bundle).encode("utf-8"), "application/json")},
    )
    assert restore.status_code == 200, restore.text


def test_import_rejects_invalid_json(client: TestClient):
    headers = _admin_headers(client)
    response = client.post(
        "/api/v1/admin/import",
        headers=headers,
        files={"file": ("bad.json", b"not-json", "application/json")},
    )
    assert response.status_code == 400
