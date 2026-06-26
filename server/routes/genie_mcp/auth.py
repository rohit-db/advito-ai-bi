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
