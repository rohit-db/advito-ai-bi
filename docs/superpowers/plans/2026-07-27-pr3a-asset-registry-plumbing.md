# PR3a — Asset Registry Plumbing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard/Genie asset spec a first-class, file-backed registry (`server/assets/dashboards.seed.json`) that the server and frontend both resolve, retiring `config.ts` `DASHBOARDS` — with the app behaving **identically** afterward (no visible admin change; that's PR3b).

**Architecture:** A server-owned seed file is the single source of truth for dashboard assets (id, filter wiring, pages, per-page Genie prompts). A new `server/assets/` module resolves it (fail-soft, mirroring `server/auth/users.py`) and exposes it via `GET /api/assets`. Three server touchpoints (`resources.catalog`, `service.grant_dashboard_access`, `embed` default id) derive dashboard ids from the resolved registry, with today's env vars kept as fallbacks. On the frontend, a boot-time `RegistryProvider` (sibling to `ThemeProvider`) fetches `/api/assets` once, falls back to a **bundled copy** of the same seed if the fetch fails, gates the app shell until resolved, and exposes the registry via `useRegistry()` so every downstream consumer reads it **synchronously**.

**Tech Stack:** FastAPI + Python (pytest) on the server; React 19 + TypeScript + Vite 7 + Vitest 3 on the frontend. Brand tokens from `brand.config.json` (PR1) already available. No new dependencies.

## Global Constraints

