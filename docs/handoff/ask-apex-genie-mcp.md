# Ask APEX — Conversational Analytics on the Managed Databricks Genie MCP Server

> Handoff doc for the partner team. Branch: `feature/sustainability-dashboards`.
> App: **APEX** (FastAPI backend + React/Vite/TS frontend).
> Everything below is grounded in the actual code on this branch, with exact
> line references. **No source code was modified to produce this doc.**

---

## TL;DR

**Ask APEX** is APEX's conversational-analytics experience. You type a
question in plain English ("What was total travel spend in 2025?"), and the app
answers with a grounded, governed response: a narrative answer, the **generated
SQL**, a **result table**, live **reasoning steps**, the underlying **MCP tool
calls**, and a **deep link** back into the native Genie space.

Under the hood it does **not** call a bespoke LLM orchestration layer. It opens
a real [Model Context Protocol](https://docs.databricks.com/aws/en/generative-ai/mcp/managed-mcp)
(MCP) session to a **managed Databricks Genie MCP server** using the official
`mcp` Python SDK over **Streamable HTTP**, discovers the server's tools at
runtime, calls an "ask" tool, polls a "poll" tool until Genie finishes, and
streams every step back to the browser over **Server-Sent Events (SSE)**.

**Why this matters:** the managed Genie MCP server gives you an "agent mode"
conversational experience **out of the box today** — ask → reason → generate
governed SQL → run it → return results → follow-up — with no custom agent
runtime to build. (A dedicated Genie Agent API is coming later; the MCP server
is what you use right now.)

The frontend page (`Ask APEX`) defaults to the **workspace-wide** Genie MCP
server ("Genie One MCP", `mode="multi"`), so a single agent can answer across
every Genie space the calling identity can access.

---

## Architecture

```
┌────────────┐   POST /api/genie-mcp/ask (SSE)      ┌───────────────────────┐
│  Browser   │ ───────────────────────────────────► │  FastAPI (APEX)       │
│  React SPA │   data: {json}\n\n  … data: [DONE]   │  server/routes/       │
│ Ask APEX   │ ◄─────────────────────────────────── │    genie_mcp/*        │
└────────────┘        SSE event stream               └───────────┬───────────┘
                                                                  │ MCP (Streamable HTTP)
                                                                  │ Authorization: Bearer <token>
                                                                  ▼
                                                   ┌──────────────────────────────┐
                                                   │ Managed Genie MCP server      │
                                                   │ {host}/api/2.0/mcp/genie[/id] │
                                                   │  tools/list → ask → poll      │
                                                   └───────────────┬──────────────┘
                                                                   ▼
                                                   ┌──────────────────────────────┐
                                                   │ Genie space (governed SQL,    │
                                                   │ UC tables, SQL warehouse)     │
                                                   └──────────────────────────────┘
```

**Who authenticates as whom** (see `auth.py`):

- **Deployed / external hosting (default on this branch):** APEX authenticates
  to the Genie MCP server **as the app Service Principal** (M2M, via
  `DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET`). Genie runs as the SP.
- **On-Behalf-Of (OBO):** if a per-user token is forwarded via the
  `x-forwarded-access-token` header (e.g. inside a Databricks App with the
  `genie` user scope, or from your own IdP), that token wins and Genie runs
  **as the user** under Unity Catalog governance.
- **Local dev fallback:** a personal access token in the `token` env var.

---

## Server internals (module by module)

All server modules live under `server/routes/genie_mcp/`. The package
re-exports the router so `from server.routes.genie_mcp import router` works:

```1:9:server/routes/genie_mcp/__init__.py
"""Genie MCP route package.

Re-exports ``router`` so ``from server.routes.genie_mcp import router`` keeps
working unchanged after the split from a single module into a package.
"""

from .routes import router

__all__ = ["router"]
```

### Route mounting (`app.py`)

The router is mounted under `/api`, so its two routes become
`/api/genie-mcp/health` and `/api/genie-mcp/ask`:

```16:17:app.py
from server.routes.genie_mcp import router as genie_mcp_router
app.include_router(genie_mcp_router, prefix="/api")
```

### `routes.py` — the thin HTTP/SSE surface

Two endpoints. `AskRequest` is the POST body; note the default `mode` is
`MODE_SPACE` on the server, but the Ask APEX page overrides it to `"multi"`
(see Frontend section).

```37:43:server/routes/genie_mcp/routes.py
class AskRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    context: Optional[str] = None
    # "space" -> per-space Genie Space MCP; "multi" -> workspace-wide Genie MCP.
    mode: Optional[str] = MODE_SPACE
```

**`GET /api/genie-mcp/health`** — connects + lists tools to prove a live MCP
session. `?mode=space` (default) or `?mode=multi`:

```45:65:server/routes/genie_mcp/routes.py
@router.get("/genie-mcp/health")
async def health(request: Request):
    """Connect to the managed Genie MCP server and list its tools.

    Query param `mode` selects which server shape to probe:
      mode=space (default) -> per-space Genie Space MCP
      mode=multi           -> workspace-wide Genie MCP
    """
    mode = normalize_mode(request.query_params.get("mode"))
    space_id = GENIE_SPACE_ID or None
    server_url: Optional[str] = None
    try:
        server_url = resolve_genie_mcp_url(space_id, mode)
        token, token_type = resolve_token(request)
        return await probe_health(token=token, token_type=token_type, space_id=space_id, mode=mode)
    except Exception as e:  # noqa: BLE001 - surface any connection/auth failure
        logger.exception("genie-mcp health check failed")
        return JSONResponse(
            status_code=500,
            content={"ok": False, "mode": mode, "server_url": server_url, "message": str(e)},
        )
```

**`POST /api/genie-mcp/ask`** — the SSE endpoint. It resolves the token, then
streams every event dict from `run_genie_turn` as `data: {json}\n\n` frames,
terminating with `data: [DONE]`:

```68:99:server/routes/genie_mcp/routes.py
@router.post("/genie-mcp/ask")
async def ask(req: AskRequest, request: Request):
    """Stream the full Genie MCP ask -> poll -> answer lifecycle over SSE.

    Emits `data: {json}\\n\\n` frames (meta | status | sql | table | text |
    deep_link | tool_call | error) and terminates with `data: [DONE]`.
    """
    space_id = GENIE_SPACE_ID or None
    mode = normalize_mode(req.mode)

    async def event_stream():
        try:
            token, token_type = resolve_token(request)
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
```

### `urls.py` — multi-space vs per-space URL shapes

Two managed server shapes; the mode picks the URL. There's also an env override
(`GENIE_MCP_SERVER_URL`) that pins the URL regardless of mode.

- **per-space** (`mode="space"`): `{host}/api/2.0/mcp/genie/{GENIE_SPACE_ID}`
- **multi-space** (`mode="multi"`, "Genie One MCP"): `{host}/api/2.0/mcp/genie`

```21:47:server/routes/genie_mcp/urls.py
# The two managed Genie MCP server shapes the UI toggle switches between.
MODE_SPACE = "space"   # per-space  : {host}/api/2.0/mcp/genie/{space_id}
MODE_MULTI = "multi"   # multi-space: {host}/api/2.0/mcp/genie


def normalize_mode(mode: Optional[str]) -> str:
    """Coerce an arbitrary mode string to a known mode (defaults to space)."""
    return MODE_MULTI if (mode or "").strip().lower() == MODE_MULTI else MODE_SPACE


def resolve_genie_mcp_url(space_id: Optional[str] = None, mode: str = MODE_SPACE) -> str:
    """Resolve the managed Genie MCP server URL for the requested mode.

    Precedence:
      1. GENIE_MCP_SERVER_URL override (pins the URL regardless of mode)
      2. {WORKSPACE_URL}/api/2.0/mcp/genie         (mode="multi", workspace-wide)
         {WORKSPACE_URL}/api/2.0/mcp/genie/{space} (mode="space", single space)
    """
    override = os.environ.get("GENIE_MCP_SERVER_URL")
    if override:
        return override.rstrip("/")
    host = (WORKSPACE_URL or "").rstrip("/")
    if not host:
        raise RuntimeError("WORKSPACE_URL is not set; cannot build Genie MCP server URL")
    base = f"{host}/api/2.0/mcp/genie"
    if mode == MODE_MULTI:
        return base
    return f"{base}/{space_id}" if space_id else base
```

The deep link back into the native Genie space is `{host}/genie/rooms/{space_id}`:

```50:57:server/routes/genie_mcp/urls.py
def genie_space_deep_link(space_id: Optional[str], conversation_id: Optional[str] = None) -> Optional[str]:
    """Best-effort deep link back into the native Genie space."""
    if not space_id:
        return None
    host = (WORKSPACE_URL or "").rstrip("/")
    if not host:
        return None
    return f"{host}/genie/rooms/{space_id}"
```

> **Note (verified):** The Executive Summary feature and the Ask APEX page both
> use **`mode="multi"`** (workspace-wide). See `config.ts` comment at
> `buildExecSummaryPrompt` and `GenieMcpExperience.tsx` line 26.

### `auth.py` — OBO vs Service Principal

Precedence: (1) OBO user token from `x-forwarded-access-token`; (2) host-agnostic
SP token via M2M (`get_sp_bearer()`); (3) Databricks Apps default SP auth; (4)
local PAT from the `token` env var. Returns `(token, token_type)` where
`token_type` is `"obo"` or `"service_principal"`.

```21:48:server/routes/genie_mcp/auth.py
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
```

**About the `genie` scope:** the module docstring is explicit that OBO tokens
carry the **`genie`** user API scope (e.g. from a Databricks App forwarding
`x-forwarded-access-token`), so Genie runs as the user under UC governance:

```1:11:server/routes/genie_mcp/auth.py
"""
Auth for the Genie MCP connection.

When hosted externally (the default for this branch) Genie runs AS THE APP
SERVICE PRINCIPAL, authenticated via M2M (DATABRICKS_CLIENT_ID/SECRET) — no
Databricks login and no Databricks Apps platform required.

If an on-behalf-of (OBO) user token is forwarded (e.g. inside a Databricks App
via ``x-forwarded-access-token`` with the ``genie`` user API scope, or by your
own IdP), it is honored first so Genie runs as the user under UC governance.
"""
```

The SP token itself is minted in `config.py` via the SDK's M2M path
(`WorkspaceClient(...).config.authenticate()`):

```77:92:server/config.py
def get_sp_bearer() -> str | None:
    """Return a service-principal bearer token via M2M, or None if no SP creds.

    Host-agnostic: relies only on DATABRICKS_HOST + DATABRICKS_CLIENT_ID/SECRET,
    so it works identically on EC2/ECS/any container and inside Databricks Apps.
    """
    if not HAS_SP_CREDENTIALS:
        return None
    w = WorkspaceClient(
        host=WORKSPACE_URL,
        client_id=DATABRICKS_CLIENT_ID,
        client_secret=DATABRICKS_CLIENT_SECRET,
    )
    headers = w.config.authenticate() or {}
    token = headers.get("Authorization", "").replace("Bearer ", "").strip()
    return token or None
```

### `client.py` — MCP transport helpers + runtime tool discovery

Tool names are **never hardcoded**. The server is inspected via `tools/list` and
the code adapts to whatever it exposes.

`unwrap_tool_result` prefers `structuredContent`, falling back to parsing the
text content as JSON/markdown:

```16:38:server/routes/genie_mcp/client.py
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
```

`resolve_tool_names` maps discovered tools to ask/poll roles. Canonical names
are `genie_ask` / `genie_poll_response` (multi-space) and
`query_space_<id>` / `poll_response_<id>` (per-space). When a `space_id` is
given, it prefers the tool whose name contains that id:

```45:73:server/routes/genie_mcp/client.py
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
```

`build_ask_args` / `build_poll_args` build arguments from **each tool's
discovered input schema** (`inputSchema.properties`) rather than assuming key
names — it fuzzy-matches the question key (`question`/`query`/`prompt`/`message`),
injects `space_id` into any `*space*` property, and maps the response id to
whichever of `message_id`/`response_id` the schema declares:

```81:123:server/routes/genie_mcp/client.py
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
```

### `service.py` — the ask → poll → answer lifecycle

This is the framework-agnostic core. It yields plain event dicts (no SSE
coupling), which makes it independently unit-testable. Polling defaults: every
~3s, up to 120 attempts (both env-tunable):

```34:42:server/routes/genie_mcp/service.py
# Genie agent turns typically take ~70-260s, so poll every ~3s up to a cap.
POLL_INTERVAL_MS = int(os.environ.get("GENIE_MCP_POLL_INTERVAL_MS", "3000"))
POLL_MAX_ATTEMPTS = int(os.environ.get("GENIE_MCP_POLL_MAX_ATTEMPTS", "120"))

# Terminal Genie statuses (lowercased) at which we stop polling.
_TERMINAL_STATUSES = {
    "completed", "complete", "incomplete", "failed", "cancelled",
    "error", "query_result_expired",
}
```

**The tool-call flow** (all inside one MCP session):

1. Open Streamable HTTP transport → `ClientSession` → `initialize()` → `list_tools()`:

```115:144:server/routes/genie_mcp/service.py
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
```

2. **Ask:** call the ask tool, unwrap + normalize, emit a `tool_call` event
   (phase `"ask"`). Filter context (from the FilterBar) is prepended to the
   question:

```111:162:server/routes/genie_mcp/service.py
    question = message
    if context:
        question = f"[Filter context: {context}]\n\n{message}"
```
```146:162:server/routes/genie_mcp/service.py
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
```

3. **Poll loop:** while not terminal, call the poll tool every `POLL_INTERVAL_MS`,
   emit a `tool_call` (phase `"poll"`), and emit `status` events. It prefers the
   server's explicit `progress_steps`; otherwise it narrates the status
   transition (e.g. `executing_query` → "Running the generated SQL…"). It also
   honors client disconnects:

```173:220:server/routes/genie_mcp/service.py
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
```

4. **Emit artifacts:** once terminal, stream `sql`, `table`, `text`, and
   `deep_link` events (falling back to a Genie-space deep link when the answer
   didn't include one):

```222:244:server/routes/genie_mcp/service.py
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
```

`probe_health` (used by the health endpoint) does the same connect + list, and
returns the discovered tools plus resolved ask/poll names:

```74:92:server/routes/genie_mcp/service.py
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
```

### `sse.py` — SSE framing

Tiny helper. Dicts are JSON-encoded; strings pass through (used for `[DONE]`):

```9:12:server/routes/genie_mcp/sse.py
def sse(payload: dict | str) -> str:
    if isinstance(payload, str):
        return f"data: {payload}\n\n"
    return f"data: {json.dumps(payload)}\n\n"
```

### `parsing.py` — artifact parsing + state normalization

Two response shapes get normalized into **one** state dict so `service.py` never
branches on server shape:

- **per-space:** structured JSON with `content.textAttachments` /
  `content.queryAttachments` (each carrying a `query` + a full
  `statement_response`).
- **multi-space:** rendered markdown (a ```` ```sql ```` fence, a GFM table, and
  a deep link), with Genie's embedded-query HTML-comment markers stripped.

**Odd markers handling (verified):** Genie's `genie_ask` markdown wraps embedded
result tables in `<!-- begin-embedded:query_… -->` … `<!-- end-embedded:… -->`
markers. Because the table is rendered separately (structured), these blocks and
stray `[Query Result](…)` links are **stripped** from the prose:

```32:51:server/routes/genie_mcp/parsing.py
# Genie's genie_ask markdown wraps embedded result tables in HTML-comment markers
# like `<!-- begin-embedded:query_48e0a3 -->` ... `<!-- end-embedded:... -->`. We
# render the table separately (structured), so strip these blocks from the prose.
_EMBEDDED_BLOCK_RE = re.compile(
    r"<!--\s*begin-embedded:[\s\S]*?end-embedded:[^>]*?-->", re.IGNORECASE
)
_EMBEDDED_MARKER_RE = re.compile(r"<!--\s*(?:begin|end)-embedded:[^>]*?-->", re.IGNORECASE)
_QUERY_RESULT_LINK_RE = re.compile(r"\[Query Result\]\([^)]*\)", re.IGNORECASE)
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")


def clean_answer_markdown(markdown: str) -> str:
    """Strip Genie's embedded-query markers/tables and link noise from the prose."""
    if not markdown:
        return markdown
    md = _EMBEDDED_BLOCK_RE.sub("", markdown)
    md = _EMBEDDED_MARKER_RE.sub("", md)
    md = _QUERY_RESULT_LINK_RE.sub("", md)
    md = _MULTI_NEWLINE_RE.sub("\n\n", md)
    return md.strip()
```

- **SQL** is extracted from a ```` ```sql ```` fence, or any fenced block that
  contains a `SELECT` (`extract_sql`, lines 54–63).
- **Deep links** are pulled from `[Explore in Databricks](…)` or any
  genie/chat/sql/explore URL (`extract_deep_link`, lines 66–73).
- **GFM tables** are parsed by finding a header row followed by a `---` separator,
  with per-column numeric detection and number formatting so Genie's stringified
  numbers don't render in scientific notation (`extract_table`, lines 95–150;
  `format_number`, lines 84–92).
- **Structured (per-space) tables** are built from
  `statement_response.manifest.schema.columns` + `result.data_array`
  (`table_from_statement`, lines 155–200).

`normalize_state` is the single funnel that returns
`conversation_id, message_id, status, text, sql_blocks, tables, deep_link, progress_steps`:

```203:260:server/routes/genie_mcp/parsing.py
def normalize_state(structured: dict, raw_text: str) -> dict:
    """Normalise either managed-server shape into a single state dict.

    Returns: conversation_id, message_id, status, text (markdown answer),
    sql_blocks [{sql, description}], tables [{columns, rows}], deep_link,
    progress_steps [str].
    """
    structured = structured or {}
    conversation_id = structured.get("conversationId") or structured.get("conversation_id")
    message_id = (
        structured.get("messageId")
        or structured.get("message_id")
        or structured.get("response_id")
    )
    status = (structured.get("status") or "").strip()

    text = ""
    sql_blocks: list[dict] = []
    tables: list[dict] = []
    deep_link = structured.get("deep_link")
    progress_steps = structured.get("progress_steps") or []

    content = structured.get("content")
    if isinstance(content, dict):
        # ── per-space structured shape ──
        text = "\n\n".join(t for t in (content.get("textAttachments") or []) if t)
        for qa in content.get("queryAttachments") or []:
            sql = qa.get("query")
            if sql:
                sql_blocks.append({"sql": sql, "description": qa.get("description") or "Generated by Genie"})
            table = table_from_statement(qa.get("statement_response"))
            if table:
                tables.append(table)
    else:
        # ── multi-space markdown shape (or opaque) ──
        markdown = structured.get("final_answer") or raw_text or ""
        # Parse artifacts from the RAW markdown, but display a cleaned answer
        # (embedded-query markers + raw table stripped out).
        sql = extract_sql(markdown)
        if sql:
            sql_blocks.append({"sql": sql, "description": "Generated by Genie"})
        table = extract_table(markdown)
        if table:
            tables.append(table)
        if not deep_link:
            deep_link = extract_deep_link(markdown)
        text = clean_answer_markdown(markdown)

    return {
        "conversation_id": conversation_id,
        "message_id": message_id,
        "status": status,
        "text": text,
        "sql_blocks": sql_blocks,
        "tables": tables,
        "deep_link": deep_link,
        "progress_steps": [s for s in progress_steps if s],
    }
```

### `apex.py` — conversation persistence (adjacent, not the MCP call)

`server/routes/apex.py` is mounted at `/api/apex` and stores conversation
history + per-user filter prefs in Lakebase (Databricks managed Postgres). It is
**not** part of the Genie MCP call path — the frontend hook calls it separately
to persist each completed turn. It degrades gracefully when Lakebase is off
(`persisted: false` / empty lists):

```55:67:server/routes/apex.py
@router.get("/conversations")
def list_conversations(request: Request):
    email, _ = _user(request)
    return {"conversations": persistence.list_conversations(email)}


@router.post("/conversations")
def create_conversation(request: Request, body: CreateConversationBody):
    email, tenant = _user(request)
    if not persistence.enabled():
        return JSONResponse({"persisted": False, "id": None}, status_code=200)
    conv = persistence.create_conversation(email, tenant=tenant, mode=body.mode, title=body.title or persistence.DEFAULT_TITLE)
    return {"persisted": True, **conv}
```

---

## Frontend internals

### The page: `GenieMcpExperience.tsx` ("Ask APEX")

Branded **"Ask APEX"**, it drives the hook in **`"multi"`** mode (Genie One MCP,
workspace-wide) with persistence on — there is intentionally no space/multi
toggle on this page:

```14:26:frontend/src/pages/GenieMcpExperience.tsx
export default function GenieMcpExperience() {
  const {
    messages,
    isLoading,
    mcpStatus,
    checkHealth,
    sendMessage,
    clearChat,
    conversations,
    activeConversationId,
    loadConversation,
    removeConversation,
  } = useGenieMcpChat("multi", { persist: true }); // Genie One MCP (workspace-wide), no toggle
```

Header shows the title and the live MCP status pill; suggestions come from
`SUGGESTIONS_BY_MODE.multi`:

```67:74:frontend/src/pages/GenieMcpExperience.tsx
              <div>
                <h1 className="text-[15px] font-semibold leading-tight tracking-tight text-slate-900">
                  Ask APEX
                </h1>
                <p className="text-[11px] text-slate-500">Conversational analytics, governed</p>
              </div>
            </div>
            <McpStatusPill status={mcpStatus} onRetry={checkHealth} />
```

Each assistant turn is rendered by `GenieAssistantMessage` with the full
affordances (collapsible answer, tool panel, footer):

```126:143:frontend/src/pages/GenieMcpExperience.tsx
                {messages.map((m) =>
                  m.role === "user" ? (
                    <UserBubble key={m.id} message={m} initials={user?.initials || "U"} />
                  ) : (
                    <GenieAssistantMessage
                      key={m.id}
                      message={m}
                      variant="full"
                      sqlOpen={!!openSql[m.id]}
                      onToggleSql={() => toggleSql(m.id)}
                      toolsOpen={!!openTools[m.id]}
                      onToggleTools={() => toggleTools(m.id)}
                      collapsibleAnswer
                      showFooter
                    />
                  )
                )}
```

### The hook: `useGenieMcpChat.ts`

`checkHealth` hits `GET /api/genie-mcp/health?mode=<mode>` and populates the MCP
status (auth type + discovered tools):

```114:134:frontend/src/hooks/useGenieMcpChat.ts
  const checkHealth = useCallback(async () => {
    setMcpStatus({ state: "connecting" });
    try {
      const res = await fetch(`/api/genie-mcp/health?mode=${mode}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMcpStatus({ state: "error", message: data.message, serverUrl: data.server_url });
        return;
      }
      setMcpStatus({
        state: "connected",
        serverUrl: data.server_url,
        auth: data.auth,
        tools: data.tools || [],
        askTool: data.ask_tool,
        pollTool: data.poll_tool,
      });
    } catch (err) {
      setMcpStatus({ state: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [mode]);
```

`sendMessage` POSTs to `/api/genie-mcp/ask` and reads the SSE body via a
`ReadableStream` reader, splitting on `\n`, stripping the `data: ` prefix, and
skipping `[DONE]`:

```182:222:frontend/src/hooks/useGenieMcpChat.ts
        const res = await fetch("/api/genie-mcp/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversation_id: conversationIdRef.current || undefined,
            context: context || "",
            mode,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "");
          throw new Error(errText || `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
```

Each event `type` maps to a patch of the streaming assistant message. This is
the exact contract between `service.py` and the UI:

```223:267:frontend/src/hooks/useGenieMcpChat.ts
            switch (event.type) {
              case "meta":
                if (event.conversationId) conversationIdRef.current = event.conversationId;
                break;
              case "status":
                patch((m) =>
                  m.steps[m.steps.length - 1] === event.content
                    ? m
                    : { ...m, steps: [...m.steps, event.content] }
                );
                break;
              case "sql":
                patch((m) => ({
                  ...m,
                  sql: [...m.sql, { sql: event.sql, description: event.description }],
                }));
                break;
              case "tool_call":
                patch((m) => ({
                  ...m,
                  toolCalls: [
                    ...m.toolCalls,
                    {
                      tool: event.tool,
                      phase: event.phase,
                      args: event.args,
                      result: event.result,
                      attempt: event.attempt,
                    },
                  ],
                }));
                break;
              case "table":
                patch((m) => ({ ...m, table: { columns: event.columns, rows: event.rows } }));
                break;
              case "text":
                patch((m) => ({ ...m, content: event.content }));
                break;
              case "deep_link":
                patch((m) => ({ ...m, deepLink: { url: event.url, label: event.label } }));
                break;
              case "error":
                patch((m) => ({ ...m, error: event.content, status: "failed" }));
                break;
            }
```

After the stream ends, the completed turn is persisted to Lakebase via
`saveConversationTurn`:

```274:282:frontend/src/hooks/useGenieMcpChat.ts
      } finally {
        patch((m) => ({ ...m, isStreaming: false }));
        setIsLoading(false);

        // Persist the completed turn to Lakebase and refresh the thread list.
        if (persist && dbConvRef.current) {
          saveConversationTurn(dbConvRef.current, text, draft).then(() => refreshConversations());
        }
      }
```

### Component rendering

`GenieAssistantMessage.tsx` composes the pieces in order: reasoning → error →
answer (collapsible) → SQL → table → tool calls → deep link → footer:

```56:106:frontend/src/components/genie/GenieAssistantMessage.tsx
      <div className={bubble}>
        <GenieReasoning steps={message.steps} isStreaming={message.isStreaming} variant={variant} />

        {message.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {message.error}
          </div>
        )}

        {message.content &&
          (longAnswer ? (
            <div>
              <div className={`relative ${collapsed ? "max-h-48 overflow-hidden" : ""}`}>
                <MarkdownContent content={message.content} />
```

- **Reasoning** (`GenieReasoning.tsx`): the `status` events become a collapsible
  violet "Genie reasoning" timeline (auto-expanded while streaming, collapsed to
  the last step when done). Line 49 renders the card; each step shows a spinner
  (pending) or a green check (done).
- **Tool calls** (`GenieToolCalls.tsx`): the "Under the hood · N MCP calls"
  panel. It lists the `ask` call (tool name + pretty-printed args) and collapses
  the many `poll` calls into their **distinct status transitions**
  (lines 27–35, 70–90).
- **SQL** (`GenieSqlBlock.tsx`): collapsible "Generated SQL" panel; dark
  terminal styling (lines 24–47).
- **Result table** (`GenieResultTable.tsx`): normalizes columns (string or
  `{name}` objects) and renders a scrollable table (lines 12–14, 23–47).
- **Deep link** (`GenieDeepLink.tsx`): the "Open in Genie" button
  (lines 15–25).
- **MCP status** (`GenieMcpStatus.tsx`): `McpStatusPill` shows "Live MCP · on-
  behalf-of user" or "· service principal", with the tool list in the tooltip
  (lines 47–81).

Mode metadata used for labels/suggestions (`genieModes.ts`):

```6:17:frontend/src/components/genie/genieModes.ts
export const MODE_META: Record<GenieMode, { label: string; path: string; blurb: string }> = {
  multi: {
    label: "Genie One MCP",
    path: "/api/2.0/mcp/genie",
    blurb: "Workspace-wide agent across every Genie space you can access.",
  },
  space: {
    label: "Genie Space",
    path: "/api/2.0/mcp/genie/{space_id}",
    blurb: "A single Genie space — the APEX Travel Intelligence space.",
  },
};
```

---

## Executive Summary feature

`ExecutiveSummaryModal.tsx` reuses the **same hook** in `"multi"` mode (no
persistence) and fires **one** prompt on mount. The comment confirms it targets
the workspace-wide Genie MCP because a narrative markdown answer suits a
board-ready brief:

```24:39:frontend/src/components/ExecutiveSummaryModal.tsx
  // Executive Summary runs against the workspace-wide Genie MCP ("multi"),
  // which returns a narrative markdown answer well-suited to a board-ready brief.
  const { messages, isLoading, sendMessage, clearChat } = useGenieMcpChat("multi");
  const [showSql, setShowSql] = useState(false);
  const sentRef = useRef(false);

  const fire = () => {
    sendMessage(buildExecSummaryPrompt(summaryPrompt), pageContext);
  };

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    fire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

The per-page `summaryPrompt` (e.g. `SPEND_GENIE`, `SUSTAINABILITY_GENIE`,
`CARBON_FORECAST_GENIE` in `config.ts`) is wrapped by `buildExecSummaryPrompt`,
which forces the **fixed three-section** markdown layout — `## Overview`,
`## KPIs`, `## Strategic Insights` — so every page renders a consistent brief:

```508:520:frontend/src/config.ts
export function buildExecSummaryPrompt(summaryPrompt: string): string {
  return (
    `${summaryPrompt}\n\n` +
    "Format the response as markdown with EXACTLY these three sections, each as a `## ` heading and in this order:\n" +
    "## Overview\n" +
    "A 2-3 sentence narrative of the headline story for this view.\n" +
    "## KPIs\n" +
    "A bullet list of the most important metrics with specific numbers, including year-over-year change where available.\n" +
    "## Strategic Insights\n" +
    "3-4 concise, actionable bullet points calling out notable risks, opportunities, or recommended actions.\n\n" +
    "Be specific and quantitative. Do not add any sections beyond these three."
  );
}
```

The modal renders the streaming answer (with a three-section shimmer skeleton
while awaiting), then the table, SQL, and deep link — reusing the same Genie
components (lines 117–139). `pageContext` is passed as the SSE `context` field,
which `service.py` prepends as `[Filter context: …]`.

---

## Configure it for YOUR workspace / Genie space

### Prerequisites

1. A Databricks workspace with **Genie** enabled and at least one **Genie space**
   already built and working (tables added, sample questions verified in the
   native Genie UI).
2. The managed Genie MCP server enabled on that workspace (this is the
   `.../api/2.0/mcp/genie[...]` endpoint — see the
   [managed MCP docs](https://docs.databricks.com/aws/en/generative-ai/mcp/managed-mcp)).
3. A **Service Principal** (for external/portable hosting) with an OAuth secret,
   **or** an OBO user token path (Databricks App / your IdP).
4. A SQL warehouse the Genie space can use (on Databricks Apps this is granted
   via the `sql-warehouse` resource in `app.yaml`).

### Permissions the identity needs on the Genie space

Whichever identity actually calls the MCP server (the **SP** for M2M, or the
**user** for OBO) must have:

- **CAN RUN** (or higher) on the target **Genie space**.
- **CAN USE** on the **SQL warehouse** backing the space.
- Unity Catalog **SELECT** on the tables/views the space queries (plus USE
  CATALOG / USE SCHEMA). Under OBO these are enforced as the *user*; under SP
  they're enforced as the *service principal* — grant accordingly.

### Environment / config

The one required data setting is the Genie space id. Server default lives in
`config.py`:

```50:50:server/config.py
GENIE_SPACE_ID = os.environ.get("GENIE_SPACE_ID", "01f127092d2219f3be10180d79b2ee5d")
```

Copy `.env.example` → `.env` and fill in your values:

```10:16:.env.example
# ── Databricks Service Principal (M2M) ──────────────────────────────
DATABRICKS_HOST=https://<your-workspace>.cloud.databricks.com
DATABRICKS_CLIENT_ID=
DATABRICKS_CLIENT_SECRET=
# ── Data assets ─────────────────────────────────────────────────────
GENIE_SPACE_ID=01f127092d2219f3be10180d79b2ee5d
DASHBOARD_URL=https://<your-workspace>.cloud.databricks.com/embed/dashboardsv3/<dashboard-id>?o=<org-id>
```

Env vars that matter for Ask APEX:

| Var | Where | Purpose |
| --- | --- | --- |
| `DATABRICKS_HOST` | `config.py` `WORKSPACE_URL` (also legacy `workspace_url`) | Workspace host; builds the MCP URL and deep links. |
| `DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET` | `config.py` (also legacy `EMBED_SP_CLIENT_ID/SECRET`) | SP M2M creds → the bearer token the app sends to the MCP server. |
| `GENIE_SPACE_ID` | `config.py` | The space used for per-space mode, tool selection in multi mode, and deep links. |
| `token` | `auth.py` / `config.py` | Local-dev PAT fallback when no SP creds and not in a Databricks App. |
| `GENIE_MCP_SERVER_URL` | `urls.py` | Optional override that pins the MCP URL regardless of mode. |
| `GENIE_MCP_POLL_INTERVAL_MS` / `GENIE_MCP_POLL_MAX_ATTEMPTS` | `service.py` | Poll cadence / cap (defaults 3000ms / 120). |
| `DATABRICKS_APP_NAME` | `config.py` `IS_DATABRICKS_APP` | Auto-set inside Databricks Apps; switches to platform default auth. |

> The frontend also has its own `GENIE_SPACE_ID` constant in `config.ts`
> (line 37), used only to build client-side references; the **server**
> `GENIE_SPACE_ID` (env) is what actually drives the MCP call.

### Switching multi vs per-space

- **Per request:** the POST body / health query param `mode` (`"space"` or
  `"multi"`). The server coerces anything non-`"multi"` to `"space"`
  (`normalize_mode`, `urls.py` line 25).
- **In the Ask APEX UI:** it's hardcoded to `"multi"`
  (`GenieMcpExperience.tsx` line 26). To point Ask APEX at a single space,
  change that argument to `"space"` (and make sure `GENIE_SPACE_ID` is set).
- **Executive Summary** is always `"multi"`
  (`ExecutiveSummaryModal.tsx` line 26).

To point at **your** space: set `GENIE_SPACE_ID` in `.env`, ensure your SP (or
OBO user) has the permissions above, restart the server, and use the health
endpoint to confirm a live session (see below).

---

## Troubleshooting

Start with the health probe — it isolates connectivity/auth from a full turn:

```bash
# per-space (default)
curl "http://localhost:8000/api/genie-mcp/health?mode=space"
# workspace-wide (what Ask APEX uses)
curl "http://localhost:8000/api/genie-mcp/health?mode=multi"
```

A healthy response is `{"ok": true, "auth": "service_principal"|"obo", "tools": [...], "ask_tool": "...", "poll_tool": "..."}`.

| Symptom | Likely cause | Where it surfaces |
| --- | --- | --- |
| Health returns `{"ok": false, ...}` with a 500 and a `message` | Connection or auth failure to the MCP server | `routes.py` 60–65; UI pill shows "MCP offline — retry" (`GenieMcpStatus.tsx`). |
| `"No OBO token, no SP credentials … and no local PAT"` | None of the three auth paths are configured | `auth.py` 43–47 raises; emitted as an `error` SSE event. |
| `"WORKSPACE_URL is not set; cannot build Genie MCP server URL"` | `DATABRICKS_HOST` / `workspace_url` missing | `urls.py` 43. |
| `"No usable Genie tool found on MCP server …"` (lists discovered tools) | The identity can't see any Genie tool on that server (permissions), or wrong URL/space | `service.py` 126–132. |
| Permission denied / empty answer for a specific space | Identity lacks CAN RUN on the space or SELECT on its tables (esp. under OBO) | Surfaces as an `error` event or an empty/`incomplete` status → `_Genie returned status: …_` (`service.py` 233–234). |
| `"Timed out waiting for Genie to finish…"` | Turn exceeded `POLL_MAX_ATTEMPTS × POLL_INTERVAL_MS` (~6 min default) | `service.py` 215–220. Raise the env caps for very heavy queries. |
| Answer text contains stray `begin-embedded:` / `[Query Result]` noise | Parser didn't strip a marker variant | `parsing.py` `clean_answer_markdown` 43–51 — that's the code that removes them. |
| Numbers show in scientific notation / unformatted | Numeric detection missed a column | `parsing.py` `format_number` 84–92 + `extract_table` 131–149. |
| History not saving | Lakebase disabled (`LAKEBASE_ENABLED=false`) | Expected: `apex.py` returns `persisted: false`; UI still works in-memory. |

Auth-type tips:
- If the pill says **"service principal"** but you expected **"on-behalf-of
  user"**, no `x-forwarded-access-token` header reached the app (you're not
  behind the Databricks App proxy / IdP that injects it) — the app fell back to
  SP (`auth.py` 23–31).
- Inside a Databricks App with no explicit SP creds, auth uses the platform's
  injected SP (`auth.py` 33–40).

---

## File map (real paths)

Server (`server/routes/genie_mcp/`):
- `__init__.py` — re-exports `router`.
- `routes.py` — `GET /api/genie-mcp/health`, `POST /api/genie-mcp/ask` (SSE).
- `service.py` — `run_genie_turn` (ask→poll→answer) + `probe_health`.
- `client.py` — result unwrap, runtime tool discovery, arg building.
- `auth.py` — `resolve_token` (OBO vs SP vs PAT).
- `urls.py` — MCP URL shapes + deep link + `normalize_mode`.
- `sse.py` — SSE framing helper.
- `parsing.py` — artifact parsing + `normalize_state`.

Other server:
- `server/routes/apex.py` — conversation history + filter prefs (`/api/apex`).
- `server/config.py` — `GENIE_SPACE_ID`, `WORKSPACE_URL`, SP creds, `get_sp_bearer`.
- `app.py` — mounts the routers under `/api`.
- `.env.example` — environment contract.

Frontend (`frontend/src/`):
- `pages/GenieMcpExperience.tsx` — the Ask APEX page (defaults to `multi`).
- `hooks/useGenieMcpChat.ts` — SSE streaming chat hook + persistence.
- `components/genie/GenieAssistantMessage.tsx` — assistant message composer.
- `components/genie/GenieReasoning.tsx` — collapsible reasoning timeline.
- `components/genie/GenieToolCalls.tsx` — "Under the hood" MCP-call panel.
- `components/genie/GenieSqlBlock.tsx` — Generated SQL panel.
- `components/genie/GenieResultTable.tsx` — result table.
- `components/genie/GenieDeepLink.tsx` — "Open in Genie" button.
- `components/genie/GenieMcpStatus.tsx` — MCP status chip/pill/dot.
- `components/genie/genieModes.ts` — mode labels + suggestions.
- `components/ExecutiveSummaryModal.tsx` — Executive Summary (always `multi`).
- `config.ts` — `GENIE_SPACE_ID`, `DashboardGenieConfig`, `buildExecSummaryPrompt`, per-page prompts/suggestions.

---

## Appendix: SSE event contract

`run_genie_turn` yields these event `type`s; the hook's `switch` consumes them:

| `type` | Fields | UI effect |
| --- | --- | --- |
| `meta` | `conversationId`, `mode`, `authType`, `serverUrl`, `tools`, `askTool`, `pollTool` | stores Genie session id |
| `status` | `content` | appends a reasoning step |
| `tool_call` | `phase` (`ask`/`poll`), `tool`, `args`, `result`, `attempt` | "Under the hood" panel |
| `sql` | `sql`, `description` | Generated SQL block |
| `table` | `columns`, `rows` | result table |
| `text` | `content` | the markdown answer |
| `deep_link` | `url`, `label` | "Open in Genie" button |
| `error` | `content` | red error box, status `failed` |
| `[DONE]` | (string frame) | terminates the stream |
