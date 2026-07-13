"""
Genie MCP HTTP routes (thin).

Answers travel-analytics questions by talking to a Databricks **managed Genie
MCP server** with a real MCP client (the official ``mcp`` Python SDK) over
Streamable HTTP — showcasing that grounded analytics, governed SQL, and the
agent runtime are all native to the Databricks Data Intelligence Platform.

Endpoints (mounted under /api in app.py):
  GET  /api/genie-mcp/health  -> connect + tools/list (proves a live MCP session)
  POST /api/genie-mcp/ask     -> SSE stream of the ask -> poll -> answer lifecycle

These handlers only resolve auth + mode and adapt the framework-agnostic core in
``service.py`` to FastAPI/SSE.

Reference: https://docs.databricks.com/aws/en/generative-ai/mcp/managed-mcp
"""

import logging
from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from ...config import GENIE_SPACE_ID
from .auth import resolve_genie
from .urls import normalize_mode, resolve_genie_mcp_url, MODE_SPACE
from .service import probe_health, run_genie_turn
from .sse import sse

logger = logging.getLogger(__name__)

router = APIRouter()


class AskRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    context: Optional[str] = None
    # "space" -> per-space Genie Space MCP; "multi" -> workspace-wide Genie MCP.
    mode: Optional[str] = MODE_SPACE


@router.get("/genie-mcp/health")
async def health(request: Request):
    """Connect to the managed Genie MCP server and list its tools.

    Query param `mode` selects which server shape to probe:
      mode=space (default) -> per-space Genie Space MCP
      mode=multi           -> workspace-wide Genie MCP
    """
    mode = normalize_mode(request.query_params.get("mode"))
    server_url: Optional[str] = None
    try:
        token, token_type, space_override = resolve_genie(request)
        space_id = space_override or GENIE_SPACE_ID or None
        server_url = resolve_genie_mcp_url(space_id, mode)
        return await probe_health(token=token, token_type=token_type, space_id=space_id, mode=mode)
    except Exception as e:  # noqa: BLE001 - surface any connection/auth failure
        logger.exception("genie-mcp health check failed")
        return JSONResponse(
            status_code=500,
            content={"ok": False, "mode": mode, "server_url": server_url, "message": str(e)},
        )


@router.post("/genie-mcp/ask")
async def ask(req: AskRequest, request: Request):
    """Stream the full Genie MCP ask -> poll -> answer lifecycle over SSE.

    Emits `data: {json}\\n\\n` frames (meta | status | sql | table | text |
    deep_link | tool_call | error) and terminates with `data: [DONE]`.
    """
    mode = normalize_mode(req.mode)

    async def event_stream():
        try:
            token, token_type, space_override = resolve_genie(request)
            space_id = space_override or GENIE_SPACE_ID or None
        except Exception as e:  # noqa: BLE001
            yield sse({"type": "error", "content": str(e)})
            yield sse("[DONE]")
            return

        async for event in run_genie_turn(
            token=token,
            token_type=token_type,
            message=req.message,
            conversation_id=req.conversation_id,
            context=req.context,
            space_id=space_id,
            mode=mode,
            is_disconnected=request.is_disconnected,
        ):
            yield sse(event)
        yield sse("[DONE]")

    return StreamingResponse(event_stream(), media_type="text/event-stream")
