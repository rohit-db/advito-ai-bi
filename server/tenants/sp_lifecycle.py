"""Service Principal lifecycle for per-tenant isolation (Databricks SDK).

Each tenant gets a dedicated workspace Service Principal, created/rotated/
deleted here via :func:`server.tenants.runtime.admin_client` (a workspace-admin
capable ``WorkspaceClient``). Every function is best-effort with explicit errors
and, for :func:`onboard_sp`, transactional rollback: if anything fails after the
SP is created we delete the SP + any registry rows and re-raise, so a half-baked
tenant is never left behind.

Only the imports live at module top; all SDK calls happen inside functions so
this module imports cleanly without network / databricks-sdk auth.
"""
from __future__ import annotations

import logging
from typing import Optional

from ..config import TENANT_SP_PREFIX
from . import registry, runtime

logger = logging.getLogger("server.tenants.sp_lifecycle")


# ----------------------------------------------------------------- helpers
def _sp_db_id(w, sp_app_id: str) -> str:
    """Resolve a Service Principal's internal (database) id from its app id.

    The SDK secrets proxy and update/delete calls key off the internal ``id``,
    while the registry / OAuth flows use the ``application_id`` (client id).
    """
    if not sp_app_id:
        raise RuntimeError("sp_app_id is required to resolve the SP internal id")
    matches = list(
        w.service_principals.list(filter=f"applicationId eq '{sp_app_id}'")
    )
    for sp in matches:
        db_id = getattr(sp, "id", None)
        if db_id is not None:
            return str(db_id)
    raise RuntimeError(f"No Service Principal found for application_id={sp_app_id}")


def _secret_value(created) -> str:
    """Pull the plaintext secret out of a secrets-proxy create response."""
    secret = getattr(created, "secret", None)
    if not secret:
        raise RuntimeError("SP secret creation returned no secret value")
    return secret


def _set_active(w, sp_db_id: str, active: bool) -> None:
    """Toggle a Service Principal's ``active`` flag, tolerating SDK variants.

    Prefers a SCIM ``patch``; falls back to a full ``update`` when patch is
    unavailable or fails.
    """
    try:
        from databricks.sdk.service import iam

        op = iam.Patch(
            op=iam.PatchOp.REPLACE,
            path="active",
            value=active,
        )
        w.service_principals.patch(
            id=sp_db_id,
            operations=[op],
            schemas=[iam.PatchSchema.URN_IETF_PARAMS_SCIM_API_MESSAGES_2_0_PATCH_OP],
        )
        return
    except Exception as e:  # noqa: BLE001 - fall back to full update
        logger.debug("patch active=%s failed (%s); trying update", active, e)

    # Full replace requires re-sending identifying fields.
    sp = w.service_principals.get(id=sp_db_id)
    w.service_principals.update(
        id=sp_db_id,
        application_id=getattr(sp, "application_id", None),
        display_name=getattr(sp, "display_name", None),
        active=active,
    )


