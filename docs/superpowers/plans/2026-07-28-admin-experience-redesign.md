# Admin Experience Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the duplicated admin navigation and redesign the Manage Assets experience (card grid + sectioned editor) into a coherent, context-aware admin area.

**Architecture:** Frontend-only IA + presentation change. The left `Sidebar` becomes context-aware (admin sections under `/admin`, analytics nav elsewhere); the `AdminLayout` top tab bar is removed; `AssetsPage` becomes a card grid with a stat strip; the cross-asset `AccessGrid` moves to its own `/admin/access` route; `AssetEditor` groups its fields into labeled sections with a jump-nav. No backend or `adminApi` changes.

**Tech Stack:** React 19 + react-router-dom 7 + Tailwind v4, Vitest + Testing Library (`vitest run`), lucide-react icons.

## Global Constraints

- **No hardcoded brand values.** Use `brand-*` Tailwind utilities and existing tokens (`brand-primary`, `brand-accent`, `brand-border`, `brand-primary-light`, `brand-primary-dark`); never hardcode brand colors/strings (AGENTS.md invariant).
- **Operator-only admin.** Admin nav + entry affordance render only when `user?.role === "operator"`; pages still self-guard via 401/403 → `AccessGate`.
- **Fail-soft.** When the asset registry is not `writable` (Lakebase off), keep the amber "requires Lakebase" notice and disable Add/Edit/Delete/toggle; assets still render read-only.
- **No API changes.** Reuse `adminApi` as-is (`listAdminAssets`, `saveAdminAsset`, `deleteAdminAsset`, access-matrix endpoints). No new backend routes.
- **Test runner:** run frontend tests with `cd frontend && npx vitest run <path>`.
- **Preserve existing behavior/contracts:** `AssetEditor`'s `SaveAssetBody` shape, `handleSave` guards, and the dashboards-picker fail-soft logic are unchanged — Task 6 is presentational only.

## File Structure

- `frontend/src/components/admin/adminContext.ts` — add `ADMIN_ACCESS_PATH` + an `ADMIN_SECTIONS` list (route/label/icon) consumed by the sidebar.
- `frontend/src/components/Sidebar.tsx` — context-aware: admin sections + "Back to APEX" under `/admin`; remove the analytics-view "Administration" block.
- `frontend/src/pages/admin/AdminLayout.tsx` — remove the top tab bar; keep audit polling + `AccessGate` + `Outlet` context.
- `frontend/src/pages/admin/AccessPage.tsx` — **new**; wraps `AccessGrid` for the `/admin/access` route.
- `frontend/src/components/admin/AssetCard.tsx` — **new**; one asset tile.
- `frontend/src/pages/admin/AssetsPage.tsx` — card grid + stat strip; remove embedded `AccessGrid` section.
- `frontend/src/components/admin/AssetEditor.tsx` — group body into labeled sections + jump-nav.
- `frontend/src/App.tsx` — add the `/admin/access` route.

---

### Task 1: Admin nav model + context-aware Sidebar

**Files:**
- Modify: `frontend/src/components/admin/adminContext.ts:5-7`
- Modify: `frontend/src/components/Sidebar.tsx:9,173-186`
- Test: `frontend/src/components/Sidebar.test.tsx`

**Interfaces:**
- Produces: `ADMIN_ACCESS_PATH = "/admin/access"`; `ADMIN_SECTIONS: { path: string; label: string; icon: string }[]` (icon is a key into `ICON_MAP` from `@/config`). Task 3 consumes `ADMIN_ACCESS_PATH`.
- Consumes: `useLocation()` (already imported), `useUser()` (already imported, `user.role`).

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/components/Sidebar.test.tsx`. The existing tests render on a non-admin route (default `MemoryRouter`), so extend `renderSidebar` to accept an initial path and stub an operator user:

```tsx
import { ADMIN_ASSETS_PATH } from "@/components/admin/adminContext";

function renderSidebarAt(registry: Registry, path: string, role: "operator" | "user" = "operator") {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true, status: 200,
    json: async () => ({ email: "dana@advito.com", role, tenant: "*" }),
  })));
  return render(
    <RegistryContext.Provider value={registry}>
      <MemoryRouter initialEntries={[path]}>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>
    </RegistryContext.Provider>
  );
}

it("shows admin sections and Back to APEX when under /admin (operator)", async () => {
  renderSidebarAt({ assets: {} }, ADMIN_ASSETS_PATH, "operator");
  expect(await screen.findByText(/back to apex/i)).toBeInTheDocument();
  expect(screen.getByText("Assets")).toBeInTheDocument();
  expect(screen.getByText("Tenant access")).toBeInTheDocument();
  expect(screen.getByText("Users & SPs")).toBeInTheDocument();
});

