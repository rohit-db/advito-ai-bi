import logging

from fastapi import APIRouter, Request
from ..config import get_workspace_client
from .. import assets as assets_registry
from ..tenants.resolver import resolve_tenant_sp
from ..tenants.resources import tenant_access

router = APIRouter()

logger = logging.getLogger("server.routes.api")


def compute_initials(display_name: str) -> str:
    parts = (display_name or "").split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return (parts[0][0] if parts else "?").upper()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/me")
def get_me():
    try:
        w = get_workspace_client()
        me = w.current_user.me()
        display_name = me.display_name or ""
        email = me.user_name or ""
        return {
            "displayName": display_name,
            "email": email,
            "initials": compute_initials(display_name),
        }
    except Exception:
        return {
            "displayName": "Demo User",
            "email": "demo@prism.example",
            "initials": "DU",
        }


@router.get("/assets")
def get_assets(request: Request):
    """Resolved dashboard asset registry, filtered to the caller's entitlement.

    Readable by any authenticated session — the frontend RegistryProvider fetches
    this at boot. When the request resolves to a tenant Service Principal, the
    registry is narrowed to the assets whose physical dashboard that SP can run
    (the same Databricks ACL that gates the embed). Operators / ``tenant_id="*"``
    / pre-onboarding requests resolve to None and see the full registry (the
    resolver seam's fall-back invariant). Fail-soft throughout: any entitlement
    error returns the full registry rather than locking a user out.
    """
    registry = assets_registry.load_registry()
    try:
        resolved = resolve_tenant_sp(request)
    except Exception as e:  # noqa: BLE001 — never fail the boot fetch
        logger.warning("tenant resolve failed for /api/assets, serving full registry: %s", e)
        return registry
    if not resolved:
        return registry  # operator / all-clients / pre-onboarding -> unfiltered
    _token, row = resolved
    try:
        access = tenant_access(row.sp_app_id)
        granted = access.get("dashboards", {})
    except Exception as e:  # noqa: BLE001 — fail soft, do not lock out
        logger.warning("entitlement lookup failed for %s, serving full registry: %s", row.sp_app_id, e)
        return registry
    assets = registry.get("assets", {})
    filtered = {
        key: spec
        for key, spec in assets.items()
        if granted.get((spec or {}).get("dashboardId"))
    }
    return {"assets": filtered}
