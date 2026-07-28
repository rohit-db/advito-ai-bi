# PR3b-1 — Asset CRUD + Access Matrix (server) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PR3a's read-only asset registry **writable when Lakebase is on** (`apex_asset_registry` table, mirroring `users.py`), expose operator CRUD at `/api/admin/assets`, and add an efficient `GET /api/tenants/access-matrix` for the upcoming access grid — all additive, so the app behaves identically until the PR3b-2 frontend lands.

**Architecture:** Extend `server/assets/registry.py` with Lakebase-override functions (`list_assets`/`save_asset`/`delete_asset`/`registry_writable`/`ensure_schema`) that layer over the seed exactly like `server/auth/users.py` layers over `users.seed.json`. `load_registry()` (consumed by `GET /api/assets` + the 3 PR3a touchpoints) becomes Lakebase-or-seed. Seed import is **once-only at init** (a meta marker row), so an operator who deletes all assets gets an authoritative-empty registry the seed does NOT resurrect. New routes in `server/routes/assets_admin.py` mirror `server/routes/users.py`. `resources.access_matrix()` inverts the existing per-SP `tenant_access` to fetch each resource ACL once.

**Tech Stack:** FastAPI + Python + psycopg (Lakebase/Postgres) + pytest. No new dependencies.

## Global Constraints

