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


def test_analytics_public(client: TestClient):
    response = client.get("/api/v1/analytics/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "monthly_fixed_costs" in data
    assert data["active_cost_items"] == 0


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

    items = client.get("/api/v1/cost-items", headers=headers)
    assert items.status_code == 200
    assert len(items.json()) == 1
    assert items.json()[0]["name"] == "Strom"

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

    options = client.get("/api/v1/analytics/filter-options")
    assert options.status_code == 200
    assert any(p["name"] == "Tim" for p in options.json()["persons"])
    assert any(o["name"] == "Haus" for o in options.json()["objects"])

    by_object = client.get(f"/api/v1/analytics/dashboard?object_id={object_id}")
    assert by_object.status_code == 200
    assert by_object.json()["monthly_fixed_costs"] == "120.00"

    by_person = client.get(f"/api/v1/analytics/dashboard?person_id={person_id}")
    assert by_person.status_code == 200
    assert by_person.json()["monthly_fixed_costs"] == "36.00"

    by_household = client.get("/api/v1/analytics/dashboard?household=true")
    assert by_household.status_code == 200
    assert by_household.json()["monthly_fixed_costs"] == "84.00"
