"""
Genie MCP route
---------------
Answers travel-analytics questions by talking to a Databricks **managed Genie
MCP server** with a real MCP client (the official `mcp` Python SDK) over
Streamable HTTP — instead of the custom Multi-Agent System in `agent.py` or the
Conversations API used by `genie.py`.

The contrast we showcase:
  - Multi-Agent System (Model Serving)  -> streaming free-text answer
  - Genie MCP (this route)              -> grounded answer + live reasoning
                                           steps + generated SQL + result table
                                           + a deep link back into the native
                                           Genie space, governed by Unity Catalog.

Endpoints (mounted under /api in app.py):
  GET  /api/genie-mcp/health  -> connect + tools/list (proves a live MCP session)
  POST /api/genie-mcp/ask     -> SSE stream of the full ask -> poll -> answer
                                 lifecycle, using this repo's SSE conventions.

Two managed-server shapes exist; we discover the live contract at runtime via
tools/list rather than hardcoding:
  (a) per-space  : {host}/api/2.0/mcp/genie/{GENIE_SPACE_ID}
  (b) multi-space: {host}/api/2.0/mcp/genie  with genie_ask / genie_poll_response

Auth: prefer the on-behalf-of (OBO) user token the Databricks App platform
injects as `x-forwarded-access-token` (requires the `genie` user API scope), so
Genie runs AS THE USER. Falls back to the app service principal (or a local PAT).

Reference: https://docs.databricks.com/aws/en/generative-ai/mcp/managed-mcp
"""

import os
import re
import json
import asyncio
import logging
from typing import Any, Optional

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from databricks.sdk import WorkspaceClient

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

from ..config import GENIE_SPACE_ID, WORKSPACE_URL, IS_DATABRICKS_APP

logger = logging.getLogger(__name__)

router = APIRouter()

# Genie agent turns typically take ~70-260s, so poll every ~3s up to a cap.
POLL_INTERVAL_MS = int(os.environ.get("GENIE_MCP_POLL_INTERVAL_MS", "3000"))
POLL_MAX_ATTEMPTS = int(os.environ.get("GENIE_MCP_POLL_MAX_ATTEMPTS", "120"))

# Terminal Genie statuses (lowercased) at which we stop polling.
_TERMINAL_STATUSES = {"completed", "incomplete", "failed", "cancelled"}


class AskRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    context: Optional[str] = None


# ─── URL resolution ───────────────────────────────────────────────────────────

def resolve_genie_mcp_url(space_id: Optional[str] = None) -> str:
    """Resolve the managed Genie MCP server URL.

    Precedence:
      1. GENIE_MCP_SERVER_URL override (can point at a single space)
      2. {WORKSPACE_URL}/api/2.0/mcp/genie[/{space_id}]
    """
    override = os.environ.get("GENIE_MCP_SERVER_URL")
    if override:
        return override.rstrip("/")
    host = (WORKSPACE_URL or "").rstrip("/")
    if not host:
        raise RuntimeError("WORKSPACE_URL is not set; cannot build Genie MCP server URL")
    base = f"{host}/api/2.0/mcp/genie"
    return f"{base}/{space_id}" if space_id else base


# ─── Auth ───────────────────────────────────────────────────────────────────

def resolve_token(request: Request) -> tuple[str, str]:
    """Return (bearer_token, token_type). OBO user token first, SP/PAT fallback.

    In a Databricks App the user's token arrives as `x-forwarded-access-token`
    (scope `genie`) so Genie runs on behalf of the signed-in user. Otherwise we
    fall back to the app service principal (Databricks App) or a local PAT.
    """
    obo = request.headers.get("x-forwarded-access-token")
    if obo:
        return obo, "obo"

    if IS_DATABRICKS_APP:
        # Service-principal OAuth handled by the SDK config.
        sp = WorkspaceClient()
        headers = sp.config.authenticate() or {}
        auth = headers.get("Authorization", "")
        token = auth.replace("Bearer ", "").strip()
        if not token:
            raise RuntimeError("Could not obtain a service-principal token")
        return token, "service_principal"

    # Local dev: PAT from env (same convention as genie.py / agent.py).
    pat = os.environ.get("token")
    if not pat:
        raise RuntimeError(
            "No OBO token and no local PAT (env 'token') available for the MCP connection"
        )
    return pat, "service_principal"


# ─── Markdown artifact parsing (ported from genieMcpParser.js) ─────────────────

