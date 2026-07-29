# Admin Experience Redesign — Design

**Date:** 2026-07-28
**Branch:** `feature/apex-theming`
**Status:** Approved (design), pending implementation plan

## Problem

The operator Admin area has two usability problems the operator called out directly:

1. **Duplicated navigation.** The same two admin links — *Manage Assets* and *Manage Users & SPs* — render in two places at once: the left `Sidebar` "Administration" section (`Sidebar.tsx:174-186`) **and** the `AdminLayout` top tab bar (`AdminLayout.tsx:62-67`). Inside admin you see the identical pair on the left rail and across the top.
2. **The Manage Assets experience is unintuitive and visually poor.** `AssetsPage` stacks a raw table (Key / Label / Dashboard id / Pages / Active) on top of a separate full-width "Tenant access" grid. "Add asset" opens `AssetEditor` — a single dense modal cramming asset key, dashboard picker, global filter page, workspace/org, a nav block (path/icon/section/order), filter-key→widget rows, and per-page prompt/suggestion editors into one vertical scroll. It reads like a config dump, not a guided experience.

## Goals

- One clear place for admin navigation; no duplication.
- An Assets overview that is scannable and visually polished.
- An asset editor with visible structure instead of a wall of inputs.
- Preserve all existing functionality and the load-bearing invariants (operator-only gating, fail-soft when Lakebase is off, tenant-access semantics).

## Non-goals

- No backend/API changes. This is a frontend IA + presentation redesign. The admin API (`adminApi`), access semantics (`POST /api/tenants/{id}/access`), and asset save/validate contract stay as-is.
- No change to the analytics-side app shell, routing for dashboards, or the white-label auth flow.
- No new admin capabilities (no new CRUD); this reorganizes what already exists.

## Decisions (approved via visual brainstorming)

1. **Navigation → context-aware sidebar.** Remove the duplicate. The left `Sidebar` becomes context-aware: in the analytics app it shows analytics nav; when the operator enters `/admin`, the sidebar swaps to admin sections with a clear **"← Back to APEX"** escape. The `AdminLayout` top tab bar is removed entirely. This frees admin pages to use full width and lets us split into more sections without crowding a tab bar.
2. **Assets overview → card grid.** Replace the raw table with a card grid: each asset is a tile (icon, label, `asset_key` · N pages · N filters, Active/Inactive status badge) with **Edit** and **Access** actions, plus a dashed **+ Add asset** tile. A small stat strip (Active assets / Pages / Tenant SPs) sits above the grid.
3. **Editor → sectioned single form.** Keep one modal/panel but group fields into labeled sections — **Basics / Data / Navigation / Filters / Pages** — with a left jump-nav. Everything stays on one scroll; nothing is hidden behind wizard steps (operators edit far more than they create, so gating behind Next buttons would slow the common path).

## Admin sections (sidebar)

The context-aware admin sidebar exposes four sections, splitting today's two crowded pages:

| Section | Route | Content | Source today |
|---|---|---|---|
| **Assets** | `/admin/assets` | Card grid + stat strip; Edit → sectioned editor; Access → per-asset grant panel | `AssetsPage` table + `AssetEditor` |
| **Tenant access** | `/admin/access` *(new route)* | Cross-asset tenant × resource matrix (the current `AccessGrid`, moved out of the Assets page) | `AccessGrid` (was embedded in `AssetsPage`) |
| **Users & SPs** | `/admin/tenants` | Unchanged content: stat cards, tenant table, users table, onboard/verify/history, activity | `TenantsPage` |
| **Activity** | `/admin/activity` *(optional, deferred)* | The audit feed, if we want it standalone; otherwise it stays inline where it is | `AdminLayout` audit / `ActivityFeed` |

