# Prism Rename + Merge-to-Main + README — Design

**Date:** 2026-08-02
**Branch:** work forks from `main` after the merge (see Sequencing)
**Status:** Approved (design), pending spec review
**Relates to:** `docs/superpowers/specs/2026-07-31-prism-dubois-rebuild-design.md` (this is "Phase 1 — rename", the final phase of the DuBois rebuild, plus the merge-to-main and README that the rebuild deferred)

## Goal

Three sequenced pieces of work:
1. **Merge** the completed + reviewed DuBois theming (50 commits on `feature/apex-theming`) into `main` via fast-forward.
2. **Rename** the product APEX → **Prism** across user-visible strings and code identifiers (NOT Lakebase tables), and rename the repo/package to **`prism-analytics`**.
3. **Rewrite the README** to be product-first ("what Prism is + how to install"), documenting the config seams that let each demo run as its own deployment.

The organizing idea: separate the **generic Prism product** from the **Travel Intelligence demo content**. Prism ships *with* Travel Intelligence as its reference demo; additional demos (Retail, Hospitality) run as separate deployments from the same codebase with their own config + data + env. This is a "document the seams" modularity approach — **no runtime multi-vertical re-architecture**.

## Non-goals

- **No multi-vertical runtime abstraction.** We do NOT extract filter vocabulary, KPI metric config, or hero copy into config this round. Those stay as they are (travel-flavored, some in code). The README documents them as the seams a new demo touches. (`content.config.json` remains a *future* idea, unbuilt.)
- **No Lakebase table rename.** All `apex_*` tables stay. Renaming them needs a data migration for zero demo value (invisible to users).
- **No backend logic / behavior change.** The rename is identifier + string substitution + one route-prefix change wired on both sides. Tenant isolation, SP resolver, Genie MCP, persistence, auth all keep their behavior.
- **No demo data/dashboards.** The user builds demo data and dashboards for other verticals separately, as distinct deployments.
- **`total_emissions_advito` is NOT renamed** — it is a real UC metric-view column (demo data schema), not app identity.

## Sequencing

1. **Merge theming → main** (fast-forward; verified `merge-base(main, feature/apex-theming) == main tip`, so FF is clean, no conflicts). Verify tests + build on `main`, push `main`.
2. **Rename branch off the merged `main`** — one focused branch/PR carrying the rename + README + docs touch-up.

Rationale: cleaner history; the rename is reviewable in isolation from the (large) theming diff.

## Rename scope (APEX → Prism)

Depth chosen: **surface + code identifiers** (NOT DB tables). In dependency order:

### A. Product & repo identity
- `brand.config.json`: `appName` `"APEX"` → `"Prism"`, `shortName` `"APEX"` → `"Prism"`. **KEEP `tagline: "Travel Intelligence"`** — Prism ships with the Travel demo as its example; the tagline is demo content, overridable per deployment via `brand.config.json`.
- `server/brand.py` `DEFAULT_BRAND` (lines ~20–42): `appName`/`shortName` → `"Prism"`, keep tagline.
- `frontend/package.json` `name`: `advito-ai-bi` → `prism-analytics`.
- `databricks.yml`: `bundle.name` and the app resource name → `prism-analytics`.
- **GitHub repo rename** `rohit-db/advito-ai-bi` → `rohit-db/prism-analytics`; update `origin` remote URL. (Outward-facing action — CONFIRM with the user immediately before executing. GitHub auto-redirects the old URL, so low risk.)

### B. User-visible copy
- `frontend/src/config.ts` `FIXED_REACT_ROUTES` (lines ~531, 539): labels `"Ask APEX"` / `"Ask APEX MCP View"` → `"Ask Prism"` / `"Ask Prism MCP View"`.
- `frontend/src/components/genie/genieModes.ts` (~line 15): blurb string — replace "APEX Travel Intelligence space" phrasing (keep the travel meaning, drop the APEX name → "Prism").
- `frontend/src/pages/HomePage.tsx`: fallback label (~139), placeholder (~163), card title (~261) — "APEX" → "Prism".
- `frontend/src/pages/GenieMcpExperience.tsx` (~84, 99): headings — "APEX" → "Prism".
- `frontend/src/pages/AskApexLive.tsx` (~81, 108): breadcrumb + h2 — "APEX" → "Prism".
- `frontend/src/components/DashboardWorkspace.tsx` (~87): "AI-powered travel intelligence" — keep (travel content, no APEX token) OR align to Prism voice; leave the travel meaning intact.

