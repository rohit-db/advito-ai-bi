"""
Genie **MCP App** (interactive View) proxy for the "Ask Prism Live" page.

Genie One MCP exposes a second ask path, ``view_ask``, that renders charts and
progress inline via an MCP Apps **View** (an ``ui://`` HTML resource) instead of
the text-only ``genie_ask`` used by ``service.py``. See
https://docs.databricks.com/aws/en/agents/mcp/genie-mcp.

The browser is the MCP Apps *host* (it embeds the sandboxed View iframe via
``@mcp-ui/client``), but it must NOT hold Databricks credentials and generally
cannot reach the managed server directly (CORS). So this module is a thin,
**stateless** MCP proxy: every call opens a short-lived MCP session with the
tenant/OBO/SP identity resolved by :func:`resolve_genie` (preserving the
per-tenant SP isolation seam), performs one MCP operation, and returns the
result as the JSON-RPC wire shape the JS SDK expects.

Two things differ from ``service.py``:
  1. We advertise the **UI extension** capability on ``initialize`` — the
     managed server only offers ``view_ask`` + the ``ui://`` resource to
     Apps-capable clients. The stock ``ClientSession.initialize`` cannot send
     the ``extensions`` field, so we send a capability-complete initialize
     ourselves (:func:`_initialize_with_ui`).
  2. We never poll. The View polls Genie itself, routing ``tools/call`` and
     ``resources/read`` back through this proxy (``/app/call-tool`` and
     ``/app/read-resource``).

Endpoints (mounted under /api in app.py):
  GET  /api/genie-mcp/app/health        -> initialize(UI) + tools/list; is view_ask offered?
  POST /api/genie-mcp/app/ask           -> initialize(UI) + view_ask; returns tool result + ui:// uri
  POST /api/genie-mcp/app/read-resource -> resources/read (the View fetches its own HTML)
  POST /api/genie-mcp/app/call-tool     -> tools/call   (the View's own poll / drill-down calls)
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import AnyUrl, BaseModel
from mcp import ClientSession, types
from mcp.client.streamable_http import streamablehttp_client

from ...config import GENIE_SPACE_ID
from .auth import resolve_genie
from .urls import resolve_genie_mcp_url, MODE_MULTI

logger = logging.getLogger(__name__)

router = APIRouter()

# SEP-1724 UI extension capability. The managed Genie MCP server gates `view_ask`
# and the `ui://` View resource behind this — mirror @mcp-ui/client's
# UI_EXTENSION_CAPABILITIES so the browser host and this proxy negotiate the same
# contract.
_UI_EXTENSION = {
    "io.modelcontextprotocol/ui": {"mimeTypes": ["text/html;profile=mcp-app"]},
}

_CLIENT_INFO = types.Implementation(name="prism-ask-live", version="1.0.0")

# MCP Apps (view_ask + the ui:// View) requires the 2025-11-25 protocol. The
# pinned ``mcp`` SDK's ``LATEST_PROTOCOL_VERSION`` is older (2025-06-18), which
# predates MCP Apps, so we advertise this explicitly on the App-View path. The
# text-only ``genie_ask`` path (service.py) is unaffected.
_APP_PROTOCOL_VERSION = "2025-11-25"


def _resolve_app_token(request: Request) -> tuple[str, str]:
    """Resolve bearer token for the App-View MCP proxy.

    Production path: ``resolve_genie`` (tenant SP → OBO → app SP → PAT).

  Demo-only: when ``GENIE_APP_DEMO_PROFILE`` is set, mint a user token from that
  Databricks CLI profile instead. Use with ``GENIE_MCP_SERVER_URL`` pointing at a
  workspace that serves ``view_ask`` (e.g. e2-demo-field-eng). Never enable in
  production deployments.
    """
    demo_profile = (os.environ.get("GENIE_APP_DEMO_PROFILE") or "").strip()
    if demo_profile:
        from databricks.sdk import WorkspaceClient

        wc = WorkspaceClient(profile=demo_profile)
        hdrs = wc.config.authenticate() or {}
        token = hdrs.get("Authorization", "").replace("Bearer ", "").strip()
        if not token:
            raise RuntimeError(f"Could not obtain token for GENIE_APP_DEMO_PROFILE={demo_profile!r}")
        return token, "demo_profile"
    token, token_type, _ = resolve_genie(request)
    return token, token_type


async def _initialize_with_ui(session: ClientSession) -> types.InitializeResult:
    """Initialize advertising the UI extension so `view_ask` is offered.

    ``ClientSession.initialize`` hardcodes capabilities and cannot send the
    ``extensions`` field, so we issue the initialize handshake directly.
    ``ClientCapabilities`` is ``extra="allow"``, so ``extensions`` serializes.
    """
    capabilities = types.ClientCapabilities(experimental=None, extensions=_UI_EXTENSION)
    result = await session.send_request(
        types.ClientRequest(
            types.InitializeRequest(
                method="initialize",
                params=types.InitializeRequestParams(
                    protocolVersion=_APP_PROTOCOL_VERSION,
                    capabilities=capabilities,
                    clientInfo=_CLIENT_INFO,
                ),
            )
        ),
        types.InitializeResult,
    )
    await session.send_notification(
        types.ClientNotification(types.InitializedNotification(method="notifications/initialized"))
    )
    return result


@asynccontextmanager
async def _session(request: Request):
    """Open a short-lived, UI-capable MCP session to Genie One MCP.

    Yields the initialized ``ClientSession``. Identity comes from
    :func:`resolve_genie` (tenant SP → OBO → app SP → PAT), so the UC row filter
    still scopes results per tenant. ``view_ask`` is a Genie One (workspace-wide)
    tool, so we always target the ``multi`` URL.
    """
    token, _token_type = _resolve_app_token(request)
    server_url = resolve_genie_mcp_url(None, MODE_MULTI)
    headers = {"Authorization": f"Bearer {token}"}
    async with streamablehttp_client(server_url, headers=headers) as (read, write, _):
        async with ClientSession(read, write) as session:
            await _initialize_with_ui(session)
            yield session


def _dump(model: Any) -> Any:
    """Serialize an MCP result to its JSON-RPC wire shape (camelCase / _meta)."""
    return model.model_dump(mode="json", by_alias=True, exclude_none=True)


def _resource_uri(tool: types.Tool) -> Optional[str]:
    """Read the tool's declared MCP App resource URI (``_meta.ui.resourceUri``)."""
    meta = tool.meta or {}
    ui = meta.get("ui") if isinstance(meta, dict) else None
    if isinstance(ui, dict):
        return ui.get("resourceUri") or ui.get("resource_uri")
    return None


