import pytest


@pytest.fixture(autouse=True)
def _hermetic_env(monkeypatch):
    """Unit tests never touch a real Lakebase or the auth gate.

    This repo's .env sets LAKEBASE_ENABLED=true; without this, any test that
    resolves the asset registry (or other Lakebase-backed code) would attempt a
    real DB connection, time out, and fall back — slow and flaky. Tests that WANT
    Lakebase-on opt in explicitly by monkeypatching the relevant module's
    `_lb_enabled` / `enabled` seam (as the asset-registry Lakebase tests already do).
    """
    monkeypatch.setenv("LAKEBASE_ENABLED", "false")
    monkeypatch.delenv("AUTH_ENABLED", raising=False)
    # The module-level `LAKEBASE_ENABLED` bool in server.lakebase is baked at
    # import time; patching the env var alone won't retroactively change it.
    # Patch the live module attribute so enabled() returns False in every test.
    monkeypatch.setattr("server.lakebase.LAKEBASE_ENABLED", False, raising=False)
    yield
