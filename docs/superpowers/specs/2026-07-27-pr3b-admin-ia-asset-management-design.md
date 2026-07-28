# PR3b — Admin IA + Asset Management + Access Grid — Design

**Date:** 2026-07-27
**Branch:** `feature/apex-theming` (staged PRs; PR1/PR2/PR3a already on this branch + pushed to origin)
**Status:** Approved design — ready for implementation planning
**Predecessor:** [PR3a asset-registry plumbing](2026-07-27-apex-flagship-whitelabel-redesign-design.md#section-c--admin-information-architecture) (complete, merge-ready)

## Goal

Make the app's **data assets modular and operator-managed**: turn the ~518-line
"Service Principals" admin monolith into a clean two-page admin, let an operator
manage dashboard/Genie **assets** in-UI (full structured editor), and expose
per-tenant access as a scannable **tenant × asset grid** (replacing the buried
per-row `AccessDialog`). This is the foundation half of the broader modularity
vision — "adaptable by anybody, not just APEX."

## Scope decomposition — why PR3b is the foundation, PR3c the surface

During brainstorming the user expanded the modularity vision to **"what buttons
are shown… adaptable by anybody."** That is three independent subsystems, not
one, so we decomposed:

| | Scope | Depends on |
|---|---|---|
| **PR3b (this spec)** | Admin IA reorg + asset registry CRUD (Lakebase override on PR3a's seed) + tenant×asset **access grid** | PR3a ✅ |
| **PR3c (later)** | **Surface/nav registry** (`ROUTES` → config-driven, PR3a-style) + **per-tenant entitlement** that filters the nav so each client sees only its entitled surface — unified into the same access grid | PR3b + a nav registry |

PR3b + PR3c together deliver the full vision. PR3b ships first because PR3c's
entitlement engine needs the grid and a surface registry to exist before it can
wire nav-visibility to entitlement. **PR3c also closes a gap PR3b leaves open:**
today (and after PR3b) a tenant without CAN_RUN on a dashboard still *sees* the
nav button and hits an empty/error dashboard — unifying nav-visibility with the
access grid is PR3c's job, explicitly out of scope here.

## Governing tenet — minimal · config-driven · agent-ready

Same tenet as the rest of the initiative (see [config-driven-agent-ready]).
Editable source-of-truth stays a **file an agent can read/edit**
(`server/assets/dashboards.seed.json`) in the zero-infra default; the in-UI
editor is the durable path when Lakebase is on. One-hop "Change X → edit Y".

### Load-bearing invariants (must not break — from AGENTS.md)

- **Tenant isolation:** per-tenant SP + UC row filter is the isolation control;
  the access grid toggles CAN_RUN on the tenant SP but the row filter remains the
  load-bearing control. `resolve_tenant_sp` (fallback-to-app-SP-on-None) untouched.
- **Secrets:** SP secrets AES-GCM encrypted at rest, shown once, never logged —
  PR3b does not touch the secret path.
- **Fail-soft:** Lakebase off / auth off degrade gracefully. Asset editing
  requires Lakebase; with it off, Manage Assets is **read-only** with a seed-edit
  note (no degraded write path). `GET /api/assets` read path is unchanged.
- **Admin API/UI is operator-only** (`role == "operator"`), enforced server-side.

## Delivery

Two independently reviewable sub-PRs (mirrors PR3a's a/b split); each leaves the
app fully working:

- **PR3b-1 (server, additive):** `apex_asset_registry` table + editable resolver
  functions + `/api/admin/assets` CRUD + `/api/tenants/access-matrix`. The app
  behaves identically — the read path is unchanged and the new write path is
  dormant until the UI lands.
- **PR3b-2 (frontend):** `AdminLayout` + two sub-pages, the structured asset
  editor, the access grid; delete `AccessDialog`; decompose the old `AdminPage`.

---

## Section 1 — Architecture & IA shell

Replace the ~518-line `AdminPage` monolith with a thin **`AdminLayout`** (sub-nav
+ `<Outlet/>`) and two focused pages, **reusing** existing components — not
rewriting them.

```
/admin                      → AdminLayout (sub-nav + shared 401/403 gate + audit poll)
  /admin/assets  (default)  → AssetsPage   — registry table + structured editor + tenant×asset access grid
  /admin/tenants            → TenantsPage  — TenantTable + UsersTable + ActivityFeed (relocated)
```

- **Nav:** the Sidebar's single "Service Principals" operator entry becomes an
  **"Administration"** group with **Manage Assets** + **Manage Users & SPs**.
  `/admin` redirects to `/admin/assets`.
- **Relocated as-is:** `TenantTable`, `UsersTable`, `ActivityFeed`,
  `OnboardDialog`, `VerifyModal`, `HistoryDrawer`, `UserDialog`, `SecretAlert`,
  `ConfirmDialog`, `StatCard` → `TenantsPage`. The stats strip stays on Tenants.
- **Lifted into `AdminLayout` (shared by both sub-pages):** the 401/403
  `AccessGate` and the audit-feed poll (one gate, one poll — not duplicated).
- **Deleted:** `AccessDialog` (its grant/revoke logic folds into the grid). The
  old `AdminPage.tsx` is decomposed, not preserved.
- **Routing:** `App.tsx` currently registers one `ADMIN_ROUTE_PATH`; it gains the
  nested `/admin/*` routes. Operator gating unchanged (server self-guards; nav
  hidden for non-operators via `useUser().role`).

This section is pure front-end reorganization — no API or data-model change.

---

## Section 2 — Server: editable asset registry (Lakebase override)

PR3a's `server/assets/registry.py` is read-only (seed-backed). PR3b makes it
**writable when Lakebase is on**, mirroring `server/auth/users.py` exactly.

**Data model** — a new Lakebase table, created lazily (like the users/tenant
tables), spec stored as one JSONB blob so seed↔DB is a clean 1:1:

```sql
CREATE TABLE IF NOT EXISTS apex_asset_registry (
    asset_key   VARCHAR(128) PRIMARY KEY,   -- "spend", "sustainability", …
    spec        JSONB NOT NULL,             -- full AssetSpec (label, dashboardId, globalFilterPage, filters, pages[])
    sort_order  INT NOT NULL DEFAULT 0,     -- nav/display order
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Resolver precedence** (extends PR3a; unchanged when Lakebase off):

- **Lakebase OFF** → seed file only (today's behavior). `writable = false`.
- **Lakebase ON** → `apex_asset_registry` rows are the source; `writable = true`.
  **Seed import is once-only at initialization**, NOT "whenever the table is
  empty": on schema creation the resolver seeds the table from the file exactly
  once (tracked by a small `apex_asset_registry_meta(initialized BOOLEAN)` marker
  row, or an equivalent one-shot guard). This is the [PR3a authoritative-empty
  lesson] applied here — **an operator who deletes all assets gets an empty
  registry that STAYS empty; the seed must not resurrect deleted assets** on the
  next resolve. The seed file remains the documented fallback/initial-import
  source and the Lakebase-off source, but once Lakebase is initialized the table
  is authoritative (including authoritative-empty).

**Functions added to `server/assets/registry.py`** (mirroring `users.py`'s
`list/save/delete` + `lakebase_writable`), all fail-soft:

- `list_assets() -> list[dict]` — resolved assets (Lakebase-or-seed), each
  `{asset_key, spec, sort_order, active}`, ordered by `sort_order`.
- `save_asset(asset_key, spec, sort_order, active) -> None` — upsert; requires
  Lakebase (raises the same "requires LAKEBASE_ENABLED=true" error `save_user`
  does when off).
- `delete_asset(asset_key) -> None` — requires Lakebase.
- `registry_writable() -> bool` — `lakebase.enabled()`.
- `load_registry()` (existing; consumed by `GET /api/assets` + the three PR3a
  server touchpoints: `resources.catalog`, `service.grant_dashboard_access`,
  embed default) now resolves Lakebase-or-seed — so **the running app, embed
  default, grants, and catalog all automatically pick up UI edits**, no extra
  wiring. Shape returned stays `{"assets": {key: spec}}` (built from active rows,
  sorted) so existing consumers are unaffected.

**Validation** (server-side; the structured editor sends structured data):

- `asset_key` non-empty slug (`[a-z0-9-_]+`).
- `spec.dashboardId` non-empty string.
- `spec.globalFilterPage` string (may be empty).
- `spec.filters` is an object whose **keys are valid `FilterKey`s** (the vocab
  lives in `config.ts` `FILTERS`; the server validates against the same known
  set — kept in sync via a small constant, documented).
- `spec.pages` is a list; each page `{pageId, label, summaryPrompt, suggestions[]}`.
  Empty `pages` is allowed (PR3a's `pageGenie` guard degrades safely).
- Invalid → HTTP 400 with a clear per-field message.

**Cache invalidation (PR3a handoff item):** PR3a's module-level `_cache` must not
serve stale data after a write or across processes. When Lakebase is **on**,
`load_registry()` resolves fresh (only the seed read is memoized); `save/delete`
drop any cache. When Lakebase is **off**, the seed cache behaves as in PR3a.

---

## Section 3 — Server: asset CRUD + access-grid APIs

Thin operator-gated routes exposing Section 2, plus one aggregate for the grid.
Mirror the existing `/tenants` operator pattern (`_require_operator`, `actor` from
session, audit on writes).

**Asset CRUD:**

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/assets` | *(exists, PR3a)* resolved registry, now Lakebase-or-seed. **Session-readable** (all users need it to render). |
| `GET` | `/api/admin/assets` | Operator view: resolved list + `{writable}` flag (UI shows edit vs read-only+seed-note). Mirrors `listAppUsers`'s `{users, writable}`. |
| `POST` | `/api/admin/assets` | Create/update an asset (upsert by `asset_key`). Operator-gated, validated, audited (`asset_save`). |
| `DELETE` | `/api/admin/assets/{asset_key}` | Remove an asset. Operator-gated, audited (`asset_delete`). |

Splitting the operator write-surface (`/api/admin/assets`) from the public read
(`/api/assets`) keeps the RegistryProvider boot-fetch simple and the write-surface
clearly operator-only. New routes live in a `server/routes/assets_admin.py`
(or fold into the existing admin router), consistent with `/api/users`.

**Access grid — reuse + one aggregate:**

- Columns = **catalog** (`/api/tenants/resources` → `catalog_dashboards()` +
  genie spaces). Rows = **tenants** (`/api/tenants`).
- **New: `GET /api/tenants/access-matrix`** — one operator call returning
  `{tenant_id: {dashboards:{id:bool}, genie_spaces:{id:bool}}}` for all tenants,
  avoiding the N-calls-on-load waterfall.
- **Efficiency requirement:** implement via a new
  `resources.access_matrix(sp_app_ids: list[str]) -> dict` that fetches **each
  resource's ACL once (M fetches)** and checks every tenant SP against it — cost
  scales with #assets, not #tenants × #assets. (Inverts today's per-SP
  `resources.tenant_access`, which would be N×M.)
- Toggling a cell reuses the **unchanged** `POST /api/tenants/{id}/access`
  (grant/revoke → CAN_RUN → audit `grant_access`/`revoke_access`).

**Isolation unchanged:** the grid toggles CAN_RUN on the tenant SP; the UC row
filter remains the load-bearing control. PR3b does not touch `resolve_tenant_sp`,
secrets, or the embed path.

---

## Section 4 — Frontend: Manage Assets page (structured editor + access grid)

`AssetsPage` has two stacked operator-only regions.

### 4a. Asset registry table + full structured editor

- **Table:** lists resolved assets (`GET /api/admin/assets`) — key, label,
  dashboard id, #pages, active. Row actions: **Edit**, **Activate/Deactivate**,
  **Delete**, plus **+ Add asset**.
- **Editor** (`AssetEditor` modal/drawer — full structured, no JSON):
  - **Scalars:** label, dashboardId, globalFilterPage, optional workspace/org
    (empty = brand default).
  - **Filters:** editable rows, `FilterKey` (dropdown sourced from `config.ts`
    `FILTERS` — vocabulary stays in code) → widget id (text). Add/remove rows.
  - **Pages:** ordered list; each = pageId + label + `summaryPrompt` (textarea) +
    `suggestions` (add/remove string list). Add/remove/reorder pages.
  - **Save** → `POST /api/admin/assets`, server-validated; on success the
    registry re-resolves and the table refreshes.
- **Lakebase OFF posture:** table renders **read-only** with an inline note —
  *"Editing assets requires Lakebase. Edit `server/assets/dashboards.seed.json`
  (or enable Lakebase) — changes appear on reload."* — driven by the `writable`
  flag. Fail-soft boundary; no degraded write path (matches `UsersTable`).

### 4b. Tenant × asset access grid (headline fix — "so hidden" → scannable)

- Matrix: **rows = tenants**, **columns = grantable resources** (dashboards +
  Genie spaces from the catalog); each cell a toggle showing CAN_RUN state (from
  `/api/tenants/access-matrix`).
- Toggling a cell = optimistic update → `POST /api/tenants/{id}/access` (the exact
  grant/revoke `AccessDialog` used, reverted on error) → audit row. `AccessDialog`
  is then deleted.
- Handles existing shapes: empty catalog (note), deactivated tenants (shown,
  greyed), busy/optimistic per-cell state.

**Live-registry consequence:** because `load_registry()` now feeds the
RegistryProvider, editing an asset changes the actual app surface. The provider
fetches once at boot, so an operator's edit shows for end-users on their **next
load** (not live-pushed) — consistent with today's config model. Note this inline
in the editor ("changes apply on next load"); no live push (YAGNI).

**Brand-neutral:** editor + grid built with no "APEX"/travel assumptions in labels
or copy, all via brand tokens — the admin surface itself is white-label-ready.

---

## Section 5 — Delivery, testing & agent-readiness

### Testing

- **Server (pytest):** resolve precedence (seed-only off / Lakebase-override on /
  seed imported **once** at init); **authoritative-empty: after seed import,
  deleting all assets yields an empty registry that stays empty on the next
  resolve — the seed does NOT resurrect them** (the PR3a lesson, now on the server
  side); save/delete round-trip + `writable` gating;
  validation rejects (bad FilterKey, empty dashboardId, bad slug) → 400;
  `access_matrix` shape + the "each resource ACL fetched once" behavior; CRUD
  operator-gating (401/403); fail-soft (Lakebase-off read-only, `GET /api/assets`
  unchanged). **Same mutation-tested rigor as PR3a** — prove non-vacuity where an
  assertion could pass hollowly (especially: a Lakebase-override test must fail if
  the override is ignored; use a distinct sentinel vs the seed).
- **Frontend (vitest):** `AssetEditor` add/remove filter+page rows and the save
  payload shape; access-grid cell toggle → correct grant/revoke call + optimistic
  revert on error; Lakebase-off read-only note renders; `AdminLayout`
  routing/gate.
- **Manual (Chrome, controller-run):** full CRUD on an asset; grid toggle audits;
  IA navigation between the two pages; Lakebase-off posture; confirm an edited
  asset changes the end-user surface on reload.

### Agent-readiness deliverables

- Update the **"Change X → edit Y"** map in `docs/customizing.md` + `AGENTS.md`:
  *Dashboards & Genie assets → `dashboards.seed.json` (or **Manage Assets** UI when
  Lakebase on)*; *Per-tenant asset access → **Manage Assets → access grid***.
- Document the seed↔Lakebase precedence + the editor's structured shape.
- Editor/grid brand-neutral (no APEX/travel assumptions).

### Out of scope (YAGNI / deferred)

- **Export registry → seed file** (brainstorm option "C") — deferred;
  agent-readability holds via the Lakebase-off file posture.
- **Nav/surface registry + per-tenant entitlement** → **PR3c** (the second half of
  the modularity vision; needs PR3b's grid + a nav registry).
- **Live/real-time registry push** to end-users (changes apply on next load).

## Acceptance

- Admin nav shows two pages (**Manage Assets** default, **Manage Users & SPs**);
  no single page is the old monolith. `AccessDialog` is gone.
- With Lakebase **on**: an operator adds/edits/removes a dashboard asset (scalars +
  filters + pages/prompts) in-UI; it persists to `apex_asset_registry`, appears in
  nav/grid, and changes the end-user surface on reload.
- With Lakebase **off**: Manage Assets is read-only with the seed-edit note; the
  app still renders dashboards/Genie from the seed; `GET /api/assets` unchanged.
- A tenant × asset access grid is visible without opening any per-row dialog;
  toggling a cell grants/revokes CAN_RUN and writes an audit row (unchanged
  backend); the matrix loads via one aggregate call.
- Isolation, secrets, and the embed path are untouched; operator-gating enforced
  server-side.
- `python -m pytest tests/ -q` and `cd frontend && npx tsc -b && npx vite build &&
  npx vitest run` all clean.

## Governing reference

[config-driven-agent-ready]; predecessor
[PR3a](2026-07-27-apex-flagship-whitelabel-redesign-design.md); the master
initiative spec's Section C is the origin of the admin-IA design this refines.
