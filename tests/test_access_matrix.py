from server.tenants import resources


def test_access_matrix_fetches_each_acl_once(monkeypatch):
    # catalog with 2 dashboards + 1 genie space -> 3 ACL fetches total, regardless
    # of how many SPs we check (proves per-resource, not per-SP-per-resource).
    monkeypatch.setattr(resources, "catalog", lambda: {
        "dashboards": [{"id": "d1", "name": "D1"}, {"id": "d2", "name": "D2"}],
        "genie_spaces": [{"id": "g1", "name": "G1"}],
    })
    fetch_calls = []

    def fake_acl(resource_type, resource_id):
        fetch_calls.append((resource_type, resource_id))
        # d1 granted to spA; g1 granted to spB; nothing else
        return [{"rt": resource_type, "rid": resource_id}]

    def fake_has(entries, sp_app_id):
        rt, rid = entries[0]["rt"], entries[0]["rid"]
        return (rid == "d1" and sp_app_id == "spA") or (rid == "g1" and sp_app_id == "spB")

    monkeypatch.setattr(resources, "_acl_entries", fake_acl)
    monkeypatch.setattr(resources, "_sp_has_access", fake_has)

    matrix = resources.access_matrix(["spA", "spB"])
    # Each of the 3 resources fetched exactly once, NOT 3*2=6.
    assert len(fetch_calls) == 3
    assert matrix["spA"]["dashboards"] == {"d1": True, "d2": False}
    assert matrix["spB"]["genie_spaces"] == {"g1": True}
    assert matrix["spA"]["genie_spaces"] == {"g1": False}


from fastapi.testclient import TestClient


def test_access_matrix_route_operator_gated(monkeypatch):
    import app as app_module
    monkeypatch.setenv("AUTH_ENABLED", "true")
    client = TestClient(app_module.app)
    assert client.get("/api/tenants/access-matrix").status_code == 401


def test_service_access_matrix_empty_when_no_tenants(monkeypatch):
    from server.tenants import service, registry as tregistry
    monkeypatch.setattr(tregistry, "list_tenants", lambda: [])
    assert service.access_matrix() == {"tenants": {}}
