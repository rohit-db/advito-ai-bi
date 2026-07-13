"""Process-wide singletons for the per-tenant isolation layer.

  * :func:`minter`        — shared :class:`TokenMinter` (per-SP token cache).
  * :func:`admin_client`  — WorkspaceClient used for SP lifecycle + admin SQL.
  * :func:`warehouse_id`  — resolved SQL warehouse id (by name, cached).
  * :func:`secret_for_sp` — decrypted SP secret from the registry.

``admin_client`` uses ``TENANTS_ADMIN_PROFILE`` when set (so you can onboard
locally as your admin CLI profile without making the app SP a workspace admin),
otherwise the app's Service-Principal-first client.
"""
from __future__ import annotations

import logging
from typing import Optional

from ..config import (
    TENANTS_ADMIN_PROFILE,
    WAREHOUSE_NAME,
    WORKSPACE_URL,
    get_workspace_client,
)
from . import registry
from .minter import TokenMinter

logger = logging.getLogger("server.tenants.runtime")

_minter: Optional[TokenMinter] = None
_admin_client = None
_warehouse_id: Optional[str] = None


def minter() -> TokenMinter:
    global _minter
    if _minter is None:
        _minter = TokenMinter(WORKSPACE_URL)
    return _minter


def invalidate_minter(sp_app_id: str) -> None:
    minter().invalidate(sp_app_id)


def admin_client():
    """WorkspaceClient for SP lifecycle / admin SQL (needs workspace-admin)."""
    global _admin_client
    if _admin_client is None:
        if TENANTS_ADMIN_PROFILE:
            from databricks.sdk import WorkspaceClient

            _admin_client = WorkspaceClient(profile=TENANTS_ADMIN_PROFILE)
        else:
            _admin_client = get_workspace_client()
    return _admin_client


def secret_for_sp(sp_app_id: str) -> Optional[str]:
    return registry.get_secret(sp_app_id)


def warehouse_id() -> str:
    """Resolve a SQL warehouse id by name (falls back to the first available)."""
    global _warehouse_id
    if _warehouse_id:
        return _warehouse_id
    w = admin_client()
    wid = None
    for wh in w.warehouses.list():
        if wh.name == WAREHOUSE_NAME:
            wid = wh.id
            break
    if wid is None:
        for wh in w.warehouses.list():
            wid = wh.id
            break
    if wid is None:
        raise RuntimeError("No SQL warehouse available in this workspace")
    _warehouse_id = wid
    return wid
