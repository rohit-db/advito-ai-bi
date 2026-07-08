# Hosting APEX Outside Databricks

> A customer-shareable reference for running the **APEX** white-label analytics
> app on **your own infrastructure** (EC2, ECS/Fargate, or any container host)
> while still using **Databricks** for data, AI/BI dashboards, and Genie.
>
> Companion document:
> [`aibi-embedding-filter-passing-workaround.md`](./aibi-embedding-filter-passing-workaround.md)
> — the white-label embedding + `f_` URL filter-passing pattern this app reuses
> unchanged.

---

## 1. Summary / TL;DR

Host the app **anywhere**; it talks to Databricks **purely via a Service
Principal**. White-label dashboard embedding + filter passing, Genie One MCP
agent mode, and the custom OEM login all work **unchanged**.

- **No Databricks Apps.** The app is a plain container you run on EC2/ECS/any
  Docker host.
- **No Apps OAuth proxy.** You are the front door; there is no platform proxy to
  clear, so the reverse-proxy gateway in `edge/` is no longer required.
- **No Databricks login screen.** Dashboards render via short-lived,
  Service-Principal-scoped embed tokens; sign-on is your own in-process OEM
  login.

Everything Databricks-side is reached over standard SDK env vars
(`DATABRICKS_HOST` + `DATABRICKS_CLIENT_ID` + `DATABRICKS_CLIENT_SECRET`,
M2M / OAuth `client_credentials`). The same code path runs inside Databricks Apps
*and* on external hosts — only where the credentials come from changes.

---

## 2. Architecture

The entire app — custom login, the React SPA, and the FastAPI backend — runs in
**one container on your host**. The browser only ever talks to *your* host
(plus, for the embedded dashboard iframe, directly to the Databricks workspace
origin over HTTPS). The Service Principal secret never leaves the server.

```
                          YOUR INFRASTRUCTURE (EC2 / ECS / any container host)
                        ┌─────────────────────────────────────────────────────┐
                        │  APEX container                                       │
   ┌──────────┐  HTTPS  │  ┌───────────────────────────────────────────────┐  │
   │ Browser  │◀───────▶│  │ FastAPI (server/)                             │  │
   │ (end     │         │  │  • server/auth/  custom OEM login + session   │  │
   │  user)   │         │  │  • /api/embed/token   3-step embed-token mint │  │
   │          │         │  │  • /api/genie-mcp/ask   Genie One MCP (SSE)   │  │
   │          │         │  │  • serves the built SPA (frontend/)           │  │
   └────┬─────┘         │  └───────────────┬───────────────────────────────┘  │
        │               └──────────────────┼──────────────────────────────────┘
        │                                   │  Service Principal (M2M)
        │                                   │  DATABRICKS_HOST + CLIENT_ID/SECRET
        │                                   ▼
        │               ┌─────────────────────────────────────────────────────┐
        │               │  Databricks workspace                                │
        │               │   • /oidc/v1/token         (mint SP / embed tokens)  │
        │               │   • /api/2.0/lakeview/...   (dashboard tokeninfo)    │
        │               │   • /api/2.0/mcp/genie[/{space}]  (Genie One MCP)    │
        │               │   • Lakebase / Postgres   (users + history + filters)│
        │  iframe loads │   • Unity Catalog + SQL warehouse (governed data)    │
        │  dashboard    └─────────────────────────────────────────────────────┘
        │  directly from workspace origin                  ▲
        └──────────────────────────────────────────────────┘
           GET /embed/dashboardsv3/{id}/pages/{page}
               ?o=…&f_{page}~{widget}=…#token=<scopedToken>
```

### 2.1 Data path — embedded dashboard

1. Browser requests a dashboard page from the APEX SPA.
2. SPA calls the backend: `GET /api/embed/token?dashboard_id=…&viewer_id=…[&external_value=…]`.
3. Backend runs the **3-step OAuth exchange as the SP** (see §4 of the
   [filter-passing workaround](./aibi-embedding-filter-passing-workaround.md))
   and returns `{ token, expires_in }`. The SP secret stays server-side.
4. SPA builds the iframe URL itself — the **same `/embed/` URL basic embedding
   uses**, so the `f_{pageId}~{widgetId}=value` filters still apply — and puts
   the scoped token in the `#token=` hash:

   ```
   https://<workspace>/embed/dashboardsv3/{id}/pages/{page}?o={org}&f_54194f59~tsector=Air#token=<scopedToken>
   ```
5. The iframe loads **directly from the workspace origin** (not through your
   host). It renders with **no Databricks login** and applies the host-driven
   filters. The SPA refreshes the token ~5 minutes before expiry.