- **Mirror `server/auth/users.py` exactly** — the Lakebase-or-seed shape (`LAKEBASE_ENABLED` branch → try Lakebase, fall back to seed on error), `ensure_schema()`, `list/save/delete`, `lakebase_writable()`. Same idioms, same fail-soft.
- **`save_asset`/`delete_asset` require Lakebase** — raise `RuntimeError("Asset management requires LAKEBASE_ENABLED=true")` when off (exactly like `save_user`/`delete_user`).
- **Once-only seed import, authoritative-empty** — the seed imports into `apex_asset_registry` exactly once (tracked by an `apex_asset_registry_meta` marker row). After that, the table is authoritative: deleting all assets yields an empty registry that STAYS empty; the seed must NOT resurrect deleted assets on the next resolve. (This is the PR3a authoritative-empty lesson, server-side.)
- **`load_registry()` return shape is unchanged**: `{"assets": {key: spec}}`, built from **active** rows ordered by `sort_order`, so PR3a consumers (`GET /api/assets`, `dashboard_ids`, `default_dashboard_id`, `catalog_dashboards`) keep working with zero changes.
- **`GET /api/assets` stays session-readable** (unchanged, PR3a). The new write surface `/api/admin/assets` is **operator-only** (`role == "operator"`), mirroring `/api/users`.
- **Validation** (server-side): `asset_key` matches `^[a-z0-9_-]+$`; `spec.dashboardId` non-empty str; `spec.filters` keys ∈ the known `FilterKey` set (`currentPeriod`, `previousPeriod`, `travelSector`, `destinationRegion`); `spec.pages` a list of `{pageId,label,summaryPrompt,suggestions[]}` (empty list allowed). Invalid → HTTP 400.
- **Isolation/secrets untouched** — the access-matrix only READS ACLs; grant/revoke stays the unchanged `POST /api/tenants/{id}/access`. Do not modify `resolve_tenant_sp`, `crypto`, or the embed path.
- **Cache correctness** — when Lakebase is ON, `load_registry()` must resolve fresh (don't serve a stale module cache after a write); when OFF, keep PR3a's seed memoization. `save_asset`/`delete_asset` clear any cache.
- **No new dependencies.** psycopg + pytest already present.
- **Commit after each task**, conventional-commit messages ending with a blank line then exactly `Co-authored-by: Isaac`. Never `--no-verify`.
- **Gate:** `python -m pytest tests/ -q` + `python -c "import app; print('ok')"` green after each task.

---

## File structure

**Modify:**
- `server/assets/registry.py` — add `apex_asset_registry` schema + `ensure_schema()`, `_lakebase_*` helpers, `list_assets`/`save_asset`/`delete_asset`/`registry_writable`, once-only seed import, and make `load_registry()` Lakebase-or-seed. Add validation helper.
- `server/assets/__init__.py` — re-export the new public names.
- `app.py` — call `server.assets.registry.ensure_schema()` in the startup hook (best-effort, like the tenant/users schema calls) + mount the new admin router.

**Create:**
- `server/routes/assets_admin.py` — operator-gated `GET/POST /api/admin/assets`, `DELETE /api/admin/assets/{asset_key}`.
- `tests/test_assets_registry_lakebase.py` — resolver precedence, once-only import, authoritative-empty, save/delete gating, validation.
- `tests/test_assets_admin_routes.py` — CRUD route operator-gating + shapes.
- `tests/test_access_matrix.py` — `resources.access_matrix` shape + "each ACL fetched once".

**Also modify:**
- `server/tenants/resources.py` — add `access_matrix(sp_app_ids)` (inverts `tenant_access`).
- `server/tenants/service.py` — add `access_matrix()` service wrapper (list tenants → SP ids → matrix).
- `server/routes/tenants.py` — add `GET /tenants/access-matrix`.

**Boundary reference (verified current code):**
- `server/auth/users.py` is the mirror: `USERS_TABLE`, `SCHEMA_SQL`, `_lakebase_list/_upsert`, `_load_json_users` (seed cache), `list_users`/`save_user`/`delete_user`/`lakebase_writable`, `ensure_schema`. `save_user` raises `RuntimeError("User management requires LAKEBASE_ENABLED=true")` when off.
- `server/lakebase.py`: `enabled()`, `connection()` (contextmanager, psycopg), `LAKEBASE_ENABLED`.
- `server/tenants/registry.py`: `list_tenants() -> list[TenantRow]` each with `.sp_app_id`, `.status`; `ensure_schema()` guarded by `enabled()`.
- `server/tenants/resources.py`: `catalog()` → `{dashboards:[{id,name}], genie_spaces:[...]}`; `_acl_entries(resource_type, resource_id)`, `_sp_has_access(entries, sp_app_id)`, `tenant_access(sp_app_id)`. Object types: `"dashboard"`, `"genie_space"`.
- `server/tenants/audit.py`: `log(action, *, tenant_id=, actor=, sp_app_id=, status="ok", detail=, latency_ms=)`; no-op when Lakebase off.
- `server/routes/users.py`: the exact operator-route pattern (`_require_operator`, `{writable}` in list, 400/404/409/500 handling).
- `app.py`: routers mounted with `app.include_router(x_router, prefix="/api")`; startup hook `_ensure_lakebase_schema()` best-effort-calls each `ensure_schema()`.

---

## Task 1: `apex_asset_registry` schema + Lakebase helpers + `ensure_schema` (once-only seed import)

**Files:**
- Modify: `server/assets/registry.py`
- Test: `tests/test_assets_registry_lakebase.py` (create)

**Interfaces:**
- Produces:
  - `ASSET_TABLE = "apex_asset_registry"`, `ASSET_META_TABLE = "apex_asset_registry_meta"`.
  - `SCHEMA_SQL` (both tables).
  - `ensure_schema() -> None` — creates tables (guarded by `lakebase.enabled()`), then runs the once-only seed import.
  - `_lakebase_list() -> list[dict]`, `_lakebase_upsert(asset_key, spec, sort_order, active) -> None`, `_lakebase_delete(asset_key) -> None`, `_seed_import_once() -> None` (internal).

This task adds the storage layer only; `list_assets`/`save_asset`/`load_registry` wiring is Task 2.

- [ ] **Step 1: Write the failing test**

Create `tests/test_assets_registry_lakebase.py`:

```python
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `python -m pytest tests/test_assets_registry_lakebase.py -v`
Expected: FAIL — `AttributeError: module ... has no attribute 'SCHEMA_SQL'` / `_lb_enabled`.

- [ ] **Step 3: Add the schema + Lakebase helpers to `registry.py`**

At the top of `server/assets/registry.py`, add the Lakebase imports (alongside the existing stdlib imports). Import `enabled` under an alias so tests can monkeypatch a module-level name:

```python
from ..lakebase import connection as _connection, enabled as _lb_enabled
```

Add the table constants + schema (after `_SEED_PATH`):

```python
ASSET_TABLE = "apex_asset_registry"
ASSET_META_TABLE = "apex_asset_registry_meta"

SCHEMA_SQL = f"""
CREATE TABLE IF NOT EXISTS {ASSET_TABLE} (
    asset_key   VARCHAR(128) PRIMARY KEY,
    spec        JSONB        NOT NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS {ASSET_META_TABLE} (
    id           INT PRIMARY KEY DEFAULT 1,
    seeded       BOOLEAN NOT NULL DEFAULT FALSE,
    seeded_at    TIMESTAMPTZ,
    CONSTRAINT {ASSET_META_TABLE}_singleton CHECK (id = 1)
);
"""
```

Add the Lakebase CRUD helpers (mirror `users._lakebase_*`), using psycopg's `Json` adapter for the JSONB column:

```python
def _lakebase_list() -> list[dict]:
    with _connection() as conn:
        cur = conn.execute(
            f"SELECT asset_key, spec, sort_order, active FROM {ASSET_TABLE} "
            "ORDER BY sort_order, asset_key"
        )
        return [
            {"asset_key": r[0], "spec": r[1], "sort_order": r[2], "active": r[3]}
            for r in cur.fetchall()
        ]


def _lakebase_upsert(asset_key: str, spec: dict, sort_order: int, active: bool) -> None:
    from psycopg.types.json import Json

    with _connection() as conn:
        conn.execute(
            f"""
            INSERT INTO {ASSET_TABLE} (asset_key, spec, sort_order, active, updated_at)
            VALUES (%s, %s, %s, %s, NOW())
            ON CONFLICT (asset_key) DO UPDATE SET
                spec       = EXCLUDED.spec,
                sort_order = EXCLUDED.sort_order,
                active     = EXCLUDED.active,
                updated_at = NOW()
            """,
            (asset_key, Json(spec), sort_order, active),
        )
        conn.commit()


def _lakebase_delete(asset_key: str) -> None:
    with _connection() as conn:
        conn.execute(f"DELETE FROM {ASSET_TABLE} WHERE asset_key = %s", (asset_key,))
        conn.commit()
```

Add the once-only seed import + `ensure_schema` (import reads the seed **file** directly, NOT the resolved registry, to avoid recursion):

```python
def _read_seed_assets() -> dict[str, Any]:
    """Parse the seed file's assets object directly (no Lakebase), fail-soft."""
    try:
        data = json.loads(Path(_SEED_PATH).read_text(encoding="utf-8"))
        assets = data.get("assets")
        return assets if isinstance(assets, dict) else {}
    except Exception as exc:  # noqa: BLE001
        logger.warning("assets seed unreadable during import (%s)", exc)
        return {}


def _seed_import_once() -> None:
    """Import the seed rows into the table EXACTLY once (guarded by the meta marker).

    After this runs, the table is authoritative — an operator deleting all assets
    yields an empty registry that the seed does NOT resurrect.
    """
    with _connection() as conn:
        conn.execute(
            f"INSERT INTO {ASSET_META_TABLE} (id, seeded) VALUES (1, FALSE) "
            "ON CONFLICT (id) DO NOTHING"
        )
        cur = conn.execute(f"SELECT seeded FROM {ASSET_META_TABLE} WHERE id = 1")
        row = cur.fetchone()
        if row and row[0]:
            return  # already seeded — never import again
        from psycopg.types.json import Json

        for i, (key, spec) in enumerate(_read_seed_assets().items()):
            conn.execute(
                f"INSERT INTO {ASSET_TABLE} (asset_key, spec, sort_order, active) "
                "VALUES (%s, %s, %s, TRUE) ON CONFLICT (asset_key) DO NOTHING",
                (key, Json(spec), i),
            )
        conn.execute(
            f"UPDATE {ASSET_META_TABLE} SET seeded = TRUE, seeded_at = NOW() WHERE id = 1"
        )
        conn.commit()


def ensure_schema() -> None:
    """Create the asset tables + run the once-only seed import (best-effort)."""
    if not _lb_enabled():
        return
    with _connection() as conn:
        conn.execute(SCHEMA_SQL)
        conn.commit()
    _seed_import_once()
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `python -m pytest tests/test_assets_registry_lakebase.py -v`
Expected: PASS (both tests).

- [ ] **Step 5: Confirm no regression + import sanity**

Run: `python -m pytest tests/ -q` and `python -c "import server.assets, app; print('ok')"`
Expected: all pass; import ok.

- [ ] **Step 6: Commit**

```bash
git add server/assets/registry.py tests/test_assets_registry_lakebase.py
git commit -m "feat(assets): apex_asset_registry schema + Lakebase helpers + once-only seed import

Co-authored-by: Isaac"
```

---

## Task 2: `list_assets`/`save_asset`/`delete_asset`/`registry_writable` + Lakebase-or-seed `load_registry`

**Files:**
- Modify: `server/assets/registry.py`
- Modify: `server/assets/__init__.py` (re-exports)
- Test: `tests/test_assets_registry_lakebase.py` (extend)

**Interfaces:**
- Consumes: Task 1's `_lakebase_list/_upsert/_delete`, `ensure_schema`, `_lb_enabled`.
- Produces:
  - `list_assets() -> list[dict]` — resolved (Lakebase-or-seed), each `{asset_key, spec, sort_order, active}`. Lakebase-on → active+inactive rows ordered by `sort_order`; off → seed assets (all active, `sort_order` = file order).
  - `save_asset(asset_key, spec, sort_order=0, active=True) -> None` — validates then upserts; raises `RuntimeError("Asset management requires LAKEBASE_ENABLED=true")` when off.
  - `delete_asset(asset_key) -> None` — same Lakebase-required guard.
  - `registry_writable() -> bool` — `_lb_enabled()`.
  - `validate_asset(asset_key, spec) -> None` — raises `ValueError` on invalid input.
  - `load_registry()` — now Lakebase-or-seed; return shape unchanged (`{"assets": {key: spec}}`, **active** rows only, ordered).

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_assets_registry_lakebase.py`:

```python
import pytest


def test_validate_asset_rejects_bad_input():
    with pytest.raises(ValueError):
        areg.validate_asset("Bad Key!", {"dashboardId": "d"})          # bad slug
    with pytest.raises(ValueError):
        areg.validate_asset("ok", {"dashboardId": ""})                  # empty id
    with pytest.raises(ValueError):
        areg.validate_asset("ok", {"dashboardId": "d", "filters": {"nope": "w"}})  # bad FilterKey
    # valid: known filter keys + empty pages allowed
    areg.validate_asset("ok", {"dashboardId": "d", "filters": {"currentPeriod": "period"}, "pages": []})


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
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `python -m pytest tests/test_assets_registry_lakebase.py -v`
Expected: the new tests FAIL — `validate_asset`/`save_asset`/`registry_writable`/`list_assets` not defined; `load_registry` ignores Lakebase.

- [ ] **Step 3: Add validation + public functions + rewire `load_registry`**

In `server/assets/registry.py`, add the known filter-key set + validation:

```python
# The FilterKey vocabulary lives in frontend/src/config.ts FILTERS; the server
# validates seed/registry `filters` maps against the same known set.
_KNOWN_FILTER_KEYS = {"currentPeriod", "previousPeriod", "travelSector", "destinationRegion"}
_ASSET_KEY_RE = re.compile(r"^[a-z0-9_-]+$")


def validate_asset(asset_key: str, spec: dict) -> None:
    """Raise ValueError if the asset_key/spec is malformed."""
    if not asset_key or not _ASSET_KEY_RE.match(asset_key):
        raise ValueError("asset_key must match [a-z0-9_-]+")
    if not isinstance(spec, dict):
        raise ValueError("spec must be an object")
    if not str(spec.get("dashboardId") or "").strip():
        raise ValueError("spec.dashboardId is required")
    filters = spec.get("filters") or {}
    if not isinstance(filters, dict):
        raise ValueError("spec.filters must be an object")
    bad = set(filters) - _KNOWN_FILTER_KEYS
    if bad:
        raise ValueError(f"unknown filter key(s): {sorted(bad)}")
    pages = spec.get("pages", [])
    if not isinstance(pages, list):
        raise ValueError("spec.pages must be a list")
```

Add `import re` to the imports. Then the public functions:

```python
def registry_writable() -> bool:
    return _lb_enabled()


def list_assets() -> list[dict]:
    """Resolved assets (Lakebase-or-seed): [{asset_key, spec, sort_order, active}]."""
    if _lb_enabled():
        try:
            return _lakebase_list()
        except Exception as e:  # noqa: BLE001
            logger.warning("Lakebase asset list failed, using seed: %s", e)
    return [
        {"asset_key": k, "spec": v, "sort_order": i, "active": True}
        for i, (k, v) in enumerate(_read_seed_assets().items())
    ]


def save_asset(asset_key: str, spec: dict, sort_order: int = 0, active: bool = True) -> None:
    validate_asset(asset_key, spec)
    if not _lb_enabled():
        raise RuntimeError("Asset management requires LAKEBASE_ENABLED=true")
    ensure_schema()
    _lakebase_upsert(asset_key, spec, sort_order, active)
    global _cache
    _cache = None  # invalidate resolved cache


def delete_asset(asset_key: str) -> None:
    if not _lb_enabled():
        raise RuntimeError("Asset management requires LAKEBASE_ENABLED=true")
    ensure_schema()
    _lakebase_delete(asset_key)
    global _cache
    _cache = None
```

Rewire `load_registry()` so Lakebase (active rows, ordered) wins, seed is the fallback. Keep the seed-path memoization; when Lakebase is on, resolve fresh (don't serve a stale cache after writes):

```python
def load_registry() -> dict[str, Any]:
    """Resolved registry {"assets": {key: spec}} — Lakebase-or-seed; never raises."""
    if _lb_enabled():
        try:
            rows = _lakebase_list()
            return {"assets": {r["asset_key"]: r["spec"] for r in rows if r["active"]}}
        except Exception as e:  # noqa: BLE001
            logger.warning("Lakebase registry resolve failed, using seed: %s", e)
    # seed path (PR3a behavior, memoized)
    global _cache
    if _cache is not None:
        return _cache
    _cache = {"assets": _read_seed_assets()}
    return _cache
```

(Note: `_read_seed_assets` already fail-soft-returns `{}`; this preserves the PR3a empty-on-missing behavior. The prior inline try/except in `load_registry` is now centralized in `_read_seed_assets`.)

- [ ] **Step 4: Update `__init__.py` re-exports**

In `server/assets/__init__.py`, add the new names to the import + `__all__`:

```python
from .registry import (
    load_registry,
    dashboard_ids,
    default_dashboard_id,
    catalog_dashboards,
    list_assets,
    save_asset,
    delete_asset,
    registry_writable,
    validate_asset,
    ensure_schema,
)

__all__ = [
    "load_registry", "dashboard_ids", "default_dashboard_id", "catalog_dashboards",
    "list_assets", "save_asset", "delete_asset", "registry_writable",
    "validate_asset", "ensure_schema",
]
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `python -m pytest tests/test_assets_registry_lakebase.py -v`
Expected: all PASS.

- [ ] **Step 6: Confirm PR3a behavior preserved + full suite**

Run: `python -m pytest tests/ -q` and `python -c "import server.assets as a; print('spend' in a.load_registry()['assets'])"`
Expected: all pass; prints `True` (seed still resolves with Lakebase off, PR3a's `test_assets.py` still green).

- [ ] **Step 7: Commit**

```bash
git add server/assets/registry.py server/assets/__init__.py tests/test_assets_registry_lakebase.py
git commit -m "feat(assets): list/save/delete_asset + validation + Lakebase-or-seed load_registry

Co-authored-by: Isaac"
```

---

## Task 3: `ensure_schema` wired into app startup

**Files:**
- Modify: `app.py` (startup hook)
- Test: `tests/test_assets_registry_lakebase.py` (extend — import-safety only)

**Interfaces:**
- Consumes: `server.assets.registry.ensure_schema` (Task 1).

- [ ] **Step 1: Write the failing test**

Append to `tests/test_assets_registry_lakebase.py`:

```python
def test_app_startup_calls_asset_ensure_schema(monkeypatch):
    # The startup hook must best-effort-call assets.ensure_schema (like users/tenants).
    import app as app_module
    called = {"n": 0}
    monkeypatch.setattr("server.assets.registry.ensure_schema", lambda: called.__setitem__("n", called["n"] + 1))
    # Re-run the startup hook directly.
    app_module._ensure_lakebase_schema()
    assert called["n"] >= 1
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `python -m pytest tests/test_assets_registry_lakebase.py::test_app_startup_calls_asset_ensure_schema -v`
Expected: FAIL — the startup hook doesn't call assets.ensure_schema yet.

- [ ] **Step 3: Add the call to the startup hook**

In `app.py`'s `_ensure_lakebase_schema()`, add a best-effort block mirroring the existing users/tenant blocks:

```python
    # Asset registry (dashboard specs); best-effort, no-op without Lakebase.
    try:
        from server.assets import registry as _asset_registry

        _asset_registry.ensure_schema()
    except Exception as exc:  # noqa: BLE001
        import logging

        logging.getLogger("app").warning("Asset registry schema init skipped: %s", exc)
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `python -m pytest tests/test_assets_registry_lakebase.py::test_app_startup_calls_asset_ensure_schema -v`
Expected: PASS.

- [ ] **Step 5: Full suite + import sanity**

Run: `python -m pytest tests/ -q` and `python -c "import app; print('ok')"`
Expected: all pass; ok.

- [ ] **Step 6: Commit**

```bash
git add app.py tests/test_assets_registry_lakebase.py
git commit -m "feat(assets): init asset registry schema on app startup (best-effort)

Co-authored-by: Isaac"
```

---

## Task 4: `/api/admin/assets` operator CRUD routes

**Files:**
- Create: `server/routes/assets_admin.py`
- Modify: `app.py` (mount the router)
- Test: `tests/test_assets_admin_routes.py` (create)

**Interfaces:**
- Consumes: `server.assets.registry.{list_assets,save_asset,delete_asset,registry_writable,validate_asset}`; `server.tenants.audit.log`; `verify_session`/`SESSION_COOKIE`.
- Produces routes (mounted under `/api`):
  - `GET /admin/assets` → `{"assets": [ {asset_key, spec, sort_order, active} ], "writable": bool}` (operator-only).
  - `POST /admin/assets` body `{asset_key, spec, sort_order?, active?}` → `{"asset": {...}}`; 400 on validation error, 403 non-operator, 500 on Lakebase failure.
  - `DELETE /admin/assets/{asset_key}` → `{"ok": true, "asset_key": ...}`.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_assets_admin_routes.py`:

```python
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
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `python -m pytest tests/test_assets_admin_routes.py -v`
Expected: FAIL — 404 (routes not mounted).

- [ ] **Step 3: Create the router**

Create `server/routes/assets_admin.py` (mirror `server/routes/users.py`):

```python
"""Operator API for the dashboard asset registry.

Manages the assets exposed via GET /api/assets. Editing requires Lakebase; with
it off the registry is read-only (the seed file is the source). Mirrors the
/api/users operator pattern.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..assets import registry as assets_registry
from ..auth.sessions import SESSION_COOKIE, verify_session
from ..tenants import audit

router = APIRouter()


def _require_operator(request: Request) -> dict:
    ident = verify_session(request.cookies.get(SESSION_COOKIE))
    if not ident:
        raise HTTPException(status_code=401, detail="authentication required")
    if ident.get("role") != "operator":
        raise HTTPException(status_code=403, detail="operator role required")
    return ident


class AssetIn(BaseModel):
    asset_key: str
    spec: dict[str, Any]
    sort_order: int = 0
    active: bool = True


@router.get("/admin/assets")
def list_admin_assets(request: Request):
    _require_operator(request)
    return {"assets": assets_registry.list_assets(), "writable": assets_registry.registry_writable()}


@router.post("/admin/assets")
def save_admin_asset(request: Request, body: AssetIn):
    ident = _require_operator(request)
    try:
        assets_registry.validate_asset(body.asset_key, body.spec)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    try:
        assets_registry.save_asset(body.asset_key, body.spec, body.sort_order, body.active)
    except RuntimeError as e:  # Lakebase off
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e
    audit.log("asset_save", actor=ident.get("email"), status="ok", detail=body.asset_key)
    return {"asset": {"asset_key": body.asset_key, "spec": body.spec,
                      "sort_order": body.sort_order, "active": body.active}}


@router.delete("/admin/assets/{asset_key}")
def delete_admin_asset(request: Request, asset_key: str):
    ident = _require_operator(request)
    try:
        assets_registry.delete_asset(asset_key)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e
    audit.log("asset_delete", actor=ident.get("email"), status="ok", detail=asset_key)
    return {"ok": True, "asset_key": asset_key}
```

- [ ] **Step 4: Mount the router in `app.py`**

After the users router mount, add:

```python
from server.routes.assets_admin import router as assets_admin_router
app.include_router(assets_admin_router, prefix="/api")
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `python -m pytest tests/test_assets_admin_routes.py -v`
Expected: all PASS.

- [ ] **Step 6: Confirm operator-gating works when AUTH is on**

Add one gating test to `tests/test_assets_admin_routes.py`:

```python
def test_admin_assets_gated_when_auth_on(monkeypatch):
    import app as app_module
    monkeypatch.setenv("AUTH_ENABLED", "true")
    client = TestClient(app_module.app)
    assert client.get("/api/admin/assets").status_code == 401  # no session cookie
```

Run: `python -m pytest tests/test_assets_admin_routes.py -v`
Expected: PASS (401 without a session).

- [ ] **Step 7: Full suite + import sanity**

Run: `python -m pytest tests/ -q` and `python -c "import app; print('ok')"`
Expected: all pass; ok.

- [ ] **Step 8: Commit**

```bash
git add server/routes/assets_admin.py app.py tests/test_assets_admin_routes.py
git commit -m "feat(assets): operator CRUD routes at /api/admin/assets

Co-authored-by: Isaac"
```

---

## Task 5: `resources.access_matrix` + `service.access_matrix` + `GET /api/tenants/access-matrix`

**Files:**
- Modify: `server/tenants/resources.py` (add `access_matrix`)
- Modify: `server/tenants/service.py` (add `access_matrix` wrapper)
- Modify: `server/routes/tenants.py` (add the route)
- Test: `tests/test_access_matrix.py` (create)

**Interfaces:**
- Consumes: `resources.catalog()`, `resources._acl_entries`, `resources._sp_has_access`; `registry.list_tenants()`.
- Produces:
  - `resources.access_matrix(sp_app_ids: list[str]) -> dict` — `{sp_app_id: {dashboards:{id:bool}, genie_spaces:{id:bool}}}`, fetching **each resource ACL once** (not per SP).
  - `service.access_matrix() -> dict` — `{"tenants": {tenant_id: {sp_app_id, access:{...}}}}` for all registered tenants.
  - `GET /api/tenants/access-matrix` (operator-only) → `service.access_matrix()`.

- [ ] **Step 1: Write the failing test**

Create `tests/test_access_matrix.py`:

```python
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `python -m pytest tests/test_access_matrix.py -v`
Expected: FAIL — `AttributeError: ... has no attribute 'access_matrix'`.

- [ ] **Step 3: Add `access_matrix` to `resources.py`**

In `server/tenants/resources.py`, add (after `tenant_access`):

```python
def access_matrix(sp_app_ids: list[str]) -> dict:
    """Access for MANY SPs at once, fetching each resource ACL exactly once.

    Returns ``{sp_app_id: {dashboards:{id:bool}, genie_spaces:{id:bool}}}``. Cost
    scales with the number of resources, not tenants*resources — the right shape
    for the admin access grid.
    """
    cat = catalog()
    # Fetch each resource ACL once.
    dash_acls = {d["id"]: _acl_entries("dashboard", d["id"]) for d in cat["dashboards"]}
    space_acls = {s["id"]: _acl_entries("genie_space", s["id"]) for s in cat["genie_spaces"]}
    out: dict = {}
    for sp in sp_app_ids:
        out[sp] = {
            "dashboards": {rid: _sp_has_access(acl, sp) for rid, acl in dash_acls.items()},
            "genie_spaces": {rid: _sp_has_access(acl, sp) for rid, acl in space_acls.items()},
        }
    return out
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `python -m pytest tests/test_access_matrix.py -v`
Expected: PASS (3 fetches, correct matrix).

- [ ] **Step 5: Add the service wrapper + route**

In `server/tenants/service.py`, add (near `get_access`/`set_access`):

```python
def access_matrix() -> dict:
    """Resource access for every registered tenant SP (one ACL fetch per resource)."""
    rows = registry.list_tenants()
    sp_by_tenant = {r.tenant_id: r.sp_app_id for r in rows}
    matrix = resources.access_matrix(list(sp_by_tenant.values()))
    return {
        "tenants": {
            tid: {"sp_app_id": sp, "access": matrix.get(sp, {"dashboards": {}, "genie_spaces": {}})}
            for tid, sp in sp_by_tenant.items()
        }
    }
```

In `server/routes/tenants.py`, add the route (near the other `/tenants/...` GETs). **Place it BEFORE the `/tenants/{tenant_id}/access` route is irrelevant (distinct path), but keep it beside `/tenants/resources`:**

```python
@router.get("/tenants/access-matrix")
def tenant_access_matrix(request: Request):
    """Access for ALL tenants at once (for the admin access grid)."""
    _require_operator(request)
    try:
        return service.access_matrix()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 6: Test the service wrapper + route (Lakebase-off → empty tenants)**

Append to `tests/test_access_matrix.py`:

```python
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
```

Run: `python -m pytest tests/test_access_matrix.py -v`
Expected: all PASS.

- [ ] **Step 7: Full suite + import sanity**

Run: `python -m pytest tests/ -q` and `python -c "import app; print('ok')"`
Expected: all pass; ok.

- [ ] **Step 8: Commit**

```bash
git add server/tenants/resources.py server/tenants/service.py server/routes/tenants.py tests/test_access_matrix.py
git commit -m "feat(tenants): access-matrix endpoint (one ACL fetch per resource)

Co-authored-by: Isaac"
```

---

## Self-review notes

- **Spec coverage (Sections 2–3):**
  - `apex_asset_registry` table, spec as JSONB ✓ (T1). `apex_asset_registry_meta` marker + once-only import ✓ (T1 `_seed_import_once`).
  - `list_assets`/`save_asset`/`delete_asset`/`registry_writable` mirroring users.py ✓ (T2). `save/delete` require Lakebase ✓ (T2, tested).
  - Once-only import + **authoritative-empty** — the import is guarded by the `seeded` marker, NOT "table empty", so delete-all stays empty ✓ (T1). (A dedicated Lakebase-integration test of delete-all-persists is noted below as ⚠️ — it needs a live DB; the marker logic is unit-covered by the seeded-guard branch.)
  - `load_registry()` Lakebase-or-seed, active-only, ordered, shape unchanged ✓ (T2, non-vacuous override test). PR3a consumers unaffected ✓ (T2 Step 6 + existing `test_assets.py`).
  - Validation (slug, dashboardId, FilterKey set, pages list) ✓ (T2 `validate_asset`).
  - `GET /api/admin/assets` + `{writable}`, `POST`, `DELETE`, operator-gated, audited ✓ (T4). `/api/assets` read path untouched ✓ (not modified).
  - `GET /api/tenants/access-matrix` + `resources.access_matrix` fetching each ACL once ✓ (T5, non-vacuous fetch-count test). Grant/revoke path unchanged ✓ (not modified).
- **⚠️ Cannot fully unit-test without a live Lakebase:** the actual DB round-trip (`_lakebase_upsert`/`_seed_import_once` against Postgres) and the true delete-all-persists behavior. Mitigation: the logic branches (`_lb_enabled` gating, the `seeded` marker guard, active filtering, the resolve precedence) are all unit-tested via monkeypatch; the SQL mirrors the proven `users.py`/`registry.py` patterns verbatim. The controller's manual check (PR3b spec Section 5) exercises the live path. This is the same test posture PR3a used for its Lakebase-touching code.
- **Placeholder scan:** none — every step has runnable code/commands.
- **Type consistency:** `list_assets()` row dict `{asset_key, spec, sort_order, active}` is consistent across T2 (definition), T4 (route passthrough), and the `_lakebase_list` producer (T1). `access_matrix(sp_app_ids)` return shape `{sp: {dashboards, genie_spaces}}` consistent T5 resources→service→route. `save_asset(asset_key, spec, sort_order=0, active=True)` signature consistent T2↔T4.
- **Additive/identical-behavior:** T1–T3 add storage + startup wiring (dormant when Lakebase off — the seed path is byte-identical to PR3a). T4–T5 add new routes. No existing route changes; `GET /api/assets` and the 3 PR3a touchpoints keep working. The app behaves identically until PR3b-2 consumes these.
- **Ordering:** T1 (schema/helpers) → T2 (public fns + load_registry rewire, the one behavior-sensitive change) → T3 (startup) → T4 (CRUD routes) → T5 (access-matrix, independent of T1–T4). Each independently testable.
- **Out of scope (PR3b-2):** AdminLayout, AssetsPage, structured editor, the access grid UI, deleting AccessDialog. PR3b-1 is server-only.