_SQL_FENCE_RE = re.compile(r"```sql\s*([\s\S]*?)```", re.IGNORECASE)
_GENERIC_FENCE_RE = re.compile(r"```\s*([\s\S]*?)```")
_EXPLORE_LINK_RE = re.compile(r"\[Explore in Databricks\]\((https?://[^)]+)\)", re.IGNORECASE)
_GENIE_LINK_RE = re.compile(r"\((https?://[^)]*/(?:genie|chat|sql|explore)[^)]*)\)", re.IGNORECASE)
_TABLE_SEP_RE = re.compile(r"^\s*\|?[\s:|-]+\|?\s*$")
_NUMERIC_STRIP_RE = re.compile(r"[$,%\s]")


def extract_sql(markdown: str) -> Optional[str]:
    """First fenced SQL block, or a generic fence that clearly holds a SELECT."""
    if not markdown:
        return None
    m = _SQL_FENCE_RE.search(markdown)
    if m and m.group(1).strip():
        return m.group(1).strip()
    g = _GENERIC_FENCE_RE.search(markdown)
    if g and re.search(r"\bselect\b", g.group(1), re.IGNORECASE):
        return g.group(1).strip()
    return None


def extract_deep_link(markdown: str) -> Optional[str]:
    """First Databricks UI deep link in the markdown."""
    if not markdown:
        return None
    m = _EXPLORE_LINK_RE.search(markdown)
    if m:
        return m.group(1)
    m = _GENIE_LINK_RE.search(markdown)
    return m.group(1) if m else None


def _is_number(value: Any) -> bool:
    try:
        float(_NUMERIC_STRIP_RE.sub("", str(value)))
        return True
    except (ValueError, TypeError):
        return False


def extract_table(markdown: str) -> Optional[dict]:
    """Parse the first GitHub-flavoured-markdown table into columns + rows."""
    if not markdown:
        return None
    lines = markdown.split("\n")

    for i in range(len(lines) - 1):
        header = lines[i]
        sep = lines[i + 1]
        if "|" not in header:
            continue
        if not _TABLE_SEP_RE.match(sep) or "-" not in sep:
            continue

        def parse_row(line: str) -> list[str]:
            stripped = line.strip()
            if stripped.startswith("|"):
                stripped = stripped[1:]
            if stripped.endswith("|"):
                stripped = stripped[:-1]
            return [c.strip() for c in stripped.split("|")]

        header_cells = parse_row(header)
        if len(header_cells) < 1:
            continue

        rows: list[list[str]] = []
        j = i + 2
        while j < len(lines):
            line = lines[j]
            if "|" not in line or line.strip() == "":
                break
            cells = parse_row(line)
            while len(cells) < len(header_cells):
                cells.append("")
            rows.append(cells[: len(header_cells)])
            j += 1

        if not rows:
            continue

        columns = []
        for col_idx, name in enumerate(header_cells):
            values = [r[col_idx] for r in rows if r[col_idx] not in ("", None)]
            all_numeric = len(values) > 0 and all(_is_number(v) for v in values)
            columns.append({"name": name, "type": "number" if all_numeric else "string"})

        return {"columns": columns, "rows": rows, "rowCount": len(rows)}

    return None


def parse_genie_artifacts(markdown: str, structured_deep_link: Optional[str] = None) -> dict:
    """Derive all structured artifacts from a final Genie markdown blob."""
    return {
        "sql": extract_sql(markdown),
        "deep_link": structured_deep_link or extract_deep_link(markdown),
        "table": extract_table(markdown),
    }


# ─── MCP result unwrapping + tool discovery ────────────────────────────────────

def _unwrap_tool_result(result: Any) -> tuple[dict, str]:
    """Prefer structuredContent; fall back to parsing text content as JSON/markdown."""
    structured: dict = {}
    sc = getattr(result, "structuredContent", None)
    if isinstance(sc, dict):
        structured = sc

    text_parts: list[str] = []
    for c in getattr(result, "content", None) or []:
        text = getattr(c, "text", None)
        if text:
            text_parts.append(text)
    markdown = "\n".join(text_parts).strip()

    if not structured and markdown:
        try:
            parsed = json.loads(markdown)
            if isinstance(parsed, dict):
                structured = parsed
        except (json.JSONDecodeError, ValueError):
            pass

    return structured, markdown


