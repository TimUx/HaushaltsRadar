def _admin_headers(client):
    login = client.post(
        "/api/v1/auth/login/json",
        json={"username": "admin", "password": "admin"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _seed_cost(client, headers, *, name="Strom", amount=120, person_name="ChartTim"):
    cats = client.get("/api/v1/categories", headers=headers)
    assert cats.status_code == 200
    category_id = cats.json()[0]["id"]
    person = client.post("/api/v1/persons", headers=headers, json={"name": person_name})
    assert person.status_code == 201
    person_id = person.json()["id"]
    created = client.post(
        "/api/v1/cost-items",
        headers=headers,
        json={
            "name": name,
            "amount": amount,
            "category_id": category_id,
            "payment_interval": "monthly",
            "currency": "EUR",
            "is_active": True,
            "allocations": [
                {"is_household": True, "percentage": 70},
                {"is_household": False, "person_id": person_id, "percentage": 30},
            ],
        },
    )
    assert created.status_code == 201
    return created.json(), person_id, category_id


def test_chart_endpoints_require_auth(client):
    assert client.get("/api/v1/analytics/breakdown").status_code == 401
    assert client.get("/api/v1/analytics/hierarchy").status_code == 401
    assert client.get("/api/v1/analytics/heatmap").status_code == 401
    assert client.get("/api/v1/analytics/flow").status_code == 401


def test_breakdown_group_by_category(client):
    headers = _admin_headers(client)
    _seed_cost(client, headers, person_name="ChartTimA")
    response = client.get("/api/v1/analytics/breakdown?group_by=category", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["group_by"] == "category"
    assert len(data["items"]) >= 1
    assert float(data["items"][0]["amount"]) > 0


def test_heatmap_shape(client):
    headers = _admin_headers(client)
    _seed_cost(client, headers, name="Wärme", person_name="ChartTimB")
    response = client.get("/api/v1/analytics/heatmap", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "year" in data
    assert isinstance(data["months"], list) and len(data["months"]) >= 1
    assert isinstance(data["categories"], list)
    assert len(data["values"]) == len(data["categories"])
    if data["categories"]:
        assert len(data["values"][0]) == len(data["months"])


def test_flow_has_links(client):
    headers = _admin_headers(client)
    _seed_cost(client, headers, name="FlussPosten", person_name="ChartTimC")
    response = client.get("/api/v1/analytics/flow", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["links"]) >= 1
    assert len(data["nodes"]) >= 2


def test_hierarchy_category_mode(client):
    headers = _admin_headers(client)
    _seed_cost(client, headers, name="HierarchiePosten", person_name="ChartTimD")
    response = client.get("/api/v1/analytics/hierarchy?mode=category", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "category"
    assert len(data["nodes"]) >= 1
    assert "children" in data["nodes"][0]
