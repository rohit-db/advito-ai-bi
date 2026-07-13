# Lakebase persistence + config-driven dashboard/filter registry

> **Audience:** the partner team taking over / reusing the APEX reference app.
> This doc is deliberately hand-holdy. It explains two reusable pillars of the
> app and, crucially, how they *fail soft* so a demo never hard-crashes.
>
> **Scope:** persistence (Lakebase) and the frontend config registry.
> Authentication / the white-label user directory is mentioned where relevant
> but is owned by the auth handoff doc.
>
> Everything below is grounded in real source on the
> `feature/sustainability-dashboards` branch, with line-accurate code refs.

---

## TL;DR

- **APEX** (FastAPI + React) uses **Lakebase — Databricks-managed Postgres — as
  its OLTP persistence layer** for two things (three, counting auth):
  1. **conversation history** for the "Ask APEX" Genie experience, and
  2. **per-user dashboard filter preferences** (your saved filter selection is
     restored on your next visit).
- **No long-lived DB password exists.** The Postgres "password" is a
  **short-lived OAuth credential minted from a Databricks identity** — the app's
  Service Principal in production, or a Databricks CLI profile in local dev.
- **Everything fails soft.** If Lakebase is disabled or unreachable, the app
  still runs: conversations just aren't saved, filters aren't remembered. The
  server returns `persisted: false` / empty results; the frontend `try/catch`es
  every call and returns empty/null.
- **Dashboards + filters are config-driven.** Adding a new dashboard is
  declarative: add a `DashboardSpec` to `DASHBOARDS` and a `ROUTES` entry in
  `frontend/src/config.ts`. The `FilterBar` and `CustomDashboard` components
  adapt automatically — you don't touch component code.

**The 8 `/api/apex/*` endpoints, the 3 Lakebase tables, and the env vars are
all listed at the very bottom of this doc.**

---

## Lakebase credential model (prod SP vs local CLI profile)

### Why Lakebase

Lakebase is Databricks' managed Postgres. Using it here means the app's
transactional state (conversations, filter prefs, the user directory) lives in
an OLTP store **co-located with the same Databricks identity** the app already
uses for everything else (Genie, dashboard embedding). The payoff:

- **No separate DB secret to manage.** Auth to Postgres is OAuth — the
  connection "password" is a short-lived database credential minted on demand
  from a Databricks identity, so there's no long-lived password sitting in an
  env var or secret store.
- **One identity, one auth chain.** The credential is minted through the same
  Service-Principal-first client the rest of the app uses
  (`server.config.get_workspace_client()`), so it works host-agnostically —
  inside Databricks Apps *or* on EC2/ECS/any container — with no Databricks
  login.

The module docstring lays out this intent and the env contract:

```1:27:server/lakebase.py
"""Shared Lakebase (Databricks managed Postgres) connection layer.

One place that knows how to talk to Lakebase, reused by every persistence
concern in the app:
  * the white-label user directory (``server.auth.users``),
  * conversation history + user filter preferences (``server.persistence``).

Lakebase auth is OAuth — the Postgres "password" is a short-lived database
credential minted from a Databricks identity. We mint it through the same
Service-Principal-first client the rest of the app uses
(``server.config.get_workspace_client()``), so it works host-agnostically with
no Databricks login. For local development you can instead point
``LAKEBASE_PROFILE`` at a Databricks CLI profile and mint the credential as that
user (handy before the SP has been granted a Postgres role on the instance).
```

### The `load_dotenv()` at import time — why it matters

Note lines 37–39: `load_dotenv()` runs **at module import**, *before* any of the
`os.environ.get(...)` module-level reads below it.

```37:64:server/lakebase.py
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("server.lakebase")


def _bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


LAKEBASE_ENABLED = _bool("LAKEBASE_ENABLED", False)
LAKEBASE_INSTANCE_NAME = os.environ.get("LAKEBASE_INSTANCE_NAME", "").strip()
# Resource path used to mint the database credential for Lakebase Autoscaling
# projects, e.g. projects/<id>/branches/production/endpoints/primary.
LAKEBASE_ENDPOINT_PATH = os.environ.get("LAKEBASE_ENDPOINT_PATH", "").strip()
# Optional CLI profile for local-dev credential minting. Leave blank in
# production so the app's SP auth chain mints the credential.
LAKEBASE_PROFILE = os.environ.get("LAKEBASE_PROFILE", "").strip()

PGHOST = os.environ.get("PGHOST", "").strip()
PGPORT = os.environ.get("PGPORT", "5432").strip() or "5432"
PGDATABASE = os.environ.get("PGDATABASE", "databricks_postgres").strip() or "databricks_postgres"
PGUSER = os.environ.get("PGUSER", "").strip()
PGSSLMODE = os.environ.get("PGSSLMODE", "require").strip() or "require"
```

**Why this bit us / why it matters:** these module-level constants
(`LAKEBASE_ENABLED`, `PGHOST`, `PGUSER`, …) are evaluated **once, at import
time**. If `.env` had not been loaded before this module was imported, all of
these would read as blank/default, `enabled()` would return `False`, and
Lakebase would silently stay off even though your `.env` was correct. Calling
`load_dotenv()` at the top of the module — not lazily inside a function —
guarantees the env is populated before the constants are computed. (Note
`server/config.py` does the same thing at its top for the Databricks SDK env
vars.)

### `enabled()` — the gate everything checks

