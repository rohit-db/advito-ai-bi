"""
Auth for the Genie MCP connection.

Prefer the on-behalf-of (OBO) user token the Databricks App platform injects as
``x-forwarded-access-token`` (requires the ``genie`` user API scope), so Genie
runs AS THE USER under Unity Catalog governance. Falls back to the app service
principal (Databricks App) or a local PAT for dev.
"""

import os

from fastapi import Request
from databricks.sdk import WorkspaceClient

from ...config import IS_DATABRICKS_APP


def resolve_token(request: Request) -> tuple[str, str]:
    """Return (bearer_token, token_type). OBO user token first, SP/PAT fallback."""
    obo = request.headers.get("x-forwarded-access-token")
    if obo:
        return obo, "obo"

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
            "No OBO token and no local PAT (env 'token') available for the MCP connection"
        )
    return pat, "service_principal"
