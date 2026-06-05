"""
Framework-agnostic Genie MCP core.

``run_genie_turn`` drives the full ask -> poll -> answer lifecycle against a
managed Genie MCP server and yields plain event dicts (no FastAPI/SSE coupling),
so it can be reused or unit-tested independently. ``probe_health`` connects and
lists tools to prove a live MCP session.

Event dicts yielded by ``run_genie_turn`` use these ``type`` values:
  meta | status | sql | table | text | deep_link | tool_call | error
(The HTTP layer is responsible for SSE framing and the terminating [DONE].)
"""

import os
import asyncio
import logging
from typing import Any, AsyncIterator, Awaitable, Callable, Optional

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

from .urls import resolve_genie_mcp_url, genie_space_deep_link, MODE_SPACE
from .parsing import normalize_state
from .client import (
    unwrap_tool_result,
    resolve_tool_names,
    build_ask_args,
    build_poll_args,
    tools_summary,
)

logger = logging.getLogger(__name__)

# Genie agent turns typically take ~70-260s, so poll every ~3s up to a cap.
POLL_INTERVAL_MS = int(os.environ.get("GENIE_MCP_POLL_INTERVAL_MS", "3000"))
POLL_MAX_ATTEMPTS = int(os.environ.get("GENIE_MCP_POLL_MAX_ATTEMPTS", "120"))

# Terminal Genie statuses (lowercased) at which we stop polling.
_TERMINAL_STATUSES = {
    "completed", "complete", "incomplete", "failed", "cancelled",
    "error", "query_result_expired",
}

# Friendly narration for the live reasoning timeline, keyed by message status.
_STATUS_NARRATION = {
    "pending_warehouse": "Starting the SQL warehouse…",
    "asking_ai": "Genie is reasoning over your data…",
    "filtering_context": "Finding the relevant tables…",
    "fetching_metadata": "Reading table metadata…",
    "executing_query": "Running the generated SQL…",
    "running": "Running the generated SQL…",
    "pending": "Working…",
    "submitted": "Submitted to Genie…",
    "completed": "Done.",
}


def narration(status: str) -> str:
    key = (status or "").lower()
    return _STATUS_NARRATION.get(key) or (status.replace("_", " ").capitalize() if status else "Working…")


def tool_call_result(state: dict) -> dict:
    """Compact summary of an MCP tool result for the "under the hood" panel."""
    return {
        "status": state.get("status") or None,
        "messageId": state.get("message_id"),
        "hasText": bool(state.get("text")),
        "sql": len(state.get("sql_blocks") or []),
        "tables": len(state.get("tables") or []),
    }


async def probe_health(*, token: str, token_type: str, space_id: Optional[str], mode: str) -> dict:
    """Connect to the managed Genie MCP server and list its tools."""
    server_url = resolve_genie_mcp_url(space_id, mode)
    headers = {"Authorization": f"Bearer {token}"}
    async with streamablehttp_client(server_url, headers=headers) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            listed = await session.list_tools()
            tools = listed.tools or []
            ask_tool, poll_tool = resolve_tool_names(tools, space_id)
    return {
        "ok": True,
        "mode": mode,
        "server_url": server_url,
        "auth": token_type,
        "tools": tools_summary(tools),
        "ask_tool": ask_tool.name if ask_tool else None,
        "poll_tool": poll_tool.name if poll_tool else None,
    }