def _resolve_tool_names(tools: list) -> tuple[Optional[Any], Optional[Any]]:
    """Map discovered tools to ask/poll roles (canonical names + heuristics)."""
    by_name = {t.name: t for t in tools}
    names = list(by_name.keys())

    ask = (
        by_name.get("genie_ask")
        or next((by_name[n] for n in names if re.search(r"ask|query|question", n, re.I) and not re.search(r"poll", n, re.I)), None)
        or next((by_name[n] for n in names if not re.search(r"poll", n, re.I)), None)
        or (tools[0] if tools else None)
    )
    poll = (
        by_name.get("genie_poll_response")
        or next((by_name[n] for n in names if re.search(r"poll", n, re.I)), None)
    )
    return ask, poll


def _tool_props(tool: Any) -> dict:
    schema = getattr(tool, "inputSchema", None) or {}
    return schema.get("properties") or {}


def _build_ask_args(ask_tool: Any, question: str, conversation_id: Optional[str], space_id: Optional[str]) -> dict:
    """Build genie_ask arguments from the discovered input schema."""
    props = _tool_props(ask_tool)
    args: dict[str, Any] = {}

    q_key = "question" if "question" in props else next(
        (k for k in props if re.search(r"question|query|prompt|message", k, re.I)), "question"
    )
    args[q_key] = question

    if space_id:
        for k in props:
            if "space" in k.lower():
                args[k] = space_id

    if conversation_id:
        for k in ("conversation_id", "conversationId"):
            if k in props:
                args[k] = conversation_id

    return args


def _build_poll_args(poll_tool: Any, conversation_id: str, response_id: str, space_id: Optional[str]) -> dict:
    props = _tool_props(poll_tool)
    args: dict[str, Any] = {}
    for k in ("conversation_id", "conversationId"):
        if k in props:
            args[k] = conversation_id
    for k in ("response_id", "responseId"):
        if k in props:
            args[k] = response_id
    if space_id:
        for k in props:
            if "space" in k.lower():
                args[k] = space_id
    # Fallback if the schema is opaque.
    if not args:
        args = {"conversation_id": conversation_id, "response_id": response_id}
    return args


def _tools_summary(tools: list) -> list[dict]:
    return [{"name": t.name, "description": getattr(t, "description", None)} for t in tools]


# ─── SSE helpers ──────────────────────────────────────────────────────────────

def _sse(payload: dict | str) -> str:
    if isinstance(payload, str):
        return f"data: {payload}\n\n"
    return f"data: {json.dumps(payload)}\n\n"


# ─── Health endpoint ──────────────────────────────────────────────────────────

@router.get("/genie-mcp/health")
async def health(request: Request):
    """Connect to the managed Genie MCP server and list its tools.

    Proves the app is talking to a real MCP server (verified via tools/list,
    not the w.genie.* Conversations API) and surfaces the live tool contract.
    """
    space_id = GENIE_SPACE_ID or None
    server_url: Optional[str] = None
    try:
        server_url = resolve_genie_mcp_url(space_id)
        token, token_type = resolve_token(request)
        headers = {"Authorization": f"Bearer {token}"}

        async with streamablehttp_client(server_url, headers=headers) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                listed = await session.list_tools()
                tools = listed.tools or []
                ask_tool, poll_tool = _resolve_tool_names(tools)

        return {
            "ok": True,
            "server_url": server_url,
            "auth": token_type,
            "tools": _tools_summary(tools),
            "ask_tool": ask_tool.name if ask_tool else None,
            "poll_tool": poll_tool.name if poll_tool else None,
        }
    except Exception as e:  # noqa: BLE001 - surface any connection/auth failure
        logger.exception("genie-mcp health check failed")
        return JSONResponse(
            status_code=500,
            content={"ok": False, "server_url": server_url, "message": str(e)},
        )


# ─── Ask endpoint (SSE) ───────────────────────────────────────────────────────

