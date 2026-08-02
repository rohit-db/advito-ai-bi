# Prism Rename + Merge-to-Main + README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the completed DuBois theming into `main`, rename the product APEX → Prism (surface + code identifiers, NOT DB tables) and the repo/package → `prism-analytics`, and rewrite the README to be product-first with a "spin up a new demo" seams guide.

**Architecture:** Three sequenced pieces per the approved spec `docs/superpowers/specs/2026-08-02-prism-rename-merge-readme-design.md`: (1) fast-forward merge to `main` (verified clean FF, no conflicts, all commits pre-reviewed); (2) an atomic rename on a branch off the merged `main`; (3) README + docs refresh folded into the rename branch. No backend logic or behavior change — the rename is string/identifier substitution plus one route-prefix change wired on both sides.

**Tech Stack:** Vite 7 + React 19 + FastAPI (Python 3.12) + Tailwind v4, Vitest 3, pytest. Git + `gh` CLI.

## Global Constraints

- **No backend logic / behavior change.** Tenant isolation, SP resolver, Genie MCP, Lakebase persistence, auth keep their behavior. Only identifiers, strings, one route prefix, two filenames change.
- **NOT renamed (leave verbatim):** all `apex_*` Lakebase table names; the `total_emissions_advito` UC metric-view column; the Lakebase endpoint path `projects/apex-edge/...` in `server/lakebase.py`; `docs/superpowers/` + `docs/requirements.md` historical files.
- **Route prefix `/api/apex` → `/api/prism` is ONE atomic change** — backend mount (`app.py:41`) + all 7 frontend callers (`frontend/src/config.ts`) move together. A one-sided change silently breaks conversation history + filter persistence.
- **Tagline stays `"Travel Intelligence"`** — Prism ships with the Travel demo as its reference content.
- **Demo emails standardize on `@prism.example`.**
- **Repo rename is outward-facing** — the implementer must STOP and get explicit user go-ahead before running `gh repo rename` (Task 4 gates on this).
- **Active gh account must be `rohit-db`** (has write to the repo); `rohit-bhagwat_data` gets 403. If a push 403s: `gh auth switch --user rohit-db && gh auth setup-git`, retry.
- **Verification per task:** `cd frontend && npm test` (75 tests) + `npm run build` green; Python tests via `python3 -m pytest` (11 tests — NOT via the rtk proxy, which collects 0). Note: the shell `rtk` proxy mangles multi-file grep/glob args — run greps on one path or via `rtk proxy grep`. `cd` does not persist across separate bash calls.

---

## File Structure

- **Task 1 (merge):** no file edits — `git merge --ff-only` on `main`, push.
- **Task 2 (rename):** `brand.config.json`, `server/brand.py`, `app.py`, `frontend/src/config.ts`, `frontend/src/components/genie/genieModes.ts`, `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/GenieMcpExperience.tsx`, `frontend/src/pages/AskApexLive.tsx`→`AskLive.tsx` (rename), `frontend/src/components/DashboardWorkspace.tsx`, `frontend/src/App.tsx` (import), `server/routes/apex.py`→`prism.py` (rename), `server/config.py`, `server/routes/genie_mcp/app_view.py`, `server/routes/embed.py`, `server/auth/sessions.py`, `frontend/src/theme/ThemeProvider.tsx`, `server/auth/users.seed.json`, `server/routes/api.py`. Test files that assert any renamed token.
- **Task 3 (README/docs):** `README.md` (rewrite), `AGENTS.md` (name touch-up), light touch on `docs/customizing.md` if it names APEX.
- **Task 4 (repo rename):** `frontend/package.json`, `databricks.yml`, GitHub repo rename + `origin` URL, push, open PR.

---

### Task 1: Fast-forward merge the DuBois theming into `main`

The 50 commits on `feature/apex-theming` are complete, per-task + final-opus reviewed, and pushed. `merge-base(main, feature/apex-theming) == main tip`, so this is a clean fast-forward — no new code, no conflicts.

**Files:** none (git operation).