it("does NOT show an Administration block on the analytics view", () => {
  renderSidebarAt({ assets: { spend: asset("Spend", "/spend-custom", 1) } }, "/", "operator");
  expect(screen.queryByText(/administration/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/back to apex/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/Sidebar.test.tsx`
Expected: FAIL — "Back to APEX" / "Tenant access" not found; the "Administration" block still renders.

- [ ] **Step 3: Add the nav model to adminContext.ts**

Append after line 7:

```ts
export const ADMIN_ACCESS_PATH = "/admin/access";

/** Sections shown in the context-aware admin sidebar. icon is an ICON_MAP key. */
export const ADMIN_SECTIONS = [
  { path: ADMIN_ASSETS_PATH, label: "Assets", icon: "LayoutDashboard" },
  { path: ADMIN_ACCESS_PATH, label: "Tenant access", icon: "ShieldCheck" },
  { path: ADMIN_TENANTS_PATH, label: "Users & SPs", icon: "Users" },
] as const;
```

Confirm `LayoutDashboard`, `ShieldCheck`, and `Users` exist in `ICON_MAP` (`@/config`); if `Users` is absent, use an existing key such as `ShieldCheck` and note it.

- [ ] **Step 4: Make the Sidebar context-aware**

In `Sidebar.tsx`: import `useLocation` (already imported), `ADMIN_BASE` and `ADMIN_SECTIONS` from adminContext, and `ArrowLeft` from `lucide-react`. Compute `const inAdmin = location.pathname.startsWith(ADMIN_BASE);`. When `inAdmin && isOperator`, render (inside the `ScrollArea`) a "← Back to APEX" `NavItem`-style button (navigates to `"/"`) followed by an "Administration" section mapping `ADMIN_SECTIONS` to `NavItem`s — and skip the analytics `insightsRoutes`/`explorationRoutes` sections. When not `inAdmin`, render the analytics sections as today but **remove** the operator "Administration" block (delete lines 173-186).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/Sidebar.test.tsx`
Expected: PASS (all tests, including the two pre-existing ones).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/adminContext.ts frontend/src/components/Sidebar.tsx frontend/src/components/Sidebar.test.tsx
git commit -m "feat(admin): context-aware sidebar; drop duplicate admin nav block"
```

---

### Task 2: Remove the AdminLayout top tab bar

**Files:**
- Modify: `frontend/src/pages/admin/AdminLayout.tsx:56-69`
- Test: `frontend/src/pages/admin/AssetsPage.test.tsx` (indirect) — plus a small direct check below.

**Interfaces:**
- Consumes: nothing new. Produces: unchanged `AdminOutletContext` via `Outlet`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/admin/AdminLayout.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import * as adminApi from "@/lib/adminApi";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApi, "audit").mockResolvedValue({ rows: [] });
});

it("renders child content without a top tab bar", async () => {
  render(
    <MemoryRouter initialEntries={["/admin/assets"]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="assets" element={<div>ASSETS CHILD</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText("ASSETS CHILD")).toBeInTheDocument());
  // The old tab bar rendered these NavLinks; they must be gone.
  expect(screen.queryByRole("link", { name: /manage assets/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /manage users & sps/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/admin/AdminLayout.test.tsx`
Expected: FAIL — the "Manage Assets"/"Manage Users & SPs" `NavLink`s are still present.

- [ ] **Step 3: Remove the tab bar**

In `AdminLayout.tsx`, delete the `<div className="sticky top-0 …"><nav>…</nav></div>` block (lines 60-69) and the now-unused `tab` const (line 56). Remove now-unused imports (`NavLink`, `LayoutDashboard`, `ShieldCheck`, `ADMIN_ASSETS_PATH`, `ADMIN_TENANTS_PATH`) — keep `Outlet`, `LockKeyhole`, `ShieldX`. The return becomes the wrapper `div` + `<Outlet context={ctx} />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/admin/AdminLayout.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/AdminLayout.tsx frontend/src/pages/admin/AdminLayout.test.tsx
git commit -m "feat(admin): remove AdminLayout top tab bar (nav now in sidebar)"
```

---

### Task 3: Tenant access route (`/admin/access`)

**Files:**
- Create: `frontend/src/pages/admin/AccessPage.tsx`
- Modify: `frontend/src/App.tsx:238-242`
- Test: `frontend/src/pages/admin/AccessPage.test.tsx`

**Interfaces:**
- Consumes: `useAdminOutlet().reportAccessError`; `AccessGrid` (default export, prop `onAccessError?: (err: unknown) => void`); `ADMIN_ACCESS_PATH` (Task 1).
- Produces: default-exported `AccessPage` component; a `/admin/access` route.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/admin/AccessPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import AccessPage from "./AccessPage";
import * as adminApi from "@/lib/adminApi";
import type { AdminOutletContext } from "@/components/admin/adminContext";

const ctx: AdminOutletContext = {
  audit: [], auditLoading: false, auditError: null, auditRefreshing: false,
  reportAccessError: () => {}, refreshAll: () => {},
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApi, "resources").mockResolvedValue({ dashboards: [{ id: "d1", name: "Travel" }], genie_spaces: [] });
  vi.spyOn(adminApi, "listTenants").mockResolvedValue({ tenants: [] });
  vi.spyOn(adminApi, "accessMatrix").mockResolvedValue({ tenants: {} });
});

it("renders the tenant access grid heading", async () => {
  render(
    <MemoryRouter initialEntries={["/admin/access"]}>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="/admin/access" element={<AccessPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText(/tenant access/i)).toBeInTheDocument());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/admin/AccessPage.test.tsx`
Expected: FAIL — cannot resolve `./AccessPage`.

- [ ] **Step 3: Create AccessPage**

```tsx
import { ShieldCheck } from "lucide-react";
import AccessGrid from "@/components/admin/AccessGrid";
import { useAdminOutlet } from "@/components/admin/adminContext";

export default function AccessPage() {
  const { reportAccessError } = useAdminOutlet();
  return (
    <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-brand-primary to-brand-accent text-white shadow-sm">
          <ShieldCheck size={22} />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Tenant access</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
            Grant or revoke each tenant Service Principal's access to dashboards and Genie spaces.
          </p>
        </div>
      </div>
      <AccessGrid onAccessError={reportAccessError} />
    </div>
  );
}
```

- [ ] **Step 4: Wire the route in App.tsx**

Add the import near the other admin imports (`import AccessPage from "@/pages/admin/AccessPage";`) and add a route inside the `<Route path={ADMIN_BASE} …>` block (after the `assets` route):

```tsx
<Route path="access" element={<AccessPage />} />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/admin/AccessPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/AccessPage.tsx frontend/src/pages/admin/AccessPage.test.tsx frontend/src/App.tsx
git commit -m "feat(admin): add /admin/access route for the tenant access grid"
```

---

### Task 4: AssetCard component

**Files:**
- Create: `frontend/src/components/admin/AssetCard.tsx`
- Test: `frontend/src/components/admin/AssetCard.test.tsx`

**Interfaces:**
- Consumes: `AssetRow` from `@/lib/adminApi` (`{ asset_key, spec, sort_order, active }`; `spec` has `label`, `dashboardId`, `filters`, `pages`).
- Produces: default-exported `AssetCard` with props:
  `{ asset: AssetRow; writable: boolean; busy: boolean; onEdit: () => void; onAccess: () => void; onToggleActive: () => void; onDelete: () => void }`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AssetCard from "./AssetCard";
import type { AssetRow } from "@/lib/adminApi";

const asset: AssetRow = {
  asset_key: "spend", sort_order: 0, active: true,
  spec: { label: "Spend Analytics", dashboardId: "d1", globalFilterPage: "", filters: { client: "w1" }, pages: [{ pageId: "p1", label: "P1", summaryPrompt: "", suggestions: [] }] },
};

it("renders label, key, meta, and status; fires Edit and Access", () => {
  const onEdit = vi.fn(), onAccess = vi.fn();
  render(<AssetCard asset={asset} writable busy={false} onEdit={onEdit} onAccess={onAccess} onToggleActive={() => {}} onDelete={() => {}} />);
  expect(screen.getByText("Spend Analytics")).toBeInTheDocument();
  expect(screen.getByText(/spend/)).toBeInTheDocument();       // key in meta line
  expect(screen.getByText(/1 page/)).toBeInTheDocument();
  expect(screen.getByText(/active/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /edit/i }));
  fireEvent.click(screen.getByRole("button", { name: /access/i }));
  expect(onEdit).toHaveBeenCalled();
  expect(onAccess).toHaveBeenCalled();
});

it("disables Edit/Delete when not writable", () => {
  render(<AssetCard asset={asset} writable={false} busy={false} onEdit={() => {}} onAccess={() => {}} onToggleActive={() => {}} onDelete={() => {}} />);
  expect(screen.getByRole("button", { name: /edit/i })).toBeDisabled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/admin/AssetCard.test.tsx`
Expected: FAIL — cannot resolve `./AssetCard`.

- [ ] **Step 3: Implement AssetCard**

```tsx
import { LayoutDashboard, Pencil, Trash2, ShieldCheck } from "lucide-react";
import type { AssetRow } from "@/lib/adminApi";

export default function AssetCard({
  asset, writable, busy, onEdit, onAccess, onToggleActive, onDelete,
}: {
  asset: AssetRow; writable: boolean; busy: boolean;
  onEdit: () => void; onAccess: () => void; onToggleActive: () => void; onDelete: () => void;
}) {
  const pageCount = asset.spec.pages?.length ?? 0;
  const filterCount = Object.keys(asset.spec.filters ?? {}).length;
  const meta = `${asset.asset_key} · ${pageCount} page${pageCount === 1 ? "" : "s"} · ${filterCount} filter${filterCount === 1 ? "" : "s"}`;
  return (
    <div className={`rounded-xl border border-brand-border bg-white p-4 shadow-sm ${asset.active ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-brand-primary to-brand-accent text-white">
          <LayoutDashboard size={18} />
        </div>
        <button onClick={onToggleActive} disabled={!writable || busy}
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium disabled:opacity-60 ${asset.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
          {asset.active ? "Active" : "Inactive"}
        </button>
      </div>
      <div className="mt-2.5 text-sm font-semibold text-slate-900">{asset.spec.label}</div>
      <div className="font-mono text-[11px] text-slate-400">{meta}</div>
      <div className="mt-3 flex items-center gap-1.5">
        <button onClick={onEdit} disabled={!writable}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-brand-primary-light px-2 py-1.5 text-xs font-medium text-brand-primary-dark hover:bg-brand-primary hover:text-white disabled:opacity-50">
          <Pencil size={13} /> Edit
        </button>
        <button onClick={onAccess}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-brand-border px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
          <ShieldCheck size={13} /> Access
        </button>
        <button aria-label="Delete asset" onClick={onDelete} disabled={!writable || busy}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 disabled:opacity-40">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/admin/AssetCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/AssetCard.tsx frontend/src/components/admin/AssetCard.test.tsx
git commit -m "feat(admin): AssetCard tile component"
```

---

### Task 5: AssetsPage card grid + stat strip

**Files:**
- Modify: `frontend/src/pages/admin/AssetsPage.tsx:74-171`
- Test: `frontend/src/pages/admin/AssetsPage.test.tsx`

**Interfaces:**
- Consumes: `AssetCard` (Task 4), `ADMIN_ACCESS_PATH` (Task 1), `useNavigate` (react-router-dom).
- Produces: no new exports.

- [ ] **Step 1: Update the tests for the card grid**

The existing three tests in `AssetsPage.test.tsx` still hold (they assert on `getByText("Spend")`, the Add-asset button, the `requires lakebase` notice, and the 401/403 gate — all preserved). Add one grid-specific test and remove the now-defunct "Tenant access" embedded-grid assumption (there is none to assert today, so just add):

```tsx
it("navigates to tenant access when a card's Access button is clicked", async () => {
  vi.spyOn(adminApi, "listAdminAssets").mockResolvedValue({
    writable: true,
    assets: [{ asset_key: "spend", sort_order: 0, active: true, spec: { label: "Spend", dashboardId: "d", globalFilterPage: "", filters: {}, pages: [] } }],
  });
  renderPage();
  await waitFor(() => expect(screen.getByText("Spend")).toBeInTheDocument());
  // Access button exists on the card (navigation asserted via router in integration)
  expect(screen.getByRole("button", { name: /access/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `cd frontend && npx vitest run src/pages/admin/AssetsPage.test.tsx`
Expected: FAIL — no "Access" button yet (table has Edit/Delete icons only). Existing three tests should still pass.

- [ ] **Step 3: Replace the table + access section with the card grid**

In `AssetsPage.tsx`: import `AssetCard`, `useNavigate`, and `ADMIN_ACCESS_PATH`; add `const navigate = useNavigate();`. Replace the `{/* Registry table */}` `<section>` body (the `<table>`, lines ~118-153) with a responsive grid mapping `assets` to `<AssetCard>`, plus a dashed "+ Add asset" tile calling `setEditing("create")`. Keep the header, `error` banner, `!writable` amber notice, loading/empty states, and the `<AssetEditor>` mount. **Delete** the `{/* Access grid */}` `<section>` (lines 156-160) and the `AccessGrid` import — that view now lives at `/admin/access`. Add a stat strip above the grid:

```tsx
const activeCount = assets.filter((a) => a.active).length;
const pageCount = assets.reduce((n, a) => n + (a.spec.pages?.length ?? 0), 0);
```

Wire card callbacks: `onEdit={() => setEditing(a)}`, `onAccess={() => navigate(ADMIN_ACCESS_PATH)}`, `onToggleActive={() => onToggleActive(a)}`, `onDelete={() => onDelete(a)}`, `busy={busyKey === a.asset_key}`, `writable={writable}`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/pages/admin/AssetsPage.test.tsx`
Expected: PASS (all four tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/AssetsPage.tsx frontend/src/pages/admin/AssetsPage.test.tsx
git commit -m "feat(admin): Assets card grid + stat strip; move access grid out"
```

---

### Task 6: Sectioned AssetEditor

**Files:**
- Modify: `frontend/src/components/admin/AssetEditor.tsx:177-362`
- Test: `frontend/src/components/admin/AssetEditor.test.tsx`

**Interfaces:**
- Consumes: unchanged props (`initial`, `existingKeys`, `onSave`, `onClose`). Produces: no signature change.

- [ ] **Step 1: Confirm existing tests are the contract**

Run: `cd frontend && npx vitest run src/components/admin/AssetEditor.test.tsx`
Expected: PASS today. These tests (save payload, guards, field `aria-label`s) MUST stay green — Task 6 only regroups the DOM, it does not change field labels or `handleSave`.

- [ ] **Step 2: Add a jump-nav + section test**

```tsx
it("shows section headings and a jump-nav", () => {
  render(<AssetEditor initial={null} existingKeys={[]} onSave={async () => {}} onClose={() => {}} />);
  for (const s of ["Basics", "Data", "Navigation", "Filters", "Pages"]) {
    expect(screen.getAllByText(new RegExp(`^${s}$`, "i")).length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/admin/AssetEditor.test.tsx`
Expected: FAIL — section headings not present as distinct elements yet.

- [ ] **Step 4: Regroup the body into labeled sections**

Wrap the existing field groups (do not change any field, `aria-label`, or handler) in five titled `<section>`s, each with an `id` and an `<h3>`/`<span class="…">` heading: **Basics** (asset key, label), **Data** (dashboard picker, global filter page, workspace, org), **Navigation** (the existing nav checkbox block), **Filters** (the existing filter rows), **Pages** (the existing pages block). Add a jump-nav column (sticky list of anchor buttons that `scrollIntoView` or set focus to each section) alongside the form inside the `Modal`. Keep `maxWidthClass="max-w-2xl"` or widen to `max-w-3xl` to fit the jump-nav.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/admin/AssetEditor.test.tsx`
Expected: PASS (existing tests + the new section test).

- [ ] **Step 6: Full frontend test run + commit**

Run: `cd frontend && npx vitest run`
Expected: PASS (whole suite).

```bash
git add frontend/src/components/admin/AssetEditor.tsx frontend/src/components/admin/AssetEditor.test.tsx
git commit -m "feat(admin): sectioned AssetEditor with jump-nav"
```

---

## Self-Review

**Spec coverage:**
- Nav → context-aware sidebar, no top tabs → Task 1 (sidebar) + Task 2 (remove tabs). ✓
- Assets card grid + stat strip → Task 4 (card) + Task 5 (grid). ✓
- Tenant access moved to own route → Task 3. ✓
- Sectioned editor → Task 6. ✓
- Invariants (operator-only, fail-soft, no API change) → Global Constraints + preserved in Tasks 1/5/6. ✓
- Open question 3 (per-asset Access = navigate to matrix first pass) → Task 5 `onAccess` navigates to `ADMIN_ACCESS_PATH`. ✓
- Open questions 1 (admin entry affordance) and 2 (standalone Activity) → deferred by spec; not implemented here. Admin entry: the sidebar's operator "Administration" access point is removed from the analytics view in Task 1; a dedicated entry affordance (gear) is a follow-up — **flagged, not silently dropped.**

**Placeholder scan:** No TBD/TODO; all code steps carry real code. ✓

**Type consistency:** `AssetCard` prop names (`writable`, `busy`, `onEdit`, `onAccess`, `onToggleActive`, `onDelete`) match Task 5's usage; `ADMIN_ACCESS_PATH` defined in Task 1, consumed in Tasks 3 & 5; `AssetRow` shape matches `adminApi`. ✓

## Follow-ups (out of scope here)
- Dedicated operator **admin entry affordance** (gear in sidebar footer / header) — open question 1.
- Standalone **Activity** route — open question 2.
- Per-asset **Access panel** (single-asset scoped grid) — open question 3 enhancement.