```67:69:server/lakebase.py
def enabled() -> bool:
    """True when Lakebase is configured enough to attempt a connection."""
    return LAKEBASE_ENABLED and bool(PGHOST and PGUSER)
```

`enabled()` is the single source of truth. It requires **both** the feature flag
(`LAKEBASE_ENABLED=true`) **and** the minimum connection info (`PGHOST` +
`PGUSER`). Every persistence function calls this first (see graceful
degradation).

### How a connection is actually obtained

There are three moving parts: pick a workspace client → mint a credential →
build a psycopg conninfo.

**1. Pick the workspace client (this is the prod-vs-local-dev fork):**

```78:85:server/lakebase.py
def _workspace_client():
    if LAKEBASE_PROFILE:
        from databricks.sdk import WorkspaceClient

        return WorkspaceClient(profile=LAKEBASE_PROFILE)
    from server.config import get_workspace_client

    return get_workspace_client()
```

- **Local dev:** if `LAKEBASE_PROFILE` is set, mint the credential **as that CLI
  profile's user** (`WorkspaceClient(profile=…)`). This is handy *before* the
  Service Principal has been granted a Postgres role on the instance — you can
  develop as yourself.
- **Production:** if `LAKEBASE_PROFILE` is blank, fall through to
  `server.config.get_workspace_client()`, which is the app's
  **Service-Principal-first** auth chain. Its resolution order is:

```54:74:server/config.py
def get_workspace_client() -> WorkspaceClient:
    """Workspace client that works inside Databricks Apps *and* on any external host.

    Resolution order:
      1. Service Principal (M2M / OAuth client_credentials) when client id/secret
         are set — the portable, host-agnostic path used for external hosting.
      2. Databricks Apps platform default auth (injected SP) when running in-app.
      3. Local PAT via the legacy ``token`` env var.
    """
    if HAS_SP_CREDENTIALS:
        return WorkspaceClient(
            host=WORKSPACE_URL,
            client_id=DATABRICKS_CLIENT_ID,
            client_secret=DATABRICKS_CLIENT_SECRET,
        )
    if IS_DATABRICKS_APP:
        return WorkspaceClient()
    return WorkspaceClient(
        host=WORKSPACE_URL,
        token=os.environ.get("token"),
    )
```

**2. Mint the short-lived Postgres credential (cached, with two API paths):**

```88:115:server/lakebase.py
def _mint_token() -> str:
    global _token, _token_exp
    with _lock:
        if _token and time.time() < _token_exp - 120:
            return _token
        w = _workspace_client()
        cred = None
        # Lakebase Autoscaling projects mint via the postgres service using the
        # endpoint resource path. This is the path proven against apex-edge.
        if LAKEBASE_ENDPOINT_PATH:
            try:
                cred = w.postgres.generate_database_credential(  # type: ignore[attr-defined]
                    endpoint=LAKEBASE_ENDPOINT_PATH
                )
            except Exception as e:  # noqa: BLE001
                logger.debug("postgres.generate_database_credential failed: %s", e)
        # Newer "Database Instances" API mints via instance_names.
        if cred is None:
            import uuid

            cred = w.database.generate_database_credential(  # type: ignore[attr-defined]
                request_id=str(uuid.uuid4()),
                instance_names=[LAKEBASE_INSTANCE_NAME],
            )
        _token = cred.token
        _token_exp = time.time() + 3000  # credentials last ~1h; refresh early
        logger.info("Minted Lakebase credential for %s", LAKEBASE_INSTANCE_NAME or PGHOST)
        return _token  # type: ignore[return-value]
```

Key facts to understand here:

- **Caching:** the minted token is cached in module globals (`_token`,
  `_token_exp`) behind a `threading.Lock`, and reused until 120 s before
  expiry (line 91). Credentials last ~1 h; the code refreshes early by tracking
  a 3000 s (50 min) window (line 113). This avoids minting a credential on every
  single query.
- **Two minting APIs, tried in order:**
  1. If `LAKEBASE_ENDPOINT_PATH` is set → try the **Lakebase Autoscaling**
     path: `w.postgres.generate_database_credential(endpoint=…)`. This is the
     path proven against the `apex-edge` instance. Failures here are swallowed
     (logged at debug) so it can fall back.
  2. Otherwise / on fallback → the newer **"Database Instances"** API:
     `w.database.generate_database_credential(request_id=…, instance_names=[…])`.

**3. Build the conninfo and open a connection:**

```118:135:server/lakebase.py
def _conninfo() -> str:
    token = _mint_token()
    return (
        f"host={PGHOST} port={PGPORT} dbname={PGDATABASE} "
        f"user={PGUSER} password={token} sslmode={PGSSLMODE}"
    )


@contextmanager
def connection() -> Iterator["object"]:
    """Yield a psycopg connection minted with a fresh Lakebase credential."""
    import psycopg

    conn = psycopg.connect(_conninfo())
    try:
        yield conn
    finally:
        conn.close()
```

The minted token is dropped straight into the psycopg `password=` field. Every
`with connection() as conn:` gets a connection authenticated with a fresh (or
cached-but-still-valid) credential, and always closes it in the `finally`.

There's also a `healthcheck()` used by the health endpoint that reports
`"disabled"` when off and runs a `SELECT 1` otherwise:

```138:147:server/lakebase.py
def healthcheck() -> tuple[bool, str]:
    """Return (ok, detail) — used by the health endpoint."""
    if not enabled():
        return False, "disabled"
    try:
        with connection() as conn:
            conn.execute("SELECT 1")
        return True, "ok"
    except Exception as e:  # noqa: BLE001
        return False, str(e)[:200]
```