**Interfaces:** Produces `main` at `c5047fb`, pushed. Task 2 forks from here.

- [ ] **Step 1: Confirm clean FF is still possible**

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi
git fetch origin
git checkout main
git pull --ff-only origin main
[ "$(git merge-base main feature/apex-theming)" = "$(git rev-parse main)" ] && echo "FF OK" || echo "NOT FF — STOP"
```
Expected: `FF OK`. If `NOT FF`, STOP and report — `main` diverged since planning.

- [ ] **Step 2: Fast-forward merge**

```bash
git merge --ff-only feature/apex-theming
git rev-parse --short HEAD   # expect c5047fb
```

- [ ] **Step 3: Verify tests + build on the merged main**

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend && npm test && npm run build
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi && python3 -m pytest -q
```
Expected: 75 frontend tests pass, clean build, 11 python tests pass.

- [ ] **Step 4: Push main**

```bash
git push origin main
```
(Confirm active gh account is `rohit-db` first: `gh auth status | grep -A1 'Active account: true'`.)

- [ ] **Step 5: Create the rename branch off main**

```bash
git checkout -b rename/prism
```

---

### Task 2: Rename APEX → Prism (surface + code identifiers + demo emails)

The atomic rename. All swaps below are exact current→replacement. Locate by the quoted string (line numbers may drift). Presentation/identifier only — no logic change.

**Files:** (listed in File Structure above)

**Interfaces:** Consumes the merged `main`. Produces the renamed app on branch `rename/prism`. The `/api/prism` prefix + `AskLive`/`prism.py` module names are relied on by Task 3's README references.

- [ ] **Step 1: Brand config + server default brand**

- `brand.config.json`: `"appName": "APEX"` → `"appName": "Prism"`; `"shortName": "APEX"` → `"shortName": "Prism"`. (Keep `tagline`, `colors`, everything else.)
- `server/brand.py` `DEFAULT_BRAND["identity"]`: `"appName": "APEX"` → `"Prism"`, `"shortName": "APEX"` → `"Prism"`. (Keep tagline + colors.)

(Note: `server/auth/login.py` reads brand at runtime — it renames automatically, no edit needed.)

- [ ] **Step 2: User-visible copy (frontend)**

- `frontend/src/config.ts:531` `label: "Ask APEX",` → `label: "Ask Prism",`
- `frontend/src/config.ts:539` `label: "Ask APEX MCP View",` → `label: "Ask Prism MCP View",`
- `frontend/src/config.ts:538` `path: "/ask-apex-live",` → `path: "/ask-live",` (route path rename — see Step 6 for the file/import)
- `frontend/src/config.ts:46` comment `// Genie space backing the global "Ask APEX" experience.` → `// Genie space backing the global "Ask Prism" experience.`
- `frontend/src/config.ts:23` comment `// APEX app configuration` → `// Prism app configuration`
- `frontend/src/config.ts:340` comment `// ─── APEX persistence API ...` → `// ─── Prism persistence API ...`
- `frontend/src/components/genie/genieModes.ts:15` `blurb: "A single Genie space — the APEX Travel Intelligence space.",` → `blurb: "A single Genie space — the Prism Travel Intelligence space.",`
- `frontend/src/pages/HomePage.tsx:139` `{user?.tenant || "APEX Travel Intelligence"}` → `{user?.tenant || "Prism Travel Intelligence"}`
- `frontend/src/pages/HomePage.tsx:149` comment `{/* Ask APEX composer */}` → `{/* Ask Prism composer */}`
- `frontend/src/pages/HomePage.tsx:163` `placeholder="Ask APEX about spend, emissions, bookings…"` → `placeholder="Ask Prism about spend, emissions, bookings…"`
- `frontend/src/pages/HomePage.tsx:261` `title="Ask APEX"` → `title="Ask Prism"`
- `frontend/src/pages/GenieMcpExperience.tsx:84` `Ask APEX` → `Ask Prism`
- `frontend/src/pages/GenieMcpExperience.tsx:99` `Ask APEX anything` → `Ask Prism anything`
- `frontend/src/components/DashboardWorkspace.tsx:84` `Ask APEX` → `Ask Prism`

