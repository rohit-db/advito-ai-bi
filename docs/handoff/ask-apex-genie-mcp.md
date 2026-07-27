# Ask APEX — Conversational Analytics on the Managed Databricks Genie MCP

> Branch: `feature/sustainability-dashboards` · App: **APEX** (FastAPI + React/Vite/TS).
> Every code reference below is verified against the current branch.

## TL;DR

**Ask APEX** answers plain-English questions ("What was total travel spend in
2025?") with a governed, grounded response: a narrative answer, the **generated
SQL**, a **result table**, live **reasoning steps**, the underlying **MCP tool
calls**, and a **deep link** into the native Genie space.

There is **no bespoke LLM orchestration**. The backend opens a real
[MCP](https://docs.databricks.com/aws/en/generative-ai/mcp/managed-mcp) session
to a **managed Databricks Genie MCP server** (official `mcp` Python SDK over
Streamable HTTP), discovers tools at runtime, calls an *ask* tool, polls a
*poll* tool until Genie finishes, and streams every step to the browser over
**Server-Sent Events (SSE)**. The managed server gives you an **agent-mode**
experience out of the box today.

The app exposes this in **three** places:

| Capability | Where | Genie mode | Persistence |
| --- | --- | --- | --- |
| **In-dashboard "Ask APEX" rail** | Right-hand rail next to each dashboard | `space` (per-space) | in-memory |
| **Executive Summary** | One-click modal on a dashboard | `multi` (Genie One MCP) | none |
| **Standalone "Ask APEX" page** | Full-page chat (`/genie-mcp`) | `multi` (Genie One MCP) | Lakebase |
| **"Ask APEX Live" page** | Full-page chat (`/ask-apex-live`), **charts inline** | `view_ask` MCP App View (Genie One MCP) | none |

> The first three surfaces use the **text-only** `genie_ask` path (SQL + markdown
> table). **Ask APEX Live** uses Genie One MCP's `view_ask` **MCP App** path,
> which renders Genie's own interactive **View** (charts + progress) inline. See
> [Capability 4](#capability-4--ask-apex-live-mcp-app-view).

> **Modes.** `space` = per-space server `{host}/api/2.0/mcp/genie/{spaceId}`.
> `multi` = **Genie One MCP**, the workspace-wide server `{host}/api/2.0/mcp/genie`
> that answers across every Genie space the caller can access. The server's
> `AskRequest.mode` defaults to `space`, but the standalone page and Executive
> Summary both pass `"multi"` explicitly — a deliberate override, not the default.

## How it works (request → SSE → render)

```
Browser (React)                FastAPI (server/routes/genie_mcp)         Managed Genie MCP
──────────────                 ─────────────────────────────────        ─────────────────
sendMessage(text, context) ─── POST /api/genie-mcp/ask ───────────►
                                 resolve auth + mode
                                 open MCP session (Streamable HTTP,
                                   Authorization: Bearer <token>) ───►   tools/list
                                 ask tool ──────────────────────────►   genie_ask / query_space_<id>
                                 poll tool (every ~3s) ─────────────►   genie_poll_response / poll_…
   ◄── data: {json}\n\n ─────── yield event dicts as SSE frames
       meta·status·tool_call·                                     ◄───   status + progress steps
       sql·table·text·deep_link
   ◄── data: [DONE] ─────────── stream ends
render answer / SQL / table /
reasoning / "under the hood"
```

Each SSE `type` maps to a patch on the streaming assistant message (see
[SSE event contract](#sse-event-contract)).

---

## Capability 1 — In-dashboard "Ask APEX" rail

A 400px right rail sits next to the embedded dashboard, scoped to the **current
page**. `DashboardWorkspace` drives the chat hook in the **default `space`
mode** (per-space Genie space) — note the bare `useGenieMcpChat()` call:

```34:34:frontend/src/components/DashboardWorkspace.tsx
  const { messages, isLoading, mcpStatus, sendMessage, clearChat } = useGenieMcpChat();
```

**Per-page tailoring.** `App.tsx` selects each page's Genie wiring
(`summaryPrompt` + `suggestions`) with `getDashboardGenie(route, activePageId)`
and builds a `pageContext` string from the page label + the active filters:

```47:54:frontend/src/App.tsx
      const genie = getDashboardGenie(route, activePageId);
      const spec = getDashboard(route);
      const pageLabel = `${route.label} · ${
        route.pages?.find((p) => p.pageId === activePageId)?.label ?? ""
      }`.replace(/ · $/, "");
      const pageContext = [`Dashboard: ${pageLabel}`, filtersToContext(filters, spec)]
        .filter(Boolean)
        .join(". ");
```

`filtersToContext` renders only the filters that dashboard supports into a short
string (e.g. `Period: 2025-01-01 to 2025-12-31. Sector: Air`):

```373:388:frontend/src/config.ts
export function filtersToContext(filters: FilterState, spec?: DashboardSpec): string {
  const keys = spec ? getSupportedFilterKeys(spec) : (Object.keys(FILTERS) as FilterKey[]);
  const parts: string[] = [];
  for (const key of keys) {
    const def = FILTERS[key];
    if (def.kind === "dateRange") {
      const from = filters[def.fromField] as string | undefined;
      const to = filters[def.toField] as string | undefined;
      if (from && to) parts.push(`${def.label === "vs" ? "Previous period" : def.label}: ${from} to ${to}`);
    } else {
      const value = filters[def.field] as string | undefined;
      if (value) parts.push(`${def.label}: ${value}`);
    }
  }
  return parts.join(". ");
}
```

Per-page prompts/suggestions live in `config.ts` (`SPEND_GENIE`,
`SUSTAINABILITY_GENIE`, `CARBON_FORECAST_GENIE`) and are resolved page-first,
then route-level, then a safe default:

```506:509:frontend/src/config.ts
export function getDashboardGenie(route?: RouteConfig, pageId?: string): DashboardGenieConfig {
  const page = route?.pages?.find((p) => p.pageId === pageId);
  return page?.genie ?? route?.genie ?? SPEND_GENIE;
}
```

**Sending with context.** Both the composer and the suggested-question buttons
pass `pageContext` as the SSE `context` field, and the rail resets its
conversation whenever the page changes:

```50:60:frontend/src/components/DashboardWorkspace.tsx
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim(), pageContext);
    setInput("");
  };

  const handleSuggestion = (q: string) => {
    if (isLoading) return;
    sendMessage(q, pageContext);
  };
```

On the server, `context` is prepended to the question so Genie honors the active
filters:

```111:113:server/routes/genie_mcp/service.py
    question = message
    if context:
        question = f"[Filter context: {context}]\n\n{message}"
```

---

## Capability 2 — Executive Summary

One click opens `ExecutiveSummaryModal`, which fires a **single** prompt on mount
against the **workspace-wide Genie MCP (`"multi"`)**, with no persistence:

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

The page's `summaryPrompt` is wrapped by `buildExecSummaryPrompt`, which forces
**exactly three sections in this order** — `## Overview`, `## KPIs`,
`## Strategic Insights` — so every page renders a consistent brief:

```516:528:frontend/src/config.ts
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

While streaming, the modal shows a shimmer skeleton mirroring those three
sections, then renders the markdown answer, table, SQL, and deep link. The same
`pageContext` (page label + filters) is passed as `context`.

---

## Capability 3 — Standalone "Ask APEX" page

The full-page chat at `/genie-mcp` drives the hook in **`"multi"` (Genie One MCP,
workspace-wide) with Lakebase persistence on**. There is intentionally **no mode
toggle and no explanatory banner** — just the branded hero, a history rail, and
the chat:

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

The empty state is a centered hero ("Ask APEX anything") with `multi`-mode
suggestion chips from `SUGGESTIONS_BY_MODE.multi`; a live MCP status pill sits in
the header. Each assistant turn renders with full affordances (collapsible
answer, "under the hood" tool panel, footer). Completed turns persist to
Lakebase and appear in the left history rail (see `useGenieMcpChat` persistence,
below). Multi-tenant note: when a tenant session is active, Genie runs as that
tenant's Service Principal — see `docs/handoff/multi-tenant-isolation.md`.

---

## Frontend: the chat hook (`useGenieMcpChat.ts`)

One hook powers all three surfaces. It defaults to `space` mode; callers override
to `multi` where needed:

```84:88:frontend/src/hooks/useGenieMcpChat.ts
export function useGenieMcpChat(
  initialMode: GenieMode = "space",
  options: UseGenieMcpChatOptions = {}
) {
  const { persist = false } = options;
```

`checkHealth` probes `GET /api/genie-mcp/health?mode=<mode>` and populates the
status pill (auth type + discovered tools). `sendMessage` POSTs to
`/api/genie-mcp/ask` and reads the SSE body with a `ReadableStream` reader,
splitting on `\n`, stripping the `data: ` prefix, and skipping `[DONE]`:

```182:214:frontend/src/hooks/useGenieMcpChat.ts
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

Each event `type` patches the streaming message — the exact contract with
`service.py`:

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

When `persist` is on (standalone page only), the assembled turn is saved to
Lakebase via `saveConversationTurn` after the stream ends; the history rail is
then refreshed. Persistence fails soft — if Lakebase is off the chat still works
in memory (`server/routes/apex.py` at `/api/apex`).

**Rendering.** `GenieAssistantMessage` composes the pieces in order —
reasoning → error → answer (collapsible on the full page) → SQL → table → tool
calls → deep link → footer — reused by both the rail (`variant="compact"`) and
the page (`variant="full"`). Supporting components: `GenieReasoning` (violet
"Genie reasoning" timeline from `status` events), `GenieToolCalls` ("Under the
hood · N MCP calls" — lists the `ask` call and collapses many `poll` calls into
their distinct status transitions), `GenieSqlBlock`, `GenieResultTable`,
`GenieDeepLink`, and `GenieMcpStatus` (the pill/dot).

---

## Server: the ask → poll → answer pipeline

All modules live under `server/routes/genie_mcp/`, mounted at `/api`
(`app.py` 16-17) → routes become `/api/genie-mcp/health` and
`/api/genie-mcp/ask`.

### Routes (`routes.py`)

`AskRequest` is the POST body. Its `mode` **defaults to `space`** on the server —
the `multi` callers override it explicitly:

```37:42:server/routes/genie_mcp/routes.py
class AskRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    context: Optional[str] = None
    # "space" -> per-space Genie Space MCP; "multi" -> workspace-wide Genie MCP.
    mode: Optional[str] = MODE_SPACE
```

`POST /genie-mcp/ask` resolves auth + space, then streams every event dict from
`run_genie_turn` as `data: {json}\n\n`, ending with `data: [DONE]`:

```77:97:server/routes/genie_mcp/routes.py
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
```

`GET /genie-mcp/health?mode=space|multi` does a connect + `tools/list` to prove a
live session and returns the discovered ask/poll tool names.

### URL shapes + mode (`urls.py`)

`normalize_mode` coerces anything non-`multi` to `space`; `resolve_genie_mcp_url`
builds the URL (an env override `GENIE_MCP_SERVER_URL` pins it regardless):

```25:47:server/routes/genie_mcp/urls.py
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

The "Open in Genie" deep link is `{host}/genie/rooms/{space_id}`
(`genie_space_deep_link`, 50-57).

### Auth (`auth.py`)

`resolve_genie` returns `(token, token_type, space_id_override)`. It tries the
**multi-tenant Service Principal path first** (returns `token_type="tenant_sp"`
plus an optional per-tenant space); on any miss it falls back to standard
resolution so health checks and pre-onboarding requests still work:

```21:43:server/routes/genie_mcp/auth.py
def resolve_genie(request: Request) -> tuple[str, str, str | None]:
    """Resolve (bearer_token, token_type, space_id_override) for a Genie turn.

    Multi-tenant path first: if the logged-in white-label session maps to a
    tenant Service Principal (session ``tenant_id`` matches a registered tenant), Genie
    runs AS THAT SP, so ``session_user()`` resolves to the SP and the Unity
    Catalog row filter scopes results to the tenant. A per-tenant Genie space
    override (``client_registry.genie_space_id``) is returned when set.

    Falls back to the standard resolution (OBO → app SP → PAT) with no space
    override, so health checks and pre-onboarding requests still work.
    """
    try:
        from ...tenants.resolver import resolve_tenant_sp

        hit = resolve_tenant_sp(request)
        if hit:
            token, row = hit
            return token, "tenant_sp", (row.genie_space_id or None)
    except Exception:  # noqa: BLE001 - never block on the isolation layer
        pass
    token, token_type = resolve_token(request)
    return token, token_type, None
```

`resolve_token` is the standard precedence: (1) OBO user token from
`x-forwarded-access-token` (`genie` scope → Genie runs as the user under UC
governance); (2) host-agnostic SP via M2M (`get_sp_bearer()`, minted in
`config.py` from `DATABRICKS_CLIENT_ID/SECRET`); (3) Databricks Apps default SP;
(4) local PAT (`token` env). See `docs/handoff/multi-tenant-isolation.md` for the
per-tenant SP details.

### Core loop (`service.py`)

`run_genie_turn` is framework-agnostic (yields plain event dicts, no SSE
coupling). One MCP session does the whole turn:

1. **Connect + discover** — open Streamable HTTP → `ClientSession` →
   `initialize()` → `list_tools()`, then `resolve_tool_names` picks the ask/poll
   tools. Emits `meta` + a first `status`.
2. **Ask** — `build_ask_args` builds args from the tool's discovered input
   schema, `call_tool` runs it, the result is unwrapped + normalized, and a
   `tool_call` (phase `ask`) is emitted.
3. **Poll** — until a terminal status, call the poll tool every
   `POLL_INTERVAL_MS` (default 3s, up to 120 attempts), emitting a `tool_call`
   (phase `poll`) and `status` events (prefers Genie's explicit `progress_steps`,
   else narrates the status transition). Honors client disconnects.
4. **Emit artifacts** — once terminal, stream `sql`, `table`, `text`, and
   `deep_link` (falling back to the Genie-space deep link):

```222:240:server/routes/genie_mcp/service.py
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

Poll cadence and terminal statuses:

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

### Tool discovery (`client.py`) + parsing (`parsing.py`)

Tool names are **never hardcoded**. `resolve_tool_names` maps discovered tools to
ask/poll roles — canonical `genie_ask` / `genie_poll_response` (multi) and
`query_space_<id>` / `poll_response_<id>` (per-space); when a `space_id` is given
it prefers the tool whose name contains that id. `build_ask_args` / `build_poll_args`
build arguments from each tool's `inputSchema.properties` (fuzzy-matching the
question key, injecting `space_id` into any `*space*` property).

`parsing.normalize_state` funnels **both** server shapes into one state dict
(`conversation_id, message_id, status, text, sql_blocks, tables, deep_link,
progress_steps`) so `service.py` never branches on shape:

- **per-space:** structured JSON — `content.textAttachments` /
  `content.queryAttachments` (SQL + `statement_response` → table).
- **multi:** rendered markdown — a ` ```sql ` fence, a GFM table (with numeric
  formatting so figures don't render in scientific notation), and a deep link.
  Genie's `<!-- begin-embedded:… -->` markers and stray `[Query Result](…)` links
  are stripped from the prose by `clean_answer_markdown` (the table is rendered
  separately from structured data).

`sse.py` is the framing helper: dicts are JSON-encoded, strings pass through (for
`[DONE]`).

---

## Configuration & setup

### Prerequisites

1. A Databricks workspace with **Genie** enabled and at least one working
   **Genie space** (tables added, questions verified in the native UI).
2. The **managed Genie MCP server** enabled (`.../api/2.0/mcp/genie[...]` — see
   the [managed MCP docs](https://docs.databricks.com/aws/en/generative-ai/mcp/managed-mcp)).
3. A **Service Principal** with an OAuth secret (portable external hosting),
   and/or an OBO user-token path (Databricks App / your IdP).
4. A SQL warehouse the Genie space can use.

### Permissions the calling identity needs

Whichever identity actually calls the MCP server (the **SP** for M2M / tenant SP,
or the **user** for OBO):

- **CAN RUN** (or higher) on the target **Genie space**.
- **CAN USE** on the **SQL warehouse** backing the space.
- Unity Catalog **SELECT** on the space's tables/views (+ USE CATALOG / USE
  SCHEMA). Enforced as the *user* under OBO, or as the *SP* otherwise.

### Environment

The one required data setting is the Genie space id (`config.py` 50):

```50:50:server/config.py
GENIE_SPACE_ID = os.environ.get("GENIE_SPACE_ID", "01f127092d2219f3be10180d79b2ee5d")
```

| Var | Purpose |
| --- | --- |
| `DATABRICKS_HOST` (→ `WORKSPACE_URL`) | Workspace host; builds the MCP URL + deep links. |
| `DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET` | SP M2M creds → the bearer token sent to the MCP server. |
| `GENIE_SPACE_ID` | Per-space mode + tool selection in multi mode + deep links. |
| `token` | Local-dev PAT fallback. |
| `GENIE_MCP_SERVER_URL` | Optional override that pins the MCP URL regardless of mode. |
| `GENIE_MCP_POLL_INTERVAL_MS` / `GENIE_MCP_POLL_MAX_ATTEMPTS` | Poll cadence / cap (defaults 3000ms / 120). |
| `DATABRICKS_APP_NAME` | Auto-set inside Databricks Apps; switches to platform default auth. |

> `config.ts` also has a client-side `GENIE_SPACE_ID` (line 38) used only for
> client-side references; the **server** `GENIE_SPACE_ID` env is what drives the
> MCP call.

### Switching modes

- **Per request:** the POST body / health query `mode` (`"space"` | `"multi"`).
- **In-dashboard rail:** `space` (bare `useGenieMcpChat()`).
- **Standalone page & Executive Summary:** hardcoded `"multi"`. To point the page
  at a single space, change its `useGenieMcpChat("multi", …)` argument to
  `"space"` and ensure `GENIE_SPACE_ID` is set.

---

## Capability 4 — Ask APEX Live (MCP App View)

A second full-page chat at **`/ask-apex-live`** that renders Genie's answers as
**interactive charts inline** instead of a text table. It uses Genie One MCP's
**MCP App** path (`view_ask`), documented at
[Genie One MCP server](https://docs.databricks.com/aws/en/agents/mcp/genie-mcp).
It is a **new, additive** surface — the existing `genie_ask` + SSE surfaces are
untouched.

### Why it's a different code path

MCP App visualizations are **not** an extra SSE event on the `genie_ask` stream.
`view_ask` returns an [MCP Apps](https://modelcontextprotocol.org/extensions/apps/overview)
**View**: a `ui://` HTML resource that the *host* renders in a sandboxed iframe;
the View then polls Genie itself and draws the charts. So the app must act as an
**MCP Apps host**, not just parse tool output. We use `@mcp-ui/client`'s
`AppRenderer` for the host side.

### Architecture (browser is the host; backend is a stateless MCP proxy)

The browser cannot hold Databricks credentials or reach the managed server
directly (CORS), so the backend proxies MCP while the browser hosts the iframe:

```
Ask APEX Live (React)            FastAPI (genie_mcp/app_view.py)        Genie One MCP
─────────────────────            ───────────────────────────────       ─────────────
sendMessage(q) ── POST /app/ask ──────────────────────────────►
                                 initialize(+UI extension) ───────►     (offers view_ask)
                                 tools/call view_ask ─────────────►
   ◄── { resourceUri, toolResult, deepLink, conversationId } ───
AppRenderer mounts the View:
  onReadResource ── POST /app/read-resource {uri} ───────────────►      resources/read ui://…
   ◄── ReadResourceResult (HTML) ──
  (View polls / drills down)
  onCallTool ────── POST /app/call-tool {name,args} ─────────────►      tools/call (poll, get_query_result)
   ◄── CallToolResult ──
```

- **Auth / isolation unchanged.** Each proxy call opens a short-lived MCP session
  via `resolve_genie(request)` (tenant SP → OBO → app SP → PAT), so the UC row
  filter still scopes results per tenant. Proxying is **stateless** — Genie state
  lives server-side keyed by `conversation_id`, so a fresh session per call is
  fine.
- **UI extension capability.** The managed server only offers `view_ask` + the
  `ui://` resource to Apps-capable clients. The stock `ClientSession.initialize`
  can't send the SEP-1724 `extensions` field, so `app_view._initialize_with_ui`
  sends a capability-complete initialize advertising
  `{"io.modelcontextprotocol/ui": {"mimeTypes": ["text/html;profile=mcp-app"]}}`.
- **Sandbox proxy.** `AppRenderer` needs a sandbox-proxy HTML page (a distinct
  document that hosts the View iframe). We serve `frontend/public/mcp-sandbox-proxy.html`
  at `/mcp-sandbox-proxy.html`. It is **same-origin** (fine for the reference
  app); for production, serve it from a separate origin/subdomain with a strict
  CSP that still allows the View's runtime scripts.

### Endpoints (`server/routes/genie_mcp/app_view.py`)

| Route | Purpose |
| --- | --- |
| `GET /api/genie-mcp/app/health` | `initialize(+UI)` + `tools/list`; reports whether `view_ask` is offered. |
| `POST /api/genie-mcp/app/ask` | Calls `view_ask`; returns `{ toolName, resourceUri, toolResult, conversationId, deepLink }`. |
| `POST /api/genie-mcp/app/read-resource` | Proxies `resources/read` (the View fetches its own HTML). |
| `POST /api/genie-mcp/app/call-tool` | Proxies `tools/call` (the View's own poll / drill-down calls). |

### Frontend

- `frontend/src/pages/AskApexLive.tsx` — the page (route `/ask-apex-live`, nav
  label **"Ask APEX Live"**).
- `frontend/src/hooks/useGenieAppView.ts` — drives `/app/ask` and exposes the
  stable `onReadResource` / `onCallTool` proxy handlers for `AppRenderer`.
- `@mcp-ui/client` (dep added to `frontend/package.json`) — `AppRenderer` in
  client-less mode (`onReadResource` + `onCallTool`), so no token ever reaches
  the browser.

### Prerequisites

Same as the other surfaces (see [Prerequisites](#prerequisites)), plus the
workspace must have the **Managed MCP Servers** preview enabled and **Chat in
Genie One** configured (that's what exposes `view_ask`). If `view_ask` isn't
offered, `/app/health` returns `hasViewAsk: false` and the page shows an amber
banner instead of failing.

### Validated live on `e2-demo-field-eng` ✅

The backend proxy chain is validated against a live App-View-enabled workspace
(`e2-demo-field-eng`, OBO user token):

- `initialize` (protocol `2025-11-25` + `extensions: io.modelcontextprotocol/ui`)
  → server **acks** `capabilities.extensions: {io.modelcontextprotocol/ui: {}}`
  and exposes `view_ask`, `view_poll_response`, `view_fetch_query_results`.
- `view_ask` tool `_meta.ui.resourceUri = ui://genie/mcp-app.html`; `_resource_uri`
  reads it correctly.
- `resources/read ui://genie/mcp-app.html` → real View HTML
  (`text/html;profile=mcp-app`, ~31 KB) — what `/app/read-resource` serves.
- `view_ask` result `structuredContent` has `conversation_id` + `deep_link` —
  what `/app/ask` extracts.

**Protocol pin was essential:** the pinned `mcp` SDK (1.12.4) negotiates
`2025-06-18`, which predates MCP Apps and yields **no** `view_ask`.
`app_view._APP_PROTOCOL_VERSION` pins `2025-11-25`. (Consider upgrading the `mcp`
package once Apps is GA.)

### ⚠️ Not all workspaces serve the App View yet

`view_ask` is Beta behind the **Managed MCP Servers** preview. Probed workspaces
`dbc-1e27e56a-90cd` and `fevm-serverless-stable-71zsua` connect + initialize but
only expose `genie_ask` / `genie_poll_response` (no apps/UI capability). Point
APEX at an enabled workspace via `GENIE_MCP_SERVER_URL` to use the feature.

To confirm the in-browser render on an enabled workspace, verify end-to-end:

1. `curl .../api/genie-mcp/app/health` → expect `{"ok": true, "hasViewAsk": true, "resourceUri": "ui://…"}`.
2. Load `/ask-apex-live`, ask a chart question, confirm the View iframe renders
   and the network shows `/app/read-resource` + `/app/call-tool` calls.
3. If the View renders blank: the sandbox proxy CSP may block the View's runtime
   scripts — check the iframe console and relax/adjust CSP.
4. If `hasViewAsk` is false but the preview is on: confirm the identity resolved
   by `resolve_genie` can access Genie One (the same identity `genie_ask` uses).

## Troubleshooting

Start with the health probe — it isolates connectivity/auth from a full turn:

```bash
curl "http://localhost:8000/api/genie-mcp/health?mode=space"   # per-space
curl "http://localhost:8000/api/genie-mcp/health?mode=multi"   # Genie One MCP
```

Healthy: `{"ok": true, "auth": "service_principal"|"obo"|"tenant_sp", "tools":[…], "ask_tool":"…", "poll_tool":"…"}`.

| Symptom | Likely cause |
| --- | --- |
| Health `{"ok": false}` (500 + `message`) | Connection/auth failure; UI pill shows "MCP offline — retry". |
| `"No OBO token, no SP credentials … and no local PAT"` | None of the auth paths configured (`auth.py`). |
| `"WORKSPACE_URL is not set…"` | `DATABRICKS_HOST` / `workspace_url` missing (`urls.py`). |
| `"No usable Genie tool found on MCP server …"` | Identity can't see a Genie tool (permissions) or wrong URL/space (`service.py`). |
| Permission denied / empty answer for a space | Identity lacks CAN RUN on the space or SELECT on its tables → `error` or `_Genie returned status: …_`. |
| `"Timed out waiting for Genie to finish…"` | Turn exceeded `POLL_MAX_ATTEMPTS × POLL_INTERVAL_MS` (~6 min default); raise the caps. |
| Stray `begin-embedded:` / `[Query Result]` noise | A marker variant slipped past `clean_answer_markdown` (`parsing.py`). |
| History not saving | Lakebase disabled — expected; UI still works in-memory. |

- Pill says **"service principal"** but you expected OBO → no
  `x-forwarded-access-token` reached the app (not behind the proxy/IdP that
  injects it), so it fell back to SP.

---

## SSE event contract

`run_genie_turn` yields these `type`s; the hook's `switch` consumes them:

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

## File map

**Server** (`server/routes/genie_mcp/`): `routes.py` (health + ask/SSE),
`service.py` (`run_genie_turn` + `probe_health`), `client.py` (unwrap + tool
discovery + arg building), `auth.py` (`resolve_genie` → tenant SP / OBO / SP /
PAT), `urls.py` (URL shapes + deep link + `normalize_mode`), `parsing.py`
(artifact parsing + `normalize_state`), `sse.py` (framing),
`app_view.py` (the **MCP App View** proxy: `/app/health|ask|read-resource|call-tool`
+ `_initialize_with_ui`). Also
`server/routes/apex.py` (Lakebase history + filter prefs, `/api/apex`),
`server/config.py` (`GENIE_SPACE_ID`, `WORKSPACE_URL`, SP creds, `get_sp_bearer`),
`app.py` (router mounting).

**Frontend** (`frontend/src/`): `pages/GenieMcpExperience.tsx` (standalone page,
`multi` + persist), `pages/AskApexLive.tsx` (**MCP App View** page, `/ask-apex-live`)
+ `hooks/useGenieAppView.ts` (drives `/app/ask` + `AppRenderer` proxy handlers) +
`public/mcp-sandbox-proxy.html` (View iframe sandbox host),
`components/DashboardWorkspace.tsx` (in-dashboard rail +
Executive Summary trigger, `space`), `components/ExecutiveSummaryModal.tsx`
(`multi`), `hooks/useGenieMcpChat.ts` (SSE hook + persistence),
`components/genie/*` (message composer, reasoning, tool calls, SQL, table, deep
link, status, mode metadata), `config.ts` (`GENIE_SPACE_ID`, per-page Genie
configs, `filtersToContext`, `getDashboardGenie`, `buildExecSummaryPrompt`).
