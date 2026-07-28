from fastapi.testclient import TestClient


def _client(monkeypatch):
    import app as app_module
    monkeypatch.delenv("AUTH_ENABLED", raising=False)  # gate off for unit check
    return TestClient(app_module.app)


def test_get_admin_assets_shape(monkeypatch):
    client = _client(monkeypatch)
    res = client.get("/api/admin/assets")
    assert res.status_code == 200
    body = res.json()
    assert "assets" in body and "writable" in body
    assert isinstance(body["assets"], list)


def test_post_admin_assets_requires_lakebase(monkeypatch):
    # With Lakebase off, save raises -> route surfaces a 400/409/500 (not a crash).
    client = _client(monkeypatch)
    res = client.post("/api/admin/assets", json={"asset_key": "x", "spec": {"dashboardId": "d"}})
    assert res.status_code in (400, 409, 500)
    assert "LAKEBASE" in res.text.upper() or "lakebase" in res.text.lower()


def test_post_admin_assets_validation_400(monkeypatch):
    client = _client(monkeypatch)
    # Bad slug is a validation error regardless of Lakebase (validate runs first).
    res = client.post("/api/admin/assets", json={"asset_key": "Bad Key!", "spec": {"dashboardId": "d"}})
    assert res.status_code == 400


def test_admin_assets_gated_when_auth_on(monkeypatch):
    import app as app_module
    monkeypatch.setenv("AUTH_ENABLED", "true")
    client = TestClient(app_module.app)
    assert client.get("/api/admin/assets").status_code == 401  # no session cookie