### 2.2 Data path — Genie One MCP question

1. Browser POSTs the question to `POST /api/genie-mcp/ask` (Server-Sent Events).
2. Backend resolves a bearer token (`server/routes/genie_mcp/auth.py`): an
   on-behalf-of user token if one was forwarded, otherwise the **SP token**
   (`get_sp_bearer`).
3. Backend opens an MCP session to the **managed Genie MCP server** at
   `{host}/api/2.0/mcp/genie/{GENIE_SPACE_ID}` (per-space) or
   `{host}/api/2.0/mcp/genie` (multi-space), drives `ask → poll → answer`, and
   streams `meta | status | sql | table | text | deep_link` events back to the
   browser over SSE.

### 2.3 Data path — conversation history + filter preferences (Lakebase)

1. The Ask Genie page persists each completed turn via
   `POST /api/apex/conversations/{id}/turn`; the left rail lists prior threads
   (`GET /api/apex/conversations`) and replays one on click
   (`GET /api/apex/conversations/{id}`).
2. The dashboard filter bar saves the user's selection
   (`PUT /api/apex/filters/{dashboard_id}`) and restores it on the next visit
   (`GET /api/apex/filters/{dashboard_id}`).
3. Every row is scoped by the session's `email`, so tenants never see each
   other's threads or filter state. The backend (`server/persistence.py`) mints a
   short-lived Postgres OAuth credential via the SDK at connect time — no static
   DB password. When `LAKEBASE_ENABLED=false` these endpoints no-op and the UI
   falls back to in-memory behavior.

---

## 3. What changes vs Databricks-Apps hosting

The application code is the same. What changes is the environment around it:
where credentials come from, who the front door is, and where the login lives.

| Concern | On Databricks Apps | Self-hosted (external) |
| --- | --- | --- |
| **SP credentials** | Platform injects `DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET` automatically | **You supply** `DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET` (from your own SP) via env / secrets manager |
| **Genie identity (OBO)** | Apps may forward `x-forwarded-access-token`, so Genie can run as the end user | No platform OBO header → **Genie runs as the SP**. (OBO is still honored if *your* IdP forwards a user token — `auth.py` checks it first.) |
| **Front door** | Requests pass through the **Apps OAuth proxy**; the `edge/` gateway injects an SP bearer just to clear it | No Apps proxy → the edge gateway's bearer-injection trick is **unnecessary**. **You are the front door.** |
| **Custom login** | Hosted by the `edge/` reverse-proxy gateway (its own login + Lakebase user directory) | Login moves **in-process** to `server/auth/` — the app is its own OEM IdP. No separate gateway process. |
| **Serving the app** | Platform serves SPA + API | **You serve** the built SPA **and** the FastAPI API yourself, from **one container** |

> In the Databricks-hosted variant, a separate reverse-proxy gateway (the `edge/`
> pattern) existed only to make an app *hosted on Databricks* reachable without
> Databricks SSO. When you self-host, that whole job disappears — so this branch
> does **not** ship an edge gateway; its custom-login + Lakebase user-directory
> pattern is ported in-process into `server/auth/` instead.

---

## 4. Service Principal setup

Because the app runs queries **as the SP** (the dashboard is published with
`embed_credentials=false`), the SP needs the same data access a human viewer
would — there is no end-user identity backing the queries.

**Steps and required grants:**

1. **Create a Service Principal + OAuth secret.**
   In the workspace, create an SP and generate an **OAuth secret**
   (client id + client secret) for M2M / `client_credentials`. These become
   `DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET`.

2. **Grant data access (queries run as the SP).**
   - `SELECT` on the underlying **Unity Catalog** tables/views the dashboard and
     Genie space read.
   - `CAN_USE` on the **SQL warehouse** backing the dashboard / Genie space.

3. **Grant dashboard access.**
   - `CAN_VIEW` / `CAN_RUN` on the **published** dashboard.
   - Publish the dashboard with **`embed_credentials=false`** (it runs queries as
     the SP, not the publisher) and add your app's origin to the dashboard's
     **embedding approved-domains** allow-list.

4. **Grant Genie space access.**
   Ensure the SP can access the **Genie space** (`GENIE_SPACE_ID`) so the managed
   Genie MCP server answers as the SP.

5. **(If using Lakebase) grant the SP database access.**
   Grant the SP a **Postgres role** on the **Lakebase instance** so it can mint a
   credential and read/write the app tables: the users table
   (`AUTH_USERS_TABLE`, default `apex_app_users`) plus the auto-created
   `apex_conversations`, `apex_messages`, and `apex_filter_prefs`. The app mints a
   short-lived Postgres OAuth credential via the SDK at connect time — no static
   DB password. (For local dev you can instead set `LAKEBASE_PROFILE` to a CLI
   profile and mint as that user before the SP role exists.)