> **Access, two views.** The **Tenant access** section is the full cross-asset matrix for the "what does *this tenant* get" view. A card's **Access** button gives quick per-asset access ("who can see *this* dashboard"). **First-pass behavior:** the card's **Access** button navigates to the Tenant access section (optionally pre-scoped to that asset's columns); a dedicated single-asset panel is a later enhancement (see open question 3). Both views call the existing `setAccess` / access-matrix endpoints; no new API.

## Components

### Changed
- **`Sidebar.tsx`** — becomes context-aware. When the current route is under `ADMIN_BASE`, render admin sections (Assets / Tenant access / Users & SPs) + a "← Back to APEX" link instead of the analytics nav; the operator-only "Administration" block (lines 174-186) is removed from the analytics view. Entry into admin is a single operator-only affordance (e.g. a gear/admin control in the analytics sidebar footer or `Header`).
- **`AdminLayout.tsx`** — remove the top tab bar (lines 60-69). Keep the audit polling + `AccessGate` (401/403) logic and the `Outlet` context. The layout becomes a thin wrapper providing full-width to child pages.
- **`AssetsPage.tsx`** — replace the `<table>` (lines 118-153) with the card grid + stat strip. Remove the embedded "Tenant access" `<section>` (lines 156-160); that moves to the new Tenant access route. Keep the load/save/delete/toggle handlers and the `!writable` (Lakebase-off) amber notice and fail-soft behavior.
- **`AssetEditor.tsx`** — restructure the body (lines 177-362) into the five labeled sections with a jump-nav. No change to `handleSave`, the `SaveAssetBody` shape, client-side guards, or the dashboards picker fail-soft logic. Purely presentational grouping.

### New
- **`AssetCard.tsx`** — one asset tile (icon, label, meta line, status badge, Edit/Access actions). Used by the card grid.
- **Admin section nav** — the context-aware admin nav model (could live in `adminContext.ts` as a section list consumed by `Sidebar`).
- **Route:** `/admin/access` rendering the moved `AccessGrid` (add to the `Routes` in `App.tsx:238-242`).
- *(Optional/deferred)* per-asset Access panel — a scoped `AccessGrid` view opened from a card.

### Unchanged
- `TenantsPage.tsx` and its children (`TenantTable`, `UsersTable`, `OnboardDialog`, `VerifyModal`, `HistoryDrawer`, `ActivityFeed`, `StatCard`, `ConfirmDialog`, `SecretAlert`).
- `adminApi` and all backend routes.
- `AccessGrid` internals (only its mount location and an optional single-asset filter prop change).

## Data flow

No change. `AssetsPage` still calls `adminApi.listAdminAssets()` → renders cards; Edit/Add still builds a `SaveAssetBody` via `AssetEditor` → `adminApi.saveAdminAsset` → reload. Access toggles still POST to `/api/tenants/{id}/access` optimistically with revert-on-error. Operator gating still flows through `reportAccessError` → `AccessGate`.

## Error handling & invariants (preserve)

- **Operator-only:** admin routes still self-guard via 401/403 → `AccessGate`; the admin sidebar sections and the admin entry affordance are hidden for non-operators (`user.role !== "operator"`).
- **Fail-soft (Lakebase off):** the `!writable` amber notice and disabled Add/Edit/Delete/toggle must remain; assets still render read-only from the seed registry.
- **Access semantics:** grant/revoke still runs as the operator against existing endpoints; no change to what CAN_RUN means.

## Testing

- Update `AssetsPage.test.tsx` for the card grid (assets render as cards; Add/Edit/Access actions present; `!writable` disables actions and shows the notice).
- Update `AdminLayout` expectations — no top tab bar; `AccessGate` still shown on 401/403.
- Add/adjust `Sidebar.test.tsx` — analytics view has no "Administration" block; admin view shows admin sections + "Back to APEX"; non-operator sees neither.
- New `AssetCard` test — renders label/meta/status, fires Edit/Access callbacks.
- Keep `AssetEditor.test.tsx` green — behavior (save payload, guards) is unchanged; only update selectors if section grouping changes the DOM structure.
- `AccessGrid.test.tsx` — still passes at the new route; add coverage if a single-asset filter prop is introduced.

## Open questions (resolve during planning)

1. **Admin entry point:** gear icon in the analytics sidebar footer vs. in the `Header`? (Leaning sidebar footer, operator-only.)
2. **Activity section:** promote to its own route, or leave the audit inline? (Leaning leave inline for now — defer the standalone Activity route.)
3. **Per-asset Access panel:** ship in this pass, or land the card grid first and keep Access linking to the full matrix initially? (Can phase.)
