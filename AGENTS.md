# AGENTS.md — APEX reference app

Universal guidance for AI coding agents (Cursor, Claude Code, Codex, …) and humans.
This is the auto-loaded entrypoint; the `.cursor/rules/*.mdc` files mirror a subset
for Cursor specifically. **The canonical, detailed docs are in `docs/` — read them.**

## What this is
A white-label analytical app on the Databricks Data Intelligence Platform:
embedded AI/BI dashboards (logo hidden, filters passed, page headers hidden),
an agentic **"Ask APEX"** chat over the managed **Genie MCP** server, per-tenant
data isolation via Service Principals + a Unity Catalog row filter, and a
self-hosted white-label login. Runs on **Databricks Apps _or_ fully externally**
(EC2/ECS/Docker) via a Service Principal — no Databricks App required.

## Read these first (map)
- [`README.md`](README.md) — what the app is, structure, how to run, config.
- [`docs/handoff/README.md`](docs/handoff/README.md) — guided walkthrough of every
  solved blocker with exact file/line citations. **Start here for techniques.**
- Deep dives:
  - [`docs/architecture/aibi-embedding-filter-passing-workaround.md`](docs/architecture/aibi-embedding-filter-passing-workaround.md) — SDK embed, filter passing, logo/header hiding.
  - [`docs/handoff/ask-apex-genie-mcp.md`](docs/handoff/ask-apex-genie-mcp.md) — Genie MCP chat.
  - [`docs/handoff/multi-tenant-isolation.md`](docs/handoff/multi-tenant-isolation.md) · [`docs/handoff/tenant-isolation-runbook.md`](docs/handoff/tenant-isolation-runbook.md) — per-tenant SP isolation + operator steps.
  - [`docs/handoff/whitelabel-auth-and-hosting.md`](docs/handoff/whitelabel-auth-and-hosting.md) — login + hosting models.
  - [`docs/handoff/lakebase-persistence-and-config.md`](docs/handoff/lakebase-persistence-and-config.md) — Lakebase history/prefs + dashboard registry.
  - [`docs/architecture/external-hosting.md`](docs/architecture/external-hosting.md) — running outside Databricks.

## Invariants — do not break
- **Tenant join key:** the white-label login's `tenant_id` **is** the
  `tenant_id` in `apex_client_registry`. Do not add a separate user→tenant table.
- **Per-tenant identity:** each tenant has its own Service Principal. Genie MCP and
  the AI/BI embed run **as that SP** so the UC row filter is the load-bearing
  isolation control. The seam is
  `server/tenants/resolver.resolve_tenant_sp(request) -> (token, TenantRow) | None`.
  On `None` (operator `tenant_id="*"`, no Lakebase, or pre-onboarding),
  callers **must fall back to the app SP — never fail**.
- **Secrets:** SP client secrets are AES-GCM encrypted (`AES_KEY_BASE64`) in
  Lakebase; never log/return them except once at onboard/rotate. Never commit
  `.env` (it is gitignored); keep credentials out of source.
- **Fail soft:** Lakebase and white-label auth both degrade gracefully
  (in-memory/JSON + open access) when disabled. Preserve that.
- **Admin API/UI is operator-only** (`role == "operator"` from the session).

## Dev commands
```bash
# Backend
python -m uvicorn app:app --host 0.0.0.0 --port 8000
# Frontend (build is `tsc -b && vite build`)
cd frontend && npm install && npm run dev
```

## Conventions
- Frontend workspace host/org are build-time env vars
  (`VITE_WORKSPACE_URL`/`VITE_WORKSPACE_ORG`, see `frontend/.env.example`);
  dashboard specs/filters/prompts live declaratively in `frontend/src/config.ts`.
- Server config is env-driven (`server/config.py`); copy `.env.example` → `.env`.
