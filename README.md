# APEX — White-Label Corporate Travel Intelligence

A reference implementation of a **customer-facing, white-label analytics application** built entirely on the Databricks Data Intelligence Platform. Originally built for Advito (BCD Travel) to replace QuickSight, it doubles as a blueprint for any OEM/embedded-analytics use case.

The thesis: **Databricks is all you need to build white-label analytical applications** — embedded AI/BI dashboards, an agentic "Ask" experience, governed metrics, and your own identity layer, with no third-party BI tool.

## What it does

- **White-label AI/BI dashboards** — Databricks AI/BI dashboards embedded with the host app controlling tabs and filters. Filters are pushed in via `f_` URL parameters (see the workaround doc below), and the "Powered by Databricks" logo is hidden using the `@databricks/aibi-client` SDK.
- **"Ask APEX" (Genie One MCP)** — an agentic chat experience over the managed Genie MCP server. Streams reasoning, SQL, result tables, and deep links via SSE, with an "under the hood" view of MCP tool calls. Defaults to the multi-space **Genie One MCP** ("Agent mode out of the box").
- **Executive Summary** — one click generates a structured (Overview / KPIs / Strategic Insights) summary for the current dashboard page via the workspace-wide **Genie One MCP** (`multi` mode).
- **Per-user personalization** — conversation history and saved dashboard filter preferences persist in **Lakebase** (Databricks managed Postgres).
- **Own your front door** — an optional in-process **white-label login** (Lakebase/JSON user directory + HMAC-signed session cookies) so end users never see a Databricks login screen.

## Hosting models

This codebase runs in two ways from the **same** FastAPI + React app:

1. **Databricks App** — deployed on the Databricks Apps platform (`app.yaml` / `databricks.yml`). The app's own service principal authenticates to the platform.
2. **External host** (EC2 / ECS / generic Docker) — reaches Databricks purely via a **Service Principal (M2M)** using standard SDK env vars. No Databricks Apps platform required. See `docs/architecture/external-hosting.md`.

Auth, embedding, Genie MCP, and Lakebase all behave identically across both — the difference is just where credentials come from.

## Architecture

```
Browser
  │  (optional) white-label login → HMAC-signed session cookie
  ▼
React UI (Vite + Tailwind)
  │  /api/*  (SSE for chat)
  ▼
FastAPI backend ──────────────► Databricks (via Service Principal / app identity)
  ├── /api/embed/token            AI/BI scoped embed token (CAN_RUN)
  ├── /api/genie-mcp/*            managed Genie MCP server (Genie One + per-space)
  ├── /api/apex/*                 conversation history + filter prefs  ── Lakebase (Postgres)
  ├── /api/{health,config,me}     app config + identity
  └── /login /logout              white-label IdP (session gate middleware)
                                       │
                                       ▼
                     AI/BI Dashboard · Genie Space · Metric View (Unity Catalog)
```

See [`docs/architecture/apex_architecture.mmd`](docs/architecture/apex_architecture.mmd) for the
editable Mermaid architecture diagram (render with `npx @mermaid-js/mermaid-cli -i docs/architecture/apex_architecture.mmd -o apex_architecture.png`).

## Project structure

```
advito-ai-bi/
├── app.py                       # FastAPI entry: routers, session gate, SPA serving
├── app.yaml                     # Databricks App config
├── databricks.yml               # Asset Bundle config
├── requirements.txt             # Python dependencies
├── Dockerfile / docker-compose.yml / .dockerignore   # external-host packaging
├── .env.example                 # env contract for external hosting
│
├── frontend/                    # React + Vite + Tailwind v4
│   └── src/
│       ├── App.tsx              # Shell + config-driven routing + filter prefs
│       ├── config.ts            # Routes, dashboard IDs, filter (f_) URL helpers
│       ├── components/          # Sidebar, Header, FilterBar, DashboardWorkspace,
│       │   ├── genie/           #   Ask APEX chat (messages, SQL, tables, tool calls)
│       │   └── ui/              #   shadcn-style primitives
│       ├── pages/               # NativeDashboard, CustomDashboard (SDK embed), GenieMcpExperience
│       └── hooks/               # useGenieMcpChat (SSE + Lakebase persist), useUser
│
├── server/                      # FastAPI backend
│   ├── config.py                # Workspace client, SP/identity resolution, env vars
│   ├── lakebase.py              # Shared Lakebase (Postgres) connection + credential minting
│   ├── persistence.py           # Schema + CRUD: conversations, messages, filter prefs
│   ├── auth/                    # White-label IdP: login, sessions, middleware, user dir
│   └── routes/
│       ├── api.py               # /health, /config, /me
│       ├── embed.py             # /embed/token (SP-minted scoped embed token)
│       ├── apex.py              # /apex/* (conversation history + filter prefs)
│       └── genie_mcp/           # Genie MCP client, SSE, parsing, auth
│
├── src/sql/                     # Metric view DDL + validation queries
├── resources/metric_views.yml   # DABs job resource for the metric view
└── docs/                        # architecture, data, requirements, screenshots
```

