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
