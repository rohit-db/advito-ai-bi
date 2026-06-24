"""Scoped AI/BI dashboard embed tokens (external embedding, no Databricks login).

Implements the documented 3-step OAuth exchange for "embedding for external
users" (https://docs.databricks.com/aws/en/dashboards/share/embedding/external-embed):

    1. Exchange the app Service Principal's client_id/secret for a broadly
       scoped ``all-apis`` OAuth token.
    2. Call the published dashboard's ``/tokeninfo`` with that token, passing a
       non-PII ``external_viewer_id`` (+ optional ``external_value`` for UC
       row-level scoping).
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
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..config import WORKSPACE_URL, DASHBOARD_URL

router = APIRouter()

_TIMEOUT = 30
# Default dashboard id parsed from DASHBOARD_URL (…/embed/dashboardsv3/<id>?…).
_DEFAULT_DASHBOARD_ID = DASHBOARD_URL.split("/dashboardsv3/")[-1].split("?")[0].split("/")[0]


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


def _mint_embed_token(dashboard_id: str, viewer_id: str, external_value: str | None) -> dict:
    instance = WORKSPACE_URL.rstrip("/")
    cid, csec = _sp_credentials()
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
    if external_value is not None:
        params["external_value"] = external_value
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
def embed_token(dashboard_id: str | None = None,
                viewer_id: str = "apex-viewer",
                external_value: str | None = None) -> JSONResponse:
    """Return a scoped, browser-safe embed token for the given dashboard."""
    did = dashboard_id or _DEFAULT_DASHBOARD_ID
    try:
        result = _mint_embed_token(did, viewer_id, external_value)
        return JSONResponse({"ok": True, "dashboard_id": did, **result})
    except requests.HTTPError as e:
        body = e.response.text[:400] if e.response is not None else str(e)
        return JSONResponse({"ok": False, "error": f"token exchange failed: {body}"}, status_code=502)
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
