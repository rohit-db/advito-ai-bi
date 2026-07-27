"""Grantable resource catalog + per-tenant access management.

The operator admin UI grants a tenant's Service Principal ``CAN_RUN`` on
individual AI/BI dashboards and Genie spaces. This module is the seam between
that UI and the Databricks permissions API.

The **catalog** of grantable resources is declarative (env), so more dashboards
or Genie spaces can be added without code changes:

  RESOURCE_DASHBOARDS=<id>:<Label>,<id>:<Label>
  RESOURCE_GENIE_SPACES=<id>:<Label>,<id>:<Label>

Both fall back to the app defaults when unset — ``DASHBOARD_IDS`` for dashboards
and ``GENIE_SPACE_ID`` for the single Ask APEX space — so existing single-resource
deployments keep working.

Grants run as the admin client (``runtime.admin_client`` → ``TENANTS_ADMIN_PROFILE``
when set), which needs CAN_MANAGE on the object.
"""
from __future__ import annotations

import logging
import os

from databricks.sdk.service.iam import AccessControlRequest

from . import runtime

logger = logging.getLogger("server.tenants.resources")

# Permissions-API object types, keyed by our logical resource_type.
_PERM_OBJECT_TYPES = {
    "dashboard": "dashboards",
    "genie_space": "genie",
}
_PERMISSION_LEVEL = "CAN_RUN"


def _parse(raw: str) -> list[dict]:
    """Parse ``id:Label,id2:Label2`` (or bare ``id,id2``) into ``[{id,name}]``."""
    out: list[dict] = []
    for chunk in (raw or "").split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if ":" in chunk:
            rid, _, name = chunk.partition(":")
            rid, name = rid.strip(), name.strip()
        else:
            rid, name = chunk, chunk
        if rid:
            out.append({"id": rid, "name": name or rid})
    return out


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


def _object_type(resource_type: str) -> str:
    obj = _PERM_OBJECT_TYPES.get(resource_type)
    if not obj:
        raise ValueError(f"unknown resource_type: {resource_type!r}")
    return obj


def _acl_entries(resource_type: str, resource_id: str) -> list:
    """Fetch the ACL for one resource via the SDK permissions service."""
    perms = runtime.admin_client().permissions.get(
        _object_type(resource_type), resource_id
    )
    return list(perms.access_control_list or [])


def _sp_has_access(entries: list, sp_app_id: str) -> bool:
    for e in entries:
        if getattr(e, "service_principal_name", None) != sp_app_id:
            continue
        for p in getattr(e, "all_permissions", None) or []:
            if getattr(p, "permission_level", None):
                return True
    return False


def grant(sp_app_id: str, resource_type: str, resource_id: str) -> None:
    """Give the tenant SP CAN_RUN on the resource (PATCH merges, non-destructive)."""
    runtime.admin_client().permissions.update(
        _object_type(resource_type),
        resource_id,
        access_control_list=[
            AccessControlRequest(
                service_principal_name=sp_app_id,
                permission_level=_PERMISSION_LEVEL,
            )
        ],
    )


def revoke(sp_app_id: str, resource_type: str, resource_id: str) -> None:
    """Remove the tenant SP from the resource ACL.

    The permissions API has no per-principal delete, so we GET the ACL and PUT it
    back without this SP — preserving every other principal's *direct* (non-
    inherited) permission. Inherited permissions are omitted (they re-apply
    automatically and can't be set explicitly).
    """
    rebuilt: list[AccessControlRequest] = []
    for e in _acl_entries(resource_type, resource_id):
        if getattr(e, "service_principal_name", None) == sp_app_id:
            continue
        direct = [
            getattr(p, "permission_level", None)
            for p in getattr(e, "all_permissions", None) or []
            if getattr(p, "permission_level", None) and not getattr(p, "inherited", False)
        ]
        if not direct:
            continue
        kwargs: dict = {"permission_level": direct[0]}
        for key in ("user_name", "group_name", "service_principal_name"):
            val = getattr(e, key, None)
            if val:
                kwargs[key] = val
        if len(kwargs) > 1:  # has a principal, not just a level
            rebuilt.append(AccessControlRequest(**kwargs))
    runtime.admin_client().permissions.set(
        _object_type(resource_type),
        resource_id,
        access_control_list=rebuilt,
    )


def has_access(sp_app_id: str, resource_type: str, resource_id: str) -> bool:
    return _sp_has_access(_acl_entries(resource_type, resource_id), sp_app_id)


def tenant_access(sp_app_id: str) -> dict:
    """Return ``{dashboards:{id:bool}, genie_spaces:{id:bool}}`` for the SP."""
    cat = catalog()
    acl_cache: dict[tuple[str, str], list] = {}

    def _check(resource_type: str, resource_id: str) -> bool:
        key = (resource_type, resource_id)
        if key not in acl_cache:
            acl_cache[key] = _acl_entries(resource_type, resource_id)
        return _sp_has_access(acl_cache[key], sp_app_id)

    return {
        "dashboards": {
            d["id"]: _check("dashboard", d["id"]) for d in cat["dashboards"]
        },
        "genie_spaces": {
            s["id"]: _check("genie_space", s["id"]) for s in cat["genie_spaces"]
        },
    }