- **Governing tenet — minimal · config-driven · agent-ready.** One-hop "change X → edit Y". The editable source of truth is a **file in the repo** an agent can read/edit (`server/assets/dashboards.seed.json`), not runtime DB state.
- **The app must behave IDENTICALLY after PR3a.** Same dashboards, same pages, same filters, same Genie prompts, same nav. PR3a is pure plumbing — **no visible admin change** (admin IA is PR3b).
- **Registry becomes the single source; env vars remain fallbacks.** `DASHBOARD_IDS`, `RESOURCE_DASHBOARDS`, and the `DASHBOARD_URL`-derived default are demoted to fallbacks the resolver uses only when the registry yields nothing. Never remove them.
- **Genie SPACE id stays server config.** Only dashboard **specs + per-page prompts** move to the seed. `GENIE_SPACE_ID` (server-side, per-tenant-overridable in `genie_mcp/auth.py`) and `grant_genie_access` are **out of scope** — do not touch them. The frontend `GENIE_SPACE_ID` const in `config.ts` has zero importers; leave it in place (removing it is optional cleanup, not required).
- **`FILTERS` catalog + `FilterKey` type STAY in `frontend/src/config.ts`** — filter render vocabulary is a code concern. The registry's per-asset `filters` map only *references* those keys.
- **`ROUTES` STAYS in `frontend/src/config.ts`** for nav (order, icon, section, label, non-dashboard pages). A dashboard route references a registry key via its `dashboard` field. `ROUTES` loses its inline `pages`/`genie` (those move to the registry); it keeps `dashboard`.
- **Fail-soft everywhere (AGENTS.md invariant).** Server registry resolve returns an empty/default registry (never raises) on a missing/bad seed. Frontend provider falls back to the bundled seed if `GET /api/assets` fails — the app always renders. Preserve Lakebase-off and auth-off behavior.
- **Load-bearing isolation untouched.** The UC row filter, `resolve_tenant_sp` fallback-to-app-SP-on-None, and SP secret handling are not in scope — do not modify them.
- **`GET /api/assets` is readable by any authenticated session** (all users need the registry to render). No operator gate (that's for the PR3b CRUD endpoints). It must not 500 when Lakebase is off.
- **No new dependencies.** pytest + Vitest 3 already exist.
- **Commit after each task**, conventional-commit messages, ending with a blank line then exactly `Co-authored-by: Isaac`. Never use `--no-verify`.
- **Build/test gates:** `python -m pytest tests/ -q` (server) and, for frontend-touching tasks, `cd frontend && npx tsc -b && npx vite build` + `npx vitest run`.

---

## File structure

**Create:**
- `server/assets/__init__.py` — package marker + public re-exports.
- `server/assets/registry.py` — seed loader + derivations (`load_registry`, `dashboard_ids`, `default_dashboard_id`, `catalog_dashboards`). Fail-soft. Mirrors `server/auth/users.py`'s file-first shape.
- `server/assets/dashboards.seed.json` — the seed (two view-keyed assets: `spend`, `sustainability`), seeded from today's `config.ts` `DASHBOARDS` + `ROUTES` Genie wiring.
- `tests/test_assets.py` — pytest for the loader, derivations, fail-soft, and `GET /api/assets`.
- `frontend/src/registry/types.ts` — `AssetPage`, `AssetSpec`, `Registry` types.
- `frontend/src/registry/seed.ts` — typed import of the **bundled** seed (fail-soft copy) via the `@dashboards-seed` alias.
- `frontend/src/registry/RegistryProvider.tsx` — boot-time fetch + bundled-seed fallback + shell skeleton + context.
- `frontend/src/registry/useRegistry.ts` — `useRegistry()` + `useDashboardAsset(key)` hooks.
- `frontend/src/registry/RegistryProvider.test.tsx` — vitest for fetch-wins + fallback-on-failure.
- `frontend/src/registry/seed.test.ts` — vitest asserting the bundled seed shape.

**Modify:**
- `server/routes/api.py` — add `GET /assets`.
- `server/tenants/resources.py` — `catalog()` derives dashboards from the registry (env fallback preserved).
- `server/tenants/service.py` — `grant_dashboard_access()` derives ids from the registry (env fallback preserved).
- `server/routes/embed.py` — default dashboard id from the registry (env/`DASHBOARD_URL` fallback preserved).
- `frontend/vite.config.ts` — add the `@dashboards-seed` alias.
- `frontend/src/vite-env.d.ts` — add `declare module "@dashboards-seed"`.
- `frontend/src/main.tsx` — mount `RegistryProvider` (inside `ThemeProvider`, wrapping `App`).
- `frontend/src/config.ts` — remove `DASHBOARDS`, `getDashboardById`, `getDashboard`, `getDashboardGenie`, `DashboardGenieConfig`, the `SPEND_GENIE`/`SUSTAINABILITY_GENIE`/`CARBON_FORECAST_GENIE` consts, and `PageConfig`; slim `RouteConfig` (drop `pages`/`genie`, keep `dashboard`); **keep** `DashboardSpec`, `FILTERS`, `FilterKey`, `FilterState`, the embed-URL helpers, `filtersToContext`, `ROUTES`, KPI/persistence helpers.
- `frontend/src/App.tsx` — resolve the asset + pages + Genie from the registry (via `useRegistry`) instead of `getDashboard`/`getDashboardGenie`/`route.pages`.
- `frontend/src/pages/CustomDashboard.tsx` — accept the registry asset (structurally a `DashboardSpec`) for its `spec`/`pages`.
- `docs/customizing.md` + `AGENTS.md` — update the "Change X → edit Y" rows; document the seed + the FILTERS/ROUTES seam.

**Boundary reference — who reads what today (verified):**
- `DASHBOARDS`/`getDashboardById`: no external importers (only `config.ts` self-refs).
- `getDashboard`, `getDashboardGenie`, `getSupportedFilterKeys`, `filtersToContext`: `App.tsx`.
- `DashboardSpec`, `buildTokenEmbedUrl`, `shouldPassEmbedFilters`: `CustomDashboard.tsx`.
- `ROUTES`: `App.tsx`, `Sidebar.tsx`, `Header.tsx`, `Placeholder.tsx` — the last three read only nav fields (`path`/`label`/`icon`/`section`/`mode`), never `pages`/`genie`/`dashboard`.
- `FILTERS`: `FilterBar.tsx`, `PreferencesPage.tsx`.

---

## Task 1: Server `assets` module + seed file

**Files:**
- Create: `server/assets/__init__.py`
- Create: `server/assets/registry.py`
- Create: `server/assets/dashboards.seed.json`
- Test: `tests/test_assets.py` (create)

**Interfaces:**
- Produces:
  - `load_registry() -> dict` — `{"assets": {key: assetDict}}`; fail-soft to `{"assets": {}}` on missing/bad JSON.
  - `dashboard_ids() -> list[str]` — deduped physical dashboard ids across all assets, order-preserving.
  - `default_dashboard_id() -> str | None` — the first asset's `dashboardId`, or `None` when empty.
  - `catalog_dashboards() -> list[dict]` — `[{"id": str, "name": str}]`, deduped by id (name from the first asset carrying that id's `label`).

- [ ] **Step 1: Write the seed file**

Create `server/assets/dashboards.seed.json`. Two assets (`spend`, `sustainability`) over the one physical dashboard id, seeded verbatim from `config.ts` `DASHBOARDS.apex` + the `ROUTES` Genie wiring (SPEND_GENIE, SUSTAINABILITY_GENIE, CARBON_FORECAST_GENIE):

```json
{
  "_note": "Dashboard asset registry (seed / JSON fallback). Server-owned source of truth for AI/BI dashboard specs + per-page Genie prompts, resolved by server/assets/registry.py and exposed via GET /api/assets. The frontend bundles a copy for fail-soft. Filter render vocabulary (FilterKey) lives in frontend/src/config.ts FILTERS; the `filters` map here only references those keys. Nav (order/icon/section) lives in config.ts ROUTES, which references an asset by key via its `dashboard` field.",
  "assets": {
    "spend": {
      "label": "Spend",
      "dashboardId": "01f1271698161d42b3c66528415775e8",
      "globalFilterPage": "54194f59",
      "filters": {
        "currentPeriod": "period",
        "previousPeriod": "previous_period",
        "travelSector": "tsector",
        "destinationRegion": "dest_region"
      },
      "pages": [
        {
          "pageId": "summary",
          "label": "Summary",
          "summaryPrompt": "Write a concise executive summary of corporate travel SPEND for the current period. Cover total spend, the top spend categories, the top destinations, and the most significant year-over-year changes. Use specific numbers and keep it to a few short paragraphs.",
          "suggestions": [
            "Total spend by category for 2025?",
            "Top 10 destinations by gross spend USD?",
            "Compare spend 2025 vs 2024 by travel sector?"
          ]
        },
        {
          "pageId": "carbon_forecasting",
          "label": "Carbon Forecasting",
          "summaryPrompt": "Summarize the carbon emissions forecast: the projected CO2 emissions trend, the key drivers behind it, and how the trajectory compares to the current period. Use specific numbers.",
          "suggestions": [
            "What is the projected CO2 emissions trend?",
            "Which categories drive future emissions most?",
            "How do forecasted emissions compare to last year?"
          ]
        }
      ]
    },
    "sustainability": {
      "label": "Sustainability",
      "dashboardId": "01f1271698161d42b3c66528415775e8",
      "globalFilterPage": "54194f59",
      "filters": {
        "currentPeriod": "period",
        "previousPeriod": "previous_period",
        "travelSector": "tsector",
        "destinationRegion": "dest_region"
      },
      "pages": [
        {
          "pageId": "summary",
          "label": "Summary",
          "summaryPrompt": "Write a concise executive summary of travel SUSTAINABILITY for the current period. Cover total CO2 emissions, emissions by travel category, the most carbon-intensive categories or destinations, and notable year-over-year changes. Use specific numbers and keep it to a few short paragraphs.",
          "suggestions": [
            "Total emissions by category for 2025?",
            "Top 5 countries by CO2 emissions?",
            "What is the emissions per km for Air travel?"
          ]
        },
        {
          "pageId": "carbon_forecasting",
          "label": "Carbon Forecasting",
          "summaryPrompt": "Summarize the carbon emissions forecast: the projected CO2 emissions trend, the key drivers behind it, and how the trajectory compares to the current period. Use specific numbers.",
          "suggestions": [
            "What is the projected CO2 emissions trend?",
            "Which categories drive future emissions most?",
            "How do forecasted emissions compare to last year?"
          ]
        }
      ]
    }
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/test_assets.py`:

```python
import json
from pathlib import Path

from server.assets import registry as assets


def test_load_registry_has_seed_assets():
    reg = assets.load_registry()
    a = reg["assets"]
    assert "spend" in a and "sustainability" in a
    assert a["spend"]["label"] == "Spend"
    assert a["spend"]["dashboardId"] == "01f1271698161d42b3c66528415775e8"
    # per-page Genie prompts moved off ROUTES into the seed
    spend_summary = next(p for p in a["spend"]["pages"] if p["pageId"] == "summary")
    assert "SPEND" in spend_summary["summaryPrompt"].upper()
    assert len(spend_summary["suggestions"]) == 3


def test_dashboard_ids_are_deduped():
    # spend + sustainability share one physical dashboard id -> one entry
    assert assets.dashboard_ids() == ["01f1271698161d42b3c66528415775e8"]


def test_default_dashboard_id():
    assert assets.default_dashboard_id() == "01f1271698161d42b3c66528415775e8"


def test_catalog_dashboards_shape():
    cat = assets.catalog_dashboards()
    assert cat == [{"id": "01f1271698161d42b3c66528415775e8", "name": "Spend"}]


def test_load_registry_failsoft_on_missing_file(monkeypatch, tmp_path):
    monkeypatch.setattr(assets, "_SEED_PATH", str(tmp_path / "nope.json"))
    assets._cache = None  # bypass any cached parse
    reg = assets.load_registry()
    assert reg == {"assets": {}}
    assert assets.dashboard_ids() == []
    assert assets.default_dashboard_id() is None


def test_load_registry_failsoft_on_bad_json(monkeypatch, tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text("{ not valid json ")
    monkeypatch.setattr(assets, "_SEED_PATH", str(bad))
    assets._cache = None
    assert assets.load_registry() == {"assets": {}}
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `python -m pytest tests/test_assets.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'server.assets'`.

- [ ] **Step 4: Implement the module**

Create `server/assets/__init__.py`:

```python
"""Dashboard asset registry (server-owned source of truth).

The AI/BI dashboard specs + per-page Genie prompts the app knows about live in
``dashboards.seed.json`` (file-first, fail-soft) — mirroring the ``users.py``
seed pattern. Both the server (grants, resource catalog, embed default) and the
frontend (via ``GET /api/assets``) resolve from here, so "add/change a dashboard"
is a one-file edit. An optional Lakebase override table lands in PR3b; today the
seed is the resolved registry.
"""
from .registry import (
    load_registry,
    dashboard_ids,
    default_dashboard_id,
    catalog_dashboards,
)

__all__ = [
    "load_registry",
    "dashboard_ids",
    "default_dashboard_id",
    "catalog_dashboards",
]
```

Create `server/assets/registry.py`:

```python
"""Resolve the dashboard asset registry from the seed file (fail-soft).

Precedence mirrors ``server/auth/users.py``: a repo seed file is the default
source; a Lakebase override table can layer on later (PR3b). This module is the
single seam the server uses for dashboard ids (grants, resource catalog, embed
default), and it backs ``GET /api/assets`` for the frontend.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger("server.assets.registry")

# Repo-relative seed. Override with ASSETS_SEED_FILE.
_DEFAULT_SEED = str(Path(__file__).resolve().parent / "dashboards.seed.json")
_SEED_PATH = os.environ.get("ASSETS_SEED_FILE", _DEFAULT_SEED).strip() or _DEFAULT_SEED

_EMPTY: dict[str, Any] = {"assets": {}}
_cache: dict[str, Any] | None = None


def load_registry() -> dict[str, Any]:
    """Return the resolved registry ``{"assets": {key: spec}}``; never raises."""
    global _cache
    if _cache is not None:
        return _cache
    try:
        data = json.loads(Path(_SEED_PATH).read_text(encoding="utf-8"))
        assets = data.get("assets")
        if not isinstance(assets, dict):
            raise ValueError("seed missing an 'assets' object")
        _cache = {"assets": assets}
    except FileNotFoundError:
        logger.warning("assets seed not found at %s; empty registry", _SEED_PATH)
        _cache = {"assets": {}}
    except Exception as exc:  # noqa: BLE001 — fail soft
        logger.warning("assets seed unreadable (%s); empty registry", exc)
        _cache = {"assets": {}}
    return _cache


def _assets() -> dict[str, Any]:
    return load_registry().get("assets", {})


def dashboard_ids() -> list[str]:
    """Deduped physical dashboard ids across all assets, order-preserving."""
    out: list[str] = []
    for spec in _assets().values():
        did = (spec or {}).get("dashboardId")
        if did and did not in out:
            out.append(did)
    return out


def default_dashboard_id() -> str | None:
    """The first asset's dashboard id, or None when the registry is empty."""
    ids = dashboard_ids()
    return ids[0] if ids else None


def catalog_dashboards() -> list[dict]:
    """``[{id, name}]`` for the grantable-resource catalog, deduped by id."""
    out: list[dict] = []
    seen: set[str] = set()
    for spec in _assets().values():
        did = (spec or {}).get("dashboardId")
        if not did or did in seen:
            continue
        seen.add(did)
        out.append({"id": did, "name": (spec or {}).get("label") or did})
    return out
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `python -m pytest tests/test_assets.py -v`
Expected: all PASS.

- [ ] **Step 6: Confirm no regression + import sanity**

Run: `python -m pytest tests/ -q` and `python -c "import server.assets; print('ok')"`
Expected: all pass; import ok.

- [ ] **Step 7: Commit**

```bash
git add server/assets tests/test_assets.py
git commit -m "feat(assets): server-owned dashboard registry seed + resolver

Fail-soft loader mirroring users.py; view-keyed seed (spend/sustainability)
carries dashboard specs + per-page Genie prompts. Derivations for dashboard
ids, default id, and the grantable-resource catalog.

Co-authored-by: Isaac"
```

---

## Task 2: `GET /api/assets` endpoint

**Files:**
- Modify: `server/routes/api.py`
- Test: `tests/test_assets.py` (extend)

**Interfaces:**
- Consumes: `server.assets.load_registry()` (Task 1).
- Produces: `GET /api/assets` → the resolved registry JSON (`{"assets": {...}}`). Readable by any authenticated session; must not 500 with Lakebase off.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_assets.py`:

```python
from fastapi.testclient import TestClient


def test_get_api_assets_returns_registry(monkeypatch):
    # Auth gate is a no-op unless AUTH_ENABLED; keep it off for this unit check.
    monkeypatch.delenv("AUTH_ENABLED", raising=False)
    import app as app_module

    client = TestClient(app_module.app)
    res = client.get("/api/assets")
    assert res.status_code == 200
    body = res.json()
    assert "spend" in body["assets"]
    assert body["assets"]["spend"]["dashboardId"] == "01f1271698161d42b3c66528415775e8"
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `python -m pytest tests/test_assets.py::test_get_api_assets_returns_registry -v`
Expected: FAIL — 404 (route not defined).

- [ ] **Step 3: Add the endpoint**

In `server/routes/api.py`, add near the other routes:

```python
from .. import assets as assets_registry


@router.get("/assets")
def get_assets():
    """Resolved dashboard asset registry (seed today; Lakebase override in PR3b).

    Readable by any authenticated session — the frontend RegistryProvider fetches
    this at boot. Fail-soft: returns an empty registry rather than erroring.
    """
    return assets_registry.load_registry()
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `python -m pytest tests/test_assets.py::test_get_api_assets_returns_registry -v`
Expected: PASS.

- [ ] **Step 5: Full suite + import sanity**

Run: `python -m pytest tests/ -q` and `python -c "import app; print('ok')"`
Expected: all pass; import ok.

- [ ] **Step 6: Commit**

```bash
git add server/routes/api.py tests/test_assets.py
git commit -m "feat(assets): expose resolved registry via GET /api/assets

Co-authored-by: Isaac"
```

---

## Task 3: Wire server touchpoints to the registry (env = fallback)

**Files:**
- Modify: `server/tenants/resources.py` (`catalog`)
- Modify: `server/tenants/service.py` (`grant_dashboard_access`)
- Modify: `server/routes/embed.py` (`_DEFAULT_DASHBOARD_ID` derivation)
- Test: `tests/test_assets.py` (extend)

**Interfaces:**
- Consumes: `assets.catalog_dashboards()`, `assets.dashboard_ids()`, `assets.default_dashboard_id()` (Task 1).
- Behavior: each touchpoint prefers the registry; when the registry is empty it falls back to today's env (`RESOURCE_DASHBOARDS`/`DASHBOARD_IDS`, `DASHBOARD_URL`). Genie space handling is untouched.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_assets.py`:

```python
def test_resources_catalog_uses_registry_dashboards(monkeypatch):
    # No explicit RESOURCE_DASHBOARDS/DASHBOARD_IDS -> derive from the registry.
    monkeypatch.delenv("RESOURCE_DASHBOARDS", raising=False)
    monkeypatch.delenv("DASHBOARD_IDS", raising=False)
    from server.tenants import resources

    cat = resources.catalog()
    ids = [d["id"] for d in cat["dashboards"]]
    assert "01f1271698161d42b3c66528415775e8" in ids


def test_resources_catalog_env_overrides_registry(monkeypatch):
    monkeypatch.setenv("RESOURCE_DASHBOARDS", "envdash:Env Dashboard")
    from server.tenants import resources

    cat = resources.catalog()
    assert cat["dashboards"] == [{"id": "envdash", "name": "Env Dashboard"}]


def test_grant_dashboard_access_iterates_registry_ids(monkeypatch):
    monkeypatch.delenv("DASHBOARD_IDS", raising=False)
    from server.tenants import service

    captured = []
    monkeypatch.setattr(
        service, "_permissions_patch",
        lambda path, sp, level: captured.append(path),
    )
    service.grant_dashboard_access("sp-app-id-123")
    assert any("01f1271698161d42b3c66528415775e8" in p for p in captured)


def test_embed_default_dashboard_id_from_registry():
    # embed module derives its default from the registry at import time.
    from server.routes import embed

    assert embed._DEFAULT_DASHBOARD_ID == "01f1271698161d42b3c66528415775e8"
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `python -m pytest tests/test_assets.py -k "catalog or grant_dashboard or embed_default" -v`
Expected: FAIL (`test_grant_dashboard_access_iterates_registry_ids` fails because `grant_dashboard_access` no-ops with `DASHBOARD_IDS` unset; the catalog/embed tests may already pass via env fallback but will lock behavior once wired). Confirm the grant test fails.

- [ ] **Step 3: Wire `resources.catalog()`**

In `server/tenants/resources.py`, change `catalog()` so the registry is the primary source, env the override/fallback:

```python
def catalog() -> dict:
    """Return the grantable resources: ``{dashboards:[{id,name}], genie_spaces:[...]}``."""
    from ..config import GENIE_SPACE_ID
    from .. import assets as assets_registry

    # Dashboards: explicit env override wins; else the resolved asset registry;
    # else the legacy DASHBOARD_IDS env. (Registry is the single source now.)
    dashboards = _parse(os.environ.get("RESOURCE_DASHBOARDS", ""))
    if not dashboards:
        dashboards = assets_registry.catalog_dashboards()
    if not dashboards:
        dashboards = _parse(os.environ.get("DASHBOARD_IDS", ""))

    spaces = _parse(os.environ.get("RESOURCE_GENIE_SPACES", ""))
    if not spaces and GENIE_SPACE_ID:
        spaces = [{"id": GENIE_SPACE_ID, "name": "Ask APEX (default)"}]

    return {"dashboards": dashboards, "genie_spaces": spaces}
```

- [ ] **Step 4: Wire `service.grant_dashboard_access()`**

In `server/tenants/service.py`, derive ids from the registry, keeping the env as fallback:

```python
def grant_dashboard_access(sp_app_id: str) -> None:
    """Give the tenant SP CAN_RUN on each registry dashboard id (env is fallback)."""
    from .. import assets as assets_registry

    dash_ids = assets_registry.dashboard_ids()
    if not dash_ids:
        raw = os.environ.get("DASHBOARD_IDS", "").strip()
        dash_ids = [d.strip() for d in raw.split(",") if d.strip()] if raw else []
    for dash_id in dash_ids:
        if not dash_id:
            continue
        _permissions_patch(
            f"/api/2.0/permissions/dashboards/{dash_id}", sp_app_id, "CAN_RUN"
        )
```

- [ ] **Step 5: Wire the embed default dashboard id**

In `server/routes/embed.py`, replace the module-level `_DEFAULT_DASHBOARD_ID` derivation so the registry is primary and `DASHBOARD_URL` is the fallback:

```python
from ..config import WORKSPACE_URL, DASHBOARD_URL
from .. import assets as assets_registry

router = APIRouter()

_TIMEOUT = 30


def _default_dashboard_id() -> str:
    """Prefer the resolved registry's default; fall back to the DASHBOARD_URL id."""
    rid = assets_registry.default_dashboard_id()
    if rid:
        return rid
    return DASHBOARD_URL.split("/dashboardsv3/")[-1].split("?")[0].split("/")[0]


_DEFAULT_DASHBOARD_ID = _default_dashboard_id()
```

(The `embed_token` handler already reads `_DEFAULT_DASHBOARD_ID`; no change there.)

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `python -m pytest tests/test_assets.py -v`
Expected: all PASS.

- [ ] **Step 7: Full suite + import sanity**

Run: `python -m pytest tests/ -q` and `python -c "import app; print('ok')"`
Expected: all pass; import ok.

- [ ] **Step 8: Commit**

```bash
git add server/tenants/resources.py server/tenants/service.py server/routes/embed.py tests/test_assets.py
git commit -m "feat(assets): derive dashboard grants/catalog/embed-default from the registry

resources.catalog, grant_dashboard_access, and the embed default dashboard id
now read the resolved asset registry; DASHBOARD_IDS / RESOURCE_DASHBOARDS /
DASHBOARD_URL are demoted to fallbacks. Genie space handling untouched.

Co-authored-by: Isaac"
```

---

## Task 4: Frontend registry types + bundled seed + alias

**Files:**
- Create: `frontend/src/registry/types.ts`
- Create: `frontend/src/registry/seed.ts`
- Modify: `frontend/vite.config.ts` (add `@dashboards-seed` alias)
- Modify: `frontend/src/vite-env.d.ts` (add `declare module "@dashboards-seed"`)
- Test: `frontend/src/registry/seed.test.ts` (create)

**Interfaces:**
- Produces:
  - `types.ts`: `AssetPage { pageId; label; summaryPrompt; suggestions: string[] }`, `AssetSpec { label; dashboardId; globalFilterPage; filters: Partial<Record<FilterKey, string>>; workspace?; org?; pages: AssetPage[] }`, `Registry { assets: Record<string, AssetSpec> }`.
  - `seed.ts`: `export const bundledRegistry: Registry` — the bundled copy of `server/assets/dashboards.seed.json`.
- Note: `AssetSpec` is a structural superset of `config.ts`'s `DashboardSpec` (adds `label`, `pages`; renames `id`→`dashboardId`). Because the embed helpers key off `spec.id`, Task 6 maps `dashboardId`→`id` at the App boundary (see Task 6). Keep the field named `dashboardId` in the seed/types for clarity.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/registry/seed.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { bundledRegistry } from "./seed";

describe("bundled registry seed", () => {
  it("carries the spend + sustainability assets", () => {
    expect(bundledRegistry.assets.spend).toBeDefined();
    expect(bundledRegistry.assets.sustainability).toBeDefined();
    expect(bundledRegistry.assets.spend.dashboardId).toBe(
      "01f1271698161d42b3c66528415775e8"
    );
  });

  it("carries per-page Genie prompts", () => {
    const summary = bundledRegistry.assets.spend.pages.find(
      (p) => p.pageId === "summary"
    );
    expect(summary?.summaryPrompt.toUpperCase()).toContain("SPEND");
    expect(summary?.suggestions).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd frontend && npx vitest run src/registry/seed.test.ts`
Expected: FAIL — cannot resolve `./seed` / `@dashboards-seed`.

- [ ] **Step 3: Add the Vite alias**

In `frontend/vite.config.ts`, add to `resolve.alias` (next to `@brand`):

```ts
      "@dashboards-seed": path.resolve(__dirname, "../server/assets/dashboards.seed.json"),
```

(`server.fs.allow` already includes the repo root, so dev can read it.)

- [ ] **Step 4: Declare the module type**

In `frontend/src/vite-env.d.ts`, add below the `@brand` block:

```ts
declare module "@dashboards-seed" {
  const value: import("./registry/types").Registry;
  export default value;
}
```

- [ ] **Step 5: Write the types**

Create `frontend/src/registry/types.ts`:

```ts
import type { FilterKey } from "@/config";

/** One page within a dashboard asset (its id, label, and Genie wiring). */
export interface AssetPage {
  pageId: string;
  label: string;
  summaryPrompt: string;
  suggestions: string[];
}

/**
 * A dashboard asset: the full spec the app renders + wires. Structural superset
 * of config.ts DashboardSpec (adds `label`, `pages`; the physical Lakeview id is
 * `dashboardId`). Filter render vocabulary (FilterKey) lives in config.ts FILTERS;
 * `filters` only references those keys.
 */
export interface AssetSpec {
  label: string;
  dashboardId: string;
  globalFilterPage: string;
  filters: Partial<Record<FilterKey, string>>;
  workspace?: string;
  org?: string;
  pages: AssetPage[];
}

export interface Registry {
  assets: Record<string, AssetSpec>;
}
```

- [ ] **Step 6: Write the bundled seed accessor**

Create `frontend/src/registry/seed.ts`:

```ts
import bundled from "@dashboards-seed";
import type { Registry } from "./types";

/**
 * Build-time copy of server/assets/dashboards.seed.json (imported via the
 * @dashboards-seed alias). The RegistryProvider falls back to this if
 * GET /api/assets fails, so the app always renders (zero-infra demo promise).
 */
export const bundledRegistry: Registry = bundled as Registry;
```

- [ ] **Step 7: Run the test to confirm it passes**

Run: `cd frontend && npx vitest run src/registry/seed.test.ts`
Expected: PASS.

- [ ] **Step 8: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: clean (no errors).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/registry/types.ts frontend/src/registry/seed.ts frontend/src/registry/seed.test.ts frontend/vite.config.ts frontend/src/vite-env.d.ts
git commit -m "feat(registry): frontend registry types + bundled seed (fail-soft copy)

Imports server/assets/dashboards.seed.json at build time via the
@dashboards-seed alias, mirroring the @brand pattern.

Co-authored-by: Isaac"
```

---

## Task 5: `RegistryProvider` + `useRegistry` + mount

**Files:**
- Create: `frontend/src/registry/RegistryProvider.tsx`
- Create: `frontend/src/registry/useRegistry.ts`
- Modify: `frontend/src/main.tsx`
- Test: `frontend/src/registry/RegistryProvider.test.tsx` (create)

**Interfaces:**
- Consumes: `bundledRegistry` (Task 4), `Registry`/`AssetSpec` types.
- Produces:
  - `RegistryProvider({ children })` — fetches `GET /api/assets` once at boot; on success provides that registry; on failure (or non-ok) provides `bundledRegistry`; renders a branded shell skeleton until the fetch settles.
  - `useRegistry(): Registry` — the resolved registry (throws if used outside the provider).
  - `useDashboardAsset(key?: string): AssetSpec | undefined` — asset lookup by registry key.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/registry/RegistryProvider.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RegistryProvider } from "./RegistryProvider";
import { useRegistry } from "./useRegistry";

function Probe() {
  const reg = useRegistry();
  return <div data-testid="keys">{Object.keys(reg.assets).join(",")}</div>;
}

describe("RegistryProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("provides the fetched registry when GET /api/assets succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ assets: { fromApi: { label: "X", dashboardId: "d", globalFilterPage: "g", filters: {}, pages: [] } } }),
      }))
    );
    render(
      <RegistryProvider>
        <Probe />
      </RegistryProvider>
    );
    await waitFor(() => expect(screen.getByTestId("keys")).toHaveTextContent("fromApi"));
  });

  it("falls back to the bundled seed when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    render(
      <RegistryProvider>
        <Probe />
      </RegistryProvider>
    );
    await waitFor(() => expect(screen.getByTestId("keys")).toHaveTextContent("spend"));
  });
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `cd frontend && npx vitest run src/registry/RegistryProvider.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the context + hooks**

Create `frontend/src/registry/useRegistry.ts`:

```ts
import { createContext, useContext } from "react";
import type { AssetSpec, Registry } from "./types";

export const RegistryContext = createContext<Registry | null>(null);

export function useRegistry(): Registry {
  const reg = useContext(RegistryContext);
  if (!reg) throw new Error("useRegistry must be used within <RegistryProvider>");
  return reg;
}

export function useDashboardAsset(key?: string): AssetSpec | undefined {
  const reg = useRegistry();
  return key ? reg.assets[key] : undefined;
}
```

- [ ] **Step 4: Write the provider**

Create `frontend/src/registry/RegistryProvider.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { Registry } from "./types";
import { bundledRegistry } from "./seed";
import { RegistryContext } from "./useRegistry";

/**
 * Boot-time registry loader (sibling to ThemeProvider). Fetches GET /api/assets
 * ONCE, gating the app shell behind a branded skeleton until it settles, then
 * provides the resolved registry so every downstream consumer reads it
 * synchronously. If the fetch fails, falls back to the bundled seed copy so the
 * app always renders (fail-soft — the zero-infra demo promise).
 */
export function RegistryProvider({ children }: { children: ReactNode }) {
  const [registry, setRegistry] = useState<Registry | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/assets");
        if (!res.ok) throw new Error(`assets ${res.status}`);
        const data = (await res.json()) as Registry;
        if (!cancelled) {
          setRegistry(data?.assets ? data : bundledRegistry);
        }
      } catch {
        if (!cancelled) setRegistry(bundledRegistry);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!registry) {
    return (
      <div className="h-full flex items-center justify-center bg-brand-bg">
        <Loader2 size={28} className="animate-spin text-brand-accent" />
      </div>
    );
  }

  return <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>;
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `cd frontend && npx vitest run src/registry/RegistryProvider.test.tsx`
Expected: both PASS.

- [ ] **Step 6: Mount the provider**

In `frontend/src/main.tsx`, wrap `App` (inside `ThemeProvider` so the skeleton is branded):

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { ThemeProvider } from "./theme/ThemeProvider";
import { RegistryProvider } from "./registry/RegistryProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <RegistryProvider>
          <App />
        </RegistryProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 7: Type-check + full frontend test run**

Run: `cd frontend && npx tsc -b && npx vitest run`
Expected: clean; all vitest pass. (App.tsx still uses `config.ts` `DASHBOARDS` at this point — that's fine; the cutover is Task 6. The app still builds and runs.)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/registry/RegistryProvider.tsx frontend/src/registry/useRegistry.ts frontend/src/registry/RegistryProvider.test.tsx frontend/src/main.tsx
git commit -m "feat(registry): boot-time RegistryProvider with bundled-seed fallback

Fetches GET /api/assets once, gates the app shell behind a branded skeleton,
provides the resolved registry via useRegistry so downstream reads are
synchronous. Falls back to the bundled seed on fetch failure.

Co-authored-by: Isaac"
```

---

## Task 6: Retire `config.ts` `DASHBOARDS`; rewire App + CustomDashboard to the registry

This is the atomic cutover — after it, the registry is the single frontend source and the app behaves identically. Do it in one task so the app is never half-wired.

**Files:**
- Modify: `frontend/src/config.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/CustomDashboard.tsx`
- Test: existing frontend tests + build gate (no new unit test file; behavior is covered by `RegistryProvider.test.tsx` + the build/type gate + the manual visual check in Task 7).

**Interfaces:**
- Consumes: `useRegistry()`/`useDashboardAsset()` (Task 5), `AssetSpec`/`AssetPage` (Task 4).
- Produces: `App.tsx` resolves the asset for `route.dashboard` from the registry, derives `pages` from `asset.pages`, and derives the Genie config from the active page. `CustomDashboard` receives an embed-compatible spec.
- Preserves: `FILTERS`, `FilterKey`, `FilterState`, `DEFAULT_FILTERS`, embed-URL helpers (`buildPageEmbedUrl`, `buildTokenEmbedUrl`, `shouldPassEmbedFilters`, `getSupportedFilterKeys`, `serializeFilter`, `buildFilterParams`), `filtersToContext`, `fetchEmbedToken`, KPI + persistence helpers, `ROUTES` (nav), `ICON_MAP`, `WORKSPACE`/`ORG`, `buildExecSummaryPrompt`.

- [ ] **Step 1: Slim `config.ts`**

In `frontend/src/config.ts`:

1. **Remove** the dashboard registry block: the `DashboardSpec` interface stays (it's the embed contract used by the helpers), but delete `DASHBOARDS`, `getDashboardById`, and `getDashboard`. Keep `getSupportedFilterKeys(spec?: DashboardSpec)` and the embed-URL helpers unchanged (they take a `DashboardSpec`, which an `AssetSpec` satisfies once mapped — see Step 4).
2. **Remove** the Genie-wiring block: delete `DashboardGenieConfig`, `SPEND_GENIE`, `SUSTAINABILITY_GENIE`, `CARBON_FORECAST_GENIE`, `PageConfig`, and `getDashboardGenie`. (These now live in the registry / `AssetPage`.)
3. **Slim `RouteConfig`**: drop `pages` and `genie`; keep `dashboard?: string` (the registry key). Result:

```ts
export interface RouteConfig {
  path: string;
  label: string;
  icon: string; // key into ICON_MAP
  section: "insights" | "exploration";
  mode: RouteMode;
  dashboard?: string; // key into the asset registry (server/assets/dashboards.seed.json)
}
```

4. **Update `ROUTES`**: the two `custom` routes reference the new view keys and drop inline `pages`/`genie`:

```ts
  {
    path: "/spend-custom",
    label: "Spend",
    icon: "DollarSign",
    section: "insights",
    mode: "custom",
    dashboard: "spend",
  },
  ...
  {
    path: "/sustainability",
    label: "Sustainability",
    icon: "Leaf",
    section: "insights",
    mode: "custom",
    dashboard: "sustainability",
  },
```

(Leave the four non-dashboard routes — `/`, `/genie-mcp`, `/ask-apex-live`, `/preferences` — unchanged.)

5. Keep `filtersToContext(filters, spec?)` as-is (it takes a `DashboardSpec`).

- [ ] **Step 2: Confirm the failing build (contract check)**

Run: `cd frontend && npx tsc -b`
Expected: FAIL — `App.tsx` still imports `getDashboard`/`getDashboardGenie` and reads `route.pages`. This confirms the consumers that Step 3 must fix.

- [ ] **Step 3: Rewire `App.tsx`**

Replace the config imports and the registry-derived logic. Key changes:

1. **Imports** — drop `getDashboard`, `getDashboardGenie`; keep `filtersToContext`, `getSupportedFilterKeys`, `DEFAULT_FILTERS`, `loadEffectiveFilterPrefs`, `saveFilterPrefs`, `ROUTES`. Add:

```tsx
import { useRegistry, useDashboardAsset } from "@/registry/useRegistry";
import type { AssetSpec, AssetPage } from "@/registry/types";
import type { DashboardSpec } from "@/config";
```

2. **A helper to map an `AssetSpec` → embed `DashboardSpec`** (the helpers key off `spec.id`). Put it near the top of the module:

```tsx
/** The embedded-dashboard SDK + URL helpers key off `id`; map the asset onto that shape. */
function toEmbedSpec(asset: AssetSpec): DashboardSpec {
  return {
    id: asset.dashboardId,
    globalFilterPage: asset.globalFilterPage,
    filters: asset.filters,
    workspace: asset.workspace,
    org: asset.org,
  };
}

/** Resolve the Genie config for the active page (falls back to the first page). */
function pageGenie(asset: AssetSpec | undefined, pageId?: string): { summaryPrompt: string; suggestions: string[] } {
  const page = asset?.pages.find((p) => p.pageId === pageId) ?? asset?.pages[0];
  return { summaryPrompt: page?.summaryPrompt ?? "", suggestions: page?.suggestions ?? [] };
}
```

3. **`RouteRenderer`** — it must read the registry. Since it's a component, call `useDashboardAsset(route.dashboard)` inside it:

```tsx
function RouteRenderer({ route, filters, filtersReady, activePageId, railOpen, onRailOpenChange, summaryOpen, onSummaryOpenChange }: {
  route: RouteConfig;
  filters: FilterState;
  filtersReady: boolean;
  activePageId?: string;
  railOpen: boolean;
  onRailOpenChange: (open: boolean) => void;
  summaryOpen: boolean;
  onSummaryOpenChange: (open: boolean) => void;
}) {
  const asset = useDashboardAsset(route.dashboard);
  switch (route.mode) {
    case "custom": {
      if (!asset) return <Placeholder />;
      const pages = asset.pages;
      const spec = toEmbedSpec(asset);
      const genie = pageGenie(asset, activePageId);
      const pageLabel = `${route.label} · ${pages.find((p) => p.pageId === activePageId)?.label ?? ""}`.replace(/ · $/, "");
      const pageContext = [`Dashboard: ${pageLabel}`, filtersToContext(filters, spec)].filter(Boolean).join(". ");
      const content = (
        <CustomDashboard spec={spec} pages={pages} filters={filters} filtersReady={filtersReady} activePageId={activePageId} />
      );
      return (
        <DashboardWorkspace
          pageKey={`${route.path}:${activePageId ?? ""}`}
          pageLabel={pageLabel}
          pageContext={pageContext}
          summaryPrompt={genie.summaryPrompt}
          suggestions={genie.suggestions}
          railOpen={railOpen}
          onRailOpenChange={onRailOpenChange}
          summaryOpen={summaryOpen}
          onSummaryOpenChange={onSummaryOpenChange}
        >
          {content}
        </DashboardWorkspace>
      );
    }
    case "react":
      if (route.path === "/") return <HomePage />;
      if (route.path === "/genie-mcp") return <GenieMcpExperience />;
      if (route.path === "/ask-apex-live") return <AskApexLive />;
      if (route.path === "/preferences") return <PreferencesPage />;
      return <Placeholder />;
    case "placeholder":
    default:
      return <Placeholder />;
  }
}
```

4. **The `App` body** — replace `getDashboard(currentRoute)` / `getSupportedFilterKeys(currentDashboard)` / `pages = currentRoute?.pages` with registry reads. Note `pages` used for `effectivePageId` now comes from the resolved asset:

```tsx
  const registry = useRegistry();
  const currentRoute = ROUTES.find((r) => r.path === location.pathname);
  const isCustom = currentRoute?.mode === "custom";
  const currentAsset: AssetSpec | undefined = currentRoute?.dashboard ? registry.assets[currentRoute.dashboard] : undefined;
  const pages: AssetPage[] = currentAsset?.pages ?? [];
  const currentDashboardId = currentAsset?.dashboardId;
  const filterKeys = getSupportedFilterKeys(currentAsset ? toEmbedSpec(currentAsset) : undefined);
```

(`pages.map(...)` for the `TabsTrigger` list and `pages.some(p => p.pageId === activePageId)` for `effectivePageId` keep working since `AssetPage` has `pageId`/`label`. The filter-prefs effects key off `currentDashboardId` exactly as before. `DASHBOARD_PREFS` sentinel usage unchanged.)

- [ ] **Step 4: Adjust `CustomDashboard.tsx` prop typing (if needed)**

`CustomDashboard` already accepts `spec: DashboardSpec` and `pages: PageConfig[]`. Since `PageConfig` is being removed from `config.ts`, change its `pages` prop type to `AssetPage[]`:

```tsx
import type { DashboardSpec, FilterState } from "@/config";
import type { AssetPage } from "@/registry/types";

interface CustomDashboardProps {
  spec: DashboardSpec;
  pages: AssetPage[];
  filters: FilterState;
  filtersReady?: boolean;
  activePageId?: string;
}
```

(The component only reads `pages[0]?.pageId` and `pages.length`; `AssetPage` satisfies both. `spec` stays a `DashboardSpec` — the embed logic is unchanged.)

- [ ] **Step 5: Type-check + build + full test run**

Run: `cd frontend && npx tsc -b && npx vite build && npx vitest run`
Expected: clean build; all vitest pass. If `tsc` flags a leftover reference to a removed symbol, fix that consumer (only `App.tsx`/`CustomDashboard.tsx` should be affected per the boundary reference).

- [ ] **Step 6: Grep-confirm the retirement**

Run:
```bash
cd frontend && grep -rn "DASHBOARDS\|getDashboardGenie\|getDashboard\b\|SPEND_GENIE\|SUSTAINABILITY_GENIE\|CARBON_FORECAST_GENIE\|route\.pages\|route\.genie" src
```
Expected: no matches (the registry owns these now). `getSupportedFilterKeys`, `getDashboardById` should also be gone or unused — confirm no dangling references remain.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/config.ts frontend/src/App.tsx frontend/src/pages/CustomDashboard.tsx
git commit -m "feat(registry): retire config.ts DASHBOARDS; App reads the resolved registry

App.tsx + CustomDashboard resolve dashboard specs, pages, and per-page Genie
prompts from useRegistry() instead of config.ts. FILTERS + ROUTES stay in
config.ts (filter vocabulary + nav). App behaves identically.

Co-authored-by: Isaac"
```

---

## Task 7: Docs + manual visual parity check

**Files:**
- Modify: `docs/customizing.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update `docs/customizing.md`**

Replace the planned-registry row and add the seam note. Change:

```
| Dashboards & Genie spaces | *(planned: `dashboards.seed.json`, PR3)* |
```

to:

```
| Dashboards & Genie spaces (specs, filter wiring, per-page prompts) | `server/assets/dashboards.seed.json` |
```

Add a short paragraph documenting the seam:

> **Dashboard registry vs. filters vs. nav.** `server/assets/dashboards.seed.json`
> owns dashboard **assets** (physical dashboard id, filter→widget wiring, pages,
> per-page Genie prompts), resolved by `server/assets/registry.py` and served at
> `GET /api/assets` (the frontend fetches it at boot and bundles a fallback copy).
> **Filter render vocabulary** (which filters exist, how they render) stays in
> `frontend/src/config.ts` `FILTERS`; the seed's `filters` map only *references*
> those keys. **Nav** (order, icons, sections, non-dashboard pages) stays in
> `config.ts` `ROUTES`; a dashboard route points at an asset via its `dashboard`
> key. `DASHBOARD_IDS` / `RESOURCE_DASHBOARDS` / `DASHBOARD_URL` remain env
> fallbacks used only when the registry is empty.

- [ ] **Step 2: Update `AGENTS.md`**

Mirror the same row change in the AGENTS.md "Change X → edit Y" table, and update the nearby prose line that currently says dashboard specs live in `config.ts`:

Change:
```
  dashboard specs/filters/prompts live declaratively in `frontend/src/config.ts`.
```
to:
```
  dashboard specs + per-page Genie prompts live in `server/assets/dashboards.seed.json`
  (resolved server-side, served at `GET /api/assets`); filter render vocabulary and
  nav stay in `frontend/src/config.ts` (`FILTERS` + `ROUTES`).
```

And the table row:
```
| Dashboards & Genie spaces | *(planned: `dashboards.seed.json`, PR3)* |
```
to:
```
| Dashboards & Genie spaces (specs, wiring, prompts) | `server/assets/dashboards.seed.json` |
```

- [ ] **Step 3: Manual visual parity check (controller-run, documented)**

Build the frontend (`cd frontend && npx vite build`) and run the backend (`AUTH_ENABLED=true LAKEBASE_ENABLED=false`). Open the app and confirm **identical behavior** to pre-PR3a:
- Spend and Sustainability nav entries render; each shows Summary + Carbon Forecasting page tabs.
- Filters (Period/vs/Sector/Region) render on both and drive the embed.
- Executive Summary + Ask APEX rail use the correct per-page prompts (Spend summary vs Sustainability summary differ; both Carbon Forecasting pages use the forecast prompt).
- With the backend up, `GET /api/assets` returns the registry (check the Network tab / `curl -s localhost:8000/api/assets`).
- Kill the backend `/api/assets` (or block it) and reload → the app still renders from the bundled seed (fail-soft).

Record the result in the commit message / ledger. This is verification, not code.

- [ ] **Step 4: Commit**

```bash
git add docs/customizing.md AGENTS.md
git commit -m "docs(assets): document the dashboard registry seed + FILTERS/ROUTES seam

Co-authored-by: Isaac"
```

---

## Self-review notes

- **Spec coverage (Section C addendum, PR3a bullet):**
  - `server/assets/` module (seed-or-Lakebase resolve, mirroring `users.py`) ✓ (T1 — seed path implemented; Lakebase override deferred to PR3b, seam documented).
  - `server/assets/dashboards.seed.json` seeded from current `config.ts` DASHBOARDS + ROUTES Genie wiring ✓ (T1 — verbatim prompts).
  - `GET /api/assets` ✓ (T2).
  - Frontend `RegistryProvider` (`useRegistry()`, bundled-seed fallback) ✓ (T4 + T5).
  - Retire `config.ts` `DASHBOARDS`; App/CustomDashboard read the registry ✓ (T6).
  - Server touchpoints (`grant_dashboard_access`, `resources.catalog`, embed default) derive from the registry, env = fallback ✓ (T3).
  - End state: app behaves identically ✓ (T6 build/type gate + T7 manual parity check).
- **Global-constraint coverage:** FILTERS + FilterKey stay in config.ts ✓ (T6 Step 1 explicit); ROUTES stays for nav ✓ (T6); Genie SPACE id untouched ✓ (T3 leaves `grant_genie_access`/`GENIE_SPACE_ID` alone); fail-soft on server ✓ (T1 empty-registry tests) and frontend ✓ (T5 fallback test); no new deps ✓; commit trailer ✓ (every task).
- **Type consistency:** `AssetSpec` (T4) is a structural superset of `DashboardSpec` (config.ts, kept); T6 maps `dashboardId`→`id` via `toEmbedSpec` so the embed helpers keep their `DashboardSpec` signature unchanged. `AssetPage` (T4) replaces `PageConfig` as `CustomDashboard`'s `pages` prop type (T6 Step 4). `Registry`/`AssetSpec` types shared by `seed.ts`, `RegistryProvider`, `useRegistry`, `App.tsx`.
- **View-keyed registry rationale:** two routes (`/spend-custom`, `/sustainability`) share one physical dashboard id but need different Genie prompts; modeling them as two assets (`spend`, `sustainability`) over the same `dashboardId` is what lets the prompts move to the seed while preserving identical behavior. `dashboard_ids()`/`catalog_dashboards()` dedupe by physical id so grants/catalog see one dashboard (as today).
- **Ordering / reviewability:** T1→T2→T3 are server-side and additive-with-fallback (app keeps working on `config.ts` DASHBOARDS). T4→T5 add the frontend provider additively (App still reads config.ts). T6 is the atomic cutover (registry becomes the single frontend source in one commit — never half-wired). T7 is docs + the parity gate.
- **Testing honesty:** server derivations + fail-soft are unit-tested (T1/T3) and the endpoint via TestClient (T2); the frontend provider's fetch-wins/fallback paths are unit-tested with a stubbed `fetch` (T5). The App cutover is guarded by the type/build gate + a documented manual visual parity check (T6/T7) — appropriate since it's an integration rewire of an iframe-embedding component that unit tests can't meaningfully exercise.
- **Out of scope (PR3b):** `apex_asset_registry` Lakebase table + CRUD endpoints, `AdminLayout` + the two admin pages, the tenant×asset access grid, and removing `AccessDialog`. PR3a leaves the admin UI exactly as-is.
