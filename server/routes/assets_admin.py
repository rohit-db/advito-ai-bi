"""Operator API for the dashboard asset registry.

Manages the assets exposed via GET /api/assets. Editing requires Lakebase; with
it off the registry is read-only (the seed file is the source). Mirrors the
/api/users operator pattern.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..assets import registry as assets_registry
from ..auth.sessions import SESSION_COOKIE, verify_session
from ..tenants import audit, resources as tenant_resources

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


@router.get("/admin/dashboards")
def list_workspace_dashboards(request: Request):
    """Workspace Lakeview dashboards for the asset-editor picker (by name → id).

    Fail-soft: returns ``{dashboards: []}`` on any SDK error so the editor falls
    back to free-text id entry rather than blocking.
    """
    _require_operator(request)
    return {"dashboards": tenant_resources.list_workspace_dashboards()}


@router.get("/admin/genie-spaces")
def list_workspace_genie_spaces(request: Request):
    """Workspace Genie spaces for the asset-editor picker (by name → id). Fail-soft."""
    _require_operator(request)
    return {"genie_spaces": tenant_resources.list_workspace_genie_spaces()}


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
