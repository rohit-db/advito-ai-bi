"""Tenant orchestration: lifecycle + UC mapping + grants + audit.

This is the single entry point the API layer calls. Each operation composes the
lower layers in the right order and records an audit row:

  onboard   -> sp_lifecycle.onboard_sp + unity_catalog.insert_mapping + grants
  rotate    -> sp_lifecycle.rotate_secret
  deactivate-> sp_lifecycle.deactivate + unity_catalog.deactivate_mapping
  reactivate-> sp_lifecycle.reactivate + unity_catalog.activate_mapping
  delete    -> sp_lifecycle.delete + unity_catalog.delete_mapping

Non-critical side-effects (UC mapping, grants) are best-effort: they are wrapped
so a missing UC config or a permissions hiccup logs + audits a warning but never
fails onboarding. Critical lifecycle failures are audited with ``status=error``
and re-raised for the API layer to surface.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Optional

from ..config import GENIE_SPACE_ID, WORKSPACE_URL, get_sp_bearer
from . import audit, registry, resources, runtime, sp_lifecycle, unity_catalog
from .registry import TenantRow

logger = logging.getLogger("server.tenants.service")


# ----------------------------------------------------------------- serializers
def _serialize(row: TenantRow) -> dict:
    return {
        "tenant_id": row.tenant_id,
        "display_name": row.display_name,
        "sp_app_id": row.sp_app_id,
        "sp_display_name": row.sp_display_name,
        "status": row.status,
        "genie_space_id": row.genie_space_id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def list_tenants() -> list[dict]:
    return [_serialize(r) for r in registry.list_tenants()]


def verify() -> list[dict]:
    target = os.environ.get("VERIFY_TABLE", "").strip() or None
    return unity_catalog.verify_all(target)


# ----------------------------------------------------------------- resource access
def list_resources() -> dict:
    """The catalog of grantable dashboards + Genie spaces."""
    return resources.catalog()


def get_access(tenant_id: str) -> dict:
    """Current resource access for one tenant's Service Principal."""
    row = registry.get_tenant(tenant_id)
    if not row:
        raise RuntimeError(f"tenant {tenant_id} not found")
    return {
        "tenant_id": tenant_id,
        "sp_app_id": row.sp_app_id,
        "access": resources.tenant_access(row.sp_app_id),
    }


def set_access(
    tenant_id: str,
    resource_type: str,
    resource_id: str,
    grant: bool,
    actor: Optional[str] = None,
) -> dict:
    """Grant or revoke CAN_RUN for a tenant SP on one resource; audit the change."""
    row = registry.get_tenant(tenant_id)
    if not row:
        raise RuntimeError(f"tenant {tenant_id} not found")
    started = time.time()
    action = "grant_access" if grant else "revoke_access"
    try:
        if grant:
            resources.grant(row.sp_app_id, resource_type, resource_id)
        else:
            resources.revoke(row.sp_app_id, resource_type, resource_id)
    except Exception as e:  # noqa: BLE001
        audit.log(
            action, tenant_id=tenant_id, actor=actor, sp_app_id=row.sp_app_id,
            status="error", detail=f"{resource_type}:{resource_id} — {e}",
            latency_ms=int((time.time() - started) * 1000),
        )
        raise
    audit.log(
        action, tenant_id=tenant_id, actor=actor, sp_app_id=row.sp_app_id,
        status="ok", detail=f"{resource_type}:{resource_id}",
        latency_ms=int((time.time() - started) * 1000),
    )
    return {"ok": True, "tenant_id": tenant_id}


# ----------------------------------------------------------------- grants
def _permissions_patch(path: str, sp_app_id: str, permission_level: str) -> None:
    """PATCH a permissions object to add CAN_RUN for the SP.

    Prefers the admin client's ``api_client.do``; falls back to a direct REST
    call authenticated with the app SP bearer token.
    """
    body = {
        "access_control_list": [
            {
                "service_principal_name": sp_app_id,
                "permission_level": permission_level,
            }
        ]
    }
    w = runtime.admin_client()
    try:
        w.api_client.do("PATCH", path, body=body)
        return
    except Exception as e:  # noqa: BLE001 - fall back to a plain REST call
        logger.debug("api_client.do PATCH %s failed (%s); trying requests", path, e)

    import requests

    token = get_sp_bearer()
    if not token:
        raise RuntimeError("no SP bearer token available for permissions PATCH")
    base = (WORKSPACE_URL or "").rstrip("/")
    resp = requests.patch(
        f"{base}{path}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=body,
        timeout=30,
    )
    if resp.status_code not in (200, 204):
        raise RuntimeError(
            f"permissions PATCH {path} failed ({resp.status_code}): {resp.text[:300]}"
        )


def grant_genie_access(sp_app_id: str) -> None:
    """Give the tenant SP CAN_RUN on the (default) Genie space."""
    if not GENIE_SPACE_ID:
        return
    _permissions_patch(
        f"/api/2.0/permissions/genie/{GENIE_SPACE_ID}", sp_app_id, "CAN_RUN"
    )


def grant_dashboard_access(sp_app_id: str) -> None:
    """Give the tenant SP CAN_RUN on each dashboard id in ``DASHBOARD_IDS``."""
    raw = os.environ.get("DASHBOARD_IDS", "").strip()
    if not raw:
        return
    for dash_id in (d.strip() for d in raw.split(",")):
        if not dash_id:
            continue
        _permissions_patch(
            f"/api/2.0/permissions/dashboards/{dash_id}", sp_app_id, "CAN_RUN"
        )


def grant_data_access(sp_app_id: str, tenant_id: str) -> None:
    """GRANT SELECT on the verify/mapping table to the tenant SP (UC only)."""
    target = os.environ.get("VERIFY_TABLE", "").strip() or unity_catalog.mapping_table_name
    table = unity_catalog.fq(target)  # raises if UC unset -> caller catches
    unity_catalog._admin_sql(f"GRANT SELECT ON TABLE {table} TO `{sp_app_id}`")