def _delete_all_secrets(w, sp_db_id: str, keep_ids: Optional[set] = None) -> None:
    """Delete every OAuth secret for an SP, optionally keeping some ids."""
    keep_ids = keep_ids or set()
    try:
        existing = list(
            w.service_principal_secrets_proxy.list(service_principal_id=sp_db_id)
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("could not list SP secrets for %s: %s", sp_db_id, e)
        return
    for sec in existing:
        sid = getattr(sec, "id", None)
        if sid is None or str(sid) in keep_ids:
            continue
        try:
            w.service_principal_secrets_proxy.delete(
                service_principal_id=sp_db_id, secret_id=str(sid)
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("could not delete SP secret %s: %s", sid, e)


# ----------------------------------------------------------------- lifecycle
def onboard_sp(
    tenant_id: str,
    display_name: str,
    genie_space_id: Optional[str] = None,
) -> dict:
    """Create a dedicated SP for a tenant, mint a secret, and register it.

    Returns ``{tenant_id, sp_app_id, sp_display_name, client_secret}``. On any
    failure after the SP is created, rolls back (delete SP + registry rows) and
    re-raises.
    """
    w = runtime.admin_client()
    display = f"{TENANT_SP_PREFIX}-{tenant_id}"

    sp = w.service_principals.create(display_name=display, active=True)
    sp_app_id = getattr(sp, "application_id", None)
    sp_db_id = getattr(sp, "id", None)
    if not sp_app_id or sp_db_id is None:
        raise RuntimeError(
            "Service Principal creation returned no application_id/id"
        )
    sp_db_id = str(sp_db_id)

    try:
        created = w.service_principal_secrets_proxy.create(
            service_principal_id=sp_db_id
        )
        secret = _secret_value(created)

        registry.insert_tenant(
            tenant_id=tenant_id,
            display_name=display_name,
            sp_app_id=sp_app_id,
            sp_display_name=display,
            genie_space_id=genie_space_id,
        )
        registry.put_secret(sp_app_id, secret)
    except Exception as e:  # noqa: BLE001 - roll back the SP + registry rows
        logger.error("onboard_sp failed for %s, rolling back: %s", tenant_id, e)
        try:
            w.service_principals.delete(id=sp_db_id)
        except Exception as re:  # noqa: BLE001
            logger.warning("rollback: could not delete SP %s: %s", sp_db_id, re)
        try:
            registry.delete_secret(sp_app_id)
        except Exception:  # noqa: BLE001
            pass
        try:
            registry.delete_tenant(tenant_id)
        except Exception:  # noqa: BLE001
            pass
        raise

    return {
        "tenant_id": tenant_id,
        "sp_app_id": sp_app_id,
        "sp_display_name": display,
        "client_secret": secret,
    }


def rotate_secret(tenant_id: str) -> str:
    """Mint a fresh SP secret, store it, and revoke every previous secret."""
    row = registry.get_tenant(tenant_id)
    if not row:
        raise RuntimeError(f"tenant {tenant_id} not found in registry")

    w = runtime.admin_client()
    sp_db_id = _sp_db_id(w, row.sp_app_id)

    created = w.service_principal_secrets_proxy.create(service_principal_id=sp_db_id)
    new_secret = _secret_value(created)
    new_id = getattr(created, "id", None)

    registry.put_secret(row.sp_app_id, new_secret)

    # Revoke all OTHER (old) secrets, keeping only the one we just minted.
    keep = {str(new_id)} if new_id is not None else set()
    _delete_all_secrets(w, sp_db_id, keep_ids=keep)

    runtime.invalidate_minter(row.sp_app_id)
    registry.set_tenant_status(tenant_id, "active")
    return new_secret


def deactivate(tenant_id: str) -> None:
    """Disable a tenant SP: set inactive, revoke secrets, mark deactivated."""
    row = registry.get_tenant(tenant_id)
    if not row:
        raise RuntimeError(f"tenant {tenant_id} not found in registry")

    w = runtime.admin_client()
    sp_db_id = _sp_db_id(w, row.sp_app_id)

    _set_active(w, sp_db_id, False)
    _delete_all_secrets(w, sp_db_id)
    registry.delete_secret(row.sp_app_id)
    registry.set_tenant_status(tenant_id, "deactivated")
    runtime.invalidate_minter(row.sp_app_id)


def reactivate(tenant_id: str) -> str:
    """Re-enable a deactivated tenant SP and mint a fresh secret."""
    row = registry.get_tenant(tenant_id)
    if not row:
        raise RuntimeError(f"tenant {tenant_id} not found in registry")

    w = runtime.admin_client()
    sp_db_id = _sp_db_id(w, row.sp_app_id)

    _set_active(w, sp_db_id, True)

    created = w.service_principal_secrets_proxy.create(service_principal_id=sp_db_id)
    new_secret = _secret_value(created)

    registry.put_secret(row.sp_app_id, new_secret)
    registry.set_tenant_status(tenant_id, "active")
    runtime.invalidate_minter(row.sp_app_id)
    return new_secret


def delete(tenant_id: str) -> None:
    """Best-effort teardown: delete the SP and remove all registry rows."""
    row = registry.get_tenant(tenant_id)
    if not row:
        raise RuntimeError(f"tenant {tenant_id} not found in registry")

    w = runtime.admin_client()
    try:
        sp_db_id = _sp_db_id(w, row.sp_app_id)
        w.service_principals.delete(id=sp_db_id)
    except Exception as e:  # noqa: BLE001
        logger.warning("could not delete SP for tenant %s: %s", tenant_id, e)

    registry.delete_secret(row.sp_app_id)
    registry.delete_tenant(tenant_id)
    runtime.invalidate_minter(row.sp_app_id)