**Per-tenant scoping mechanic.** When minting an embed token, the app passes
`external_viewer_id` (a non-PII viewer id) and, for multi-tenant isolation,
`external_value` (e.g. the tenant id). `external_value` is the value your
**Unity Catalog row filter** keys on, so each viewer's token can read only its
own rows. See §4.1 of the
[filter-passing workaround](./aibi-embedding-filter-passing-workaround.md).

---

## 5. Configuration

All configuration is environment variables (the app loads `.env`). Names below
are authoritative — they match `.env.example` and `server/config.py`.

### Databricks Service Principal (M2M)

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `DATABRICKS_HOST` | **Yes** | `https://dbc-xxxx.cloud.databricks.com` | Workspace URL. Standard SDK var; resolved by `get_workspace_client()` / `get_sp_bearer()`. |
| `DATABRICKS_CLIENT_ID` | **Yes** | `1a2b3c-…` | SP OAuth client id (M2M). Toggles `HAS_SP_CREDENTIALS`. |
| `DATABRICKS_CLIENT_SECRET` | **Yes** | `dose…` | SP OAuth secret. **Keep in a secrets manager; never commit.** |

### Data assets

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `GENIE_SPACE_ID` | **Yes** | `01f127092d2219f3be10180d79b2ee5d` | Genie space the MCP agent queries. |
| `DASHBOARD_URL` | **Yes** | `https://<workspace>/embed/dashboardsv3/<id>?o=<org>` | Embedded dashboard. The dashboard id and `o=` org are parsed from this URL. |

### App

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `APP_PORT` | No (default `8000`) | `8000` | Port the container serves the SPA + API on. |

### White-label login (OEM IdP — `server/auth/`)

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `AUTH_ENABLED` | No (code default `false`; `.env.example` ships `true`) | `true` | Enables the in-process custom login. When unset the session gate is a **no-op** (`server/auth/middleware.py`), preserving the Databricks-Apps behavior. |
| `AUTH_SESSION_SECRET` | **Yes** (if auth on) | `a-long-random-string` | Signs session cookies. **Rotate; keep secret.** |
| `AUTH_SESSION_COOKIE` | No | `apex_session` | Session cookie name. |
| `AUTH_SESSION_TTL_SECONDS` | No | `28800` | Session lifetime (8h). |
| `AUTH_USERS_FILE` | Conditional | `server/auth/users.seed.json` | Sample-user directory when Lakebase is disabled. |
| `AUTH_USERS_TABLE` | Conditional | `apex_app_users` | Lakebase users table name (when `LAKEBASE_ENABLED=true`). |

### Lakebase — user directory + conversation history + filter prefs (optional)

One managed Postgres backs three things: the white-label **user directory**, the
Ask Genie **conversation history**, and each user's saved **dashboard filter
preferences**. Connection + credential minting live in `server/lakebase.py`;
persistence logic in `server/persistence.py`. Tables (`apex_conversations`,
`apex_messages`, `apex_filter_prefs`) are created automatically on startup.

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `LAKEBASE_ENABLED` | No (default `false`) | `false` | `false` → JSON directory + in-memory chat; `true` → persist users, history, filters in Lakebase. |
| `LAKEBASE_INSTANCE_NAME` | If Lakebase on | `apex` | Lakebase Autoscaling project id (reference). |
| `LAKEBASE_ENDPOINT_PATH` | If Lakebase on | `projects/apex/branches/production/endpoints/primary` | Endpoint resource path used to mint the Postgres credential. |
| `LAKEBASE_PROFILE` | No | `bcd-customer` | Local-dev only: CLI profile whose user mints the credential. Blank in prod → the SP mints it (SP needs a Postgres role). |
| `PGHOST` | If Lakebase on | `ep-xxxx.database.<region>.cloud.databricks.com` | Postgres endpoint host. |
| `PGPORT` | No | `5432` | Postgres port. |
| `PGDATABASE` | If Lakebase on | `databricks_postgres` | Postgres database. |
| `PGUSER` | If Lakebase on | `<sp-client-id or user email>` | Postgres login identity. |
| `PGSSLMODE` | No | `require` | Postgres SSL mode. |

---

## 6. Run it

Packaging is Docker (root `Dockerfile`, `docker-compose.yml`, `.dockerignore`,
`.env.example`).

