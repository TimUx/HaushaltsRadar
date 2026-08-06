from datetime import date

from app.services.reports import months_between, resolve_period


def test_resolve_period_quarter():
    months, label, start, end = resolve_period(period_type="quarter", year=2025, quarter=2)
    assert label == "2. Quartal 2025"
    assert start == date(2025, 4, 1)
    assert end == date(2025, 6, 30)
    assert [m.month for m in months] == [4, 5, 6]


def test_resolve_period_year_past():
    months, label, start, end = resolve_period(period_type="year", year=2024)
    assert label == "Jahr 2024"
    assert len(months) == 12
    assert start == date(2024, 1, 1)
    assert end == date(2024, 12, 31)


def test_months_between_caps_at_through():
    months = months_between(date(2026, 1, 1), date(2026, 12, 1), through=date(2026, 3, 15))
    assert [m.month for m in months] == [1, 2, 3]


def test_period_report_endpoint(client):
    login = client.post(
        "/api/v1/auth/login/json",
        json={"username": "admin", "password": "admin"},
    )
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    cats = client.get("/api/v1/categories", headers=headers).json()
    created = client.post(
        "/api/v1/cost-items",
        headers=headers,
        json={
            "name": "BerichtStrom",
            "amount": 100,
            "category_id": cats[0]["id"],
            "payment_interval": "monthly",
            "currency": "EUR",
            "allocations": [{"is_household": True, "percentage": 100}],
        },
    )
    assert created.status_code == 201

    report = client.get(
        "/api/v1/reports/period?period_type=year&year=2026",
        headers=headers,
    )
    assert report.status_code == 200
    data = report.json()
    assert data["period_type"] == "year"
    assert "summary" in data
    assert "by_category" in data
    assert "monthly_series" in data
    assert data["months_covered"] >= 1


def test_period_report_requires_auth(client):
    assert client.get("/api/v1/reports/period?period_type=year").status_code == 401
