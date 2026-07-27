"""Scoped AI/BI dashboard embed tokens (external embedding, no Databricks login).

Implements the documented 3-step OAuth exchange for "embedding for external
users" (https://docs.databricks.com/aws/en/dashboards/share/embedding/external-embed):

    1. Exchange the app Service Principal's client_id/secret for a broadly
       scoped ``all-apis`` OAuth token.
    2. Call the published dashboard's ``/tokeninfo`` with that token, passing a
       non-PII ``external_viewer_id`` (+ optional Databricks ``external_value``
       param, mapped from session ``tenant_id``).
    3. Re-POST to ``/oidc/v1/token`` echoing the tokeninfo fields to obtain a
       tightly-scoped, browser-safe token.

The frontend drops the returned token in the embed iframe's ``#token=`` hash.
Because the dashboard is published with ``embed_credentials=false``, its
warehouse queries run AS the app SP, so it needs SELECT on the underlying data
(granted out-of-band). This is what removes the Databricks login screen while
keeping the app hosted on Databricks behind the edge gateway.
"""
from __future__ import annotations

import base64
import json
import os
import urllib.parse

import requests
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..config import WORKSPACE_URL, DASHBOARD_URL
from .. import assets as assets_registry

router = APIRouter()

_TIMEOUT = 30


def _default_dashboard_id() -> str:
    """Prefer the resolved registry's default; fall back to the DASHBOARD_URL id."""
    rid = assets_registry.default_dashboard_id()
    if rid:
        return rid
    return DASHBOARD_URL.split("/dashboardsv3/")[-1].split("?")[0].split("/")[0]


_DEFAULT_DASHBOARD_ID = _default_dashboard_id()


def _sp_credentials() -> tuple[str, str]:
    """The app Service Principal's OAuth client_id/secret.

    On Databricks Apps these are injected as DATABRICKS_CLIENT_ID /
    DATABRICKS_CLIENT_SECRET. Locally, set them in the environment (or .env).
    """
    cid = os.environ.get("DATABRICKS_CLIENT_ID") or os.environ.get("EMBED_SP_CLIENT_ID")
    csec = os.environ.get("DATABRICKS_CLIENT_SECRET") or os.environ.get("EMBED_SP_CLIENT_SECRET")
    if not cid or not csec:
        raise RuntimeError(
            "No SP credentials for embed-token minting "
            "(DATABRICKS_CLIENT_ID / DATABRICKS_CLIENT_SECRET not set)."
        )
    return cid, csec


def _resolve_embed_credentials(request: Request) -> tuple[str, str]:
    """Prefer the logged-in tenant's Service Principal, else the app SP.

    When the white-label session maps to a registered tenant, the embed token is
    minted with THAT SP's credentials — so the dashboard's warehouse queries run
    AS the tenant SP and the same Unity Catalog row filter that governs Genie
    (``session_user()`` == the SP) scopes the dashboard rows. Falls back to the
    app SP so embedding keeps working before any tenant is onboarded.
    """
    try:
        from ..tenants import registry, runtime
        from ..tenants.resolver import tenant_id_for_request

        tid = tenant_id_for_request(request)
        if tid:
            row = registry.get_tenant(tid)
            if row and row.status == "active":
                secret = runtime.secret_for_sp(row.sp_app_id)
                if secret:
                    return row.sp_app_id, secret
    except Exception:  # noqa: BLE001 - never block embedding on the isolation layer
        pass
    return _sp_credentials()


def _mint_embed_token(
    dashboard_id: str,
    viewer_id: str,
    tenant_id: str | None,
    credentials: tuple[str, str] | None = None,
) -> dict:
    instance = WORKSPACE_URL.rstrip("/")
    cid, csec = credentials or _sp_credentials()
    basic = base64.b64encode(f"{cid}:{csec}".encode()).decode()

    # 1) broadly-scoped all-apis token for the SP
    r1 = requests.post(
        f"{instance}/oidc/v1/token",
        headers={"Authorization": f"Basic {basic}",
                 "Content-Type": "application/x-www-form-urlencoded"},
        data={"grant_type": "client_credentials", "scope": "all-apis"},
        timeout=_TIMEOUT,
    )
    r1.raise_for_status()
    oidc_token = r1.json()["access_token"]

    # 2) tokeninfo scoped to this published dashboard + viewer
    params = {"external_viewer_id": viewer_id}
    # Databricks' embed API still names this param external_value; we map tenant_id.
    if tenant_id is not None:
        params["external_value"] = tenant_id
    r2 = requests.get(
        f"{instance}/api/2.0/lakeview/dashboards/{dashboard_id}/published/tokeninfo"
        f"?{urllib.parse.urlencode(params)}",
        headers={"Authorization": f"Bearer {oidc_token}"},
        timeout=_TIMEOUT,
    )
    r2.raise_for_status()
    token_info = r2.json()

    # 3) re-issue as a tightly-scoped, browser-safe token
    body = dict(token_info)
    authorization_details = body.pop("authorization_details", None)
    body["grant_type"] = "client_credentials"
    body["authorization_details"] = json.dumps(authorization_details)
    r3 = requests.post(
        f"{instance}/oidc/v1/token",
        headers={"Authorization": f"Basic {basic}",
                 "Content-Type": "application/x-www-form-urlencoded"},
        data=body,
        timeout=_TIMEOUT,
    )
    r3.raise_for_status()
    payload = r3.json()
    return {"token": payload["access_token"], "expires_in": int(payload.get("expires_in", 3600))}


@router.get("/embed/token")
def embed_token(request: Request,
                dashboard_id: str | None = None,
                viewer_id: str = "apex-viewer",
                tenant_id: str | None = None) -> JSONResponse:
    """Return a scoped, browser-safe embed token for the given dashboard.

    When a white-label session is present (``request.state.identity``, set by the
    auth middleware), the logged-in user's ``tenant_id`` and a stable
    ``viewer_id`` derived from the session take precedence over the query-param
    defaults — so each tenant automatically gets row-scoped data without the
    caller having to pass anything. Explicit query params still override when set.
    """
    did = dashboard_id or _DEFAULT_DASHBOARD_ID

    identity = getattr(request.state, "identity", None)
    if identity:
        # Session identity wins over the default viewer; a query-param override
        # (anything other than the default) is still honored.
        if viewer_id == "apex-viewer":
            viewer_id = identity.get("email") or identity.get("tenant") or viewer_id
        if tenant_id is None:
            tenant_id = identity.get("tenant_id")

    try:
        credentials = _resolve_embed_credentials(request)
        result = _mint_embed_token(did, viewer_id, tenant_id, credentials)
        return JSONResponse({"ok": True, "dashboard_id": did, **result})
    except requests.HTTPError as e:
        body = e.response.text[:400] if e.response is not None else str(e)
        return JSONResponse({"ok": False, "error": f"token exchange failed: {body}"}, status_code=502)
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