```bash
# 1) create your env file from the template
cp .env.example .env

# 2) fill in:
#    - DATABRICKS_HOST, DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET  (your SP)
#    - GENIE_SPACE_ID, DASHBOARD_URL                                    (data assets)
#    - AUTH_SESSION_SECRET                                              (a long random string)

# 3) choose a login mode:
#    Instant demo (no database):
#      LAKEBASE_ENABLED=false   -> uses AUTH_USERS_FILE sample users
#    Lakebase directory:
#      LAKEBASE_ENABLED=true    -> fill PG* + LAKEBASE_INSTANCE_NAME, then seed:
#         python -m server.auth.seed_users

# 4) build and start
docker compose up --build

# 5) open the app and sign in with a sample user
open http://localhost:${APP_PORT}    # default http://localhost:8000
```

For a zero-database demo, leave `LAKEBASE_ENABLED=false`; the app reads sample
logins from `AUTH_USERS_FILE` so you can sign in immediately. Switch to
`LAKEBASE_ENABLED=true` to back the directory with Lakebase Postgres.

---

## 7. Per-tenant data isolation

Each tenant sees only its own rows because the logged-in user's `external_value`
flows from the **server-side session** into the embed-token mint:

```
custom login (server/auth/)        embed-token mint (server/routes/embed.py)
┌──────────────────────────┐       ┌─────────────────────────────────────────┐
│ user signs in            │       │ GET /api/embed/token?dashboard_id=…&      │
│ session stores:          │  ───▶ │     viewer_id=<from session>&             │
│  • viewer_id             │       │     external_value=<tenant from session>  │
│  • external_value (tenant)│      │                                           │
└──────────────────────────┘       │ 3-step OAuth as SP:                       │
                                    │  tokeninfo?external_viewer_id=…           │
                                    │           &external_value=<tenant>        │
                                    │  → scoped token bound to that tenant      │
                                    └─────────────────────────────────────────┘
                                                  │
                                                  ▼   #token=<scopedToken>
                                    Unity Catalog row filter keys on
                                    external_value → tenant sees only its rows
```

Key points:

- `viewer_id` / `external_value` are derived from **your authenticated session**,
  **never** from anything the browser can spoof.
- `external_value` is the value Unity Catalog **row-level security** policies key
  on — the real security boundary. The `f_` URL filters are a UI convenience, not
  a security boundary.
- The minted token is short-lived (~1h) and scoped to exactly one dashboard +
  one viewer, so it is safe to hand to the browser.

---

## 8. Security notes

- **SP secret handling.** Store `DATABRICKS_CLIENT_SECRET` in a secrets manager
  (AWS Secrets Manager / SSM, etc.), inject it as an env var at runtime, and
  **never commit it**. The browser never receives it — only the final scoped
  embed token.
- **Session secret rotation.** `AUTH_SESSION_SECRET` signs session cookies; use a
  long random value and rotate it periodically.
- **TLS termination.** Put the container **behind an ALB / nginx / API gateway
  that terminates HTTPS.** TLS is required for `Secure` cookies and for safely
  carrying the embed token in the iframe URL. Do not expose the container over
  plain HTTP in production.
- **Token TTL / refresh.** Embed tokens expire (~1h); the SPA refreshes ~5
  minutes before expiry. Session TTL is `AUTH_SESSION_TTL_SECONDS`.
- **Authorization still applies.** Removing the *login* does not remove
  *authorization* — the SP must hold warehouse + UC `SELECT`, and UC row filters
  govern what each `external_value` can read.

---

## 9. Mapping to the three customer talking points

1. **Filter passing without a Databricks login.**
   The app keeps the SDK's token-auth model but builds the iframe URL itself,
   appending `f_{pageId}~{widgetId}=value` params to the standard `/embed/` URL
   with a scoped token in `#token=`. No-login white-label **and** app-driven
   filters, together. Full detail:
   [`aibi-embedding-filter-passing-workaround.md`](./aibi-embedding-filter-passing-workaround.md).

2. **Custom sign-on without Databricks SSO.**
   Sign-on is your **own in-process OEM IdP** (`server/auth/`) with an optional
   Lakebase user directory. The `edge/` reverse-proxy gateway — needed only to
   bypass the Apps OAuth proxy when hosted on Databricks — is **no longer
   required** when self-hosting. Swap the directory for Okta / Entra / Azure AD
   B2C in production while keeping the same tenant-mapping flow.

3. **Genie One MCP = agent mode out of the box.**
   The app talks to the **managed Genie MCP server** (`{host}/api/2.0/mcp/genie`
   [`/{space_id}`]) with the official MCP client, driving the full
   `ask → poll → answer` agent lifecycle as the SP (or as the user if your IdP
   forwards an OBO token). No external orchestration layer — the agent runtime is
   native to the Databricks Data Intelligence Platform.
