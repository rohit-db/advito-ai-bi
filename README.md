# Prism — White-Label Embedded AI-BI on Databricks

Prism is a **white-label, multi-tenant embedded AI-BI platform** built entirely on the Databricks Data Intelligence Platform: embedded AI/BI dashboards, an agentic "Ask Prism" (Genie MCP) experience, governed metrics, per-tenant Service-Principal isolation, and your own identity layer — no third-party BI tool required.

The metaphor: **one data source, refracted into many branded per-client views** — each tenant sees only their data, under your brand, through your login screen.

> Originally built to replace QuickSight for a corporate-travel customer; generalized as a reusable platform for any embedded-analytics use case.

> **Deploy it anywhere — no Databricks App required.** The *same* FastAPI + React
> app runs either on the Databricks Apps platform **or** fully **externally**
> (EC2 / ECS / any Docker host), reaching Databricks purely via a Service
> Principal (M2M). Embedding, Genie MCP, auth, and isolation behave identically
> in both. See [Hosting models](#hosting-models) and
> [`docs/architecture/external-hosting.md`](docs/architecture/external-hosting.md).

---

## What Prism is

Prism is a white-label, multi-tenant embedded AI-BI platform on Databricks:

- **Embedded AI/BI dashboards** — Databricks AI/BI dashboards surfaced under your brand, with the "Powered by Databricks" logo hidden, your filters applied, and your chrome owning the page.
- **Agentic "Ask" (Genie MCP)** — a natural-language Q&A experience (streaming SQL, reasoning, result tables) running as the tenant's own Service Principal against the Genie MCP server.
- **Governed metrics** — Unity Catalog metric views define the KPIs; a UC row filter enforces per-tenant data isolation for both dashboards and Genie.
- **Per-tenant Service-Principal isolation** — every tenant runs as its own SP so data scoping is enforced at the platform layer, not in application logic.
- **Your own identity layer** — a self-hosted white-label login (PBKDF2 + signed cookie); users never see a Databricks login screen.

The thesis: **Databricks is all you need to build white-label analytical applications.** No third-party BI tool, no separate embedding vendor, no separate chat product.

---

## Demos

Prism ships with **Travel Intelligence** as the reference demo — an embedded dashboard and "Ask Prism" experience for corporate-travel analytics (spend, savings, compliance, carbon).

Additional demos run as **separate deployments** from the same codebase with their own `brand.config.json`, `dashboards.seed.json`, `.env`, and Databricks workspace:

- **Retail Merchandising Intelligence** — sales / margin / inventory-turns / sell-through by category and supplier.
- **Hospitality / Hotel Performance** — RevPAR / ADR / occupancy / booking-pace by property and market.

The KPI-tile + dashboard + Genie-chat shape is identical across all three — the platform is domain-agnostic. See [Spin up a new demo](#spin-up-a-new-demo) below for the exact seams.

---

## What the platform does (features)

- **White-label AI/BI dashboards** — Databricks AI/BI dashboards embedded with the host app controlling tabs and filters. Filters are pushed in via `f_` URL parameters, the "Powered by Databricks" logo is hidden via the SDK, and page headers / the native filter pane are hidden so the app owns the chrome.
- **"Ask Prism" (Genie MCP)** — agentic chat over the managed Genie MCP server. Streams reasoning, SQL, result tables, and deep links over SSE, with an "under the hood" view of MCP tool calls. Lives both as an **in-dashboard rail** and a **standalone page** (defaults to workspace-wide **Genie One MCP** — "agent mode out of the box").
- **Executive Summary** — one click generates a structured **Overview / KPIs / Strategic Insights** brief for the current dashboard page via Genie One MCP.
- **Multi-tenant isolation** — each tenant runs as its own Service Principal; a Unity Catalog row filter (keyed on the SQL caller identity) enforces data isolation for both dashboards and Genie. Reuses an existing customer filter when one already exists.
- **Operator Admin** — a Service-Principal management page: onboard / rotate / deactivate / delete tenant SPs (secrets encrypted at rest), an audit trail, and a **"Manage access"** dialog to grant/revoke a tenant SP's `CAN_RUN` on individual dashboards and Genie spaces.
- **Per-user personalization** — conversation history and saved dashboard filters persist in **Lakebase** (Databricks managed Postgres); a **"My Filters"** page lets each user set global default filter selections.
- **Own your front door** — an optional in-process **white-label login** so end users never see a Databricks login screen.

---

## Quick-start technique map

This repo exists so your team can copy three specific techniques. Start with the row that matches your question, then open the linked deep-dive.

| # | What you want to do | How Prism does it | Deep-dive |
|---|---|---|---|
| **1** | **White-label a dashboard** — hide the "Powered by Databricks" logo, push filters in, hide page headers, hide the native filter pane | Token-based external embedding with an SP-scoped token + the `@databricks/aibi-client` SDK for logo hiding; filters pushed via `f_` URL params; page headers & filter pane hidden by DOM/URL control | [`docs/architecture/aibi-embedding-filter-passing-workaround.md`](docs/architecture/aibi-embedding-filter-passing-workaround.md) |
| **2** | **"Ask Prism"** — a Genie Q&A rail next to each dashboard, a one-click **Executive Summary**, and a full **standalone chat** | Agentic chat over the **managed Genie MCP server** (SSE-streamed reasoning, SQL, tables, deep links). Executive Summary uses a fixed **Overview / KPIs / Strategic Insights** prompt via Genie One MCP; the standalone page defaults to Genie One MCP | [`docs/handoff/ask-apex-genie-mcp.md`](docs/handoff/ask-apex-genie-mcp.md) |
| **3** | **Auth + isolation + admin** — sign users in without a Databricks login, isolate each tenant's data, manage Service Principals, enforce row-level security | White-label login (PBKDF2 + signed cookie) → each tenant maps to its **own Service Principal**; Genie **and** dashboards run *as that SP*; a Unity Catalog **row filter** enforces isolation; an operator **Admin** page manages SPs and per-resource access | [`docs/handoff/multi-tenant-isolation.md`](docs/handoff/multi-tenant-isolation.md) · [`docs/handoff/whitelabel-auth-and-hosting.md`](docs/handoff/whitelabel-auth-and-hosting.md) |

> **Handing this off?** The [**Engineering Handoff Guide**](docs/handoff/README.md) is the guided,
> read-in-order version of the table above — every technique cited to exact files.

---

## Hosting models

The **same** FastAPI + React app runs two ways:

1. **Databricks App** — deployed on the Databricks Apps platform (`app.yaml` / `databricks.yml`); the app's own service principal authenticates to the platform.
2. **External host** (EC2 / ECS / generic Docker) — reaches Databricks purely via a **Service Principal (M2M)** using standard SDK env vars; no Databricks Apps platform required. See [`docs/architecture/external-hosting.md`](docs/architecture/external-hosting.md).

Auth, embedding, Genie MCP, isolation, and Lakebase behave identically across both — only where credentials come from changes.

---

## Architecture

```
Browser
  │  (optional) white-label login → HMAC-signed session cookie
  ▼
React UI (Vite + Tailwind)
  │  /api/*  (SSE for chat)
  ▼
FastAPI backend ─────────────► Databricks (as the tenant's Service Principal, or the app SP)
  ├── /api/embed/token           AI/BI scoped embed token (CAN_RUN), minted as the tenant SP
  ├── /api/genie-mcp/*           managed Genie MCP server (Genie One + per-space), run as the tenant SP
  ├── /api/prism/*               conversation history + filter prefs ── Lakebase (Postgres)
  ├── /api/tenants/*             operator admin: SP lifecycle, audit, resource access
  ├── /api/{health,me}           app health + Databricks identity
  ├── /api/auth/me               white-label session identity
  └── /login /logout             white-label IdP (session gate middleware)
                                       │
                                       ▼
              AI/BI Dashboard · Genie Space · Metric View + Row Filter (Unity Catalog)
```

The one non-obvious idea: **the browser never touches Databricks credentials.** The server mints a short-lived, dashboard-scoped token as the tenant's Service Principal and hands only that to the iframe; the SP secret stays server-side, and a Unity Catalog row filter scopes what that SP can see.

See [`docs/architecture/apex_architecture.mmd`](docs/architecture/apex_architecture.mmd) for the editable Mermaid diagram (render with `npx @mermaid-js/mermaid-cli -i docs/architecture/apex_architecture.mmd -o apex_architecture.png`).

---

## Project structure

```
prism-analytics/
├── app.py                       # FastAPI entry: routers, session gate, SPA serving
├── app.yaml / databricks.yml    # Databricks App + Asset Bundle config
├── requirements.txt
├── Dockerfile / docker-compose.yml / .dockerignore   # external-host packaging
├── .env.example                 # full env contract (auth, Lakebase, tenants, RLS)
│
├── frontend/                    # React + Vite + Tailwind v4
│   └── src/
│       ├── App.tsx              # Shell + config-driven routing + filter-pref precedence
│       ├── config.ts            # Routes, dashboard specs, f_ filter helpers, Genie prompts
│       ├── components/
│       │   ├── genie/           #   Ask Prism chat (messages, SQL, tables, tool calls)
│       │   ├── admin/           #   SP management table + AccessDialog ("Manage access")
│       │   └── ui/              #   shadcn-style primitives
│       ├── pages/               # CustomDashboard (SDK embed), GenieMcpExperience (Ask Prism),
│       │   │                    #   AdminPage (SP management), PreferencesPage (My Filters)
│       └── hooks/               # useGenieMcpChat (SSE + Lakebase persist), useUser
│
├── server/                      # FastAPI backend
│   ├── config.py                # Workspace client, SP/identity resolution, env vars
│   ├── lakebase.py              # Shared Lakebase (Postgres) connection + credential minting
│   ├── persistence.py           # Schema + CRUD: conversations, messages, filter prefs
│   ├── auth/                    # White-label IdP: login, sessions, middleware, user dir
│   ├── tenants/                 # Per-tenant SP isolation: registry, lifecycle, RLS, resources, audit
│   └── routes/
│       ├── api.py               # /health, /me
│       ├── embed.py             # /embed/token (SP-minted scoped embed token)
│       ├── prism.py             # /prism/* (conversation history + filter prefs)
│       ├── tenants.py           # /tenants/* (SP lifecycle + resource access)
│       └── genie_mcp/           # Genie MCP client, SSE, parsing, auth
│
├── sql/tenants/ · scripts/tenants/   # Row-filter DDL + onboard/verify tooling
├── src/sql/ · resources/metric_views.yml   # Metric view DDL + DABs resource
└── docs/                        # handoff guides, architecture, data, requirements
```

---

## Configuration

All runtime config is environment-driven. Copy `.env.example` to `.env` and fill in. The headline groups:

| Group | Key variables | Purpose |
|-------|---------------|---------|
| **Databricks** | `DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID`, `DATABRICKS_CLIENT_SECRET` | Service Principal (M2M) — embed-token minting + all API calls when hosted externally |
| **Data assets** | `GENIE_SPACE_ID`, `DASHBOARD_URL` | Genie space (Ask Prism / Exec Summary) + AI/BI dashboard embed URL |
| **White-label login** | `AUTH_ENABLED`, `AUTH_SESSION_SECRET`, `AUTH_USERS_FILE` / `AUTH_USERS_TABLE` | Toggle + sign the session cookie + choose the user directory |
| **Lakebase** | `LAKEBASE_ENABLED`, `LAKEBASE_ENDPOINT_PATH`, `PGHOST` / `PGUSER` / … | Managed Postgres for user dir + history + filter prefs (off ⇒ in-memory + JSON, zero setup) |
| **Multi-tenant isolation** | `AES_KEY_BASE64`, `UC_CATALOG` / `UC_SCHEMA`, `VERIFY_TABLE` / `TENANT_COLUMN`, `DASHBOARD_IDS`, `TENANTS_ADMIN_PROFILE` | Per-tenant SPs + row-filter enforcement + auto-grant CAN_RUN on onboard |
| **Reuse existing filter** | `MAPPING_TABLE` / `MAPPING_*_COLUMN`, `FILTER_FUNCTION` | Point onboarding at a customer's existing RLS table/function |
| **Admin resource catalog** | `RESOURCE_DASHBOARDS`, `RESOURCE_GENIE_SPACES` | `id:Label` pairs shown in the "Manage access" dialog (falls back to `DASHBOARD_IDS` / `GENIE_SPACE_ID`) |

> Frontend dashboard specs, filter grammar, and Genie prompts live in `frontend/src/config.ts`. Server data assets resolve from env.
>
> **Frontend build-time config:** the shared workspace host + org are env-driven via `VITE_WORKSPACE_URL` / `VITE_WORKSPACE_ORG` (copy `frontend/.env.example` → `frontend/.env`, then rebuild). They fall back to demo defaults when unset. Dashboard ids themselves live in the `DASHBOARDS` registry in `config.ts`. *(A future admin UI could manage these instead of env.)*

---

## Local development

```bash
# Backend
python -m uvicorn app:app --host 0.0.0.0 --port 8000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

**Fastest demo** (embedding + Ask Prism, no infra beyond an SP + Genie space): set `DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID/SECRET`, `GENIE_SPACE_ID`, `DASHBOARD_URL`, and leave `LAKEBASE_ENABLED=false` and `AUTH_ENABLED=false`. Persistence and login both fail *soft*, so nothing hard-breaks when they're off.

**Demo logins** (only when `AUTH_ENABLED=true`; the shipped JSON directory `server/auth/users.seed.json`, password `apex` for all). A Lakebase-backed directory (`AUTH_USERS_TABLE`) overrides this when `LAKEBASE_ENABLED=true`.

| Email | Tenant | Row scope (`tenant_id`) |
|---|---|---|
| `alice@acmetravel.com` | Acme Travel | `acme-travel` |
| `ben@globex.com` | Globex | `globex` |
| `dana@prism.example` | Prism (operator) | `*` (sees all rows) |

---

## Deploy

**External host (Docker):**

```bash
cp .env.example .env          # fill in SP creds, Genie space, dashboard, (optional) Lakebase + auth
docker compose up --build     # builds the frontend + serves SPA + API from one FastAPI process
```

**Databricks App:**

```bash
cd frontend && npx vite build && cd ..
databricks bundle deploy       # uses databricks.yml
```

See [`docs/architecture/external-hosting.md`](docs/architecture/external-hosting.md) for ECS/EC2 notes.

---

## Spin up a new demo

Each new demo is its own deployment of the same codebase with its own config, data, and Databricks workspace. Most of the work is config + data; a handful of spots still require a source edit today.

| Seam | Where | New-demo change | Config or code? |
|------|-------|-----------------|-----------------|
| Brand (name, tagline, accent, logo) | `brand.config.json` | edit values, swap logo files | Config |
| Dashboards, Genie space, nav, prompts, suggestions | `server/assets/dashboards.seed.json` (+ admin CRUD via Lakebase) | dashboard IDs, Genie space IDs, prompts, nav | Config/data |
| Workspace + connection | env vars (`GENIE_SPACE_ID`, `UC_CATALOG`, `UC_SCHEMA`, `WAREHOUSE_NAME`, SP creds, Lakebase, RLS) | per-deployment `.env` | Config |
| Filter vocabulary | `frontend/src/config.ts` (`FILTERS`, `FilterKey`, `FilterState`) | rename/replace filter keys + options | **Code edit** |
| KPI metrics | `server/routes/kpis.py` (measures + SQL columns) + `KPI_METRIC_VIEW` env | metric-view + column names | **Code edit** |
| Hero / page copy | component source (`HomePage`, `GenieMcpExperience`, `AskLive`, `genieModes`) | edit strings | **Code edit** *(future: `content.config.json`)* |

Most of a new demo is config + data + env; the three "Code edit" rows are the spots that still need a source change today.

---

## Documentation

**Start here:** the [**Engineering Handoff Guide**](docs/handoff/README.md) maps every blocker to the code that solves it.

**Deep-dives** (`docs/`):

| Doc | Covers |
|-----|--------|
| [`docs/architecture/aibi-embedding-filter-passing-workaround.md`](docs/architecture/aibi-embedding-filter-passing-workaround.md) | **Theme 1** — white-label embedding: hide logo, pass `f_` filters, hide page headers, hide native filter pane, 3-step token minting |
| [`docs/handoff/ask-apex-genie-mcp.md`](docs/handoff/ask-apex-genie-mcp.md) | **Theme 2** — Ask Prism rail, Executive Summary (Overview/KPIs/Strategic Insights), standalone chat, SSE + tool discovery + parsing |
| [`docs/handoff/multi-tenant-isolation.md`](docs/handoff/multi-tenant-isolation.md) | **Theme 3** — per-tenant SPs, run Genie + dashboards as the SP, UC row-filter isolation, Admin + "Manage access" |
| [`docs/handoff/tenant-isolation-runbook.md`](docs/handoff/tenant-isolation-runbook.md) | **Theme 3** — operator runbook: apply the row filter, onboard tenants, verify isolation |
| [`docs/handoff/whitelabel-auth-and-hosting.md`](docs/handoff/whitelabel-auth-and-hosting.md) | **Theme 3** — white-label login (PBKDF2 + signed cookie), edge-gateway vs external-host, Docker |
| [`docs/handoff/lakebase-persistence-and-config.md`](docs/handoff/lakebase-persistence-and-config.md) | Lakebase history + filter prefs (incl. "My Filters"), and the config-driven dashboard registry |
| [`docs/architecture/external-hosting.md`](docs/architecture/external-hosting.md) | Running fully outside Databricks via a Service Principal |
| [`docs/data/*`](docs/data/) | Genie space setup, source-data lineage, metric-view validation |
| [`docs/requirements.md`](docs/requirements.md) | Original customer requirements (historical) |

---

## Known gaps / roadmap

| Gap | Status |
|-----|--------|
| Native filter (get/set) passing to embedded AI/BI dashboards | On the Databricks roadmap (targeting this quarter). Today: the `f_` URL-parameter + SDK workaround documented above. [Aha idea DB-I-14988](https://databrickinternal.ideas.aha.io/ideas/DB-I-14988) |
| Genie Agent Mode API | Coming soon; **Genie One MCP delivers the agent experience today** |
| Carbon budget data | NULL in source; ETL fix needed from the data team |