### Schema initialization

Schema creation is **lazy and best-effort**, driven from `server/persistence.py`.
`ensure_schema()` no-ops when Lakebase is off, otherwise executes the full
`CREATE TABLE IF NOT EXISTS …` block in one shot and commits:

```79:86:server/persistence.py
def ensure_schema() -> None:
    """Create the persistence tables if they don't exist (best-effort)."""
    if not enabled():
        return
    with connection() as conn:
        conn.execute(SCHEMA_SQL)
        conn.commit()
    logger.info("Lakebase persistence schema ensured")
```

Because it uses `IF NOT EXISTS`, it's idempotent — safe to call on every
startup. Nothing you have to run by hand.

---

## Schema + data model (conversations, turns, filter prefs)

All DDL lives in one `SCHEMA_SQL` string in `server/persistence.py`. Table names
are constants:

```31:33:server/persistence.py
CONVERSATIONS_TABLE = "apex_conversations"
MESSAGES_TABLE = "apex_messages"
FILTER_PREFS_TABLE = "apex_filter_prefs"
```

Here is the real DDL:

```37:69:server/persistence.py
SCHEMA_SQL = f"""
CREATE TABLE IF NOT EXISTS {CONVERSATIONS_TABLE} (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email  VARCHAR(255) NOT NULL,
    tenant      VARCHAR(255) NOT NULL DEFAULT '',
    mode        VARCHAR(32)  NOT NULL DEFAULT 'space',
    title       TEXT         NOT NULL DEFAULT '{DEFAULT_TITLE}',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_{CONVERSATIONS_TABLE}_user
    ON {CONVERSATIONS_TABLE}(user_email, updated_at DESC);

CREATE TABLE IF NOT EXISTS {MESSAGES_TABLE} (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES {CONVERSATIONS_TABLE}(id) ON DELETE CASCADE,
    seq             INTEGER NOT NULL,
    role            VARCHAR(16) NOT NULL,
    content         TEXT NOT NULL DEFAULT '',
    payload         JSONB NOT NULL DEFAULT '{{}}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_{MESSAGES_TABLE}_conv
    ON {MESSAGES_TABLE}(conversation_id, seq);

CREATE TABLE IF NOT EXISTS {FILTER_PREFS_TABLE} (
    user_email   VARCHAR(255) NOT NULL,
    dashboard_id VARCHAR(255) NOT NULL,
    filters      JSONB NOT NULL DEFAULT '{{}}'::jsonb,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_email, dashboard_id)
);
"""
```

### `apex_conversations` — one row per thread

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | `gen_random_uuid()` default |
| `user_email` | `VARCHAR(255)` | **owning identity** — everything is scoped by this |
| `tenant` | `VARCHAR(255)` | white-label tenant label |
| `mode` | `VARCHAR(32)` | e.g. `space` |
| `title` | `TEXT` | defaults to `"New conversation"`; auto-set from first user message |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | `updated_at` bumped on each new turn |

Indexed by `(user_email, updated_at DESC)` so the left-rail list (newest first,
per user) is a fast lookup.

### `apex_messages` — ordered messages

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `conversation_id` | `UUID` FK → `apex_conversations(id)` | `ON DELETE CASCADE` — delete a conversation, its messages go too |
| `seq` | `INTEGER` | per-conversation ordering |
| `role` | `VARCHAR(16)` | `user` or `assistant` |
| `content` | `TEXT` | plain text of the message |
| `payload` | **`JSONB`** | structured Genie output (steps, sql, toolCalls, table, deepLink, status, error) |
| `created_at` | `TIMESTAMPTZ` | |

Indexed by `(conversation_id, seq)` for ordered replay.

### `apex_filter_prefs` — one row per (user, dashboard)

| Column | Type | Notes |
|---|---|---|
| `user_email` | `VARCHAR(255)` | part of composite PK |
| `dashboard_id` | `VARCHAR(255)` | part of composite PK — the Lakeview dashboard id, or the sentinel `"__default__"` for the user's global "My Filters" default |
| `filters` | **`JSONB`** | the saved `FilterState` object |
| `updated_at` | `TIMESTAMPTZ` | |
| **PK** | `(user_email, dashboard_id)` | enables clean upsert |

### JSONB usage — `psycopg.types.json.Json`

Python dicts are wrapped for JSONB parameters via a small helper. This is how
arbitrary structured Genie output and filter objects get stored without
hand-serializing:

```72:76:server/persistence.py
def _json(value: Any):
    """Wrap a Python object for a JSONB parameter."""
    from psycopg.types.json import Json

    return Json(value if value is not None else {})
```

On the way **out**, JSONB comes back as a dict (psycopg adapts it), but the code
defensively handles a raw string too:

```179:190:server/persistence.py
    messages = []
    for role, content, payload in msg_rows:
        p = payload if isinstance(payload, dict) else (json.loads(payload) if payload else {})
        messages.append({"role": role, "content": content, **p})
    return {
        "id": head[0],
        "title": head[1],
        "mode": head[2],
        "created_at": head[3].isoformat() if head[3] else None,
        "updated_at": head[4].isoformat() if head[4] else None,
        "messages": messages,
    }
```

### The filter-prefs upsert (nice pattern to reuse)