## Configuration

All runtime config is environment-driven. Copy `.env.example` to `.env` and fill in:

| Variable | Purpose |
|----------|---------|
| `DATABRICKS_HOST` | Workspace URL |
| `DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET` | Service Principal (M2M) — embed token minting + all API calls when hosted externally |
| `GENIE_SPACE_ID` | Genie space backing Ask APEX / Executive Summary |
| `DASHBOARD_URL` | AI/BI dashboard embed URL |
| `AUTH_ENABLED` | Toggle the white-label login (no-op default when off) |
| `AUTH_SESSION_SECRET` / `AUTH_SESSION_*` | Session cookie signing + TTL |
| `LAKEBASE_ENABLED` | Toggle Lakebase; when off, app runs in-memory + JSON (zero setup) |
| `LAKEBASE_ENDPOINT_PATH` / `PGHOST` / `PGUSER` / ... | Lakebase Postgres connection + credential minting |

> Frontend dashboard/workspace IDs live in `frontend/src/config.ts`. Server data assets resolve from env.

## Local development

```bash
# Backend
python -m uvicorn app:app --host 0.0.0.0 --port 8000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

Requires a `.env` (see above). With `LAKEBASE_ENABLED=false` and `AUTH_ENABLED=false` you can run with just `DATABRICKS_HOST` + SP creds + `GENIE_SPACE_ID`.

## Deploy — external host (Docker)

```bash
cp .env.example .env          # fill in SP creds, Genie space, Lakebase, auth secret
docker compose up --build
```

The container builds the frontend and serves the SPA + API from one FastAPI process on `APP_PORT`. See `docs/architecture/external-hosting.md` for ECS/EC2 notes.

## Deploy — Databricks App

```bash
cd frontend && npx vite build && cd ..
databricks bundle deploy   # uses databricks.yml
# or import-dir + databricks apps deploy for the source-code workflow
```

## Key documentation

> **Handing this off to another team?** Start with the
> [**Engineering Handoff Guide**](docs/handoff/README.md) — a guided walkthrough
> mapping each blocker (SDK filter passing, white-label embedding, Ask APEX via
> Genie MCP) to the exact code that solves it.

**Handoff guides** (`docs/handoff/`) — start here:

| Doc | What it covers |
|-----|----------------|
| [`docs/handoff/README.md`](docs/handoff/README.md) | **Start-here index** — the three headline blockers, reading order, prerequisites, demo logins, and gotchas |
| [`docs/handoff/ask-apex-genie-mcp.md`](docs/handoff/ask-apex-genie-mcp.md) | Ask APEX over the managed Genie MCP server — SSE streaming, auth, tool discovery, artifact parsing, Executive Summary |
| [`docs/handoff/whitelabel-auth-and-hosting.md`](docs/handoff/whitelabel-auth-and-hosting.md) | Custom white-label login (PBKDF2 + signed cookie), edge-gateway vs external-host models, Docker |
| [`docs/handoff/lakebase-persistence-and-config.md`](docs/handoff/lakebase-persistence-and-config.md) | Lakebase history + filter prefs, and the config-driven dashboard/filter registry |

**Architecture & reference:**

| Doc | What it covers |
|-----|----------------|
| [`docs/architecture/aibi-embedding-filter-passing-workaround.md`](docs/architecture/aibi-embedding-filter-passing-workaround.md) | **The SDK technique** — white-label embedding + pushing `f_` filter params into embedded dashboards + hiding the logo (the core method) |
| [`docs/architecture/external-hosting.md`](docs/architecture/external-hosting.md) | Running outside Databricks Apps; SP (M2M) auth; per-tenant embed scoping |
| [`docs/architecture/apex_architecture.mmd`](docs/architecture/apex_architecture.mmd) | Editable Mermaid architecture diagram (current) |
| [`docs/data/genie-space-config.md`](docs/data/genie-space-config.md) | Genie space setup + instructions for the metric view |
| [`docs/data/summarydataset_analysis.md`](docs/data/summarydataset_analysis.md) | Source data lineage analysis |
| [`docs/data/metric-view-validation-results.md`](docs/data/metric-view-validation-results.md) | Metric-view validation snapshot (incl. carbon-budget NULL gap) |
| [`docs/requirements.md`](docs/requirements.md) | Original customer requirements (historical) |

## Known gaps / roadmap

| Gap | Status |
|-----|--------|
| Native filter (get/set) passing to embedded AI/BI dashboards | On the Databricks roadmap (targeting this quarter). Today: the `f_` URL-parameter + SDK workaround documented above. [Aha idea DB-I-14988](https://databrickinternal.ideas.aha.io/ideas/DB-I-14988) |
| Genie Agent Mode API | Coming soon; **Genie One MCP delivers the agent experience today** |
| Carbon budget data | NULL in source; ETL fix needed from the data team |