async def run_genie_turn(
    *,
    token: str,
    token_type: str,
    message: str,
    conversation_id: Optional[str],
    context: Optional[str],
    space_id: Optional[str],
    mode: str = MODE_SPACE,
    is_disconnected: Optional[Callable[[], Awaitable[bool]]] = None,
) -> AsyncIterator[dict]:
    """Drive ask -> poll -> answer and yield event dicts. No SSE framing here."""
    if not (message or "").strip():
        yield {"type": "error", "content": "message is required"}
        return

    question = message
    if context:
        question = f"[Filter context: {context}]\n\n{message}"

    try:
        server_url = resolve_genie_mcp_url(space_id, mode)
        headers = {"Authorization": f"Bearer {token}"}

        async with streamablehttp_client(server_url, headers=headers) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                listed = await session.list_tools()
                tools = listed.tools or []
                ask_tool, poll_tool = resolve_tool_names(tools, space_id)

                if not ask_tool:
                    yield {
                        "type": "error",
                        "content": f"No usable Genie tool found on MCP server {server_url}. "
                                   f"Discovered: {', '.join(t.name for t in tools) or '(none)'}",
                    }
                    return

                yield {
                    "type": "meta",
                    "conversationId": conversation_id,
                    "mode": mode,
                    "authType": token_type,
                    "serverUrl": server_url,
                    "tools": tools_summary(tools),
                    "askTool": ask_tool.name,
                    "pollTool": poll_tool.name if poll_tool else None,
                }
                yield {"type": "status", "content": "Connected to Genie MCP. Asking…"}

                # ── ask ──
                ask_args = build_ask_args(ask_tool, question, conversation_id, space_id)
                ask_result = await session.call_tool(ask_tool.name, ask_args)
                structured, ask_text = unwrap_tool_result(ask_result)
                state = normalize_state(structured, ask_text)

                conv_id = state["conversation_id"] or conversation_id
                message_id = state["message_id"]
                status = (state["status"] or "").lower()

                yield {
                    "type": "tool_call",
                    "phase": "ask",
                    "tool": ask_tool.name,
                    "args": ask_args,
                    "result": tool_call_result(state),
                }

                if getattr(ask_result, "isError", False) and not state["text"]:
                    yield {"type": "error", "content": state["text"] or "genie ask failed"}
                    return

                if conv_id:
                    yield {"type": "meta", "conversationId": conv_id}

                final = state

                # ── poll loop ──
                if poll_tool and message_id and status not in _TERMINAL_STATUSES:
                    emitted_steps: set[str] = set()
                    last_status: Optional[str] = None
                    attempt = 0
                    while attempt < POLL_MAX_ATTEMPTS:
                        if is_disconnected and await is_disconnected():
                            return
                        attempt += 1
                        poll_args = build_poll_args(poll_tool, conv_id, message_id, space_id)
                        poll_result = await session.call_tool(poll_tool.name, poll_args)
                        pstruct, ptext = unwrap_tool_result(poll_result)
                        pstate = normalize_state(pstruct, ptext)
                        pstatus = (pstate["status"] or "").lower()

                        yield {
                            "type": "tool_call",
                            "phase": "poll",
                            "tool": poll_tool.name,
                            "attempt": attempt,
                            "args": poll_args,
                            "result": tool_call_result(pstate),
                        }

                        # Prefer explicit progress steps; else narrate status transitions.
                        new_steps = [s for s in pstate["progress_steps"] if s not in emitted_steps]
                        if new_steps:
                            for s in new_steps:
                                emitted_steps.add(s)
                                yield {"type": "status", "content": s}
                        elif pstatus and pstatus != last_status and pstatus not in _TERMINAL_STATUSES:
                            last_status = pstatus
                            yield {"type": "status", "content": narration(pstatus)}

                        if pstate["deep_link"]:
                            final["deep_link"] = pstate["deep_link"]

                        if pstatus in _TERMINAL_STATUSES:
                            final = pstate
                            break

                        await asyncio.sleep(POLL_INTERVAL_MS / 1000)
                    else:
                        yield {
                            "type": "error",
                            "content": "Timed out waiting for Genie to finish. Try again or open the Genie space.",
                        }
                        return

                final_status = (final["status"] or "completed").lower()

                # ── emit structured artifacts ──
                for block in final["sql_blocks"]:
                    yield {"type": "sql", "sql": block["sql"], "description": block.get("description", "")}

                for table in final["tables"]:
                    yield {"type": "table", "columns": table["columns"], "rows": table["rows"]}

                if final["text"]:
                    yield {"type": "text", "content": final["text"]}
                elif final_status != "completed":
                    yield {"type": "text", "content": f"_Genie returned status: {final_status}._"}
                else:
                    yield {"type": "text", "content": "_No answer returned._"}

                deep_link = final["deep_link"] or genie_space_deep_link(space_id, conv_id)
                if deep_link:
                    yield {"type": "deep_link", "url": deep_link, "label": "Open in Genie"}

    except Exception as e:  # noqa: BLE001 - surface to the UI, then close cleanly
        logger.exception("genie-mcp turn failed")
        yield {"type": "error", "content": str(e)}