@router.post("/genie-mcp/ask")
async def ask(req: AskRequest, request: Request):
    """Stream the full Genie MCP ask -> poll -> answer lifecycle over SSE.

    Emits this repo's `data: {json}\\n\\n` frames with event types:
      meta | status | sql | table | text | deep_link | error
    and terminates with `data: [DONE]`.
    """
    space_id = GENIE_SPACE_ID or None

    async def event_stream():
        if not (req.message or "").strip():
            yield _sse({"type": "error", "content": "message is required"})
            yield _sse("[DONE]")
            return

        # Prepend filter/dashboard context, matching genie.py / agent.py.
        question = req.message
        if req.context:
            question = f"[Filter context: {req.context}]\n\n{req.message}"

        try:
            server_url = resolve_genie_mcp_url(space_id)
            token, token_type = resolve_token(request)
            headers = {"Authorization": f"Bearer {token}"}

            async with streamablehttp_client(server_url, headers=headers) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    listed = await session.list_tools()
                    tools = listed.tools or []
                    ask_tool, poll_tool = _resolve_tool_names(tools)

                    if not ask_tool:
                        yield _sse({
                            "type": "error",
                            "content": f"No usable Genie tool found on MCP server {server_url}. "
                                       f"Discovered: {', '.join(t.name for t in tools) or '(none)'}",
                        })
                        yield _sse("[DONE]")
                        return

                    yield _sse({
                        "type": "meta",
                        "conversationId": req.conversation_id,
                        "authType": token_type,
                        "serverUrl": server_url,
                        "tools": _tools_summary(tools),
                        "askTool": ask_tool.name,
                        "pollTool": poll_tool.name if poll_tool else None,
                    })
                    yield _sse({"type": "status", "content": "Connected to Genie MCP. Asking…"})

                    # ── ask ──
                    ask_args = _build_ask_args(ask_tool, question, req.conversation_id, space_id)
                    ask_result = await session.call_tool(ask_tool.name, ask_args)
                    structured, ask_markdown = _unwrap_tool_result(ask_result)

                    conversation_id = structured.get("conversation_id") or req.conversation_id
                    response_id = structured.get("response_id")
                    status = (structured.get("status") or "").lower()

                    if getattr(ask_result, "isError", False) and not ask_markdown:
                        yield _sse({"type": "error", "content": "genie_ask failed"})
                        yield _sse("[DONE]")
                        return

                    if conversation_id:
                        yield _sse({"type": "meta", "conversationId": conversation_id})

                    final_markdown: Optional[str] = None
                    final_status: Optional[str] = status or None
                    final_deep_link: Optional[str] = structured.get("deep_link")

                    # ── poll loop (shape b) ──
                    if poll_tool and response_id and status not in _TERMINAL_STATUSES:
                        emitted_steps: set[str] = set()
                        attempt = 0
                        while attempt < POLL_MAX_ATTEMPTS:
                            if await request.is_disconnected():
                                return
                            attempt += 1
                            poll_args = _build_poll_args(poll_tool, conversation_id, response_id, space_id)
                            poll_result = await session.call_tool(poll_tool.name, poll_args)
                            pstruct, pmarkdown = _unwrap_tool_result(poll_result)

                            pstatus = (pstruct.get("status") or "").lower()
                            steps = pstruct.get("progress_steps") or []
                            for step in steps:
                                if step and step not in emitted_steps:
                                    emitted_steps.add(step)
                                    yield _sse({"type": "status", "content": step})

                            if pstruct.get("deep_link"):
                                final_deep_link = pstruct["deep_link"]

                            if pstatus in _TERMINAL_STATUSES:
                                final_status = pstatus
                                final_markdown = pmarkdown or pstruct.get("final_answer")
                                break

                            await asyncio.sleep(POLL_INTERVAL_MS / 1000)
                        else:
                            yield _sse({
                                "type": "error",
                                "content": "Timed out waiting for Genie to finish. Try again or open the Genie space.",
                            })
                            yield _sse("[DONE]")
                            return
                    else:
                        # Shape (a) / synchronous: the ask result is already final.
                        final_markdown = ask_markdown or structured.get("final_answer")
                        final_status = final_status or "completed"

                    markdown = final_markdown or structured.get("final_answer") or ""
                    artifacts = parse_genie_artifacts(markdown, final_deep_link)

                    # ── emit structured artifacts ──
                    if artifacts["sql"]:
                        yield _sse({
                            "type": "sql",
                            "sql": artifacts["sql"],
                            "description": "Generated by Genie",
                        })

                    if artifacts["table"]:
                        yield _sse({
                            "type": "table",
                            "columns": artifacts["table"]["columns"],
                            "rows": artifacts["table"]["rows"],
                        })

                    if markdown:
                        yield _sse({"type": "text", "content": markdown})
                    elif final_status and final_status != "completed":
                        yield _sse({"type": "text", "content": f"_Genie returned status: {final_status}._"})
                    else:
                        yield _sse({"type": "text", "content": "_No answer returned._"})

                    if artifacts["deep_link"]:
                        yield _sse({
                            "type": "deep_link",
                            "url": artifacts["deep_link"],
                            "label": "Open in Genie",
                        })

                    yield _sse("[DONE]")

        except Exception as e:  # noqa: BLE001 - surface to the UI, then close cleanly
            logger.exception("genie-mcp ask failed")
            yield _sse({"type": "error", "content": str(e)})
            yield _sse("[DONE]")

    return StreamingResponse(event_stream(), media_type="text/event-stream")