### C. Code identifiers
- **HTTP route prefix `/api/apex` → `/api/prism`** — `app.py:41` AND all frontend `fetch("/api/apex/…")` callers in `frontend/src/config.ts` (lines ~355, 366, 383, 397, 411, 427, 438). **This is one atomic change** — both sides must move together or conversation/filter persistence breaks. A both-sides grep gate is mandatory before commit.
- **Filenames:**
  - `frontend/src/pages/AskApexLive.tsx` → `frontend/src/pages/AskLive.tsx` (update the import in `App.tsx` + any test).
  - `server/routes/apex.py` → `server/routes/prism.py` (update the import + `include_router` in `app.py`; the route-prefix change in C above lands here too).
- **SP prefix:** `server/config.py:62` `TENANT_SP_PREFIX = "apex-tenant"` → `"prism-tenant"` (env-overridable; changing the default only affects newly-created SPs, existing ones keep their names — note in report).
- **MCP client name:** `server/routes/genie_mcp/app_view.py:61` `"apex-ask-live"` → `"prism-ask-live"`.
- **Embed viewer default:** `server/routes/embed.py` (~146, 162) `"apex-viewer"` → `"prism-viewer"`.
- **Session cookie:** `server/auth/sessions.py:29` default `"apex_session"` → `"prism_session"`; dev secret default (~41) `"apex-dev-session-secret-change-me"` → `"prism-dev-session-secret-change-me"`.
- **Theme storage:** `frontend/src/theme/ThemeProvider.tsx` `id="apex-accent"` → `"prism-accent"`, `storageKey="apex-theme"` → `"prism-theme"` (lines ~14, 17, 33).
- Any other `apex-`/`APEX` runtime string surfaced by the final grep sweep that is identity (not a table name, not `total_emissions_advito`).

### D. Explicitly NOT renamed
- `apex_*` Lakebase tables: `apex_conversations`, `apex_messages`, `apex_filter_prefs` (`persistence.py`), `apex_client_registry`, `apex_sp_credentials` (`tenants/registry.py`), `apex_tenant_audit` (`tenants/audit.py`), `apex_asset_registry`, `apex_asset_registry_meta` (`assets/registry.py`), `apex_app_users` (`auth/users.py`). README notes they're internal and intentionally unchanged.
- `total_emissions_advito` column (`routes/kpis.py`).
- `docs/superpowers/` plan/spec files (historical record).
- **Lakebase endpoint path `projects/apex-edge/branches/...`** (`server/lakebase.py:20`, an env-example/comment) — this is a live infrastructure resource path, NOT app identity; renaming it would break the DB connection. Leave as-is.
- (Demo login emails ARE renamed — see below.)

### E. Demo login emails → `@prism.example` (DECIDED)
Standardize all demo/operator identities on the `prism.example` domain (currently a mix of `apex.example` and `advito.com`):
- `server/auth/users.seed.json:22` `dana@apex.example` → `dana@prism.example`
- `server/routes/apex.py:37` (moving to `prism.py`) fallback `operator@apex.example` → `operator@prism.example`
- `server/routes/api.py:41` `demo@advito.com` → `demo@prism.example`
- `README.md:162` operator-login table row `dana@advito.com` → `dana@prism.example` (and the "Advito (operator)" label → "Prism (operator)")
Grep `advito.com` + `apex.example` across runtime + README + tests after; expect zero (docs/superpowers/ + docs/requirements.md historical excepted).

## README rewrite

Product-first structure (replaces the current "APEX — White-Label Corporate Travel Intelligence" framing):