Saving filter prefs is a single `INSERT … ON CONFLICT … DO UPDATE`, keyed on the
composite PK — so "save my filters for this dashboard" is one round-trip whether
or not a row already exists:

```295:309:server/persistence.py
def put_filter_prefs(user_email: str, dashboard_id: str, filters: dict) -> bool:
    if not enabled():
        return False
    with connection() as conn:
        conn.execute(
            f"""
            INSERT INTO {FILTER_PREFS_TABLE} (user_email, dashboard_id, filters, updated_at)
            VALUES (%s, %s, %s, NOW())
            ON CONFLICT (user_email, dashboard_id)
            DO UPDATE SET filters = EXCLUDED.filters, updated_at = NOW()
            """,
            (user_email, dashboard_id, _json(filters or {})),
        )
        conn.commit()
    return True
```

### Ownership enforcement

Every read/mutate is scoped by `user_email`, so one tenant can never touch
another's rows. Reads filter by it directly; `save_turn` checks ownership via a
helper before writing:

```145:150:server/persistence.py
def _owns(conn, conversation_id: str, user_email: str) -> bool:
    cur = conn.execute(
        f"SELECT 1 FROM {CONVERSATIONS_TABLE} WHERE id = %s AND user_email = %s",
        (conversation_id, user_email),
    )
    return cur.fetchone() is not None
```

---

## API surface (`/api/apex/*`) mapped to frontend helpers

The router is defined in `server/routes/apex.py` and mounted at `/api/apex`:

```23:24:app.py
from server.routes.apex import router as apex_router
app.include_router(apex_router, prefix="/api/apex")
```

Every route resolves the caller to `(email, tenant)` via `_user(request)`, which
prefers the white-label session identity and falls back to a stable demo key so
persistence still works in single-user demos:

```27:37:server/routes/apex.py
def _user(request: Request) -> tuple[str, str]:
    """Resolve (email, tenant) for the current request.

    Prefers the white-label session identity. Falls back to a stable demo key
    when auth is disabled (Databricks-Apps mode), so persistence still works in
    single-user demos.
    """
    identity = current_identity(request)
    if identity and identity.get("email"):
        return identity["email"], identity.get("tenant", "") or ""
    return "demo@advito.com", "Advito (All)"
```

### Endpoint reference

#### 1. `GET /api/apex/conversations` — list my conversations

```55:58:server/routes/apex.py
@router.get("/conversations")
def list_conversations(request: Request):
    email, _ = _user(request)
    return {"conversations": persistence.list_conversations(email)}
```

- **Response:** `{ "conversations": ConversationMeta[] }` (empty list when
  Lakebase is off). Each item: `id, title, mode, created_at, updated_at,
  message_count`.
- **Frontend helper:** `listConversations()` in `config.ts`.

```278:287:frontend/src/config.ts
export async function listConversations(): Promise<ConversationMeta[]> {
  try {
    const res = await fetch("/api/apex/conversations");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.conversations ?? []) as ConversationMeta[];
  } catch {
    return [];
  }
}
```

#### 2. `POST /api/apex/conversations` — create a conversation

```61:67:server/routes/apex.py
@router.post("/conversations")
def create_conversation(request: Request, body: CreateConversationBody):
    email, tenant = _user(request)
    if not persistence.enabled():
        return JSONResponse({"persisted": False, "id": None}, status_code=200)
    conv = persistence.create_conversation(email, tenant=tenant, mode=body.mode, title=body.title or persistence.DEFAULT_TITLE)
    return {"persisted": True, **conv}
```

- **Request body** (`CreateConversationBody`): `{ mode?: string = "space",
  title?: string | null }`.
- **Response:** when off → `{ "persisted": false, "id": null }` (HTTP 200, not an
  error!). When on → `{ "persisted": true, id, title, mode, created_at,
  updated_at }`.
- **Frontend helper:** `createConversation(mode)` — returns the id only if
  `persisted`, else `null`.

```289:302:frontend/src/config.ts
export async function createConversation(mode: string): Promise<string | null> {
  try {
    const res = await fetch("/api/apex/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.persisted ? (data.id as string) : null;
  } catch {
    return null;
  }
}
```

#### 3. `GET /api/apex/conversations/{conversation_id}` — get one thread

```70:76:server/routes/apex.py
@router.get("/conversations/{conversation_id}")
def get_conversation(request: Request, conversation_id: str):
    email, _ = _user(request)
    conv = persistence.get_conversation(conversation_id, email)
    if conv is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return conv
```

- **Response:** the conversation head + ordered `messages[]`, or **HTTP 404**
  `{ "error": "not found" }` if not owned by the caller (or Lakebase off).
- **Frontend helper:** `getConversation(id)` — returns `null` on any non-ok.

```304:314:frontend/src/config.ts
export async function getConversation(
  id: string
): Promise<{ id: string; title: string; mode: string; messages: any[] } | null> {
  try {
    const res = await fetch(`/api/apex/conversations/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
```

#### 4. `POST /api/apex/conversations/{conversation_id}/turn` — save one turn

```79:82:server/routes/apex.py
@router.post("/conversations/{conversation_id}/turn")
def save_turn(request: Request, conversation_id: str, body: SaveTurnBody):
    email, _ = _user(request)
    return persistence.save_turn(conversation_id, email, body.user, body.assistant)
