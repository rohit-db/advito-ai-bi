import pytest

from server.assets import registry as areg


def test_schema_sql_defines_both_tables():
    assert "apex_asset_registry" in areg.SCHEMA_SQL
    assert "apex_asset_registry_meta" in areg.SCHEMA_SQL
    # spec stored as a single JSONB blob (seed<->DB 1:1)
    assert "spec" in areg.SCHEMA_SQL and "JSONB" in areg.SCHEMA_SQL.upper()


def test_ensure_schema_noop_when_lakebase_off(monkeypatch):
    # Mirror users.ensure_schema: guarded by lakebase.enabled(); off -> no connection attempt.
    monkeypatch.setattr(areg, "_lb_enabled", lambda: False)
    areg.ensure_schema()  # must not raise, must not touch a connection


def test_validate_asset_rejects_bad_input():
    with pytest.raises(ValueError):
        areg.validate_asset("Bad Key!", {"dashboardId": "d"})          # bad slug
    with pytest.raises(ValueError):
        areg.validate_asset("ok", {"dashboardId": ""})                  # empty id
    with pytest.raises(ValueError):
        areg.validate_asset("ok", {"dashboardId": "d", "filters": {"nope": "w"}})  # bad FilterKey
    # valid: known filter keys + empty pages allowed
    areg.validate_asset("ok", {"dashboardId": "d", "filters": {"currentPeriod": "period"}, "pages": []})


def test_validate_asset_rejects_nonstring_dashboardid_and_long_key():
    with pytest.raises(ValueError):
        areg.validate_asset("ok", {"dashboardId": 123})            # non-string id
    with pytest.raises(ValueError):
        areg.validate_asset("x" * 129, {"dashboardId": "d"})       # key too long
    # sanity: a valid string id + short key still passes
    areg.validate_asset("ok", {"dashboardId": "d", "filters": {}, "pages": []})


def test_save_and_delete_require_lakebase(monkeypatch):
    monkeypatch.setattr(areg, "_lb_enabled", lambda: False)
    with pytest.raises(RuntimeError, match="LAKEBASE_ENABLED"):
        areg.save_asset("x", {"dashboardId": "d"})
    with pytest.raises(RuntimeError, match="LAKEBASE_ENABLED"):
        areg.delete_asset("x")


def test_registry_writable_tracks_lakebase(monkeypatch):
    monkeypatch.setattr(areg, "_lb_enabled", lambda: True)
    assert areg.registry_writable() is True
    monkeypatch.setattr(areg, "_lb_enabled", lambda: False)
    assert areg.registry_writable() is False


def test_load_registry_seed_when_lakebase_off(monkeypatch):
    monkeypatch.setattr(areg, "_lb_enabled", lambda: False)
    monkeypatch.setattr(areg, "_cache", None)
    reg = areg.load_registry()
    assert "spend" in reg["assets"]  # seed path unchanged (PR3a behavior)


def test_load_registry_lakebase_override_wins(monkeypatch):
    # Lakebase on + a DISTINCT asset -> load_registry returns the Lakebase rows,
    # NOT the seed. (Non-vacuous: sentinel id absent from the seed.)
    monkeypatch.setattr(areg, "_lb_enabled", lambda: True)
    monkeypatch.setattr(
        areg, "_lakebase_list",
        lambda: [{"asset_key": "probe", "spec": {"dashboardId": "REG-ONLY", "label": "P"},
                  "sort_order": 0, "active": True}],
    )
    monkeypatch.setattr(areg, "_cache", None)
    reg = areg.load_registry()
    assert list(reg["assets"].keys()) == ["probe"]
    assert reg["assets"]["probe"]["dashboardId"] == "REG-ONLY"
    assert "spend" not in reg["assets"]  # seed did NOT leak in


def test_load_registry_omits_inactive(monkeypatch):
    monkeypatch.setattr(areg, "_lb_enabled", lambda: True)
    monkeypatch.setattr(
        areg, "_lakebase_list",
        lambda: [
            {"asset_key": "on", "spec": {"dashboardId": "A"}, "sort_order": 0, "active": True},
            {"asset_key": "off", "spec": {"dashboardId": "B"}, "sort_order": 1, "active": False},
        ],
    )
    monkeypatch.setattr(areg, "_cache", None)
    assert list(areg.load_registry()["assets"].keys()) == ["on"]


def test_app_startup_calls_asset_ensure_schema(monkeypatch):
    # Verify the startup hook calls the ASSET registry init. Stub every ensure_schema
    # the hook invokes so this stays a true unit test (no real Lakebase connection).
    import app as app_module
    called = {"assets": 0}
    monkeypatch.setattr("server.persistence.ensure_schema", lambda: None, raising=False)
    monkeypatch.setattr("server.tenants.registry.ensure_schema", lambda: None, raising=False)
    monkeypatch.setattr("server.tenants.audit.ensure_schema", lambda: None, raising=False)
    monkeypatch.setattr("server.auth.users.ensure_schema", lambda: None, raising=False)
    monkeypatch.setattr(
        "server.assets.registry.ensure_schema",
        lambda: called.__setitem__("assets", called["assets"] + 1),
    )
    app_module._ensure_lakebase_schema()
    assert called["assets"] >= 1
