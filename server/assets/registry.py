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
