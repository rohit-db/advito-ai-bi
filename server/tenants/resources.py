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

from . import runtime

logger = logging.getLogger("server.tenants.resources")

# Permissions-API object paths, keyed by our logical resource_type.
_PERM_PATHS = {
    "dashboard": "/api/2.0/permissions/dashboards/{id}",
    "genie_space": "/api/2.0/permissions/genie/{id}",
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

    dashboards = _parse(os.environ.get("RESOURCE_DASHBOARDS", ""))
    if not dashboards:
        dashboards = _parse(os.environ.get("DASHBOARD_IDS", ""))

    spaces = _parse(os.environ.get("RESOURCE_GENIE_SPACES", ""))
    if not spaces and GENIE_SPACE_ID:
        spaces = [{"id": GENIE_SPACE_ID, "name": "Ask APEX (default)"}]

    return {"dashboards": dashboards, "genie_spaces": spaces}


def _path(resource_type: str, resource_id: str) -> str:
    tmpl = _PERM_PATHS.get(resource_type)
    if not tmpl:
        raise ValueError(f"unknown resource_type: {resource_type!r}")
    return tmpl.format(id=resource_id)


def _acl(path: str) -> list[dict]:
    res = runtime.admin_client().api_client.do("GET", path)
    if isinstance(res, dict):
        return res.get("access_control_list", []) or []
    return []


def grant(sp_app_id: str, resource_type: str, resource_id: str) -> None:
    """Give the tenant SP CAN_RUN on the resource (PATCH merges, non-destructive)."""
    runtime.admin_client().api_client.do(
        "PATCH",
        _path(resource_type, resource_id),
        body={
            "access_control_list": [
                {"service_principal_name": sp_app_id, "permission_level": _PERMISSION_LEVEL}
            ]
        },
    )


def revoke(sp_app_id: str, resource_type: str, resource_id: str) -> None:
    """Remove the tenant SP from the resource ACL.

    The permissions API has no per-principal delete, so we GET the ACL and PUT it
    back without this SP — preserving every other principal's *direct* (non-
    inherited) permission. Inherited permissions are omitted (they re-apply
    automatically and can't be set explicitly).
    """
    path = _path(resource_type, resource_id)
    rebuilt: list[dict] = []
    for e in _acl(path):
        if e.get("service_principal_name") == sp_app_id:
            continue
        direct = [
            p.get("permission_level")
            for p in e.get("all_permissions", [])
            if p.get("permission_level") and not p.get("inherited")
        ]
        if not direct:
            continue
        entry: dict = {"permission_level": direct[0]}
        for key in ("user_name", "group_name", "service_principal_name"):
            if e.get(key):
                entry[key] = e[key]
        if len(entry) > 1:  # has a principal, not just a level
            rebuilt.append(entry)
    runtime.admin_client().api_client.do(
        "PUT", path, body={"access_control_list": rebuilt}
    )


def has_access(sp_app_id: str, resource_type: str, resource_id: str) -> bool:
    for e in _acl(_path(resource_type, resource_id)):
        if e.get("service_principal_name") == sp_app_id and any(
            p.get("permission_level") for p in e.get("all_permissions", [])
        ):
            return True
    return False


def tenant_access(sp_app_id: str) -> dict:
    """Return ``{dashboards:{id:bool}, genie_spaces:{id:bool}}`` for the SP."""
    cat = catalog()
    return {
        "dashboards": {
            d["id"]: has_access(sp_app_id, "dashboard", d["id"]) for d in cat["dashboards"]
        },
        "genie_spaces": {
            s["id"]: has_access(sp_app_id, "genie_space", s["id"]) for s in cat["genie_spaces"]
        },
    }
