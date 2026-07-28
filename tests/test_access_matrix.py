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


def test_access_matrix_empty_sp_list_is_hermetic(monkeypatch):
    # Zero SPs -> no Databricks calls at all.
    called = {"n": 0}
    def _boom(*a, **k):
        called["n"] += 1
        raise AssertionError("_acl_entries must not be called for an empty SP list")
    monkeypatch.setattr(resources, "_acl_entries", _boom)
    assert resources.access_matrix([]) == {}
    assert called["n"] == 0


def test_permission_level_is_sdk_enum_not_bare_string():
    """Regression: grant() must use the SDK PermissionLevel enum, not the string
    "CAN_RUN". AccessControlRequest serialization calls `.value` on
    permission_level, so a bare str raises 'str' object has no attribute 'value'
    the moment a grant is actually sent (read paths never build the request, so
    the bug only surfaced on a live toggle)."""
    from databricks.sdk.service.iam import PermissionLevel
    assert resources._PERMISSION_LEVEL is PermissionLevel.CAN_RUN
    assert not isinstance(resources._PERMISSION_LEVEL, str)


def test_grant_builds_serializable_access_control_request(monkeypatch):
    """The request grant() hands the SDK must serialize (.as_dict()) without the
    'str' object has no attribute 'value' error — i.e. permission_level is an enum."""
    captured = {}

    class _FakePerms:
        def update(self, object_type, resource_id, access_control_list):
            # Serializing is exactly what the real SDK client does before the HTTP
            # call — and where the bare-string bug used to blow up.
            captured["acl"] = [a.as_dict() for a in access_control_list]

    class _FakeClient:
        permissions = _FakePerms()

    monkeypatch.setattr(resources.runtime, "admin_client", lambda: _FakeClient())
    resources.grant("sp-123", "dashboard", "dash-abc")
    assert captured["acl"] == [
        {"service_principal_name": "sp-123", "permission_level": "CAN_RUN"}
    ]
