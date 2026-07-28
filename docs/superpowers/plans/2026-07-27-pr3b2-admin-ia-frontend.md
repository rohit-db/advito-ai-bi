# PR3b-2 — Admin IA Frontend (Manage Assets + Access Grid + Manage Users & SPs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ~518-line `AdminPage` monolith with a thin `AdminLayout` + two focused operator pages — **Manage Assets** (registry table + full structured editor + tenant×asset access grid) and **Manage Users & SPs** (relocated tenant/user/audit management) — consuming the PR3b-1 server endpoints, so the admin experience is scannable and assets are first-class + in-UI editable.

**Architecture:** A nested `/admin/*` route renders `AdminLayout` (sub-nav + `<Outlet/>`), which owns the two shared concerns today duplicated nowhere-else-yet: the 401/403 access gate and the audit-feed poll. Both sub-pages read those via react-router `useOutletContext`. `AssetsPage` composes a registry table, a structured `AssetEditor`, and a self-contained `AccessGrid` (which reincarnates `AccessDialog`'s grant/revoke logic as a matrix). `TenantsPage` relocates the existing tenant/user/audit components verbatim. The old `AdminPage` and `AccessDialog` are deleted in the final cutover task.

**Tech Stack:** React 19 + TypeScript + Vite 7 + Vitest 3 + react-router-dom ^7.13 (`Outlet`/`useOutletContext`). Tailwind v4 brand tokens (PR1). All server endpoints already exist and are tested (PR3b-1). No new dependencies.

## Global Constraints

- **Governing tenet — minimal · config-driven · agent-ready.** Reuse and relocate existing components; do not rewrite what works. Brand tokens only — no hardcoded hex/indigo/violet, no "APEX"/travel copy in admin chrome (the admin surface must itself be white-label-ready).
- **Additive until the cutover.** Tasks 1–5 add code without changing the live `/admin` route (the old `AdminPage` keeps serving it, app keeps building). Task 6 is the atomic flip (routing + nav + deletions).
- **Operator-only, server-enforced.** The nav entries render only when `useUser().role === "operator"`; the server self-guards every `/api/admin/assets` + `/api/tenants/*` call (401/403). The frontend gate is UX, not security.
- **Isolation/secrets untouched.** The access grid toggles CAN_RUN via the UNCHANGED `POST /api/tenants/{id}/access` (`adminApi.setAccess`). Do not touch the embed path, `resolve_tenant_sp`, crypto, or the grant/revoke server logic.
- **Lakebase-off posture (fail-soft boundary).** When `GET /api/admin/assets` returns `writable: false`, the registry table + editor are **read-only** with an inline note ("Editing assets requires Lakebase; edit `server/assets/dashboards.seed.json` or enable Lakebase — changes appear on reload"). No degraded write path. Matches how `UsersTable` already renders when `writable` is false.
- **"Changes apply on next load."** The `RegistryProvider` fetches `/api/assets` once at boot, so an operator's asset edit shows for end-users on their next load — surface this as an inline note in the editor; do not build live push (YAGNI).
- **Filter vocabulary stays in code.** The `AssetEditor`'s filter-key dropdown is sourced from `config.ts` `FilterKey` (union: `currentPeriod | previousPeriod | travelSector | destinationRegion`) with `FILTERS[k].label` for display. The seed/registry `filters` map only references those keys.
- **Test rigor (the PR3a/PR3b-1 lesson).** Vitest colocated `*.test.tsx`. Where an assertion could pass hollowly (optimistic revert, read-only gating, save-payload shape), make it non-vacuous — assert against a value only the correct path produces.
- **No new dependencies.** Commit after each task; conventional-commit messages ending with a blank line then exactly `Co-authored-by: Isaac`. Never `--no-verify`.
- **Gates:** `cd frontend && npx tsc -b && npx vite build && npx vitest run` — clean after every task.

---

## File structure

**Create:**
- `frontend/src/components/admin/adminContext.ts` — `AdminOutletContext` type + `useAdminOutlet()` + admin route path constants (`ADMIN_BASE`, `ADMIN_ASSETS_PATH`, `ADMIN_TENANTS_PATH`). The shared seam between `AdminLayout` and the two pages. (Created in Task 4, first consumer.)
- `frontend/src/components/admin/AssetEditor.tsx` — full structured editor (scalars + filter rows + pages) as a `Modal`. (Task 2)
- `frontend/src/components/admin/AssetEditor.test.tsx` — editor row add/remove + save-payload tests. (Task 2)
- `frontend/src/components/admin/AccessGrid.tsx` — self-contained tenant×asset matrix (fetch + optimistic toggle, folds in `AccessDialog` logic). (Task 3)
- `frontend/src/components/admin/AccessGrid.test.tsx` — grid toggle → `setAccess` + optimistic revert tests. (Task 3)
- `frontend/src/pages/admin/AssetsPage.tsx` — registry table + `AssetEditor` wiring + `AccessGrid`. (Task 4)
- `frontend/src/pages/admin/AssetsPage.test.tsx` — table CRUD + read-only gating tests. (Task 4)
- `frontend/src/pages/admin/TenantsPage.tsx` — relocated tenant/user/audit management. (Task 5)
- `frontend/src/pages/admin/TenantsPage.test.tsx` — renders relocated tables from context. (Task 5)
- `frontend/src/pages/admin/AdminLayout.tsx` — sub-nav + gate + audit poll + `<Outlet context={...}/>`. (Task 6)

**Modify:**
- `frontend/src/lib/adminApi.ts` — add asset-CRUD + access-matrix types & functions. (Task 1)
- `frontend/src/App.tsx` — replace the single `/admin` route with nested `/admin/*`. (Task 6)
- `frontend/src/components/Sidebar.tsx` — "Administration" group → two items. (Task 6)

**Delete (Task 6):**
- `frontend/src/pages/AdminPage.tsx` (decomposed into `AdminLayout` + `TenantsPage`)
- `frontend/src/components/admin/AccessDialog.tsx` (logic folded into `AccessGrid`)

**Boundary reference (verified current code):**
- `ADMIN_ROUTE_PATH = "/admin"` is exported from `AdminPage.tsx` and imported by `App.tsx:14` and `Sidebar.tsx:8`. Task 6 replaces it with the constants in `adminContext.ts` and repoints both importers before deleting `AdminPage`.
- `AdminPage` holds ALL tenant/user mutation logic (onboard, rotate, deactivate, reactivate, delete, user CRUD, confirm-dialog orchestration, secret alert) + the audit poll + the `AccessGate`. Task 5 relocates the tenant/user/audit parts to `TenantsPage`; Task 6 lifts the gate + poll to `AdminLayout`.
- `AccessDialog` fold-in coupling — two `onManageAccess` wirings must be reconciled: `TenantTable` has a REQUIRED `onManageAccess: (t) => void` row action (`TenantTable.tsx:24`), and `SecretAlert` has an optional `onManageAccess?: () => void` post-onboard CTA (`SecretAlert.tsx:16`). Since per-tenant access now lives in the Assets-page grid, on `TenantsPage` both point at a navigate-to-Manage-Assets action (see Task 5).
- `adminApi` exports (reuse, do not duplicate): `listTenants`, `resources` (→`ResourceCatalog{dashboards,genie_spaces}`), `setAccess(tenantId,{resource_type,resource_id,grant})`, `listAppUsers`, plus `TenantOut`, `ResourceCatalog`, `ResourceItem`, `ResourceType`, `AuditRow`, `AppUserOut`, `AdminApiError`, `isAdminApiError`.
- Registry types (`@/registry/types`): `AssetSpec { label; dashboardId; globalFilterPage; filters: Partial<Record<FilterKey,string>>; workspace?; org?; pages: AssetPage[] }`, `AssetPage { pageId; label; summaryPrompt; suggestions: string[] }`.
- Shared admin UI (`components/admin/shared.tsx`): `Modal({title,subtitle,icon,onClose,children,footer,maxWidthClass})`, `Spinner`, `relativeTime`. Reuse.
- `ICON_MAP` (config.ts) has `LayoutDashboard`, `ShieldCheck`, `Users`, `Database`, etc.

---

## Task 1: adminApi — asset CRUD + access-matrix

**Files:**
- Modify: `frontend/src/lib/adminApi.ts`

**Interfaces:**
- Consumes: the existing `request<T>` helper + `AdminApiError` in this file.
- Produces (used by Tasks 3–4):
  - Types `AssetRow { asset_key: string; spec: AssetSpec; sort_order: number; active: boolean }`, `AdminAssetsResult { assets: AssetRow[]; writable: boolean }`, `SaveAssetBody { asset_key: string; spec: AssetSpec; sort_order?: number; active?: boolean }`, `AccessMatrixResult { tenants: Record<string, { sp_app_id: string; access: { dashboards: Record<string, boolean>; genie_spaces: Record<string, boolean> } }> }`.
  - Functions `listAdminAssets()`, `saveAdminAsset(body)`, `deleteAdminAsset(assetKey)`, `accessMatrix()`.

- [ ] **Step 1: Add the types + functions**

At the top of `adminApi.ts`, add the registry-type import (after the existing header comment / imports region — this file currently has no imports, so add it as the first line):

```ts
import type { AssetSpec } from "@/registry/types";
```

Then, after the "Login users" section (end of file), append:

```ts
// ─── Dashboard asset registry (operator write-surface) ───────────────────────

export interface AssetRow {
  asset_key: string;
  spec: AssetSpec;
  sort_order: number;
  active: boolean;
}

export interface AdminAssetsResult {
  assets: AssetRow[];
  writable: boolean;
}

export interface SaveAssetBody {
  asset_key: string;
  spec: AssetSpec;
  sort_order?: number;
  active?: boolean;
}

export function listAdminAssets(): Promise<AdminAssetsResult> {
  return request<AdminAssetsResult>("/api/admin/assets");
}

export function saveAdminAsset(body: SaveAssetBody): Promise<{ asset: AssetRow }> {
  return request<{ asset: AssetRow }>("/api/admin/assets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteAdminAsset(assetKey: string): Promise<{ ok: boolean; asset_key: string }> {
  return request<{ ok: boolean; asset_key: string }>(
    `/api/admin/assets/${encodeURIComponent(assetKey)}`,
    { method: "DELETE" }
  );
}

// ─── Tenant × asset access matrix (grid aggregate) ───────────────────────────

export interface AccessMatrixResult {
  tenants: Record<
    string,
    {
      sp_app_id: string;
      access: {
        dashboards: Record<string, boolean>;
        genie_spaces: Record<string, boolean>;
      };
    }
  >;
}

export function accessMatrix(): Promise<AccessMatrixResult> {
  return request<AccessMatrixResult>("/api/tenants/access-matrix");
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: clean. (The new functions are exported but not yet consumed — that's fine.)

- [ ] **Step 3: Confirm no accidental consumer breakage**

Run: `cd frontend && npx vitest run`
Expected: all existing tests still pass (this task is purely additive to the API client).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/adminApi.ts
git commit -m "feat(admin): adminApi asset-CRUD + access-matrix client wrappers

Co-authored-by: Isaac"
```

---

## Task 2: AssetEditor (structured editor)

**Files:**
- Create: `frontend/src/components/admin/AssetEditor.tsx`
- Test: `frontend/src/components/admin/AssetEditor.test.tsx`

**Interfaces:**
- Consumes: `AssetSpec`/`AssetPage` (`@/registry/types`); `FilterKey` + `FILTERS` (`@/config`); `Modal` (`./shared`); `AssetRow`/`SaveAssetBody` (`@/lib/adminApi`).
- Produces (used by Task 4): default export `AssetEditor({ initial, existingKeys, onSave, onClose })` where `initial: AssetRow | null` (null = create), `existingKeys: string[]` (for duplicate-key guard on create), `onSave: (body: SaveAssetBody) => Promise<void>`, `onClose: () => void`. It builds the `SaveAssetBody` and calls `onSave`; the parent owns the API call + error surfacing.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/admin/AssetEditor.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AssetEditor from "./AssetEditor";
import type { AssetRow } from "@/lib/adminApi";

const SPEND: AssetRow = {
  asset_key: "spend",
  sort_order: 0,
  active: true,
  spec: {
    label: "Spend",
    dashboardId: "dash-1",
    globalFilterPage: "pg1",
    filters: { currentPeriod: "period" },
    pages: [
      { pageId: "summary", label: "Summary", summaryPrompt: "P", suggestions: ["a"] },
    ],
  },
};

describe("AssetEditor", () => {
  it("builds a save payload from edited scalar + filter + page fields", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AssetEditor initial={SPEND} existingKeys={["spend"]} onSave={onSave} onClose={() => {}} />);

    // Add a filter row, pick a key, set its widget id.
    fireEvent.click(screen.getByRole("button", { name: /add filter/i }));
    // The new row's key select + widget input are the last of their kind.
    const keySelects = screen.getAllByLabelText(/filter key/i);
    fireEvent.change(keySelects[keySelects.length - 1], { target: { value: "travelSector" } });
    const widgetInputs = screen.getAllByLabelText(/widget id/i);
    fireEvent.change(widgetInputs[widgetInputs.length - 1], { target: { value: "tsector" } });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const body = onSave.mock.calls[0][0];
    expect(body.asset_key).toBe("spend");
    expect(body.spec.filters).toMatchObject({ currentPeriod: "period", travelSector: "tsector" });
    expect(body.spec.pages).toHaveLength(1);
  });

  it("adds and removes a page", () => {
    render(<AssetEditor initial={SPEND} existingKeys={["spend"]} onSave={vi.fn()} onClose={() => {}} />);
    expect(screen.getAllByLabelText(/page id/i)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /add page/i }));
    expect(screen.getAllByLabelText(/page id/i)).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: /remove page/i })[1]);
    expect(screen.getAllByLabelText(/page id/i)).toHaveLength(1);
  });

  it("blocks save on a duplicate key when creating", () => {
    const onSave = vi.fn();
    render(<AssetEditor initial={null} existingKeys={["spend"]} onSave={onSave} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/asset key/i), { target: { value: "spend" } });
    fireEvent.change(screen.getByLabelText(/dashboard id/i), { target: { value: "d" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd frontend && npx vitest run src/components/admin/AssetEditor.test.tsx`
Expected: FAIL — module `./AssetEditor` not found.

- [ ] **Step 3: Implement the editor**

Create `frontend/src/components/admin/AssetEditor.tsx`:

```tsx
import { useState } from "react";
import { Plus, Trash2, LayoutDashboard } from "lucide-react";
import { Modal } from "./shared";
import { FILTERS } from "@/config";
import type { FilterKey } from "@/config";
import type { AssetPage } from "@/registry/types";
import type { AssetRow, SaveAssetBody } from "@/lib/adminApi";

const FILTER_KEYS = Object.keys(FILTERS) as FilterKey[];
const SLUG_RE = /^[a-z0-9_-]+$/;

interface FilterRow {
  key: FilterKey;
  widget: string;
}

function blankPage(): AssetPage {
  return { pageId: "", label: "", summaryPrompt: "", suggestions: [] };
}

/**
 * Full structured editor for one dashboard asset. Scalars + editable filter rows
 * (FilterKey→widget id) + ordered pages (id/label/prompt/suggestions). Builds a
 * SaveAssetBody and hands it to onSave; the parent owns the API call + errors.
 * Server-side validate_asset is the source of truth — this does light client
 * guards (slug, required dashboardId, duplicate key on create) and surfaces the
 * rest via the parent's save error.
 */
export default function AssetEditor({
  initial,
  existingKeys,
  onSave,
  onClose,
}: {
  initial: AssetRow | null;
  existingKeys: string[];
  onSave: (body: SaveAssetBody) => Promise<void>;
  onClose: () => void;
}) {
  const creating = initial === null;
  const [assetKey, setAssetKey] = useState(initial?.asset_key ?? "");
  const [label, setLabel] = useState(initial?.spec.label ?? "");
  const [dashboardId, setDashboardId] = useState(initial?.spec.dashboardId ?? "");
  const [globalFilterPage, setGlobalFilterPage] = useState(initial?.spec.globalFilterPage ?? "");
  const [workspace, setWorkspace] = useState(initial?.spec.workspace ?? "");
  const [org, setOrg] = useState(initial?.spec.org ?? "");
  const [filterRows, setFilterRows] = useState<FilterRow[]>(
    Object.entries(initial?.spec.filters ?? {}).map(([k, v]) => ({ key: k as FilterKey, widget: v as string }))
  );
  const [pages, setPages] = useState<AssetPage[]>(
    initial?.spec.pages?.length ? initial.spec.pages.map((p) => ({ ...p, suggestions: [...p.suggestions] })) : [blankPage()]
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setPage = (i: number, patch: Partial<AssetPage>) =>
    setPages((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  async function handleSave() {
    setError(null);
    const key = assetKey.trim();
    if (!key || !SLUG_RE.test(key)) return setError("Asset key must match [a-z0-9_-] and be non-empty.");
    if (creating && existingKeys.includes(key)) return setError(`An asset with key "${key}" already exists.`);
    if (!dashboardId.trim()) return setError("Dashboard id is required.");

    const filters: Partial<Record<FilterKey, string>> = {};
    for (const r of filterRows) if (r.widget.trim()) filters[r.key] = r.widget.trim();

    const body: SaveAssetBody = {
      asset_key: key,
      sort_order: initial?.sort_order ?? 0,
      active: initial?.active ?? true,
      spec: {
        label: label.trim() || key,
        dashboardId: dashboardId.trim(),
        globalFilterPage: globalFilterPage.trim(),
        filters,
        ...(workspace.trim() ? { workspace: workspace.trim() } : {}),
        ...(org.trim() ? { org: org.trim() } : {}),
        pages: pages.map((p) => ({
          pageId: p.pageId.trim(),
          label: p.label.trim(),
          summaryPrompt: p.summaryPrompt,
          suggestions: p.suggestions.filter((s) => s.trim()),
        })),
      },
    };
    setBusy(true);
    try {
      await onSave(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save asset.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-md border border-brand-border bg-white px-2.5 py-1.5 text-sm";
  const lbl = "text-[11px] font-semibold uppercase tracking-wide text-slate-500";

  return (
    <Modal
      title={creating ? "Add asset" : `Edit asset · ${initial?.asset_key}`}
      subtitle="Dashboard spec, filter wiring, and per-page Genie prompts. Changes apply on next load."
      icon={<LayoutDashboard size={18} />}
      onClose={onClose}
      maxWidthClass="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="rounded-md bg-brand-primary px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-primary-dark disabled:opacity-60"
          >
            {creating ? "Create" : "Save"}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}

        {/* Scalars */}
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className={lbl}>Asset key</span>
            <input aria-label="Asset key" className={input} value={assetKey} disabled={!creating}
              onChange={(e) => setAssetKey(e.target.value)} placeholder="spend" />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Label</span>
            <input aria-label="Label" className={input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Spend" />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Dashboard id</span>
            <input aria-label="Dashboard id" className={input} value={dashboardId} onChange={(e) => setDashboardId(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Global filter page</span>
            <input aria-label="Global filter page" className={input} value={globalFilterPage} onChange={(e) => setGlobalFilterPage(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Workspace (optional)</span>
            <input aria-label="Workspace" className={input} value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="brand default" />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Org (optional)</span>
            <input aria-label="Org" className={input} value={org} onChange={(e) => setOrg(e.target.value)} placeholder="brand default" />
          </label>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={lbl}>Filters</span>
            <button onClick={() => setFilterRows((r) => [...r, { key: FILTER_KEYS[0], widget: "" }])}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:text-brand-primary-dark">
              <Plus size={13} /> Add filter
            </button>
          </div>
          {filterRows.length === 0 && <p className="text-xs text-slate-400">No filters wired.</p>}
          {filterRows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <select aria-label="Filter key" className={input + " flex-1"} value={row.key}
                onChange={(e) => setFilterRows((r) => r.map((x, j) => (j === i ? { ...x, key: e.target.value as FilterKey } : x)))}>
                {FILTER_KEYS.map((k) => (
                  <option key={k} value={k}>{FILTERS[k].label} ({k})</option>
                ))}
              </select>
              <span className="text-slate-400">→</span>
              <input aria-label="Widget id" className={input + " flex-1"} value={row.widget} placeholder="widget id"
                onChange={(e) => setFilterRows((r) => r.map((x, j) => (j === i ? { ...x, widget: e.target.value } : x)))} />
              <button aria-label="Remove filter" onClick={() => setFilterRows((r) => r.filter((_, j) => j !== i))}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Pages */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={lbl}>Pages</span>
            <button onClick={() => setPages((p) => [...p, blankPage()])}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:text-brand-primary-dark">
              <Plus size={13} /> Add page
            </button>
          </div>
          {pages.map((page, i) => (
            <div key={i} className="rounded-lg border border-brand-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input aria-label="Page id" className={input + " flex-1"} value={page.pageId} placeholder="pageId"
                  onChange={(e) => setPage(i, { pageId: e.target.value })} />
                <input aria-label="Page label" className={input + " flex-1"} value={page.label} placeholder="Label"
                  onChange={(e) => setPage(i, { label: e.target.value })} />
                <button aria-label="Remove page" disabled={pages.length === 1}
                  onClick={() => setPages((p) => p.filter((_, j) => j !== i))}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 disabled:opacity-40">
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea aria-label="Summary prompt" className={input + " min-h-[60px]"} value={page.summaryPrompt}
                placeholder="Executive summary prompt…" onChange={(e) => setPage(i, { summaryPrompt: e.target.value })} />
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">Suggestions</span>
                {page.suggestions.map((s, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <input aria-label="Suggestion" className={input + " flex-1"} value={s}
                      onChange={(e) => setPage(i, { suggestions: page.suggestions.map((x, j) => (j === si ? e.target.value : x)) })} />
                    <button aria-label="Remove suggestion" onClick={() => setPage(i, { suggestions: page.suggestions.filter((_, j) => j !== si) })}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <button onClick={() => setPage(i, { suggestions: [...page.suggestions, ""] })}
                  className="inline-flex items-center gap-1 text-xs text-brand-primary hover:text-brand-primary-dark">
                  <Plus size={12} /> Add suggestion
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Run to confirm the tests pass**

Run: `cd frontend && npx vitest run src/components/admin/AssetEditor.test.tsx`
Expected: all 3 PASS. (If `Modal` doesn't render `footer`, verify against `shared.tsx` — its signature includes `footer`.)

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/AssetEditor.tsx frontend/src/components/admin/AssetEditor.test.tsx
git commit -m "feat(admin): structured AssetEditor (scalars + filter rows + pages)

Co-authored-by: Isaac"
```

---

## Task 3: AccessGrid (tenant × asset matrix)

**Files:**
- Create: `frontend/src/components/admin/AccessGrid.tsx`
- Test: `frontend/src/components/admin/AccessGrid.test.tsx`

**Interfaces:**
- Consumes: `adminApi.resources`/`listTenants`/`accessMatrix`/`setAccess`; `ResourceCatalog`, `TenantOut`, `AccessMatrixResult`, `ResourceType` (`@/lib/adminApi`); `Spinner` (`./shared`).
- Produces (used by Task 4): default export `AccessGrid({ onAccessError })` where `onAccessError?: (err: unknown) => void` lets the parent flip the shared 401/403 gate. Self-contained: fetches its own catalog + tenants + matrix and owns the optimistic toggle (reincarnates `AccessDialog`'s grant/revoke logic as a grid).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/admin/AccessGrid.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import AccessGrid from "./AccessGrid";
import * as adminApi from "@/lib/adminApi";

vi.mock("@/lib/adminApi", async (orig) => ({ ...(await orig<typeof adminApi>()) }));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApi, "resources").mockResolvedValue({
    dashboards: [{ id: "dash-1", name: "Spend" }],
    genie_spaces: [],
  });
  vi.spyOn(adminApi, "listTenants").mockResolvedValue({
    tenants: [{ tenant_id: "acme", display_name: "Acme", sp_app_id: "sp-acme", sp_display_name: "sp", status: "active", created_at: "", updated_at: "" }],
  });
  vi.spyOn(adminApi, "accessMatrix").mockResolvedValue({
    tenants: { acme: { sp_app_id: "sp-acme", access: { dashboards: { "dash-1": false }, genie_spaces: {} } } },
  });
});

describe("AccessGrid", () => {
  it("renders a tenant row × resource column and grants on toggle", async () => {
    const setAccess = vi.spyOn(adminApi, "setAccess").mockResolvedValue({ ok: true, tenant_id: "acme" });
    render(<AccessGrid />);
    await waitFor(() => expect(screen.getByText("Acme")).toBeInTheDocument());

    const cell = screen.getByRole("switch", { name: /acme.*dash-1|grant/i });
    expect(cell).toHaveAttribute("aria-checked", "false");
    fireEvent.click(cell);

    await waitFor(() => expect(setAccess).toHaveBeenCalledWith("acme", {
      resource_type: "dashboard", resource_id: "dash-1", grant: true,
    }));
    await waitFor(() => expect(cell).toHaveAttribute("aria-checked", "true"));
  });

  it("reverts the optimistic toggle when setAccess fails", async () => {
    vi.spyOn(adminApi, "setAccess").mockRejectedValue(new Error("boom"));
    render(<AccessGrid />);
    await waitFor(() => expect(screen.getByText("Acme")).toBeInTheDocument());
    const cell = screen.getByRole("switch", { name: /acme.*dash-1|grant/i });
    fireEvent.click(cell);
    // optimistic on, then reverts to off
    await waitFor(() => expect(cell).toHaveAttribute("aria-checked", "false"));
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd frontend && npx vitest run src/components/admin/AccessGrid.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the grid**

Create `frontend/src/components/admin/AccessGrid.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import * as adminApi from "@/lib/adminApi";
import type { ResourceCatalog, TenantOut, ResourceType } from "@/lib/adminApi";
import { Spinner } from "./shared";

type Access = { dashboards: Record<string, boolean>; genie_spaces: Record<string, boolean> };

/**
 * Tenant × asset access matrix. Rows = tenants, columns = grantable dashboards +
 * Genie spaces. Each cell is a CAN_RUN toggle wired to the unchanged
 * POST /api/tenants/{id}/access (optimistic, reverted on error) — the same
 * grant/revoke path the old per-row AccessDialog used, now scannable at a glance.
 */
export default function AccessGrid({ onAccessError }: { onAccessError?: (err: unknown) => void }) {
  const [catalog, setCatalog] = useState<ResourceCatalog | null>(null);
  const [tenants, setTenants] = useState<TenantOut[]>([]);
  const [access, setAccess] = useState<Record<string, Access>>({}); // tenant_id -> Access
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCell, setBusyCell] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([adminApi.resources(), adminApi.listTenants(), adminApi.accessMatrix()])
      .then(([cat, t, matrix]) => {
        if (cancelled) return;
        setCatalog(cat);
        setTenants(t.tenants ?? []);
        const acc: Record<string, Access> = {};
        for (const [tid, entry] of Object.entries(matrix.tenants ?? {})) acc[tid] = entry.access;
        setAccess(acc);
      })
      .catch((err) => {
        if (cancelled) return;
        onAccessError?.(err);
        setError(err instanceof Error ? err.message : "Could not load access matrix");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [onAccessError]);

  const toggle = useCallback(
    async (tenantId: string, type: ResourceType, id: string, next: boolean) => {
      const bucket = type === "dashboard" ? "dashboards" : "genie_spaces";
      const cellKey = `${tenantId}:${type}:${id}`;
      setBusyCell(cellKey);
      setError(null);
      setAccess((a) => ({ ...a, [tenantId]: { ...a[tenantId], [bucket]: { ...a[tenantId]?.[bucket], [id]: next } } }));
      try {
        await adminApi.setAccess(tenantId, { resource_type: type, resource_id: id, grant: next });
      } catch (err) {
        setAccess((a) => ({ ...a, [tenantId]: { ...a[tenantId], [bucket]: { ...a[tenantId]?.[bucket], [id]: !next } } }));
        onAccessError?.(err);
        setError(err instanceof Error ? err.message : "Could not update access");
      } finally {
        setBusyCell(null);
      }
    },
    [onAccessError]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
        <Spinner size={20} /> <span className="text-xs">Loading access…</span>
      </div>
    );
  }

  const cols: { type: ResourceType; id: string; name: string }[] = [
    ...(catalog?.dashboards ?? []).map((d) => ({ type: "dashboard" as const, id: d.id, name: d.name })),
    ...(catalog?.genie_spaces ?? []).map((s) => ({ type: "genie_space" as const, id: s.id, name: s.name })),
  ];

  if (cols.length === 0 || tenants.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-brand-border px-3 py-4 text-xs text-slate-400">
        {cols.length === 0 ? "No grantable resources configured." : "No tenants onboarded yet."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-brand-border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border bg-slate-50">
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tenant</th>
              {cols.map((c) => (
                <th key={`${c.type}:${c.id}`} className="px-3 py-2 text-center text-[11px] font-medium text-slate-600" title={c.id}>
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map((t) => {
              const deactivated = t.status !== "active";
              return (
                <tr key={t.tenant_id} className={deactivated ? "opacity-50" : ""}>
                  <td className="px-3 py-2 font-medium text-slate-800">{t.display_name || t.tenant_id}</td>
                  {cols.map((c) => {
                    const bucket = c.type === "dashboard" ? "dashboards" : "genie_spaces";
                    const on = !!access[t.tenant_id]?.[bucket]?.[c.id];
                    const cellKey = `${t.tenant_id}:${c.type}:${c.id}`;
                    return (
                      <td key={cellKey} className="px-3 py-2 text-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={`${t.display_name || t.tenant_id} access to ${c.name} (${c.id})`}
                          disabled={busyCell === cellKey || deactivated}
                          onClick={() => toggle(t.tenant_id, c.type, c.id, !on)}
                          className={[
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                            on ? "bg-brand-primary" : "bg-slate-300",
                            busyCell === cellKey ? "opacity-60" : "hover:opacity-90",
                          ].join(" ")}
                        >
                          <span className={["inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-relaxed text-slate-400">
        <KeyRound size={11} className="mr-1 inline" />
        Each toggle grants the tenant's Service Principal CAN_RUN on that resource. A Unity Catalog row filter still scopes the data.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run to confirm the tests pass**

Run: `cd frontend && npx vitest run src/components/admin/AccessGrid.test.tsx`
Expected: both PASS (grant call fires with the right body; failure reverts to `aria-checked="false"`).

- [ ] **Step 5: Type-check + build**

Run: `cd frontend && npx tsc -b && npx vite build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/AccessGrid.tsx frontend/src/components/admin/AccessGrid.test.tsx
git commit -m "feat(admin): tenant x asset AccessGrid (folds in AccessDialog grant/revoke)

Co-authored-by: Isaac"
```

---

## Task 4: AssetsPage (registry table + editor + grid) + admin context module

**Files:**
- Create: `frontend/src/components/admin/adminContext.ts`
- Create: `frontend/src/pages/admin/AssetsPage.tsx`
- Test: `frontend/src/pages/admin/AssetsPage.test.tsx`

**Interfaces:**
- Consumes: `adminApi.listAdminAssets`/`saveAdminAsset`/`deleteAdminAsset`; `AssetRow`, `AdminApiError` (`@/lib/adminApi`); `AssetEditor` (Task 2); `AccessGrid` (Task 3); `useAdminOutlet` (this task).
- Produces:
  - `adminContext.ts`: `AdminOutletContext` interface + `useAdminOutlet()` + path constants (used by Task 5 + Task 6).
  - `AssetsPage` default export (rendered by `AdminLayout` in Task 6).

- [ ] **Step 1: Create the shared admin context module**

Create `frontend/src/components/admin/adminContext.ts`:

```ts
import { useOutletContext } from "react-router-dom";
import type { AuditRow } from "@/lib/adminApi";

/** Admin route paths — single source (replaces AdminPage's ADMIN_ROUTE_PATH). */
export const ADMIN_BASE = "/admin";
export const ADMIN_ASSETS_PATH = "/admin/assets";
export const ADMIN_TENANTS_PATH = "/admin/tenants";

/** Shared state AdminLayout provides to its sub-pages via <Outlet context>. */
export interface AdminOutletContext {
  audit: AuditRow[];
  auditLoading: boolean;
  auditError: string | null;
  auditRefreshing: boolean;
  /** Flip the layout's 401/403 gate when a call reveals an access problem. */
  reportAccessError: (err: unknown) => void;
  /** Re-fetch tenants/users/audit (used after a mutation). */
  refreshAll: () => void;
}

export function useAdminOutlet(): AdminOutletContext {
  return useOutletContext<AdminOutletContext>();
}
```

- [ ] **Step 2: Write the failing tests**

Create `frontend/src/pages/admin/AssetsPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import AssetsPage from "./AssetsPage";
import * as adminApi from "@/lib/adminApi";
import type { AdminOutletContext } from "@/components/admin/adminContext";

vi.mock("@/lib/adminApi", async (orig) => ({ ...(await orig<typeof adminApi>()) }));
// AccessGrid does its own fetching; stub its data deps so the page renders.
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApi, "resources").mockResolvedValue({ dashboards: [], genie_spaces: [] });
  vi.spyOn(adminApi, "listTenants").mockResolvedValue({ tenants: [] });
  vi.spyOn(adminApi, "accessMatrix").mockResolvedValue({ tenants: {} });
});

const ctx: AdminOutletContext = {
  audit: [], auditLoading: false, auditError: null, auditRefreshing: false,
  reportAccessError: () => {}, refreshAll: () => {},
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/assets"]}>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="/admin/assets" element={<AssetsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AssetsPage", () => {
  it("lists resolved assets from the registry", async () => {
    vi.spyOn(adminApi, "listAdminAssets").mockResolvedValue({
      writable: true,
      assets: [{ asset_key: "spend", sort_order: 0, active: true, spec: { label: "Spend", dashboardId: "d", globalFilterPage: "", filters: {}, pages: [] } }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Spend")).toBeInTheDocument());
    // Editable when writable
    expect(screen.getByRole("button", { name: /add asset/i })).toBeEnabled();
  });

  it("renders read-only with a seed note when the registry is not writable", async () => {
    vi.spyOn(adminApi, "listAdminAssets").mockResolvedValue({
      writable: false,
      assets: [{ asset_key: "spend", sort_order: 0, active: true, spec: { label: "Spend", dashboardId: "d", globalFilterPage: "", filters: {}, pages: [] } }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/requires lakebase/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /add asset/i })).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `cd frontend && npx vitest run src/pages/admin/AssetsPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the page**

Create `frontend/src/pages/admin/AssetsPage.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { LayoutDashboard, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import * as adminApi from "@/lib/adminApi";
import type { AssetRow, SaveAssetBody } from "@/lib/adminApi";
import { Spinner } from "@/components/admin/shared";
import AssetEditor from "@/components/admin/AssetEditor";
import AccessGrid from "@/components/admin/AccessGrid";
import { useAdminOutlet } from "@/components/admin/adminContext";

export default function AssetsPage() {
  const { reportAccessError } = useAdminOutlet();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [writable, setWritable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AssetRow | null | "create">(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.listAdminAssets();
      setAssets(res.assets ?? []);
      setWritable(!!res.writable);
      setError(null);
    } catch (err) {
      reportAccessError(err);
      setError(err instanceof Error ? err.message : "Could not load assets");
    } finally {
      setLoading(false);
    }
  }, [reportAccessError]);

  useEffect(() => { load(); }, [load]);

  const onSave = useCallback(async (body: SaveAssetBody) => {
    await adminApi.saveAdminAsset(body); // throws on 400 -> surfaced by AssetEditor
    setEditing(null);
    await load();
  }, [load]);

  const onToggleActive = useCallback(async (row: AssetRow) => {
    setBusyKey(row.asset_key);
    try {
      await adminApi.saveAdminAsset({ asset_key: row.asset_key, spec: row.spec, sort_order: row.sort_order, active: !row.active });
      await load();
    } catch (err) {
      reportAccessError(err);
      setError(err instanceof Error ? err.message : "Could not update asset");
    } finally {
      setBusyKey(null);
    }
  }, [load, reportAccessError]);

  const onDelete = useCallback(async (row: AssetRow) => {
    if (!window.confirm(`Delete asset "${row.asset_key}"? This removes it from the app on next load.`)) return;
    setBusyKey(row.asset_key);
    try {
      await adminApi.deleteAdminAsset(row.asset_key);
      await load();
    } catch (err) {
      reportAccessError(err);
      setError(err instanceof Error ? err.message : "Could not delete asset");
    } finally {
      setBusyKey(null);
    }
  }, [load, reportAccessError]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-brand-primary to-brand-accent text-white shadow-sm">
            <LayoutDashboard size={22} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">Manage Assets</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
              Dashboards, Genie prompts, and per-tenant access. Assets resolve from the registry; changes apply on next load.
            </p>
          </div>
        </div>
        <button onClick={load} title="Refresh"
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {/* Registry table */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dashboard assets</h2>
          <button onClick={() => setEditing("create")} disabled={!writable}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-primary-dark disabled:opacity-50">
            <Plus size={13} /> Add asset
          </button>
        </div>

        {!writable && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Editing assets requires Lakebase. Edit <code className="font-mono">server/assets/dashboards.seed.json</code> (or enable Lakebase) — changes appear on reload.
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-slate-400"><Spinner size={20} /><span className="text-xs">Loading assets…</span></div>
        ) : assets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-brand-border px-3 py-4 text-xs text-slate-400">No assets configured.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-brand-border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Key</th><th className="px-3 py-2">Label</th>
                  <th className="px-3 py-2">Dashboard id</th><th className="px-3 py-2">Pages</th>
                  <th className="px-3 py-2">Active</th><th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map((a) => (
                  <tr key={a.asset_key} className={a.active ? "" : "opacity-50"}>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{a.asset_key}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{a.spec.label}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{a.spec.dashboardId}</td>
                    <td className="px-3 py-2 text-slate-600">{a.spec.pages?.length ?? 0}</td>
                    <td className="px-3 py-2">
                      <button disabled={!writable || busyKey === a.asset_key} onClick={() => onToggleActive(a)}
                        className="text-xs font-medium text-brand-primary hover:text-brand-primary-dark disabled:opacity-50">
                        {a.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button aria-label="Edit asset" disabled={!writable} onClick={() => setEditing(a)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-primary disabled:opacity-40"><Pencil size={14} /></button>
                        <button aria-label="Delete asset" disabled={!writable || busyKey === a.asset_key} onClick={() => onDelete(a)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 disabled:opacity-40"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Access grid */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tenant access</h2>
        <AccessGrid onAccessError={reportAccessError} />
      </section>

      {editing && (
        <AssetEditor
          initial={editing === "create" ? null : editing}
          existingKeys={assets.map((a) => a.asset_key)}
          onSave={onSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run to confirm the tests pass**

Run: `cd frontend && npx vitest run src/pages/admin/AssetsPage.test.tsx`
Expected: both PASS (writable → Add enabled; not-writable → seed note + Add disabled).

- [ ] **Step 6: Type-check + full test run**

Run: `cd frontend && npx tsc -b && npx vitest run`
Expected: clean; all pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/admin/adminContext.ts frontend/src/pages/admin/AssetsPage.tsx frontend/src/pages/admin/AssetsPage.test.tsx
git commit -m "feat(admin): AssetsPage — registry table + editor + access grid

Co-authored-by: Isaac"
```

---

## Task 5: TenantsPage (relocate tenant/user/audit management)

This relocates the identity/SP half of the old `AdminPage` into a page that reads the shared audit feed + access gate from `useAdminOutlet()`. It is a faithful move — reuse the existing components and mutation logic; only the audit-state ownership and the access-dialog wiring change.

**Files:**
- Create: `frontend/src/pages/admin/TenantsPage.tsx`
- Test: `frontend/src/pages/admin/TenantsPage.test.tsx`

**Interfaces:**
- Consumes: `useAdminOutlet()` (Task 4); `adminApi` (`listTenants`/`onboard`/`rotate`/`deactivate`/`reactivate`/`remove`/`history`/`verify`/`listAppUsers`/`createAppUser`/`updateAppUser`/`deleteAppUser`); the existing admin components `StatCard`, `SecretAlert`, `TenantTable`, `OnboardDialog`, `VerifyModal`, `HistoryDrawer`, `ActivityFeed`, `ConfirmDialog`, `UsersTable`, `UserDialog`; `relativeTime` (`../../components/admin/shared`); `ADMIN_ASSETS_PATH` (`adminContext`).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/admin/TenantsPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import TenantsPage from "./TenantsPage";
import * as adminApi from "@/lib/adminApi";
import type { AdminOutletContext } from "@/components/admin/adminContext";

vi.mock("@/lib/adminApi", async (orig) => ({ ...(await orig<typeof adminApi>()) }));
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApi, "listTenants").mockResolvedValue({
    tenants: [{ tenant_id: "acme", display_name: "Acme", sp_app_id: "sp", sp_display_name: "sp", status: "active", created_at: "", updated_at: "" }],
  });
  vi.spyOn(adminApi, "listAppUsers").mockResolvedValue({ users: [], writable: true });
});

const ctx: AdminOutletContext = {
  audit: [{ id: 1, action: "onboard", status: "ok", created_at: new Date().toISOString() }],
  auditLoading: false, auditError: null, auditRefreshing: false,
  reportAccessError: () => {}, refreshAll: () => {},
};

it("renders the relocated tenant table + audit feed from context", async () => {
  render(
    <MemoryRouter initialEntries={["/admin/tenants"]}>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="/admin/tenants" element={<TenantsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText("Acme")).toBeInTheDocument());
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd frontend && npx vitest run src/pages/admin/TenantsPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement TenantsPage by relocating from AdminPage**

Open `frontend/src/pages/AdminPage.tsx` as the source. Create `frontend/src/pages/admin/TenantsPage.tsx` that reproduces its tenant + user + audit behavior, with these precise deltas:

1. **Imports:** copy AdminPage's imports EXCEPT drop `AccessDialog`. Add `import { useAdminOutlet, ADMIN_ASSETS_PATH } from "@/components/admin/adminContext";` and `import { useNavigate } from "react-router-dom";`. Fix the relative paths (`./` → `@/components/admin/...` or keep `@/` aliases as AdminPage uses).
2. **Audit state → context:** DELETE the local `audit`, `auditLoading`, `auditError`, `auditRefreshing` state + the `loadAudit` fetcher + the audit `useEffect` poll. Instead read them from the layout: `const { audit, auditLoading, auditError, auditRefreshing, reportAccessError, refreshAll } = useAdminOutlet();`.
3. **`handleAccess` → `reportAccessError`:** replace every `handleAccess(err)` call with `reportAccessError(err)` and delete the local `handleAccess`/`gatedRef`/`accessError` state + the `AccessGate` render + the `AccessGate` component itself (the gate now lives in `AdminLayout`). The page no longer early-returns on access error.
4. **`refreshAll`:** the page's own `loadTenants` + `loadAppUsers` stay local; wrap them so the page-level refresh ALSO calls the context `refreshAll()` (which re-fetches audit). Simplest: keep local `loadTenants`/`loadAppUsers`, and define `const refresh = () => { loadTenants(); loadAppUsers(); refreshAll(); };` — use `refresh` where AdminPage used its `refreshAll`.
5. **AccessDialog removal:** delete `accessTenant` state, the `<AccessDialog .../>` render (AdminPage.tsx:445-446), and the `onManageAccess: () => setAccessTenant(res.tenant)` line in `runOnboard`'s SecretAlert data. Replace the two `onManageAccess` wirings with navigate-to-assets:
   - `const navigate = useNavigate();`
   - `TenantTable` prop: `onManageAccess={() => navigate(ADMIN_ASSETS_PATH)}`.
   - `SecretAlert` data: `onManageAccess: () => navigate(ADMIN_ASSETS_PATH)` (keeps the post-onboard "manage access" CTA working — it now lands on the grid).
6. **Header copy:** title stays "Service Principals" (or "Manage Users & Service Principals"); keep the stats strip (`StatCard` × 3), `SecretAlert`, `TenantTable`, `UsersTable`, `ActivityFeed`, all modals/dialogs, and all mutation callbacks (`onRotate`/`onDeactivate`/`onReactivate`/`onDelete`/`saveAppUser`/`onDeleteUser`/`runOnboard`/`executeConfirm`) VERBATIM.
7. **ActivityFeed props:** pass the context audit — `<ActivityFeed rows={audit} loading={auditLoading} error={auditError} refreshing={auditRefreshing} />`.
8. Remove the outer `bg-slate-50` full-height wrapper if `AdminLayout` provides the scroll container; keep the `mx-auto max-w-6xl px-6 py-6` inner wrapper. (AdminLayout renders the scroll region — Task 6.)

Do NOT change tenant/user mutation logic, confirm-dialog orchestration, or secret handling. This is a move + rewire, not a rewrite.

- [ ] **Step 4: Run to confirm the test passes**

Run: `cd frontend && npx vitest run src/pages/admin/TenantsPage.test.tsx`
Expected: PASS (Acme row renders; no crash reading audit from context).

- [ ] **Step 5: Type-check + full test run**

Run: `cd frontend && npx tsc -b && npx vitest run`
Expected: clean; all pass. (The old `AdminPage.tsx` still exists and compiles — it's still the routed admin page until Task 6.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/TenantsPage.tsx frontend/src/pages/admin/TenantsPage.test.tsx
git commit -m "feat(admin): TenantsPage — relocate tenant/user/audit management

Co-authored-by: Isaac"
```

---

## Task 6: AdminLayout + routing cutover + nav split + delete monolith

The atomic flip: build the layout (owning the gate + audit poll), point `/admin/*` at it, split the sidebar nav, and delete the old `AdminPage` + `AccessDialog`.

**Files:**
- Create: `frontend/src/pages/admin/AdminLayout.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Delete: `frontend/src/pages/AdminPage.tsx`, `frontend/src/components/admin/AccessDialog.tsx`

**Interfaces:**
- Consumes: `AdminOutletContext`/path constants (`adminContext`); `adminApi.audit`; `AuditRow`, `isAdminApiError` (`@/lib/adminApi`); `AssetsPage`/`TenantsPage`.
- Produces: `AdminLayout` default export; `App.tsx` nested `/admin/*` routes; two Sidebar nav items.

- [ ] **Step 1: Implement AdminLayout (gate + audit poll + sub-nav + Outlet)**

Create `frontend/src/pages/admin/AdminLayout.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, ShieldCheck, LockKeyhole, ShieldX } from "lucide-react";
import * as adminApi from "@/lib/adminApi";
import type { AuditRow } from "@/lib/adminApi";
import { isAdminApiError } from "@/lib/adminApi";
import { ADMIN_ASSETS_PATH, ADMIN_TENANTS_PATH } from "@/components/admin/adminContext";
import type { AdminOutletContext } from "@/components/admin/adminContext";

const AUDIT_POLL_MS = 8000;

export default function AdminLayout() {
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditRefreshing, setAuditRefreshing] = useState(false);
  const [accessError, setAccessError] = useState<{ status: number; detail: string } | null>(null);
  const gatedRef = useRef(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const reportAccessError = useCallback((err: unknown) => {
    if (isAdminApiError(err) && (err.status === 401 || err.status === 403) && !gatedRef.current) {
      gatedRef.current = true;
      setAccessError({ status: err.status, detail: err.detail });
    }
  }, []);

  const loadAudit = useCallback(async (background = false) => {
    if (background) setAuditRefreshing(true);
    try {
      const res = await adminApi.audit(20);
      setAudit(res.rows ?? []);
      setAuditError(null);
    } catch (err) {
      reportAccessError(err);
      setAuditError(err instanceof Error ? err.message : "Could not load activity");
    } finally {
      setAuditLoading(false);
      if (background) setAuditRefreshing(false);
    }
  }, [reportAccessError]);

  const refreshAll = useCallback(() => {
    loadAudit(true);
    setRefreshTick((t) => t + 1); // pages key their own reloads off nothing; this is a hook for future use
  }, [loadAudit]);

  useEffect(() => { loadAudit(); }, [loadAudit]);
  useEffect(() => {
    if (accessError) return;
    const id = window.setInterval(() => { if (!gatedRef.current) loadAudit(true); }, AUDIT_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadAudit, accessError]);

  if (accessError) return <AccessGate status={accessError.status} detail={accessError.detail} />;

  const ctx: AdminOutletContext = { audit, auditLoading, auditError, auditRefreshing, reportAccessError, refreshAll };
  const tab = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="sticky top-0 z-10 border-b border-brand-border bg-white/80 px-6 py-2.5 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-1">
          <NavLink to={ADMIN_ASSETS_PATH} className={({ isActive }) => `${tab} ${isActive ? "bg-brand-primary-light text-brand-primary-dark" : "text-slate-500 hover:bg-slate-100"}`}>
            <LayoutDashboard size={15} /> Manage Assets
          </NavLink>
          <NavLink to={ADMIN_TENANTS_PATH} className={({ isActive }) => `${tab} ${isActive ? "bg-brand-primary-light text-brand-primary-dark" : "text-slate-500 hover:bg-slate-100"}`}>
            <ShieldCheck size={15} /> Manage Users & SPs
          </NavLink>
        </nav>
      </div>
      {/* The bare /admin path is handled by the router `index` route (Step 2),
          which renders AssetsPage — no redirect needed here. */}
      <Outlet context={ctx} />
    </div>
  );
}

function AccessGate({ status, detail }: { status: number; detail: string }) {
  const notLoggedIn = status === 401;
  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-6">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-brand-border bg-white p-8 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary-light">
          {notLoggedIn ? <LockKeyhole size={28} className="text-brand-accent" /> : <ShieldX size={28} className="text-rose-500" />}
        </div>
        <div>
          <h2 className="mb-1 text-base font-semibold text-slate-800">{notLoggedIn ? "Sign in required" : "Operator access required"}</h2>
          <p className="text-sm leading-relaxed text-slate-500">
            {notLoggedIn ? "You need to be signed in to manage this workspace." : "This area is limited to operators."}
          </p>
          {detail && <p className="mt-2 text-xs text-slate-400">{detail}</p>}
        </div>
        {notLoggedIn && (
          <a href="/login" className="inline-flex h-9 items-center justify-center rounded-md bg-brand-primary px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-primary-dark">Sign in</a>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Flip App.tsx to nested admin routing**

In `frontend/src/App.tsx`:
1. Replace `import AdminPage, { ADMIN_ROUTE_PATH } from "@/pages/AdminPage";` with:
   ```tsx
   import AdminLayout from "@/pages/admin/AdminLayout";
   import AssetsPage from "@/pages/admin/AssetsPage";
   import TenantsPage from "@/pages/admin/TenantsPage";
   import { ADMIN_BASE } from "@/components/admin/adminContext";
   ```
2. Replace the single admin `<Route path={ADMIN_ROUTE_PATH} element={<AdminPage />} />` (App.tsx:236) with the nested block:
   ```tsx
   {/* Operator-only admin. Self-guards via 401/403 in AdminLayout; nav hidden for non-operators. */}
   <Route path={ADMIN_BASE} element={<AdminLayout />}>
     <Route index element={<AssetsPage />} />
     <Route path="assets" element={<AssetsPage />} />
     <Route path="tenants" element={<TenantsPage />} />
   </Route>
   ```
   The `index` route renders AssetsPage for the bare `/admin` path (this is the single redirect mechanism — AdminLayout Step 1 has no `Navigate`). The explicit `assets` route makes the "Manage Assets" NavLink active state correct when the URL is `/admin/assets`.

- [ ] **Step 3: Split the Sidebar admin nav into two items**

In `frontend/src/components/Sidebar.tsx`:
1. Replace `import { ADMIN_ROUTE_PATH } from "@/pages/AdminPage";` with `import { ADMIN_ASSETS_PATH, ADMIN_TENANTS_PATH } from "@/components/admin/adminContext";`.
2. Replace the single admin `NavItem` (Sidebar.tsx:180) inside the `{isOperator && ...}` block with two:
   ```tsx
   <NavItem path={ADMIN_ASSETS_PATH} label="Manage Assets" icon="LayoutDashboard" />
   <NavItem path={ADMIN_TENANTS_PATH} label="Manage Users & SPs" icon="ShieldCheck" />
   ```
   `NavItem`'s active state is `location.pathname === path` — exact match works for both distinct paths.

- [ ] **Step 4: Delete the monolith + AccessDialog**

```bash
git rm frontend/src/pages/AdminPage.tsx frontend/src/components/admin/AccessDialog.tsx
```
Then grep to confirm no dangling importers remain:
```bash
cd frontend && grep -rn "AdminPage\|AccessDialog\|ADMIN_ROUTE_PATH" src
```
Expected: no matches (all references now go through `AdminLayout`/`adminContext`). Fix any straggler.

- [ ] **Step 5: Type-check + build + full test run**

Run: `cd frontend && npx tsc -b && npx vite build && npx vitest run`
Expected: clean build; all tests pass.

- [ ] **Step 6: Manual visual parity check (controller-run, documented)**

Build the frontend and run the backend (`AUTH_ENABLED=true`, operator session). Via Chrome DevTools MCP, verify:
- Sidebar "Administration" shows **Manage Assets** + **Manage Users & SPs** (operator only).
- `/admin` redirects to `/admin/assets`; sub-nav switches between the two pages; NavLink active state is correct.
- Manage Assets lists the registry assets; **Add asset** opens the editor; the tenant×asset **access grid** renders (toggling a cell calls `POST /tenants/{id}/access` — check Network).
- With Lakebase off: the registry table is read-only with the seed note; Add/Edit/Delete disabled.
- Manage Users & SPs shows the relocated tenant table + users table + activity feed; onboarding still works and its post-onboard "manage access" CTA navigates to Manage Assets.
- Zero console errors.
Record the result in the ledger. This is verification, not code.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(admin): AdminLayout + nested /admin routing; retire AdminPage + AccessDialog

Two operator pages (Manage Assets, Manage Users & SPs) under a shared layout
that owns the 401/403 gate + audit poll. AccessDialog's grant/revoke folds into
the Assets-page access grid.

Co-authored-by: Isaac"
```

---

## Self-review notes

- **Spec coverage (PR3b spec Sections 1 + 4):**
  - AdminLayout + sub-nav + `/admin/assets` (default) + `/admin/tenants` ✓ (T6). Redirect `/admin`→assets ✓ (T6 `index` route).
  - Nav "Administration" group → two items ✓ (T6). Operator-gated via `useUser().role` (unchanged) ✓.
  - Relocated as-is: TenantTable/UsersTable/ActivityFeed + modals + StatCard ✓ (T5). Gate + audit poll lifted to layout ✓ (T6).
  - Deleted AccessDialog ✓ (T6); its grant/revoke folded into AccessGrid ✓ (T3).
  - AssetsPage 4a: registry table + full structured editor (scalars + filter rows + pages/prompt/suggestions) + activate/delete + add ✓ (T2 + T4). Lakebase-off read-only + seed note ✓ (T4, tested). "changes apply on next load" note ✓ (T2 subtitle + T4 header).
  - AssetsPage 4b: tenant×asset grid, toggle → unchanged `setAccess`, optimistic + revert, empty/deactivated states ✓ (T3, tested).
  - `/api/tenants/access-matrix` aggregate consumed (one call) ✓ (T3). Server write-surface `/api/admin/assets` consumed ✓ (T1/T4).
- **Global-constraint coverage:** additive until cutover (T1–T5 don't touch the live route) ✓; operator-only + server-enforced ✓; isolation/secrets/embed untouched (only `setAccess` used, unchanged) ✓; Lakebase-off fail-soft posture ✓ (T4); filter vocab from config.ts ✓ (T2); brand tokens only (no hex/indigo) ✓; no new deps ✓; commit trailer every task ✓.
- **Placeholder scan:** none — every code step has real content; T5 relocation gives exact deltas against cited AdminPage line ranges rather than "move the logic."
- **Type consistency:** `AdminOutletContext` defined in T4 (`adminContext.ts`), consumed by AssetsPage (T4) + TenantsPage (T5), provided by AdminLayout (T6) — same shape throughout. `AssetRow`/`SaveAssetBody`/`AccessMatrixResult` defined in T1, consumed T3/T4. `AssetEditor` props `{initial,existingKeys,onSave,onClose}` defined T2, used T4. `AccessGrid` prop `{onAccessError}` defined T3, used T4. Path constants `ADMIN_BASE`/`ADMIN_ASSETS_PATH`/`ADMIN_TENANTS_PATH` defined T4, used T5/T6.
- **Ordering / app-always-builds:** T1 (API, additive) → T2 (editor, standalone) → T3 (grid, standalone) → T4 (assets page, standalone + context module) → T5 (tenants page, standalone; old AdminPage still routed) → T6 (atomic cutover: layout + routing + nav + deletions). Every task ends green; only T6 changes the live route.
- **Testing honesty:** editor payload/row-ops, grid toggle+revert, and read-only gating are unit-tested with non-vacuous assertions (assert the exact save body, the exact `setAccess` args, the revert to `aria-checked="false"`, the disabled Add button). The routing cutover (T6) is integration and is gated by tsc/build + the existing suite + a documented controller visual check — appropriate since it's a router/nav rewire unit tests can't meaningfully exercise. Where a page needs the layout's outlet context, tests provide it via a `MemoryRouter` + `<Outlet context>` harness (shown in T4/T5).
- **Out of scope (deferred):** PR3c (nav/surface registry + per-tenant entitlement); the deferred live-Lakebase smoke test; deeper server-side page-shape validation (editor enforces at the edit boundary). Reordering pages (drag) is not built — `sort_order` is preserved on save but there's no reorder UI (YAGNI; add later if asked).
