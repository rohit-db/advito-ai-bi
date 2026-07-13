"""Resolve a logged-in white-label session to its tenant Service Principal.

This is the seam wired into the Genie MCP auth and the AI/BI embed route. Given
a request's signed session identity, it looks up the tenant SP (by the user's
``tenant_id`` == ``apex_client_registry.tenant_id``), mints an M2M token for
that SP, and returns ``(bearer_token, TenantRow)``.

Returns ``None`` when there is no session, the user is an operator/all-rows
(``tenant_id`` empty or ``*``), the tenant is not onboarded, or its SP is
inactive. Callers then fall back to the app Service Principal, so the app keeps
working before any tenant has been onboarded (graceful degradation).
"""
from __future__ import annotations

import logging
from typing import Optional, Tuple

from fastapi import Request

from ..auth.sessions import SESSION_COOKIE, verify_session
from . import registry, runtime
from .registry import TenantRow

logger = logging.getLogger("server.tenants.resolver")


def session_identity(request: Request) -> Optional[dict]:
    """Return the normalized identity from the signed session cookie, or None."""
    return verify_session(request.cookies.get(SESSION_COOKIE))


def tenant_id_for_request(request: Request) -> Optional[str]:
    """The tenant key for this request: the session's ``tenant_id``.

    ``*`` (all-rows / operator) and empty values are not tenant SPs.
    """
    ident = session_identity(request)
    if not ident:
        return None
    tid = (ident.get("tenant_id") or "").strip()
    if not tid or tid == "*":
        return None
    return tid


def resolve_tenant_sp(request: Request) -> Optional[Tuple[str, TenantRow]]:
    """Return ``(bearer_token, TenantRow)`` for the request's tenant, or None."""
    tid = tenant_id_for_request(request)
    if not tid:
        return None
    row = registry.get_tenant(tid)
    if not row or row.status != "active":
        return None
    secret = runtime.secret_for_sp(row.sp_app_id)
    if not secret:
        logger.warning("tenant %s is registered but has no stored SP secret", tid)
        return None
    try:
        token = runtime.minter().get_token(row.sp_app_id, secret)
    except Exception as e:  # noqa: BLE001
        logger.warning("tenant SP token mint failed for %s: %s", tid, e)
        return None
    return token, row
