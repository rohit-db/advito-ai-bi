# Prism → Render Public Deploy — Design

**Date:** 2026-08-03
**Branch:** `deploy/render-public` (off `rename/prism`)
**Status:** Approved (design), pending spec review.
**Relates to:** `docs/architecture/external-hosting.md` (the app's external-host contract), `docs/superpowers/specs/2026-08-02-prism-rename-merge-readme-design.md`, [[prism-fevm-demo]].

## Goal

Get a **public HTTPS URL** running the current Prism app against the FEVM Databricks workspace, to test whether it works publicly (embedding, Ask APEX, login). Explicitly a TEST deploy, not a production launch.

## Why Render (not Vercel)

The app is a **single long-running stateful FastAPI process**: SSE streaming for Genie MCP chat (`server/routes/genie_mcp/routes.py`), a persistent `psycopg` Lakebase connection, in-process session middleware, and the Vite SPA served from the FastAPI mount. Vercel is serverless/edge — SSE + Postgres connection churn + function time limits would fight all of that (Ask APEX streaming likely breaks). The repo already ships a production multi-stage `Dockerfile` + `docker-compose.yml` + `app.yaml` — it was built to run as one container. Render deploys that Dockerfile as-is. (Decision locked; Vercel rejected with reasons.)

## Approach

Deploy the existing `Dockerfile` to Render as a **Web Service** from the GitHub repo, pinned by a committed `render.yaml` blueprint. **No app code changes** — only deploy config (a Dockerfile build-arg addition + `render.yaml`).

## The load-bearing fix: VITE build args

The Dockerfile's frontend stage runs `npm run build` with NO `VITE_*` env → it bakes the **BCD defaults** from `config.ts:43-44` (`VITE_WORKSPACE_URL ?? "https://dbc-1e27e56a-90cd…"`, `VITE_WORKSPACE_ORG ?? "1048934788948873"`). That is the exact bug fixed locally via `frontend/.env` — but `frontend/.env` is gitignored and NOT in the Docker build context, so the image would re-break: hosted dashboards would embed the BCD workspace with a FEVM token → login prompt.

**Fix:** add build args to the Dockerfile frontend stage and pass them from `render.yaml`:
```dockerfile
FROM node:20-slim AS frontend-build
...
ARG VITE_WORKSPACE_URL
ARG VITE_WORKSPACE_ORG
ENV VITE_WORKSPACE_URL=$VITE_WORKSPACE_URL
ENV VITE_WORKSPACE_ORG=$VITE_WORKSPACE_ORG
RUN npm run build
```
`render.yaml` supplies them (non-secret) so the built SPA points at FEVM:
- `VITE_WORKSPACE_URL=https://fevm-serverless-stable-71zsua.cloud.databricks.com`
- `VITE_WORKSPACE_ORG=7474654199269365`

## Config

**`render.yaml` (committed — non-secret only):** service type web, env docker, dockerfilePath `./Dockerfile`, the two VITE build args (`dockerBuildArgs` / build-time env), `AUTH_COOKIE_SECURE=true`, `UC_CATALOG`, `UC_SCHEMA`, `WAREHOUSE_NAME`, `GENIE_SPACE_ID`, `DASHBOARD_URL`, `DASHBOARD_IDS`, `AUTH_ENABLED=true`, `AUTH_SESSION_COOKIE`, `AUTH_USERS_FILE`, `LAKEBASE_*` non-secret bits, filter/tenant mapping vars, plus `PGHOST/PGPORT/PGDATABASE/PGUSER/PGSSLMODE`. Every secret is declared `sync: false` (set in Render UI, never committed).

**Render secret env vars (UI / `sync: false`, NEVER committed):**
- `DATABRICKS_CLIENT_ID` + `DATABRICKS_CLIENT_SECRET` — the FEVM `prism-app` SP (`d6788b74-…`). (id is arguably not secret, but keep the pair together.)
- `DATABRICKS_HOST` (FEVM).
- `AUTH_SESSION_SECRET`, `AES_KEY_BASE64`.

**Dropped for Render:** `TENANTS_ADMIN_PROFILE` (CLI-profile-based; no `~/.databrickscfg` on Render). SP-lifecycle onboarding won't work on the hosted instance — the demo doesn't need it (the isolation SPs are created via the local app / CLI). Note it; don't try to make onboarding work on Render this round.

## Two-step deploy (ordering is unavoidable)

1. Deploy → Render assigns a public domain (e.g. `prism-analytics.onrender.com`).
2. Add that domain to FEVM's `aibi_dashboard_embedding_approved_domains` via the settings PATCH (same call used for `localhost` — needs etag + field_mask `aibi_dashboard_embedding_approved_domains.approved_domains`). Until then, embedded dashboards login-prompt. Keep `localhost` in the list.

## Lakebase reachability — the top unknown + fallback

The app mints Lakebase OAuth tokens via the SDK using the SP (no CLI needed), then connects to the managed Postgres over `PGHOST:5432` sslmode=require. **Whether Render can reach the FEVM Lakebase endpoint is the biggest risk.** Note for the user: "host on another workspace" does NOT necessarily fix this — it's the same question on any workspace (is managed Lakebase reachable from an arbitrary external host?).

**Fallback (bakes into the plan):** if Lakebase is unreachable from Render, set `LAKEBASE_ENABLED=false`. The app fail-soft runs with in-memory persistence + the JSON user directory (`users.seed.json`) — and **the dashboard embed + Genie still work** (they go through the SP over HTTPS, not Postgres). So the core public demo is provable even if Lakebase is blocked. Only conversation history / saved filter prefs / durable tenant registry are lost in that mode.

## Access / security (public URL)

- Demo logins kept as-is (alice@acmetravel.com / ben@globex.com / dana@prism.example, password `apex`). Data is synthetic; acceptable for a throwaway test (user's call).
- `AUTH_COOKIE_SECURE=true` (HTTPS).
- The FEVM `prism-app` SP secret lives in Render's encrypted env (user accepted). It's scoped to the demo dashboard + Genie space + warehouse + SELECT on `prism_travel` only — bounded blast radius.
- `render.yaml` commits ZERO secrets; all via `sync: false`.

## Verification

1. Render build succeeds (multi-stage: SPA build with VITE args → uvicorn image).
2. Public URL loads the Prism login (branding = Prism).
3. Log in as dana → Home renders (KPIs may fail-soft if warehouse cold — acceptable).
4. After step-2 domain approval: a dashboard page embeds inline, no login prompt (proves the VITE build-arg fix + domain approval).
5. Ask APEX streams a response (proves SSE survives Render).
6. Logs: confirm whether Lakebase connected; if not, flip `LAKEBASE_ENABLED=false` and re-verify the app still serves + embeds.

## Scope boundaries

- Deploy config only — no app logic change.
- No custom domain / no CDN / no autoscaling — single free-tier web service (note: free tier cold-starts after inactivity; first hit slow).
- Onboarding/SP-lifecycle admin not supported on Render (no CLI); out of scope.
- Not touching `rename/prism` until the deploy is proven; this lives on `deploy/render-public`.

## Open items

- Render account + GitHub connection (user action — I can't create the Render account; I'll prep everything so it's a connect-and-deploy).
- The public domain isn't known until first deploy → the domain-approval PATCH is a step-2 action.
