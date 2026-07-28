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