def _find_view_tool(tools: list[types.Tool]) -> Optional[types.Tool]:
    by_name = {t.name: t for t in tools}
    if "view_ask" in by_name:
        return by_name["view_ask"]
    return next(
        (t for t in tools if "view" in t.name.lower() and "ask" in t.name.lower()),
        None,
    )


def _extract(structured: Optional[dict], *keys: str) -> Optional[str]:
    if not isinstance(structured, dict):
        return None
    for k in keys:
        v = structured.get(k)
        if v:
            return v
    return None


class AppAskRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None


class ReadResourceRequest(BaseModel):
    uri: str


class CallToolRequest(BaseModel):
    name: str
    arguments: Optional[dict[str, Any]] = None


@router.get("/genie-mcp/app/health")
async def app_health(request: Request):
    """Prove a UI-capable MCP session and report whether ``view_ask`` is offered."""
    try:
        async with _session(request) as session:
            tools = (await session.list_tools()).tools or []
            view = _find_view_tool(tools)
            return {
                "ok": True,
                "hasViewAsk": view is not None,
                "toolName": view.name if view else None,
                "resourceUri": _resource_uri(view) if view else None,
                "tools": [t.name for t in tools],
            }
    except Exception as e:  # noqa: BLE001 - surface connection/auth/preview failures to the UI
        logger.exception("genie-mcp app health failed")
        return JSONResponse(status_code=500, content={"ok": False, "message": str(e)})


@router.post("/genie-mcp/app/ask")
async def app_ask(req: AppAskRequest, request: Request):
    """Start a View turn: call ``view_ask`` and return its result + ``ui://`` uri.

    The browser hands the returned ``resourceUri`` + ``toolResult`` to
    ``@mcp-ui/client``'s ``AppRenderer``, which fetches the View HTML (via
    ``/app/read-resource``) and lets the View poll Genie (via ``/app/call-tool``).
    """
    if not (req.question or "").strip():
        return JSONResponse(status_code=400, content={"ok": False, "message": "question is required"})
    try:
        async with _session(request) as session:
            tools = (await session.list_tools()).tools or []
            view = _find_view_tool(tools)
            if view is None:
                return JSONResponse(
                    status_code=502,
                    content={
                        "ok": False,
                        "message": (
                            "The Genie MCP App View (view_ask) is not available on this workspace. "
                            "Enable the 'Managed MCP Servers' preview and Chat in Genie One, then retry."
                        ),
                        "tools": [t.name for t in tools],
                    },
                )

            args: dict[str, Any] = {"question": req.question}
            if req.conversation_id:
                args["conversation_id"] = req.conversation_id
            result = await session.call_tool(view.name, args)

            structured = result.structuredContent if isinstance(result.structuredContent, dict) else {}
            return {
                "ok": True,
                "toolName": view.name,
                "resourceUri": _resource_uri(view),
                "toolResult": _dump(result),
                "conversationId": _extract(structured, "conversation_id", "conversationId"),
                "deepLink": _extract(structured, "deep_link", "deepLink"),
            }
    except Exception as e:  # noqa: BLE001
        logger.exception("genie-mcp app ask failed")
        return JSONResponse(status_code=500, content={"ok": False, "message": str(e)})


@router.post("/genie-mcp/app/read-resource")
async def app_read_resource(req: ReadResourceRequest, request: Request):
    """Proxy ``resources/read`` — the View fetches its own ``ui://`` HTML."""
    try:
        async with _session(request) as session:
            result = await session.read_resource(AnyUrl(req.uri))
            return _dump(result)
    except Exception as e:  # noqa: BLE001
        logger.exception("genie-mcp app read-resource failed")
        return JSONResponse(status_code=500, content={"ok": False, "message": str(e)})


@router.post("/genie-mcp/app/call-tool")
async def app_call_tool(req: CallToolRequest, request: Request):
    """Proxy ``tools/call`` — the View's own poll / drill-down calls flow here."""
    try:
        async with _session(request) as session:
            result = await session.call_tool(req.name, req.arguments or {})
            return _dump(result)
    except Exception as e:  # noqa: BLE001
        logger.exception("genie-mcp app call-tool failed")
        return JSONResponse(status_code=500, content={"ok": False, "message": str(e)})