def _best_effort(fn, *args, action: str, tenant_id: str, actor: Optional[str]) -> None:
    """Run a non-critical side-effect, auditing a warning on failure."""
    try:
        fn(*args)
    except Exception as e:  # noqa: BLE001
        logger.warning("%s failed for %s: %s", action, tenant_id, e)
        audit.log(
            action,
            tenant_id=tenant_id,
            actor=actor,
            status="warning",
            detail=str(e),
        )


# ----------------------------------------------------------------- operations
def onboard(
    tenant_id: str,
    display_name: str,
    genie_space_id: Optional[str] = None,
    actor: Optional[str] = None,
) -> dict:
    """Create the tenant SP, register the UC mapping, grant access, audit."""
    started = time.time()
    try:
        res = sp_lifecycle.onboard_sp(tenant_id, display_name, genie_space_id)
    except Exception as e:  # noqa: BLE001
        audit.log(
            "onboard",
            tenant_id=tenant_id,
            actor=actor,
            status="error",
            detail=str(e),
            latency_ms=int((time.time() - started) * 1000),
        )
        raise

    sp_app_id = res["sp_app_id"]
    _best_effort(
        unity_catalog.insert_mapping,
        sp_app_id,
        tenant_id,
        action="insert_mapping",
        tenant_id=tenant_id,
        actor=actor,
    )
    _best_effort(
        grant_genie_access, sp_app_id,
        action="grant_genie", tenant_id=tenant_id, actor=actor,
    )
    _best_effort(
        grant_dashboard_access, sp_app_id,
        action="grant_dashboard", tenant_id=tenant_id, actor=actor,
    )
    _best_effort(
        grant_data_access, sp_app_id, tenant_id,
        action="grant_data", tenant_id=tenant_id, actor=actor,
    )

    audit.log(
        "onboard",
        tenant_id=tenant_id,
        actor=actor,
        sp_app_id=sp_app_id,
        status="ok",
        latency_ms=int((time.time() - started) * 1000),
    )
    return res


def rotate(tenant_id: str, actor: Optional[str] = None) -> str:
    started = time.time()
    row = registry.get_tenant(tenant_id)
    sp_app_id = row.sp_app_id if row else None
    try:
        secret = sp_lifecycle.rotate_secret(tenant_id)
    except Exception as e:  # noqa: BLE001
        audit.log(
            "rotate", tenant_id=tenant_id, actor=actor, sp_app_id=sp_app_id,
            status="error", detail=str(e),
            latency_ms=int((time.time() - started) * 1000),
        )
        raise
    audit.log(
        "rotate", tenant_id=tenant_id, actor=actor, sp_app_id=sp_app_id,
        status="ok", latency_ms=int((time.time() - started) * 1000),
    )
    return secret


def deactivate(tenant_id: str, actor: Optional[str] = None) -> None:
    started = time.time()
    row = registry.get_tenant(tenant_id)
    sp_app_id = row.sp_app_id if row else None
    try:
        sp_lifecycle.deactivate(tenant_id)
    except Exception as e:  # noqa: BLE001
        audit.log(
            "deactivate", tenant_id=tenant_id, actor=actor, sp_app_id=sp_app_id,
            status="error", detail=str(e),
            latency_ms=int((time.time() - started) * 1000),
        )
        raise
    if sp_app_id:
        _best_effort(
            unity_catalog.deactivate_mapping, sp_app_id,
            action="deactivate_mapping", tenant_id=tenant_id, actor=actor,
        )
    audit.log(
        "deactivate", tenant_id=tenant_id, actor=actor, sp_app_id=sp_app_id,
        status="ok", latency_ms=int((time.time() - started) * 1000),
    )


def reactivate(tenant_id: str, actor: Optional[str] = None) -> str:
    started = time.time()
    row = registry.get_tenant(tenant_id)
    sp_app_id = row.sp_app_id if row else None
    try:
        secret = sp_lifecycle.reactivate(tenant_id)
    except Exception as e:  # noqa: BLE001
        audit.log(
            "reactivate", tenant_id=tenant_id, actor=actor, sp_app_id=sp_app_id,
            status="error", detail=str(e),
            latency_ms=int((time.time() - started) * 1000),
        )
        raise
    if sp_app_id:
        _best_effort(
            unity_catalog.activate_mapping, sp_app_id, tenant_id,
            action="activate_mapping", tenant_id=tenant_id, actor=actor,
        )
    audit.log(
        "reactivate", tenant_id=tenant_id, actor=actor, sp_app_id=sp_app_id,
        status="ok", latency_ms=int((time.time() - started) * 1000),
    )
    return secret


def delete(tenant_id: str, actor: Optional[str] = None) -> None:
    started = time.time()
    row = registry.get_tenant(tenant_id)
    sp_app_id = row.sp_app_id if row else None
    # Best-effort mapping removal first, while we still have the row.
    if sp_app_id:
        _best_effort(
            unity_catalog.delete_mapping, sp_app_id,
            action="delete_mapping", tenant_id=tenant_id, actor=actor,
        )
    try:
        sp_lifecycle.delete(tenant_id)
    except Exception as e:  # noqa: BLE001
        audit.log(
            "delete", tenant_id=tenant_id, actor=actor, sp_app_id=sp_app_id,
            status="error", detail=str(e),
            latency_ms=int((time.time() - started) * 1000),
        )
        raise
    audit.log(
        "delete", tenant_id=tenant_id, actor=actor, sp_app_id=sp_app_id,
        status="ok", latency_ms=int((time.time() - started) * 1000),
    )
