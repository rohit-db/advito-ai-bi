from fastapi.testclient import TestClient
from server.auth.sessions import create_session, SESSION_COOKIE


def _operator_client(monkeypatch):
    import app as app_module
    monkeypatch.setenv("AUTH_ENABLED", "true")   # gate ON — the real posture
    client = TestClient(app_module.app)
    cookie = create_session({"email": "dana@apex.example", "display_name": "Dana",
                             "tenant": "All Clients", "tenant_id": "*", "role": "operator"})
    client.cookies.set(SESSION_COOKIE, cookie)
    return client


def test_get_admin_assets_shape(monkeypatch):
    client = _operator_client(monkeypatch)
    res = client.get("/api/admin/assets")
    assert res.status_code == 200
    body = res.json()
    assert "assets" in body and "writable" in body and isinstance(body["assets"], list)


def test_post_admin_assets_validation_400(monkeypatch):
    client = _operator_client(monkeypatch)
    # Bad slug is a validation error regardless of Lakebase (validate runs first).
    res = client.post("/api/admin/assets", json={"asset_key": "Bad Key!", "spec": {"dashboardId": "d"}})
    assert res.status_code == 400


def test_post_admin_assets_requires_lakebase(monkeypatch):
    # conftest forces Lakebase OFF -> save_asset raises RuntimeError -> route 400.
    client = _operator_client(monkeypatch)
    res = client.post("/api/admin/assets", json={"asset_key": "ok", "spec": {"dashboardId": "d", "filters": {}, "pages": []}})
    assert res.status_code == 400
    assert "lakebase" in res.text.lower()


def test_admin_assets_401_without_session(monkeypatch):
    import app as app_module
    monkeypatch.setenv("AUTH_ENABLED", "true")
    client = TestClient(app_module.app)   # no cookie
    assert client.get("/api/admin/assets").status_code == 401


def test_admin_assets_403_for_non_operator(monkeypatch):
    import app as app_module
    monkeypatch.setenv("AUTH_ENABLED", "true")
    client = TestClient(app_module.app)
    cookie = create_session({"email": "alice@acmetravel.com", "display_name": "Alice",
                             "tenant": "Acme", "tenant_id": "acme-travel", "role": "user"})
    client.cookies.set(SESSION_COOKIE, cookie)
    assert client.get("/api/admin/assets").status_code == 403


# ---- Workspace resource pickers (dashboards / genie spaces) ----------------

def test_admin_dashboards_shape_and_failsoft(monkeypatch):
    # Stub the SDK-backed discovery so the route test never hits a real workspace;
    # assert the route wraps it in {dashboards: [...]}.
    from server.tenants import resources
    monkeypatch.setattr(resources, "list_workspace_dashboards",
                        lambda: [{"id": "01f-abc", "name": "Some Dashboard"}])
    client = _operator_client(monkeypatch)
    res = client.get("/api/admin/dashboards")
    assert res.status_code == 200
    assert res.json() == {"dashboards": [{"id": "01f-abc", "name": "Some Dashboard"}]}


def test_admin_genie_spaces_shape(monkeypatch):
    from server.tenants import resources
    monkeypatch.setattr(resources, "list_workspace_genie_spaces",
                        lambda: [{"id": "01f-g", "name": "A Space"}])
    client = _operator_client(monkeypatch)
    res = client.get("/api/admin/genie-spaces")
    assert res.status_code == 200
    assert res.json() == {"genie_spaces": [{"id": "01f-g", "name": "A Space"}]}


def test_admin_dashboards_operator_gated(monkeypatch):
    import app as app_module
    monkeypatch.setenv("AUTH_ENABLED", "true")
    client = TestClient(app_module.app)  # no cookie
    assert client.get("/api/admin/dashboards").status_code == 401
    assert client.get("/api/admin/genie-spaces").status_code == 401


def test_list_workspace_dashboards_failsoft_on_sdk_error(monkeypatch):
    # The resources-layer helper must never raise — a broken client → [].
    from server.tenants import resources, runtime
    class _Boom:
        def __getattr__(self, n): raise RuntimeError("workspace down")
    monkeypatch.setattr(runtime, "admin_client", lambda: _Boom())
    assert resources.list_workspace_dashboards() == []
    assert resources.list_workspace_genie_spaces() == []