```

- **Request body** (`SaveTurnBody`): `{ user: string, assistant: dict = {} }`.
  `assistant` is the structured Genie message (steps, sql, toolCalls, table,
  deepLink, status, error, content).
- **Response:** `{ ok, persisted, title? }` — `persisted: false` when off or not
  owned. Writes both the user message and the assistant message, and auto-titles
  the conversation from the first user message.
- **Frontend helper:** `saveConversationTurn(id, user, assistant)`.

```316:332:frontend/src/config.ts
export async function saveConversationTurn(
  id: string,
  user: string,
  assistant: unknown
): Promise<{ title?: string } | null> {
  try {
    const res = await fetch(`/api/apex/conversations/${encodeURIComponent(id)}/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, assistant }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
```

#### 5. `PATCH /api/apex/conversations/{conversation_id}` — rename

```85:89:server/routes/apex.py
@router.patch("/conversations/{conversation_id}")
def rename_conversation(request: Request, conversation_id: str, body: RenameBody):
    email, _ = _user(request)
    ok = persistence.rename_conversation(conversation_id, email, body.title)
    return {"ok": ok}
```

- **Request body** (`RenameBody`): `{ title: string }`.
- **Response:** `{ ok: boolean }`.
- **Frontend helper:** *(no dedicated helper in `config.ts` on this branch — the
  endpoint exists server-side for renaming; the shipped client helpers cover
  list/create/get/turn/delete + filter prefs.)*

#### 6. `DELETE /api/apex/conversations/{conversation_id}` — delete

```92:96:server/routes/apex.py
@router.delete("/conversations/{conversation_id}")
def delete_conversation(request: Request, conversation_id: str):
    email, _ = _user(request)
    ok = persistence.delete_conversation(conversation_id, email)
    return {"ok": ok}
```

- **Response:** `{ ok: boolean }`. (Messages cascade-delete via the FK.)
- **Frontend helper:** `deleteConversation(id)` — returns `res.ok`.

```334:343:frontend/src/config.ts
export async function deleteConversation(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/apex/conversations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

#### 7. `GET /api/apex/filters/{dashboard_id}` — get my saved filters

```104:107:server/routes/apex.py
@router.get("/filters/{dashboard_id}")
def get_filters(request: Request, dashboard_id: str):
    email, _ = _user(request)
    return {"filters": persistence.get_filter_prefs(email, dashboard_id)}
```

- **Response:** `{ "filters": {…} | null }` (`null` when none saved / off).
- **Frontend helper:** `fetchFilterPrefs(dashboardId)`.

```345:354:frontend/src/config.ts
export async function fetchFilterPrefs(dashboardId: string): Promise<Partial<FilterState> | null> {
  try {
    const res = await fetch(`/api/apex/filters/${encodeURIComponent(dashboardId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.filters ?? null) as Partial<FilterState> | null;
  } catch {
    return null;
  }
}
```

#### 8. `PUT /api/apex/filters/{dashboard_id}` — save my filters

```110:114:server/routes/apex.py
@router.put("/filters/{dashboard_id}")
def put_filters(request: Request, dashboard_id: str, body: FilterPrefsBody):
    email, _ = _user(request)
    ok = persistence.put_filter_prefs(email, dashboard_id, body.filters)
    return {"ok": ok}
```

- **Request body** (`FilterPrefsBody`): `{ filters: dict }`.
- **Response:** `{ ok: boolean }`.
- **Frontend helper:** `saveFilterPrefs(dashboardId, filters)` — completely
  swallows errors ("fail soft").

```356:366:frontend/src/config.ts
export async function saveFilterPrefs(dashboardId: string, filters: FilterState): Promise<void> {
  try {
    await fetch(`/api/apex/filters/${encodeURIComponent(dashboardId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filters }),
    });
  } catch {
    /* fail soft */
  }
}
```

---

## Graceful degradation (why the demo never hard-fails)

This is the single most important operational property: **you can run the entire
app with `LAKEBASE_ENABLED=false` and nothing crashes.** You just lose
persistence — conversations aren't saved, filters aren't remembered.

Degradation is enforced at **two layers**:

### Layer 1 — server: every persistence function checks `enabled()` first

Reads return empty/`None`, writes return `False` / `{"persisted": False}`. A few
examples:

```90:92:server/persistence.py
def list_conversations(user_email: str) -> list[dict]:
    if not enabled():
        return []
```

```224:225:server/persistence.py
    if not enabled():
        return {"ok": False, "persisted": False}
```

```280:282:server/persistence.py
def get_filter_prefs(user_email: str, dashboard_id: str) -> Optional[dict]:
    if not enabled():
        return None
```

And the create-conversation route short-circuits with a **200** (not a 500) so
the client can cleanly see `persisted: false`:

```64:65:server/routes/apex.py
    if not persistence.enabled():
        return JSONResponse({"persisted": False, "id": None}, status_code=200)
```

> Note: `create_conversation` in `persistence.py` *does* raise
> `RuntimeError("Lakebase is not enabled")` if called while disabled — which is
> exactly why the **route** guards with `persistence.enabled()` before calling
> it. The HTTP layer never lets that exception reach the client.

### Layer 2 — frontend: every client helper is wrapped in try/catch

Even if the network call fails, a 500 slips through, or JSON is malformed, the
helpers return a safe empty value (`[]`, `null`, `false`) instead of throwing.
See `listConversations` (returns `[]`), `getConversation`/`fetchFilterPrefs`
(return `null`), `deleteConversation` (returns `false`), and `saveFilterPrefs`
(swallows entirely, above).

### The net effect in the UI

The filter-restore effect in `App.tsx` applies a **three-level precedence** and
does nothing when nothing is saved — it only overrides defaults *if* something
comes back:

```109:126:frontend/src/App.tsx
  useEffect(() => {
    if (!currentDashboardId) return;
    let cancelled = false;
    (async () => {
      const perDashboard = await fetchFilterPrefs(currentDashboardId);
      if (cancelled) return;
      if (perDashboard) {
        setFilters({ ...DEFAULT_FILTERS, ...perDashboard });
        return;
      }
      const globalDefault = await fetchFilterPrefs(DEFAULT_PREFS_KEY);
      if (cancelled) return;
      setFilters({ ...DEFAULT_FILTERS, ...(globalDefault || {}) });
    })();
    return () => {
      cancelled = true;
    };
  }, [currentDashboardId]);
```

Precedence: **dashboard-specific saved selection → the user's global default →
app defaults.** So with Lakebase off: both `fetchFilterPrefs` calls return `null`
→ the UI runs on `DEFAULT_FILTERS`. Filtering still works within the session;
it's just not *remembered* across visits.

### "My Filters" — the user's global default selection

The same `apex_filter_prefs` table also stores each user's **global default**
filters under a sentinel `dashboard_id = DEFAULT_PREFS_KEY` (`"__default__"`,
from `frontend/src/config.ts`). The user sets these on the **"My Filters"** page
(`frontend/src/pages/PreferencesPage.tsx`, route `/preferences`), which reuses
the same `fetchFilterPrefs` / `saveFilterPrefs` helpers — no new table, no new
endpoint. Those defaults apply to any dashboard the user hasn't saved a
dashboard-specific selection for (the middle rung of the precedence above).

---

## Config-driven dashboard/filter registry (the reuse story)

The whole point of `frontend/src/config.ts` is: **wiring the app is declarative.**
Adding a dashboard or changing which filters a page shows should only touch the
config blocks — never the components.

```18:28:frontend/src/config.ts
// APEX app configuration
//
// This file is the single place to WIRE the app:
//   1. DASHBOARDS  — register an AI/BI dashboard + how its filters are wired
//   2. FILTERS     — declare the logical filters the app knows about (UI + URL)
//   3. ROUTES      — map nav entries to dashboards, pages, and Genie wiring
//
// Adding a dashboard or changing which filters apply to a page should only
// require editing the declarative blocks below — not the components.
```

### The three declarative blocks

**1. `FILTERS` — the catalog of logical filters (declared once).** Each filter
declares how it renders (`dateRange` vs `field`) and how it maps onto a
`FilterState` field. `FilterKey` is the closed set of known filters:

```81:85:frontend/src/config.ts
export type FilterKey =
  | "currentPeriod"
  | "previousPeriod"
  | "travelSector"
  | "destinationRegion";
```

```106:135:frontend/src/config.ts
export const FILTERS: Record<FilterKey, FilterDef> = {
  currentPeriod: {
    key: "currentPeriod",
    kind: "dateRange",
    label: "Period",
    fromField: "currentPeriodFrom",
    toField: "currentPeriodTo",
  },
  previousPeriod: {
    key: "previousPeriod",
    kind: "dateRange",
    label: "vs",
    fromField: "previousPeriodFrom",
    toField: "previousPeriodTo",
  },
  travelSector: {
    key: "travelSector",
    kind: "field",
    label: "Sector",
    field: "travelSector",
    allLabel: "All Sectors",
    options: [
      "Domestic",
      "Regional",
      "Intra Country",
      "Intra Continental",
      "Inter Continental",
      "Intercontinental",
    ],
  },
```

**2. `DASHBOARDS` — register a dashboard and WIRE its filters.** A
`DashboardSpec` binds each logical `FilterKey` to the *widget id* that drives it
on that specific dashboard, and can optionally override `workspace`/`org`:

```162:181:frontend/src/config.ts
export interface DashboardSpec {
  id: string;                                   // Lakeview dashboard id
  globalFilterPage: string;                     // "Global Filters" page id
  filters: Partial<Record<FilterKey, string>>;  // FilterKey → widget id
  workspace?: string;                           // optional per-dashboard workspace
  org?: string;                                 // optional per-dashboard org id
}

export const DASHBOARDS: Record<string, DashboardSpec> = {
  apex: {
    id: "01f1271698161d42b3c66528415775e8",
    globalFilterPage: "54194f59",
    filters: {
      currentPeriod: "period",
      previousPeriod: "previous_period",
      travelSector: "tsector",
      destinationRegion: "dest_region",
    },
  },
};
```

**3. `getSupportedFilterKeys` — the glue.** A dashboard "supports" exactly the
filters it binds a non-empty widget id for. This is what both the embed-URL
builder and the `FilterBar` use to know what to show:

```187:190:frontend/src/config.ts
export function getSupportedFilterKeys(spec?: DashboardSpec): FilterKey[] {
  if (!spec) return [];
  return (Object.keys(spec.filters) as FilterKey[]).filter((k) => !!spec.filters[k]);
}
```

### How the components adapt automatically

**`App.tsx` resolves the spec + supported keys from config** and passes them
down — it never hard-codes a filter set:

```104:110:frontend/src/App.tsx
  const currentRoute = ROUTES.find((r) => r.path === location.pathname);
  const isCustom = currentRoute?.mode === "custom";
  const isDashboard = currentRoute?.mode === "custom" || currentRoute?.mode === "native";
  const pages = currentRoute?.pages || [];
  const currentDashboard = getDashboard(currentRoute);
  const currentDashboardId = currentDashboard?.id;
  const filterKeys = getSupportedFilterKeys(currentDashboard);
```

It renders the `FilterBar` only when the dashboard supports at least one filter,
passing the resolved `filterKeys`:

```195:197:frontend/src/App.tsx
        {isCustom && filterKeys.length > 0 && (
          <FilterBar filters={filters} onChange={handleFilterChange} filterKeys={filterKeys} />
        )}
```

**`FilterBar.tsx` renders purely from the catalog + the `filterKeys` prop.** It
maps over the keys it was given and looks each one up in `FILTERS`, rendering a
date-range widget or a select depending on `def.kind`:

```83:122:frontend/src/components/FilterBar.tsx
        {filterKeys.map((key) => {
          const def = FILTERS[key];
          return (
            <Fragment key={key}>
              <Divider />
              {def.kind === "dateRange" ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-500 font-medium">{def.label}</span>
                  <input
                    type="date"
                    value={(draft[def.fromField] as string) || ""}
                    onChange={(e) => setDraft({ ...draft, [def.fromField]: e.target.value })}
                    className={DATE_INPUT_CLS}
                  />
                  <span className="text-xs text-slate-300">→</span>
                  <input
                    type="date"
                    value={(draft[def.toField] as string) || ""}
                    onChange={(e) => setDraft({ ...draft, [def.toField]: e.target.value })}
                    className={DATE_INPUT_CLS}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-slate-500 font-medium">{def.label}</span>
                  <StyledSelect
                    value={(draft[def.field] as string) || ""}
                    onChange={(e) => setDraft({ ...draft, [def.field]: e.target.value || undefined })}
                    style={{ minWidth: "8rem" }}
                  >
                    <option value="">{def.allLabel}</option>
                    {def.options.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </StyledSelect>
                </div>
              )}
            </Fragment>
          );
        })}
```

**Key takeaway:** `FilterBar` shows *only* the `filterKeys` for the active
dashboard. A dashboard that binds only `currentPeriod` + `travelSector` will show
just those two controls — no code change needed.

### Worked example — add a "Supplier Performance" dashboard with a different filter set

Say you want a new dashboard that only cares about **the current period and a
travel sector** (no comparison period, no region). Two declarative edits, zero
component edits.

**Step A — register the dashboard in `DASHBOARDS`** (in `frontend/src/config.ts`).
Bind only the filter keys it supports to the widget ids from *its* Global
Filters page:

```typescript
export const DASHBOARDS: Record<string, DashboardSpec> = {
  apex: {
    id: "01f1271698161d42b3c66528415775e8",
    globalFilterPage: "54194f59",
    filters: {
      currentPeriod: "period",
      previousPeriod: "previous_period",
      travelSector: "tsector",
      destinationRegion: "dest_region",
    },
  },
  // NEW dashboard — supports a DIFFERENT (smaller) filter set:
  supplier: {
    id: "0af9c0ffee1234567890abcdef012345",     // its Lakeview dashboard id
    globalFilterPage: "a1b2c3d4",               // its "Global Filters" page id
    filters: {
      currentPeriod: "period",                  // widget id on THIS dashboard
      travelSector: "sector_widget",            // widget id on THIS dashboard
    },
    // workspace / org optional — omit to inherit the global WORKSPACE / ORG
  },
};
```

Because `supplier.filters` only binds `currentPeriod` and `travelSector`,
`getSupportedFilterKeys` returns exactly `["currentPeriod", "travelSector"]`, and
the `FilterBar` for this dashboard renders **only** a period date-range and a
Sector dropdown — the previous-period and region controls simply don't appear.

**Step B — add a `ROUTES` entry** that points `dashboard` at the new key:

```typescript
export const ROUTES: RouteConfig[] = [
  // …existing routes…
  {
    path: "/supplier",
    label: "Supplier Performance",
    icon: "Briefcase",          // any key in ICON_MAP
    section: "insights",
    mode: "custom",
    dashboard: "supplier",      // ← key into DASHBOARDS
    genie: SPEND_GENIE,         // reuse or define a DashboardGenieConfig
    pages: [
      { label: "Summary", pageId: "summary" },
    ],
  },
];
```

That's it. `App.tsx` (`getDashboard` → `getSupportedFilterKeys`) resolves the new
spec by route, `CustomDashboard` embeds it, and `FilterBar` renders the reduced
filter set — all from config.

- **If you need a brand-new *kind* of filter** (say "cabin class") that isn't in
  the catalog yet, that's the one case you also extend `FilterState`
  (lines 61–68), add it to the `FilterKey` union (lines 81–85), and add a
  `FILTERS` entry (lines 106+). After that it's bindable by any dashboard.
- **Per-dashboard workspace/org:** set `workspace`/`org` on the `DashboardSpec`
  to point a single dashboard at a different workspace or org; the embed-URL
  helpers fall back to the global `WORKSPACE`/`ORG` when they're omitted (see
  `embedRoot`/`embedOrgParam`, lines 218–224).

---

## Enable Lakebase for YOUR deployment (prereqs + env)

### Prerequisites

1. **A Lakebase instance.** Create or point at an existing Lakebase
   (Databricks-managed Postgres) instance/project in your workspace. Note its
   instance name and — for Autoscaling projects — the **endpoint resource path**
   (`projects/<project-id>/branches/production/endpoints/primary`). You can get
   the endpoint and host with:

   ```bash
   databricks postgres get-endpoint <endpoint-path> -p <profile>
   ```

   That output gives you `PGHOST` and confirms the endpoint path.

2. **Grant the minting identity a Postgres role on the instance.**
   - **Production:** the identity is the app's **Service Principal**
     (`DATABRICKS_CLIENT_ID`). It must be able to call
     `generate_database_credential` for the instance *and* have a Postgres role
     on the database (so it can actually connect and read/write the
     `apex_*` tables). `PGUSER` = the SP's client id.
   - **Local dev:** you can develop as *yourself* before the SP is granted a
     role — set `LAKEBASE_PROFILE` to a Databricks CLI profile whose user has a
     Postgres role, and set `PGUSER` to your user email.

3. **Databricks SDK auth already configured** (the app's SP env vars —
   `DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID`, `DATABRICKS_CLIENT_SECRET`), since
   the credential is minted through `get_workspace_client()` in production.

### Environment variables (from `.env.example`)

```26:49:.env.example
# ── Lakebase (Databricks managed Postgres) ──────────────────────────
# Powers THREE things in this app, all in one managed Postgres:
#   1. the white-label user directory (falls back to AUTH_USERS_FILE when off)
#   2. conversation history for the Ask Genie experience
#   3. per-user dashboard filter preferences
# When false, the app runs entirely in-memory + JSON (zero Lakebase setup).
LAKEBASE_ENABLED=false
# Lakebase Autoscaling project id (display/reference).
LAKEBASE_INSTANCE_NAME=apex
# Endpoint resource path used to MINT the short-lived Postgres credential, e.g.
#   projects/<project-id>/branches/production/endpoints/primary
# Get it from: databricks postgres get-endpoint <path> -p <profile>
LAKEBASE_ENDPOINT_PATH=
# Local dev only: a Databricks CLI profile whose user mints the credential.
# Leave BLANK in production so the app's Service Principal mints it (the SP must
# have a Postgres role on the instance).
LAKEBASE_PROFILE=
# Postgres endpoint host (from the get-endpoint output above).
PGHOST=
PGPORT=5432
PGDATABASE=databricks_postgres
# Postgres login identity: the user email (local dev) or SP client id (prod).
PGUSER=
PGSSLMODE=require
```

### Production checklist

1. `LAKEBASE_ENABLED=true`
2. `LAKEBASE_INSTANCE_NAME=<your instance/project name>`
3. `LAKEBASE_ENDPOINT_PATH=projects/<id>/branches/production/endpoints/primary`
   (for Autoscaling projects)
4. `LAKEBASE_PROFILE=` **(leave blank)** so the app's SP mints the credential
5. `PGHOST=<endpoint host>`, `PGPORT=5432`, `PGDATABASE=databricks_postgres`,
   `PGSSLMODE=require`
6. `PGUSER=<sp-client-id>`
7. Ensure the SP has a Postgres role on the instance.
8. Start the app — `ensure_schema()` creates the `apex_*` tables on first
   connect (idempotent).

### Local-dev checklist

Same as above, except:

- `LAKEBASE_PROFILE=<your Databricks CLI profile>` (mint as your user)
- `PGUSER=<your user email>`

This lets you exercise persistence locally *before* the SP has been granted a
Postgres role.

### Turning it off

Set `LAKEBASE_ENABLED=false` (or just leave `PGHOST`/`PGUSER` blank). The app
runs entirely in-memory + JSON with zero Lakebase setup — conversations aren't
saved and filters aren't remembered, but nothing breaks.

---

## File map (real paths only)

| Path | Role |
|---|---|
| `server/lakebase.py` | Shared Lakebase connection layer: credential minting (prod SP vs `LAKEBASE_PROFILE` CLI profile), token caching, `connection()` context manager, `enabled()`, `healthcheck()`, `load_dotenv()` at import. |
| `server/persistence.py` | Data-access layer: `SCHEMA_SQL` DDL, conversations/messages/filter-prefs CRUD, JSONB via `psycopg.types.json.Json`, `enabled()` graceful-degradation guards, ownership checks. |
| `server/routes/apex.py` | FastAPI router for the 8 `/api/apex/*` endpoints; `_user()` identity resolution; mounted at `/api/apex`. |
| `server/config.py` | `get_workspace_client()` SP-first auth chain used to mint Lakebase credentials in production; workspace/dashboard/Genie env config. |
| `app.py` | Mounts the apex router at `/api/apex` (line 24). |
| `.env.example` | Documents the Lakebase (and app) env contract. |
| `frontend/src/config.ts` | The declarative registry: `FILTERS`, `DASHBOARDS`/`DashboardSpec`, `FilterKey`, `ROUTES`, `getDashboard`/`getSupportedFilterKeys`/`getDashboardById`/`getDashboardGenie`, and the persistence client helpers (`listConversations`/`createConversation`/`getConversation`/`saveConversationTurn`/`deleteConversation`/`fetchFilterPrefs`/`saveFilterPrefs`). |
| `frontend/src/App.tsx` | Resolves the `DashboardSpec` + supported filter keys from config per route and passes them down; restores/persists filter prefs via the client helpers. |
| `frontend/src/components/FilterBar.tsx` | Renders dynamically from the `FILTERS` catalog + the `filterKeys` prop — shows only the filters a dashboard supports. |
