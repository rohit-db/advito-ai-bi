"""Grantable resource catalog + per-tenant access management.

The operator admin UI grants a tenant's Service Principal ``CAN_RUN`` on
individual AI/BI dashboards and Genie spaces. This module is the seam between
that UI and the Databricks permissions API.

The **catalog** of grantable resources is declarative (env), so more dashboards
or Genie spaces can be added without code changes:

  RESOURCE_DASHBOARDS=<id>:<Label>,<id>:<Label>
  RESOURCE_GENIE_SPACES=<id>:<Label>,<id>:<Label>

Both fall back to the app defaults when unset — ``DASHBOARD_IDS`` for dashboards
and ``GENIE_SPACE_ID`` for the single Ask Prism space — so existing single-resource
deployments keep working.

Grants run as the admin client (``runtime.admin_client`` → ``TENANTS_ADMIN_PROFILE``
when set), which needs CAN_MANAGE on the object.
"""
from __future__ import annotations

import logging
import os

from databricks.sdk.service.iam import AccessControlRequest, PermissionLevel

from . import runtime

logger = logging.getLogger("server.tenants.resources")

# Permissions-API object types, keyed by our logical resource_type.
_PERM_OBJECT_TYPES = {
    "dashboard": "dashboards",
    "genie_space": "genie",
}
# Must be the SDK enum, not the bare string — AccessControlRequest serialization
# calls `.value` on permission_level (a plain "CAN_RUN" str raises
# 'str' object has no attribute 'value' when the grant request is sent).
_PERMISSION_LEVEL = PermissionLevel.CAN_RUN


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
        spaces = [{"id": GENIE_SPACE_ID, "name": "Ask Prism (default)"}]

    return {"dashboards": dashboards, "genie_spaces": spaces}


# ---- Workspace discovery (for the asset-editor pickers) ---------------------
# These list what EXISTS in the workspace so an operator can pick a dashboard /
# Genie space by name instead of pasting a UUID. Distinct from catalog(), which
# returns the already-configured *grantable* set. Both are fail-soft: on any SDK
# error they return [] so the editor falls back to free-text entry.

def list_workspace_dashboards() -> list[dict]:
    """All published Lakeview dashboards in the workspace as ``[{id, name}]``."""
    try:
        out: list[dict] = []
        for d in runtime.admin_client().lakeview.list():
            did = getattr(d, "dashboard_id", None)
            if not did:
                continue
            name = getattr(d, "display_name", None) or did
            out.append({"id": did, "name": name})
        return out
    except Exception as e:  # noqa: BLE001 — discovery is best-effort
        logger.warning("list_workspace_dashboards failed: %s", e)
        return []


def list_workspace_genie_spaces() -> list[dict]:
    """All Genie spaces in the workspace as ``[{id, name}]``.

    The SDK's ``genie.list_spaces()`` returns a response wrapper (``.spaces``),
    not an iterable; fall back to the REST endpoint if the shape differs.
    """
    client = runtime.admin_client()
    try:
        resp = client.genie.list_spaces()
        spaces = getattr(resp, "spaces", None)
        if spaces is None and isinstance(resp, (list, tuple)):
            spaces = resp
        out: list[dict] = []
        for s in spaces or []:
            sid = getattr(s, "space_id", None) or getattr(s, "id", None)
            if not sid:
                continue
            name = getattr(s, "title", None) or getattr(s, "display_name", None) or sid
            out.append({"id": sid, "name": name})
        if out:
            return out
    except Exception as e:  # noqa: BLE001
        logger.warning("genie.list_spaces failed, trying REST: %s", e)
    # REST fallback
    try:
        resp = client.api_client.do("GET", "/api/2.0/genie/spaces")
        spaces = resp.get("spaces", []) if isinstance(resp, dict) else []
        return [
            {"id": s.get("space_id") or s.get("id"),
             "name": s.get("title") or s.get("display_name") or (s.get("space_id") or s.get("id"))}
            for s in spaces
            if s.get("space_id") or s.get("id")
        ]
    except Exception as e:  # noqa: BLE001
        logger.warning("REST genie/spaces failed: %s", e)
        return []


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


def access_matrix(sp_app_ids: list[str]) -> dict:
    """Access for MANY SPs at once, fetching each resource ACL exactly once.

    Returns ``{sp_app_id: {dashboards:{id:bool}, genie_spaces:{id:bool}}}``. Cost
    scales with the number of resources, not tenants*resources — the right shape
    for the admin access grid.
    """
    if not sp_app_ids:
        return {}
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
