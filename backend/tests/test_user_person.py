def _admin_headers(client):
    login = client.post(
        "/api/v1/auth/login/json",
        json={"username": "admin", "password": "admin"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_user_person_link_and_me(client):
    headers = _admin_headers(client)

    person = client.post(
        "/api/v1/persons",
        headers=headers,
        json={"name": "Tim", "is_active": True},
    )
    assert person.status_code == 201
    person_id = person.json()["id"]

    created = client.post(
        "/api/v1/users",
        headers=headers,
        json={
            "username": "timuser",
            "password": "secret12",
            "role": "user",
            "person_id": person_id,
        },
    )
    assert created.status_code == 201
    assert created.json()["person_id"] == person_id

    login = client.post(
        "/api/v1/auth/login/json",
        json={"username": "timuser", "password": "secret12"},
    )
    assert login.status_code == 200
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["person_id"] == person_id

    cleared = client.patch(
        f"/api/v1/users/{created.json()['id']}",
        headers=headers,
        json={"person_id": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["person_id"] is None


def test_user_person_rejects_unknown(client):
    headers = _admin_headers(client)
    response = client.post(
        "/api/v1/users",
        headers=headers,
        json={
            "username": "orphan",
            "password": "secret12",
            "role": "viewer",
            "person_id": 99999,
        },
    )
    assert response.status_code == 400
