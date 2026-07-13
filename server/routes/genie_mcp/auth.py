"""
Auth for the Genie MCP connection.

When hosted externally (the default for this branch) Genie runs AS THE APP
SERVICE PRINCIPAL, authenticated via M2M (DATABRICKS_CLIENT_ID/SECRET) — no
Databricks login and no Databricks Apps platform required.

If an on-behalf-of (OBO) user token is forwarded (e.g. inside a Databricks App
via ``x-forwarded-access-token`` with the ``genie`` user API scope, or by your
own IdP), it is honored first so Genie runs as the user under UC governance.
"""

import os

from fastapi import Request
from databricks.sdk import WorkspaceClient

from ...config import IS_DATABRICKS_APP, get_sp_bearer


def resolve_genie(request: Request) -> tuple[str, str, str | None]:
    """Resolve (bearer_token, token_type, space_id_override) for a Genie turn.

    Multi-tenant path first: if the logged-in white-label session maps to a
    tenant Service Principal (``external_value`` == a registered tenant), Genie
    runs AS THAT SP, so ``session_user()`` resolves to the SP and the Unity
    Catalog row filter scopes results to the tenant. A per-tenant Genie space
    override (``client_registry.genie_space_id``) is returned when set.

    Falls back to the standard resolution (OBO → app SP → PAT) with no space
    override, so health checks and pre-onboarding requests still work.
    """
    try:
        from ...tenants.resolver import resolve_tenant_sp

        hit = resolve_tenant_sp(request)
        if hit:
            token, row = hit
            return token, "tenant_sp", (row.genie_space_id or None)
    except Exception:  # noqa: BLE001 - never block on the isolation layer
        pass
    token, token_type = resolve_token(request)
    return token, token_type, None


def resolve_token(request: Request) -> tuple[str, str]:
    """Return (bearer_token, token_type). OBO user token first, SP/PAT fallback."""
    obo = request.headers.get("x-forwarded-access-token")
    if obo:
        return obo, "obo"

    # Host-agnostic Service Principal (M2M). Works on EC2/ECS/any container and
    # inside Databricks Apps — this is the portable path for external hosting.
    sp_token = get_sp_bearer()
    if sp_token:
        return sp_token, "service_principal"

    if IS_DATABRICKS_APP:
        sp = WorkspaceClient()
        headers = sp.config.authenticate() or {}
        auth = headers.get("Authorization", "")
        token = auth.replace("Bearer ", "").strip()
        if not token:
            raise RuntimeError("Could not obtain a service-principal token")
        return token, "service_principal"

    pat = os.environ.get("token")
    if not pat:
        raise RuntimeError(
            "No OBO token, no SP credentials (DATABRICKS_CLIENT_ID/SECRET), and no "
            "local PAT (env 'token') available for the MCP connection"
        )
    return pat, "service_principal"