- [ ] **Step 3: Theme storage keys (frontend)**

- `frontend/src/theme/ThemeProvider.tsx`: `id="apex-accent"` → `id="prism-accent"` (appears at inject + any cleanup ~L14, L33); `storageKey="apex-theme"` → `storageKey="prism-theme"` (~L17). Grep the file for `apex` after to confirm none remain.

- [ ] **Step 4: Route prefix `/api/apex` → `/api/prism` (ATOMIC — backend + all 7 frontend callers)**

Backend:
- `app.py:41` `app.include_router(apex_router, prefix="/api/apex")` → `prefix="/api/prism"` (the `apex_router` symbol is renamed in Step 6).

Frontend (`frontend/src/config.ts` — all 7):
- L355 `fetch("/api/apex/conversations")` → `/api/prism/conversations`
- L366 `fetch("/api/apex/conversations", {` → `/api/prism/conversations`
- L383 `` fetch(`/api/apex/conversations/${encodeURIComponent(id)}`) `` → `/api/prism/...`
- L397 `` fetch(`/api/apex/conversations/${encodeURIComponent(id)}/turn`, { `` → `/api/prism/...`
- L411 `` fetch(`/api/apex/conversations/${encodeURIComponent(id)}`, { `` → `/api/prism/...`
- L427 `` fetch(`/api/apex/filters/${encodeURIComponent(dashboardId)}`) `` → `/api/prism/...`
- L438 `` fetch(`/api/apex/filters/${encodeURIComponent(dashboardId)}`, { `` → `/api/prism/...`

Gate (run after this step): `rtk proxy grep -rn "api/apex" app.py server frontend/src` → ZERO (excluding `__pycache__`); `rtk proxy grep -rn "api/prism" app.py frontend/src/config.ts` → 8 hits (1 backend + 7 frontend).

- [ ] **Step 5: Backend code identifiers**

- `server/config.py:62` `TENANT_SP_PREFIX = "apex-tenant"` → `"prism-tenant"`
- `server/routes/genie_mcp/app_view.py:61` `name="apex-ask-live"` → `name="prism-ask-live"`
- `server/routes/embed.py` (~146, 162) `"apex-viewer"` → `"prism-viewer"` (both default occurrences)
- `server/auth/sessions.py:29` default cookie `"apex_session"` → `"prism_session"`
- `server/auth/sessions.py:41` dev secret default `"apex-dev-session-secret-change-me"` → `"prism-dev-session-secret-change-me"`

- [ ] **Step 6: File renames + imports**

- `git mv frontend/src/pages/AskApexLive.tsx frontend/src/pages/AskLive.tsx`. Update the import + JSX in `frontend/src/App.tsx` (`import AskApexLive from "@/pages/AskApexLive"` → `import AskLive from "@/pages/AskLive"`; `<AskApexLive />` → `<AskLive />`; and the route match `route.path === "/ask-apex-live"` → `"/ask-live"`). Update the internal doc comment in the renamed file (L17–19) APEX→Prism. If a test imports it, update the path.
- `git mv server/routes/apex.py server/routes/prism.py`. In `app.py`: `from server.routes.apex import router as apex_router` → `from server.routes.prism import router as prism_router` (grep the exact import line first), and `app.include_router(apex_router, ...)` → `app.include_router(prism_router, ...)`. Update the docstring in the renamed file (`Mounted at ``/api/apex``` → `/api/prism`) and its fallback identity string (Step 7 covers the email).

- [ ] **Step 7: Demo emails → `@prism.example`**

- `server/auth/users.seed.json:22` `"email": "dana@apex.example",` → `"dana@prism.example",`
- `server/routes/prism.py` (was apex.py):37 `return "operator@apex.example", "All Clients"` → `"operator@prism.example", "All Clients"`
- `server/routes/api.py:41` `"email": "demo@advito.com",` → `"demo@prism.example",`

- [ ] **Step 8: Update tests that assert renamed tokens**

Run `cd frontend && npm test` and `python3 -m pytest -q`. For each failure caused by a renamed token (e.g. a test asserting `"Ask APEX"`, `/api/apex`, `apex_session`, or a demo email), update the assertion to the new value. Do NOT weaken a test — only swap the literal. Re-run until green. (If a test fails for a NON-rename reason, STOP and report — do not mask it.)

- [ ] **Step 9: Identity grep sweep (the rename's proof)**

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi
rtk proxy grep -rn "APEX\|Apex" app.py server frontend/src README.md | rtk proxy grep -v "__pycache__"
rtk proxy grep -rin "apex" app.py server frontend/src | rtk proxy grep -v "__pycache__" | rtk proxy grep -viE "apex_conversations|apex_messages|apex_filter_prefs|apex_client_registry|apex_sp_credentials|apex_tenant_audit|apex_asset_registry|apex_app_users|apex-edge|total_emissions_advito"
rtk proxy grep -rn "advito" app.py server frontend/src | rtk proxy grep -v "__pycache__" | rtk proxy grep -v "total_emissions_advito"
```
Expected: the FIRST two commands return ZERO (all remaining `apex` is a documented-exception table name / lakebase path / metric column). The THIRD returns ZERO. Any other hit is a missed rename — fix it. (README is handled in Task 3 but shouldn't contain stray APEX after; the `advito.com` demo email is fixed in Step 7.)

- [ ] **Step 10: Test + build + Python tests**

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend && npm test && npm run build
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi && python3 -m pytest -q
```
Expected: 75 frontend + 11 python pass, clean build.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: rename APEX -> Prism (surface + code identifiers)

Rename user-visible strings, the /api/apex->/api/prism route prefix (backend +
all 7 frontend callers), AskApexLive.tsx->AskLive.tsx (route /ask-live),
routes/apex.py->prism.py, SP prefix/MCP-client/embed-viewer defaults, session
cookie + theme storage keys, DEFAULT_BRAND/brand.config appName, and demo emails
-> @prism.example. Lakebase apex_* tables, total_emissions_advito, and the
apex-edge lakebase path intentionally unchanged (no data migration; no identity).
No backend logic change.

Co-authored-by: Isaac"
```

---

### Task 3: Rewrite the README (product-first) + docs name touch-up

Replace the Advito-first README with a Prism product-first one, add the "spin up a new demo" seams section, and refresh names. Depends on Task 2's new names (`/api/prism`, `Ask Prism`, demo emails).

**Files:** `README.md` (rewrite), `AGENTS.md` (name touch-up), `docs/customizing.md` (if it names APEX).

**Interfaces:** Documentation only — no code contract.

- [ ] **Step 1: Rewrite `README.md`**

Produce a product-first README with this structure (keep the repo's existing depth + the deep-dive doc links, which stay valid):

1. **Title:** `# Prism — White-Label Embedded AI-BI on Databricks`
2. **What Prism is** — a white-label, multi-tenant embedded AI-BI platform on Databricks: embedded AI/BI dashboards, an agentic "Ask" (Genie MCP) experience, governed metrics, per-tenant Service-Principal isolation, and your own identity layer — no third-party BI tool. Metaphor: one data source refracted into many branded per-client views. (Adapt the existing "thesis" paragraph; drop the "Originally built for Advito" lead — may keep a one-line "originally built to replace QuickSight for a corporate-travel customer" as provenance.)
3. **Demos** — Prism ships with **Travel Intelligence** as the reference demo. Additional demos run as *separate deployments* from the same codebase with their own config + data + env — e.g. **Retail Merchandising Intelligence** (sales / margin / inventory-turns / sell-through) and **Hospitality / Hotel Performance** (RevPAR / ADR / occupancy / booking-pace). Same KPI-tiles + dashboards + Genie-chat shape → the platform is domain-agnostic.
4. **What it does (features)** — keep the existing feature bullets, changing "Ask APEX" → "Ask Prism".
5. **Hosting models** — keep as-is (Databricks App vs external Docker).
6. **Architecture** — keep the ASCII diagram; change the `/api/apex/*` line → `/api/prism/*`; keep the "browser never touches Databricks credentials" note.
7. **Project structure** — keep the tree; update the top dir `advito-ai-bi/` → `prism-analytics/`, `pages/` note `GenieMcpExperience (Ask APEX)` → `(Ask Prism)`, `routes/apex.py` → `routes/prism.py`, `/apex/*` → `/prism/*`.
8. **Configuration** — keep the env table; change "Ask APEX" → "Ask Prism" in the Data-assets row.
9. **Local development** — keep the commands; note password `apex` for the seeded directory stays (it's the seed password, not identity) OR update to `prism` if Task 2 changed it (it did NOT — leave `apex` unless changed). Update the demo-logins table: `dana@advito.com` / "Advito (operator)" → `dana@prism.example` / "Prism (operator)"; keep `alice@acmetravel.com` / `ben@globex.com` (fictional tenant demos, fine as-is).
10. **Deploy** — keep; the `databricks bundle deploy` note is unaffected.
11. **Spin up a new demo (§6 seams table)** — add this new section with the seams table from the spec:

| Seam | Where | New-demo change | Config or code? |
|------|-------|-----------------|-----------------|
| Brand (name, tagline, accent, logo) | `brand.config.json` | edit values, swap logo files | Config |
| Dashboards, Genie space, nav, prompts, suggestions | `server/assets/dashboards.seed.json` (+ admin CRUD via Lakebase) | dashboard IDs, Genie space IDs, prompts, nav | Config/data |
| Workspace + connection | env vars (`GENIE_SPACE_ID`, `UC_CATALOG`, `UC_SCHEMA`, `WAREHOUSE_NAME`, SP creds, Lakebase, RLS) | per-deployment `.env` | Config |
| Filter vocabulary | `frontend/src/config.ts` (`FILTERS`, `FilterKey`, `FilterState`) | rename/replace filter keys + options | **Code edit** |
| KPI metrics | `server/routes/kpis.py` (measures + SQL columns) + `KPI_METRIC_VIEW` env | metric-view + column names | **Code edit** |
| Hero / page copy | component source (`HomePage`, `GenieMcpExperience`, `AskLive`, `genieModes`) | edit strings | **Code edit** (future: `content.config.json`) |

Add one honest sentence: most of a new demo is config + data + env; the three "Code edit" rows are the spots that still need a source change today.

12. **Documentation** table — keep; change "Ask APEX" mentions → "Ask Prism".
13. **Known gaps / roadmap** — keep as-is.

- [ ] **Step 2: Touch up `AGENTS.md` + `docs/customizing.md`**

- In `AGENTS.md`, replace APEX product-name references with Prism (keep technical invariant names; `apex_*` table names stay). Grep `rtk proxy grep -n "APEX\|Apex" AGENTS.md` and swap identity mentions.
- In `docs/customizing.md`, if it uses "APEX" as the app name in prose, swap to "Prism"; leave `brand.config.json` schema examples accurate. Grep first.

- [ ] **Step 3: Final doc grep**

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi
rtk proxy grep -n "APEX\|Apex" README.md AGENTS.md docs/customizing.md
```
Expected: ZERO (or only an intentional provenance mention you deliberately kept — call it out in the report).

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md docs/customizing.md
git commit -m "docs: rewrite README product-first for Prism + new-demo seams guide

Reframe from Advito/APEX travel-specific to the generic Prism platform; add a
'Demos' section (Travel Intelligence reference + Retail/Hospitality examples as
separate deployments) and a 'Spin up a new demo' seams table (config vs. code).
Update Ask APEX->Ask Prism, /api/apex->/api/prism, demo emails, and dir names in
AGENTS.md + customizing.md.

Co-authored-by: Isaac"
```

---

### Task 4: Repo + package rename to `prism-analytics`, push, open PR

The outward-facing rename. **Gated on explicit user confirmation** before the GitHub repo rename.

**Files:** `frontend/package.json`, `databricks.yml`.

**Interfaces:** Terminal — produces the renamed repo + a PR.

- [ ] **Step 1: package + bundle name**

- `frontend/package.json:2` `"name": "advito-ai-bi"` → `"name": "prism-analytics"`.
- `databricks.yml`: `bundle: name: advito-ai-bi` → `prism-analytics`; the `apps: advito-ai-bi:` resource key → `prism-analytics:` (grep the exact lines; update any reference to that resource name in the same file). Leave the workspace `root_path` user path as-is (it's a filesystem path, not identity — or note it for the user to change on their next deploy).

- [ ] **Step 2: Verify + commit the name change**

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend && npm install && npm run build
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi
git add frontend/package.json frontend/package-lock.json databricks.yml
git commit -m "chore: rename package + bundle to prism-analytics

Co-authored-by: Isaac"
```
(`npm install` refreshes the lockfile's top-level name.)

- [ ] **Step 3: STOP — get explicit user go-ahead for the GitHub repo rename**

Report to the controller/user: "Ready to rename the GitHub repo `rohit-db/advito-ai-bi` → `rohit-db/prism-analytics` and update the origin remote. This is outward-facing (GitHub 301-redirects the old URL, existing clones keep working). Confirm to proceed." Do NOT run Step 4 without a clear yes.

- [ ] **Step 4: Rename the GitHub repo + update origin (after go-ahead)**

```bash
gh auth status | grep -B1 'Active account: true'   # must be rohit-db
gh repo rename prism-analytics --repo rohit-db/advito-ai-bi --yes
git remote set-url origin https://github.com/rohit-db/prism-analytics.git
git remote -v   # confirm
```

- [ ] **Step 5: Push the rename branch + open the PR**

```bash
git push -u origin rename/prism
```
Then open a PR against `main` with `gh pr create` — title "Rename APEX → Prism + product-first README + package/repo → prism-analytics", body summarizing: the FF merge context, the rename scope (surface + code identifiers), what was intentionally left (apex_* tables, total_emissions_advito), the README rewrite, and the repo rename. Report the PR URL.

(PR body ends with the required attribution line.)

---

## Self-Review

**Spec coverage:**
- Merge to main (FF) → Task 1. ✅
- Rename A (brand/repo identity) → Task 2 S1 + Task 4 S1. ✅
- Rename B (user-visible copy) → Task 2 S2. ✅
- Rename C (code identifiers: route prefix, filenames, SP prefix, MCP/viewer, cookie, theme keys) → Task 2 S3–S6. ✅
- Rename D (NOT renamed) → Global Constraints + Step 9 grep exceptions. ✅
- Rename E (demo emails → @prism.example) → Task 2 S7. ✅
- README rewrite + seams table → Task 3. ✅
- Repo/package rename + PR → Task 4. ✅

**Placeholder scan:** none — every swap is an exact current→replacement string with a line anchor; the README rewrite is spelled out section-by-section with the exact seams table.

**Type/contract consistency:** the `/api/prism` prefix is defined once (Task 2 S4) and referenced consistently in README (Task 3 S1.6/S1.7); `AskLive`/`prism.py` module names defined in Task 2 S6 and referenced in Task 3's project-structure section. The route path `/ask-live` is changed in config.ts (S2), App.tsx (S6), and reflected nowhere else.

**Risk notes:** (a) route-prefix atomicity enforced by the S4 both-sides grep gate before proceeding. (b) Task 1 re-checks FF-possibility at run time (S1) rather than trusting the plan-time check. (c) Task 4 hard-stops for user consent before the outward-facing repo rename. (d) Step 8/9 forbid weakening tests or masking non-rename failures. (e) Cookie/theme-key rename resets local sessions/theme — expected, noted in spec. (f) The identity grep (S9) uses an explicit exception list so the documented-leave items don't cause false failures.
