import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Configure before importing app
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("BOOTSTRAP_ADMIN_USERNAME", "admin")
os.environ.setdefault("BOOTSTRAP_ADMIN_PASSWORD", "admin")

from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.services.bootstrap import ensure_bootstrap_admin, seed_categories


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    seed_categories(session)
    ensure_bootstrap_admin(session)
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    app = create_app(run_bootstrap=False)

    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client


def test_health_public(client: TestClient):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_analytics_requires_auth(client: TestClient):
    response = client.get("/api/v1/analytics/dashboard")
    assert response.status_code == 401


def test_persons_requires_auth(client: TestClient):
    response = client.get("/api/v1/persons")
    assert response.status_code == 401


def test_login_and_crud(client: TestClient):
    login = client.post(
        "/api/v1/auth/login/json",
        json={"username": "admin", "password": "admin"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create = client.post("/api/v1/persons", json={"name": "Tim"}, headers=headers)
    assert create.status_code == 201
    assert create.json()["name"] == "Tim"

    persons = client.get("/api/v1/persons", headers=headers)
    assert persons.status_code == 200
    assert len(persons.json()) == 1

    categories = client.get("/api/v1/categories", headers=headers)
    assert categories.status_code == 200
    assert len(categories.json()) >= 6

    category_id = categories.json()[0]["id"]
    created_item = client.post(
        "/api/v1/cost-items",
        headers=headers,
        json={
            "name": "Strom",
            "amount": 120,
            "category_id": category_id,
            "payment_interval": "monthly",
            "currency": "EUR",
            "is_active": True,
            "allocations": [{"is_household": True, "percentage": 100}],
        },
    )
    assert created_item.status_code == 201
    assert created_item.json()["monthly_amount"] == "120.00"
    assert created_item.json()["entry_type"] == "expense"

    one_time = client.post(
        "/api/v1/cost-items",
        headers=headers,
        json={
            "name": "Strom Nachzahlung",
            "amount": 200,
            "category_id": category_id,
            "entry_type": "expense",
            "payment_interval": "one_time",
            "start_date": "2026-03-15",
            "currency": "EUR",
            "is_active": True,
            "allocations": [{"is_household": True, "percentage": 100}],
        },
    )
    assert one_time.status_code == 201
    assert one_time.json()["monthly_amount"] == "0.00"

    missing_date = client.post(
        "/api/v1/cost-items",
        headers=headers,
        json={
            "name": "Ohne Datum",
            "amount": 50,
            "category_id": category_id,
            "payment_interval": "one_time",
            "currency": "EUR",
            "allocations": [{"is_household": True, "percentage": 100}],
        },
    )
    assert missing_date.status_code == 400

    income = client.post(
        "/api/v1/cost-items",
        headers=headers,
        json={
            "name": "PV Einspeisung",
            "amount": 65,
            "category_id": category_id,
            "entry_type": "income",
            "payment_interval": "monthly",
            "currency": "EUR",
            "is_active": True,
            "allocations": [{"is_household": True, "percentage": 100}],
        },
    )
    assert income.status_code == 201
    assert income.json()["entry_type"] == "income"

    items = client.get("/api/v1/cost-items", headers=headers)
    assert items.status_code == 200
    assert len(items.json()) == 3
    assert any(i["name"] == "Strom" for i in items.json())

    person_id = create.json()["id"]
    obj = client.post("/api/v1/objects", json={"name": "Haus"}, headers=headers)
    assert obj.status_code == 201
    object_id = obj.json()["id"]

    client.patch(
        f"/api/v1/cost-items/{created_item.json()['id']}",
        headers=headers,
        json={
            "object_id": object_id,
            "allocations": [
                {"is_household": True, "percentage": 70},
                {"is_household": False, "person_id": person_id, "percentage": 30},
            ],
        },
    )

    options = client.get("/api/v1/analytics/filter-options", headers=headers)
    assert options.status_code == 200
    assert any(p["name"] == "Tim" for p in options.json()["persons"])
    assert any(o["name"] == "Haus" for o in options.json()["objects"])

    by_object = client.get(
        f"/api/v1/analytics/dashboard?object_id={object_id}", headers=headers
    )
    assert by_object.status_code == 200
    assert by_object.json()["monthly_fixed_costs"] == "120.00"
    assert by_object.json()["monthly_income"] == "0.00"

    by_person = client.get(
        f"/api/v1/analytics/dashboard?person_id={person_id}", headers=headers
    )
    assert by_person.status_code == 200
    assert by_person.json()["monthly_fixed_costs"] == "36.00"

    by_household = client.get(
        "/api/v1/analytics/dashboard?household=true", headers=headers
    )
    assert by_household.status_code == 200
    assert by_household.json()["monthly_fixed_costs"] == "84.00"
    assert by_household.json()["monthly_income"] == "65.00"
    assert by_household.json()["monthly_net"] == "19.00"

    full = client.get("/api/v1/analytics/dashboard", headers=headers)
    assert full.status_code == 200
    assert full.json()["monthly_fixed_costs"] == "120.00"
    assert full.json()["monthly_income"] == "65.00"
    assert full.json()["monthly_net"] == "55.00"
    assert full.json()["yearly_fixed_costs"] == "1440.00"
    assert full.json()["yearly_income"] == "780.00"
    assert full.json()["yearly_net"] == "660.00"

    one_time_id = one_time.json()["id"]
    soft = client.delete(f"/api/v1/cost-items/{one_time_id}", headers=headers)
    assert soft.status_code == 204
    still_there = client.get("/api/v1/cost-items", headers=headers)
    assert any(i["id"] == one_time_id and i["is_active"] is False for i in still_there.json())

    # Price history dated in the past must drive year dashboard
    strom_id = created_item.json()["id"]
    hist_old = client.post(
        f"/api/v1/cost-items/{strom_id}/price-history",
        headers=headers,
        json={
            "amount": 100,
            "valid_from": "2025-01-01",
            "notes": "Alter Tarif",
            "sync_current_amount": False,
        },
    )
    assert hist_old.status_code == 201
    hist_new = client.post(
        f"/api/v1/cost-items/{strom_id}/price-history",
        headers=headers,
        json={
            "amount": 120,
            "valid_from": "2026-01-01",
            "notes": "Neuer Tarif",
            "sync_current_amount": True,
        },
    )
    assert hist_new.status_code == 201
    year_2025_strom = client.get(
        f"/api/v1/analytics/dashboard?year=2025&object_id={object_id}", headers=headers
    )
    assert year_2025_strom.status_code == 200
    assert year_2025_strom.json()["monthly_fixed_costs"] == "100.00"

    year_2026_strom = client.get(
        f"/api/v1/analytics/dashboard?year=2026&object_id={object_id}", headers=headers
    )
    assert year_2026_strom.status_code == 200
    assert year_2026_strom.json()["monthly_fixed_costs"] == "120.00"

    history_list = client.get(
        f"/api/v1/cost-items/{strom_id}/price-history", headers=headers
    )
    assert history_list.status_code == 200
    assert len(history_list.json()) >= 2

    hard = client.delete(
        f"/api/v1/cost-items/{one_time_id}?permanent=true", headers=headers
    )
    assert hard.status_code == 204
    after_hard = client.get("/api/v1/cost-items", headers=headers)
    assert all(i["id"] != one_time_id for i in after_hard.json())
    assert client.get(f"/api/v1/cost-items/{one_time_id}", headers=headers).status_code == 404

    options = client.get("/api/v1/analytics/filter-options", headers=headers)
    assert "years" in options.json()
    assert len(options.json()["years"]) >= 1

    past = client.post(
        "/api/v1/cost-items",
        headers=headers,
        json={
            "name": "Nachzahlung 2025",
            "amount": 99,
            "category_id": category_id,
            "entry_type": "expense",
            "payment_interval": "one_time",
            "start_date": "2025-06-01",
            "currency": "EUR",
            "allocations": [{"is_household": True, "percentage": 100}],
        },
    )
    assert past.status_code == 201
    year_2025 = client.get("/api/v1/analytics/dashboard?year=2025", headers=headers)
    assert year_2025.status_code == 200
    assert year_2025.json()["year"] == 2025
    assert year_2025.json()["one_time_expense"] == "99.00"
    assert year_2025.json()["upcoming_dues"] == []