1. **What Prism is** — white-label, multi-tenant embedded AI-BI platform on Databricks: Genie natural-language chat + AI/BI dashboards, per-tenant Service-Principal isolation, external (non-Databricks-login) hosting. Metaphor: one data source refracted into many branded per-client views.
2. **Demos** — Prism ships with **Travel Intelligence** as the reference demo. Additional demos (e.g. **Retail Merchandising Intelligence** — sales/margin/inventory-turns/sell-through; **Hospitality / Hotel Performance** — RevPAR/ADR/occupancy/booking-pace) run as *separate deployments* from the same codebase with their own config, data, and env. Same KPI-tiles + dashboards + Genie-chat shape → showcases the platform being domain-agnostic.
3. **How it works** — FastAPI serves the built Vite SPA (SPA fallback); SP token minting; Genie MCP proxy; Lakebase persistence; white-label login. Link the `docs/handoff/` deep-dives + architecture docs.
4. **Install / run locally** — prereqs (Python, Node, a Databricks workspace + SP), copy `.env.example` → `.env`, `pip install -r requirements.txt` (or equivalent), `cd frontend && npm install`, dev commands, the operator demo login.
5. **Deploy** — Databricks Apps vs. external Docker/ECS (link `docs/architecture/external-hosting.md`, `docs/handoff/whitelabel-auth-and-hosting.md`).
6. **Spin up a new demo** — the seams table (below), honest about which need a code touch.
7. **Configuration** + **Docs** tables — refresh the existing tables for the new names.

### The seams table (goes in README §6)

| Seam | Where | New-demo change | Config or code? |
|------|-------|-----------------|-----------------|
| Brand (name, tagline, accent, logo) | `brand.config.json` | edit values, swap logo files | **Config** |
| Dashboards, Genie space, nav, per-page prompts, suggested questions | `server/assets/dashboards.seed.json` (+ admin CRUD via Lakebase) | dashboard IDs, Genie space IDs, prompts, nav | **Config/data** |
| Workspace + connection | env vars (`GENIE_SPACE_ID`, `UC_CATALOG`, `UC_SCHEMA`, `WAREHOUSE_NAME`, SP creds, Lakebase, RLS) | per-deployment `.env` | **Config** |
| Filter vocabulary | `frontend/src/config.ts` (`FILTERS`, `FilterKey`, `FilterState`) | rename/replace filter keys + options | **Code edit** |
| KPI metrics | `server/routes/kpis.py` (measure list + SQL columns) + `KPI_METRIC_VIEW` env | metric-view + column names | **Code edit** (view via env, columns in code) |
| Hero / page copy | component source (`HomePage`, `GenieMcpExperience`, `AskLive`, `genieModes`) | edit strings | **Code edit** (future: `content.config.json`) |

## Verification

- **Merge:** `git merge --ff-only feature/apex-theming` from `main`; confirm `main` at `c5047fb`; `cd frontend && npm test` (75/75) + `npm run build` green; push `main`.
- **Rename:** full `npm test` + `npm run build` green; **route-prefix both-sides grep** (`/api/apex` gone from both `app.py`/`server/` and `frontend/src`, `/api/prism` present on both); **identity grep sweep** — zero `apex`/`APEX` in runtime code except the documented exceptions (`apex_*` tables, `total_emissions_advito`, `docs/superpowers/`, and — if kept — `@advito.com` demo emails); Python tests (`python3 -m pytest`, 11 tests, NOT via the rtk proxy which collects 0).
- **Live browser check** (light + dark): app boots, shows "Prism" branding (title, login, shell, home), Ask/persistence round-trips work (fail-soft on 401 backend-auth errors, as in prior phases).
- **Repo rename:** `gh repo rename prism-analytics` (after explicit user go-ahead), update `origin`, verify `git push` works (active gh account must be `rohit-db`, which has write; `rohit-bhagwat_data` gets 403).

## Risks / notes

- **Route-prefix rename is the sharpest edge** — treat `/api/apex`→`/api/prism` as one indivisible change with a mandatory both-sides grep gate. A one-sided change silently breaks conversation history + filter prefs.
- **Cookie + theme-storage key rename** resets existing local sessions and theme preference (users re-login, theme resets to default). Acceptable for a demo; noted so it isn't a surprise.
- **SP prefix change** only affects newly-minted SPs; existing tenant SPs keep their `apex-tenant-*` names. Not a functional issue (names are cosmetic in Databricks), noted for accuracy.
- **Repo rename is outward-facing** — confirm with the user immediately before executing. GitHub 301-redirects the old URL + git remote, so existing clones keep working; still, do it in the same branch as the `package.json`/`databricks.yml` name change to keep everything consistent.
- **Merge is low-risk** — verified clean fast-forward, all 50 commits already reviewed (per-task + final opus whole-branch review) and pushed to origin. No new code enters `main` beyond what's on `feature/apex-theming`.
