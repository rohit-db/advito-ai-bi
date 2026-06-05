"""
MCP transport helpers: result unwrapping, runtime tool discovery, and argument
building from each tool's discovered input schema.

We never hardcode tool names or argument keys — the managed Genie MCP server is
inspected at runtime via tools/list and we adapt to whatever it exposes
(``genie_ask``/``genie_poll_response`` for multi-space, ``query_space_<id>``/
``poll_response_<id>`` for per-space).
"""

import re
import json
from typing import Any, Optional


def unwrap_tool_result(result: Any) -> tuple[dict, str]:
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


def _is_poll(name: str) -> bool:
    return bool(re.search(r"poll", name, re.I))


def resolve_tool_names(tools: list, space_id: Optional[str] = None) -> tuple[Optional[Any], Optional[Any]]:
    """Map discovered tools to ask/poll roles (canonical names + heuristics).

    When ``space_id`` is given and the server exposes a tool per space (the
    workspace-wide server returns one ``query_space_<id>`` per accessible space),
    prefer the tool for our space.
    """
    by_name = {t.name: t for t in tools}
    names = list(by_name.keys())

    ask = None
    poll = None
    if space_id:
        ask = next((by_name[n] for n in names if space_id in n and not _is_poll(n)), None)
        poll = next((by_name[n] for n in names if space_id in n and _is_poll(n)), None)

    ask = (
        ask
        or by_name.get("genie_ask")
        or next((by_name[n] for n in names if re.search(r"ask|query|question", n, re.I) and not _is_poll(n)), None)
        or next((by_name[n] for n in names if not _is_poll(n)), None)
        or (tools[0] if tools else None)
    )
    poll = (
        poll
        or by_name.get("genie_poll_response")
        or next((by_name[n] for n in names if _is_poll(n)), None)
    )
    return ask, poll


def _tool_props(tool: Any) -> dict:
    schema = getattr(tool, "inputSchema", None) or {}
    return schema.get("properties") or {}


def build_ask_args(ask_tool: Any, question: str, conversation_id: Optional[str], space_id: Optional[str]) -> dict:
    """Build ask-tool arguments from the discovered input schema."""
    props = _tool_props(ask_tool)
    args: dict[str, Any] = {}

    q_key = "question" if "question" in props else next(
        (k for k in props if re.search(r"question|query|prompt|message", k, re.I)), "query"
    )
    args[q_key] = question

    # Per-space servers carry the space in the URL; multi-space may want it here.
    if space_id:
        for k in props:
            if "space" in k.lower():
                args[k] = space_id

    if conversation_id:
        for k in ("conversation_id", "conversationId"):
            if k in props:
                args[k] = conversation_id

    return args


def build_poll_args(poll_tool: Any, conversation_id: str, message_id: str, space_id: Optional[str]) -> dict:
    """Build poll-tool arguments, mapping the response id to message_id/response_id."""
    props = _tool_props(poll_tool)
    args: dict[str, Any] = {}

    for k in ("conversation_id", "conversationId"):
        if k in props:
            args[k] = conversation_id
    for k in ("message_id", "messageId", "response_id", "responseId"):
        if k in props:
            args[k] = message_id
    if space_id:
        for k in props:
            if "space" in k.lower():
                args[k] = space_id

    if not args:
        args = {"conversation_id": conversation_id, "message_id": message_id}
    return args


def tools_summary(tools: list) -> list[dict]:
    return [{"name": t.name, "description": getattr(t, "description", None)} for t in tools]
