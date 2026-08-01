# Prism Phase 5 (Admin) — Admin Area Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the entire admin area (`frontend/src/pages/admin/**` + `frontend/src/components/admin/**`, 18 files) onto canonical DuBois — replacing raw Tailwind palette colors (`slate-*`, `rose-*`, `emerald-*`, `amber-*`) and `brand-*` aliases with canonical DuBois tokens, tightening radii to 4px/8px, and using the DuBois shadow scale — while preserving ALL admin CRUD/data/audit/dialog behavior. Keep the hand-rolled `Modal`/`Drawer` (color+radii reskin only, NOT a migration to `ui/dialog`).

**Architecture:** One plan, four dependency-ordered tasks. The whole reskin is governed by ONE canonical mapping table (below) applied consistently. (1) **Shared foundation** — `shared.tsx` (Modal, Drawer, Spinner, CopyButton, TenantStatusBadge, AuditStatusBadge), because every dialog + table depends on it. (2) **Tables** — TenantTable, UsersTable, AccessGrid. (3) **Dialogs** — ConfirmDialog, OnboardDialog, UserDialog, VerifyModal, AssetEditor (all route through the reskinned Modal). (4) **Pages + small components** — AdminLayout, AssetsPage, AccessPage, TenantsPage, StatCard, AssetCard, ActivityFeed, HistoryDrawer, SecretAlert. Each task ends green + reviewed; each is a pure presentation change.

**Tech Stack:** Vite 7 + React 19 + React Router 7, Tailwind v4 canonical DuBois tokens (Phase 2 `index.css`), our vendored `Button`/`Badge` primitives, lucide-react, Vitest 3.

## Global Constraints

- **Frontend-only.** No backend / `app.py` / `/api/*` change.
- **KEEP all feature logic, swap presentation only** (spec §Phase 5): every hook, fetch, CRUD handler, audit-polling loop, 401/403 gate, dialog open/close state, form submit, toggle/switch logic, `createPortal` usage, and `Button` `variant`/`onClick` props stay byte-identical. ONLY `className` strings (and the shared `inputCls`/`labelCls` constants) change.
- **THE CANONICAL MAPPING (apply everywhere, every task):**

  | Current (raw / alias) | → Canonical DuBois |
  |---|---|
  | `bg-white` (card/surface) | `bg-background` |
  | `bg-slate-50` (page/subtle bg, footer) | `bg-secondary` |
  | `bg-slate-100` (count-badge/hover fill) | `bg-muted` |
  | `bg-slate-300` (toggle off) | `bg-input` |
  | `bg-slate-400` (inactive dot) | `bg-muted-foreground` |
  | `text-slate-900` / `-800` (headings) | `text-foreground` |
  | `text-slate-700` (body strong) | `text-foreground` |
  | `text-slate-600` / `-500` (body/muted) | `text-muted-foreground` |
  | `text-slate-400` / `-300` (faint/placeholder) | `text-muted-foreground` |
  | `border-slate-200` / `-100` / `-50` | `border-border` |
  | `divide-slate-50` / `-100` | `divide-border` |
  | `hover:bg-slate-50` / `-100` | `hover:bg-[var(--action-default-bg-hover)]` |
  | `border-brand-border` | `border-border` |
  | `bg-brand-primary` / `text-white` CTA | `bg-primary` / `text-primary-foreground` |
  | `hover:bg-brand-primary-dark` | `hover:bg-blue-700` |
  | `text-brand-primary` / `text-brand-accent` | `text-primary` |
  | `text-brand-primary-dark` | `text-blue-700` |
  | `bg-brand-primary-light` (tint) | `bg-primary/10` |
  | `border-brand-primary-light` | `border-primary/30` |
  | `bg-linear-to-br from-brand-primary to-brand-accent` (icon tiles) | `bg-primary` (flat — matches PageHeader avatar) |
  | `focus:ring-brand-accent` / `focus:border-brand-accent` | `focus:ring-ring` / `focus:border-ring` |
  | **rose** (danger): `text-rose-700`/`-600` | `text-destructive` |
  | `bg-rose-50` | `bg-[var(--background-danger)]` |
  | `border-rose-200` | `border-[var(--border-danger)]` |
  | `bg-rose-600 hover:bg-rose-700` (danger btn) | `bg-destructive hover:bg-red-700` |
  | `bg-rose-100 text-rose-700` (fail badge) | `bg-[var(--background-danger)] text-destructive` |
  | `hover:bg-rose-50` (danger menu item) | `hover:bg-[var(--background-danger)]` |
  | `text-rose-500` (danger icon) | `text-destructive` |
  | **emerald** (success): `text-emerald-700`/`-600` | `text-[var(--success)]` |
  | `bg-emerald-50` | `bg-[var(--background-success)]` |
  | `border-emerald-200` | `border-[var(--border-success)]` |
  | `bg-emerald-100 text-emerald-700` (pass badge) | `bg-[var(--background-success)] text-[var(--success)]` |
  | `bg-emerald-500` (dot) / `text-emerald-500` (icon) | `bg-[var(--success)]` / `text-[var(--success)]` |
  | `hover:bg-emerald-50` (menu item) | `hover:bg-[var(--background-success)]` |
  | `bg-emerald-700 text-white` (SecretAlert CTA) | `bg-[var(--success)] text-white hover:bg-green-700` |
  | **amber** (warning): `text-amber-800`/`-700` | `text-[var(--warning)]` |
  | `bg-amber-50` | `bg-[var(--background-warning)]` |
  | `border-amber-200` | `border-[var(--border-warning)]` |
  | `text-amber-500` (icon) | `text-[var(--warning)]` |
  | `hover:bg-amber-50` (menu item) | `hover:bg-[var(--background-warning)]` |
  | `rounded-2xl` (cards/modals) | `rounded-md` (8px) |
  | `rounded-xl` (icon tiles/tables/menus) | `rounded-md` (8px containers) or `rounded` (4px small) — see per-task |
  | `rounded-lg` (inputs/buttons/badges/error boxes) | `rounded` (4px) |
  | `rounded-md` (small controls) | keep (already 4px in DuBois via `--radius`) |
  | `rounded-full` (pills/dots/toggles) | keep |
  | `shadow-sm` | `shadow-[var(--shadow-db-sm)]` |
  | `shadow-lg` (dropdown) | `shadow-[var(--shadow-db-lg)]` |
  | `shadow-2xl` (modal) | `shadow-[var(--shadow-db-xl)]` |
  | `bg-black/40 backdrop-blur-sm` (modal overlay) | `bg-black/50` (canonical DuBois modal scrim — matches kit dialog/sheet) |
  | `text-white` on primary/success/danger fills | keep `text-white` (or `text-primary-foreground` on `bg-primary`) |
  | `font-mono` (IDs/codes) | keep |

  All these tokens exist in `frontend/src/index.css` (verified): `--background`, `--secondary`, `--muted`, `--muted-foreground`, `--input`, `--foreground`, `--border`, `--primary`, `--primary-foreground`, `--destructive`, `--success`, `--warning`, `--background-danger/success/warning`, `--border-danger/success/warning`, `--action-default-bg-hover`, `--shadow-db-sm/lg/xl`, `--color-blue-700/red-700/green-700`, `bg-primary/10`.
- **Alias/raw-free end state:** after each task, its files must reference NONE of: `slate-`, `rose-`, `emerald-`, `amber-`, `brand-` (except `--accent-gradient` if any — none expected in admin), `bg-surface`, `text-fg`, `-fg-`, `rounded-2xl`, `rounded-xl`, `shadow-sm`/`shadow-lg`/`shadow-2xl` (bare). (`text-primary`/`bg-primary`/`bg-background`/etc. are canonical.)
- **Button variants unchanged** — admin already uses `variant="default"` (bordered) for Cancel/secondary and bare (filled primary) for CTAs from earlier phases; keep those, only migrate the `className` color OVERRIDES on them (e.g. `text-brand-primary border-brand-primary-light` → `text-primary border-primary/30`).
- **No admin test asserts styling tokens** (verified) — so NO test changes expected. If `npm test` flags one, reconcile minimally.
- **Each task ends green:** `cd frontend && npm test && npm run build` both pass; then a per-task alias/raw-free grep. A single live Chrome check (light + dark) covers the whole admin area at the END (Task 4), since tasks 1–3 aren't independently reachable in the UI without the pages.
- Push to `feature/apex-theming`, no PRs.

---

## File Structure

**Modified (18 files across 4 tasks), no creates/deletes:**
- Task 1: `components/admin/shared.tsx`
- Task 2: `components/admin/{TenantTable,UsersTable,AccessGrid}.tsx`
- Task 3: `components/admin/{ConfirmDialog,OnboardDialog,UserDialog,VerifyModal,AssetEditor}.tsx`
- Task 4: `pages/admin/{AdminLayout,AssetsPage,AccessPage,TenantsPage}.tsx`, `components/admin/{StatCard,AssetCard,ActivityFeed,HistoryDrawer,SecretAlert}.tsx`

**Untouched:** all admin logic, `adminContext.ts` (constants/hook, no styling), tests (unless a token assertion surfaces — none known), the rest of the app.

---

### Task 1: shared.tsx foundation (Modal, Drawer, badges, Spinner, CopyButton)

Reskin the shared primitives every admin dialog/table renders through. Apply the mapping table to `shared.tsx`.

**Files:** Modify `frontend/src/components/admin/shared.tsx`.

**Interfaces:** Consumes canonical tokens. Produces the same exported components (`Modal`, `Drawer`, `Spinner`, `CopyButton`, `TenantStatusBadge`, `AuditStatusBadge`, `relativeTime`, etc.) with identical props/signatures — only their internal `className`s change.

- [ ] **Step 1: Reskin `Modal` + `Drawer` (the portal shells).**
  - Overlay (both): `bg-black/40 backdrop-blur-sm` → `bg-black/50` (canonical modal scrim; drop the blur to match the kit's dialog/sheet). Keep `fixed inset-0 z-50 …` layout + `createPortal(..., document.body)` + `onClick={onClose}` + `stopPropagation` UNCHANGED.
  - Card: `rounded-2xl shadow-2xl bg-white` → `rounded-md shadow-[var(--shadow-db-xl)] bg-background`. Keep `max-h-[85vh] flex flex-col overflow-hidden` + `role="dialog" aria-modal="true"`.
  - Header: `border-b border-slate-100` → `border-b border-border`; icon tile `rounded-xl bg-brand-primary-light text-brand-primary` → `rounded-md bg-primary/10 text-primary`; title `text-slate-900` → `text-foreground`; subtitle `text-slate-500` → `text-muted-foreground`; close button `text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg` → `text-muted-foreground hover:text-foreground hover:bg-[var(--action-default-bg-hover)] rounded`.
  - Footer: `border-t border-slate-100 bg-slate-50` → `border-t border-border bg-secondary`.
  - Body: `flex-1 overflow-y-auto px-5 py-5` — unchanged (no color).
  - Spinner (`text-brand-accent`) → `text-primary`. Keep `animate-spin` + SVG.
  - CopyButton: `text-slate-400 hover:bg-slate-100 hover:text-slate-600` → `text-muted-foreground hover:bg-[var(--action-default-bg-hover)] hover:text-foreground`; copied check `text-emerald-500` → `text-[var(--success)]`; `rounded-md` keep.

- [ ] **Step 2: Reskin the status badges.**
  - `TenantStatusBadge`: active `bg-emerald-50 text-emerald-700 border border-emerald-200` + dot `bg-emerald-500` → `bg-[var(--background-success)] text-[var(--success)] border border-[var(--border-success)]` + dot `bg-[var(--success)]`; inactive `bg-slate-100 text-slate-600 border border-slate-200` + dot `bg-slate-400` → `bg-muted text-muted-foreground border border-border` + dot `bg-muted-foreground`.
  - `AuditStatusBadge`: OK → success tokens (as above); failed `bg-rose-50 text-rose-700 border border-rose-200` → `bg-[var(--background-danger)] text-destructive border border-[var(--border-danger)]`; default → `bg-muted text-muted-foreground border border-border`.

- [ ] **Step 3: Alias/raw-free grep on shared.tsx.**
```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -nE "slate-|rose-|emerald-|amber-|brand-|rounded-2xl|rounded-xl|shadow-sm|shadow-lg|shadow-2xl|backdrop-blur" src/components/admin/shared.tsx
```
Expected: ZERO matches. (The `Drawer` uses `bg-white shadow-2xl` too — make sure both portal shells are done.)

- [ ] **Step 4: Tests + build.** `cd frontend && npm test` and `cd frontend && npm run build` — both green.

- [ ] **Step 5: Commit.**
```bash
git add frontend/src/components/admin/shared.tsx
git commit -m "feat(admin): reskin shared Modal/Drawer/badges/Spinner to canonical DuBois

Co-authored-by: Isaac"
```

---

### Task 2: Admin tables (TenantTable, UsersTable, AccessGrid)

Apply the mapping table to the three tables. These are the largest raw-color consumers (headers, rows, hover, count badges, row-action dropdown, toggle switches, empty/loading/error states, role badges).

**Files:** Modify `components/admin/{TenantTable,UsersTable,AccessGrid}.tsx`.

**Interfaces:** Consumes reskinned `shared.tsx` (Task 1) + canonical tokens. Same component props/exports.

- [ ] **Step 1: TenantTable.tsx** — apply the mapping to: container (`rounded-2xl border-slate-200 bg-white shadow-sm`→`rounded-md border-border bg-background shadow-[var(--shadow-db-sm)]`), header/title/count-badge, the "Verify isolation" button className override (`text-brand-primary border-brand-primary-light hover:bg-brand-primary-light hover:text-brand-primary-dark`→`text-primary border-primary/30 hover:bg-primary/10 hover:text-blue-700`), table head (`text-slate-400`→`text-muted-foreground`), `divide-slate-50`→`divide-border`, row hover (`hover:bg-slate-50/60`→`hover:bg-[var(--action-default-bg-hover)]`), cell text (`text-slate-900/700/500/400`→`text-foreground`/`text-muted-foreground` per hierarchy), the "Manage access" button override, RowActions dropdown (`rounded-md text-slate-500 hover:bg-slate-100`→`rounded text-muted-foreground hover:bg-[var(--action-default-bg-hover)]`; menu `rounded-xl border-slate-200 bg-white shadow-lg`→`rounded-md border-border bg-background shadow-[var(--shadow-db-lg)]`; items slate→foreground/muted, the amber Deactivate + emerald Reactivate + rose Delete menu items → warning/success/destructive tokens, divider `bg-slate-100`→`bg-border`), and EmptyState (icon tile `rounded-2xl bg-brand-primary-light`→`rounded-md bg-primary/10`, `text-brand-accent`→`text-primary`, `text-slate-800/500`→`text-foreground`/`text-muted-foreground`).

- [ ] **Step 2: UsersTable.tsx** — same container/header/table patterns; the amber "not-writable" warning box (`border-amber-200 bg-amber-50 text-amber-800`→`border-[var(--border-warning)] bg-[var(--background-warning)] text-[var(--warning)]`); role badge operator (`bg-brand-primary-light text-brand-accent`→`bg-primary/10 text-primary`) / user (`bg-slate-100 text-slate-600`→`bg-muted text-muted-foreground`); the delete button override (`text-rose-700 border-rose-200 hover:bg-rose-50`→`text-destructive border-[var(--border-danger)] hover:bg-[var(--background-danger)]`); "No login users" / loading / error states.

- [ ] **Step 3: AccessGrid.tsx** — loading/error/empty states (rose error box, dashed `border-brand-border`→`border-border`, `text-slate-400`); table wrapper `rounded-xl border-brand-border`→`rounded-md border-border`; head `bg-slate-50 text-slate-500`→`bg-secondary text-muted-foreground`; `divide-slate-100`→`divide-border`; cell text; the toggle switch ON `bg-brand-primary`→`bg-primary`, OFF `bg-slate-300`→`bg-input`, knob `bg-white`→keep (`bg-background`); footer note `text-slate-400`→`text-muted-foreground`. Keep `role="switch"`/`aria-checked`/`aria-label`/toggle logic byte-identical.

- [ ] **Step 4: Alias/raw-free grep on all three.**
```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -nE "slate-|rose-|emerald-|amber-|brand-|rounded-2xl|rounded-xl|shadow-sm|shadow-lg|shadow-2xl" src/components/admin/TenantTable.tsx src/components/admin/UsersTable.tsx src/components/admin/AccessGrid.tsx
```
Expected: ZERO matches.

- [ ] **Step 5: Tests + build.** Both green.

- [ ] **Step 6: Commit.**
```bash
git add frontend/src/components/admin/TenantTable.tsx frontend/src/components/admin/UsersTable.tsx frontend/src/components/admin/AccessGrid.tsx
git commit -m "feat(admin): reskin tenant/users/access tables to canonical DuBois

Co-authored-by: Isaac"
```

---

### Task 3: Admin dialogs (Confirm, Onboard, User, Verify, AssetEditor)

Apply the mapping to the five dialog bodies (they render through the Task-1 Modal). Focus: the shared `inputCls`/`labelCls` constants, error/success/warning callout boxes, VerifyModal pass/fail tiles + badges, AssetEditor form/nav, ConfirmDialog danger button.

**Files:** Modify `components/admin/{ConfirmDialog,OnboardDialog,UserDialog,VerifyModal,AssetEditor}.tsx`.

**Interfaces:** Consumes reskinned Modal + canonical tokens. Same props/exports.

- [ ] **Step 1: ConfirmDialog.tsx** — icon `text-rose-600`(danger)/`text-brand-primary`→`text-destructive`/`text-primary`; danger confirm button `bg-rose-600 hover:bg-rose-700`→`bg-destructive hover:bg-red-700`; message `text-slate-600`→`text-muted-foreground`; error box `rounded-lg border-rose-200 bg-rose-50 text-rose-700`→`rounded border-[var(--border-danger)] bg-[var(--background-danger)] text-destructive`.

- [ ] **Step 2: OnboardDialog.tsx + UserDialog.tsx (shared input pattern).** Both define:
  ```
  labelCls = "block text-xs font-semibold text-slate-700 mb-1.5"
  inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-colors"
  ```
  → replace with:
  ```
  labelCls = "block text-xs font-semibold text-foreground mb-1.5"
  inputCls = "w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-[var(--shadow-db-xs)] focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
  ```
  Then apply the mapping to the rest of each file: OnboardDialog's emerald confirmation card (`border-emerald-200 bg-emerald-50` + emerald text → success tokens), amber "no clients" warning → warning tokens, readOnly tenant-id field (`bg-slate-50 text-slate-600`→`bg-secondary text-muted-foreground`), the `text-brand-primary hover:text-brand-primary-dark` links → `text-primary hover:text-blue-700`, rose error boxes → danger tokens, ChevronDown `text-slate-400`→`text-muted-foreground`. UserDialog: same input/label, role/tenant selects, readOnly tenant-id, rose error box.

- [ ] **Step 3: VerifyModal.tsx** — pass/fail tiles (`border-emerald-200 bg-emerald-50/50`→`border-[var(--border-success)] bg-[var(--background-success)]`; `border-rose-200 bg-rose-50/50`→`border-[var(--border-danger)] bg-[var(--background-danger)]`); status badges (pass `bg-emerald-100 text-emerald-700`→`bg-[var(--background-success)] text-[var(--success)]`; fail `bg-rose-100 text-rose-700`→`bg-[var(--background-danger)] text-destructive`); rounded-xl→rounded-md on tiles; detail text slate→foreground/muted; error detail `bg-rose-100/70 text-rose-700`→`bg-[var(--background-danger)] text-destructive`; loading/error states.

- [ ] **Step 4: AssetEditor.tsx** — footer Cancel (`text-slate-600 hover:bg-slate-100`→`text-muted-foreground hover:bg-[var(--action-default-bg-hover)]`) + Save (`bg-brand-primary hover:bg-brand-primary-dark`→`bg-primary hover:bg-blue-700`); jump-nav buttons (`text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-brand-primary`→`text-muted-foreground hover:bg-[var(--action-default-bg-hover)] hover:text-foreground focus-visible:ring-ring`); section headings `text-slate-700`→`text-foreground`; inputs (`rounded-md border-brand-border bg-white`→`rounded border-input bg-background`); section containers (`rounded-lg border-brand-border p-3`→`rounded-md border-border p-3`); `text-brand-primary hover:text-brand-primary-dark` add/remove links → `text-primary hover:text-blue-700`; `text-slate-400 hover:bg-slate-100 hover:text-rose-500` remove buttons → `text-muted-foreground hover:bg-[var(--action-default-bg-hover)] hover:text-destructive`; rose error box → danger tokens; uppercase field labels `text-slate-500`→`text-muted-foreground`.

- [ ] **Step 5: Alias/raw-free grep on all five dialogs.**
```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -nE "slate-|rose-|emerald-|amber-|brand-|rounded-2xl|rounded-xl|shadow-sm|shadow-lg|shadow-2xl" src/components/admin/ConfirmDialog.tsx src/components/admin/OnboardDialog.tsx src/components/admin/UserDialog.tsx src/components/admin/VerifyModal.tsx src/components/admin/AssetEditor.tsx
```
Expected: ZERO matches.

- [ ] **Step 6: Tests + build.** Both green (AssetEditor.test.tsx is behavioral — should stay green).

- [ ] **Step 7: Commit.**
```bash
git add frontend/src/components/admin/ConfirmDialog.tsx frontend/src/components/admin/OnboardDialog.tsx frontend/src/components/admin/UserDialog.tsx frontend/src/components/admin/VerifyModal.tsx frontend/src/components/admin/AssetEditor.tsx
git commit -m "feat(admin): reskin admin dialogs (confirm/onboard/user/verify/asset-editor) to canonical DuBois

Co-authored-by: Isaac"
```

---

### Task 4: Admin pages + small components (+ whole-area live check)

Apply the mapping to the pages and the remaining small components, then do the single whole-admin live check (light + dark) since this task makes the area fully renderable.

**Files:** Modify `pages/admin/{AdminLayout,AssetsPage,AccessPage,TenantsPage}.tsx`, `components/admin/{StatCard,AssetCard,ActivityFeed,HistoryDrawer,SecretAlert}.tsx`.

**Interfaces:** Consumes reskinned tables/dialogs/shared + canonical tokens. Same props/exports.

- [ ] **Step 1: AdminLayout.tsx** — container `bg-slate-50`→`bg-secondary`; AccessGate: card `rounded-2xl border-brand-border bg-white shadow-sm`→`rounded-md border-border bg-background shadow-[var(--shadow-db-sm)]`, icon tile `rounded-2xl bg-brand-primary-light`→`rounded-md bg-primary/10`, `text-brand-accent`→`text-primary`, `text-rose-500`→`text-destructive`, headings/body slate→foreground/muted, sign-in link `bg-brand-primary hover:bg-brand-primary-dark`→`bg-primary hover:bg-blue-700`, `rounded-md` keep. Keep the 401/403 logic + `<Outlet context={ctx}/>` UNCHANGED.

- [ ] **Step 2: The 3 pages (AssetsPage, AccessPage, TenantsPage)** — the shared header pattern in all three: icon tile `rounded-xl bg-linear-to-br from-brand-primary to-brand-accent text-white`→`rounded-md bg-primary text-primary-foreground`; title `text-slate-900`→`text-foreground`; subtitle `text-slate-500`→`text-muted-foreground`. Then AssetsPage: Refresh/secondary buttons (`border-brand-border bg-white text-slate-600 hover:bg-slate-50`→`border-border bg-background text-muted-foreground hover:bg-[var(--action-default-bg-hover)]`), "Add asset" primary button, error box (rose→danger), stat strip (`border-brand-border bg-slate-50`→`border-border bg-secondary`), section heading `text-slate-500`→`text-muted-foreground`, dashed add tile (`rounded-xl border-dashed border-brand-border text-slate-400 hover:border-brand-primary hover:text-brand-primary`→`rounded-md border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary`), amber not-writable box→warning tokens, card grid wrapper `rounded-xl border-brand-border bg-white shadow-sm`→`rounded-md border-border bg-background shadow-[var(--shadow-db-sm)]`. TenantsPage: header + Refresh button (`border-slate-200`→`border-border`, etc.); the StatCard `accent="emerald"` prop stays (StatCard reskinned in Step 3).

- [ ] **Step 3: StatCard.tsx** — accent variants: `bg-brand-primary-light text-brand-primary`→`bg-primary/10 text-primary`; `bg-emerald-50 text-emerald-600`→`bg-[var(--background-success)] text-[var(--success)]`; `bg-slate-100 text-slate-500`→`bg-muted text-muted-foreground`. Card `rounded-xl border-slate-200 bg-white shadow-sm`→`rounded-md border-border bg-background shadow-[var(--shadow-db-sm)]`; label/value text slate→muted-foreground/foreground. (The `accent` prop VALUES — "emerald"/"primary"/"slate" — are logic; keep them, just remap what each renders.)

- [ ] **Step 4: AssetCard.tsx** — card `rounded-xl border-brand-border bg-white p-4 shadow-sm`→`rounded-md border-border bg-background p-4 shadow-[var(--shadow-db-sm)]`; icon tile gradient→`bg-primary text-primary-foreground` (keep `rounded` per size, use `rounded`); nav badge (`bg-emerald-50 text-emerald-600`/`bg-slate-100 text-slate-500`→success/muted tokens); title/desc slate→foreground/muted; edit button (`bg-brand-primary-light text-brand-primary-dark hover:bg-brand-primary hover:text-white`→`bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground`); delete button (`text-slate-400 hover:bg-slate-100 hover:text-rose-500`→`text-muted-foreground hover:bg-[var(--action-default-bg-hover)] hover:text-destructive`); the bordered secondary button.

- [ ] **Step 5: ActivityFeed.tsx** — card container/header (rounded-2xl→rounded-md, slate borders/text → canonical), `text-brand-accent`→`text-primary`, rose error box→danger, row hover `hover:bg-slate-50/70`→`hover:bg-[var(--action-default-bg-hover)]`, timeline dot `rounded-full bg-brand-primary-light`→`bg-primary/10`, slate text→foreground/muted. (Renders `AuditStatusBadge` from shared — already done.)

- [ ] **Step 6: HistoryDrawer.tsx** — renders through the reskinned `Drawer`; body: `text-slate-400`, rose error box→danger, timeline `border-l border-slate-200`→`border-l border-border`, dot `rounded-full border-2 border-white bg-brand-accent`→`border-2 border-background bg-primary`, slate text→foreground/muted, `rounded-md bg-slate-50 text-slate-600`→`rounded bg-secondary text-muted-foreground`.

- [ ] **Step 7: SecretAlert.tsx** — the dual-tone panel (green for onboard / indigo→primary for rotate). Onboard tone: `border-emerald-200 bg-emerald-50` + emerald text/icons → success tokens (`border-[var(--border-success)] bg-[var(--background-success)]`, `text-[var(--success)]`); the emerald CTA `bg-emerald-700 text-white hover:bg-emerald-800`→`bg-[var(--success)] text-white hover:bg-green-700`. Rotate tone: `border-brand-primary-light bg-brand-primary-light` + `text-brand-primary/dark/accent` → `border-primary/30 bg-primary/10` + `text-primary`/`text-blue-700`. Inner value box `bg-white/70 border-white`→`bg-background/70 border-border`; `text-slate-800`→`text-foreground`; radii rounded-xl→rounded-md, rounded-lg→rounded. Keep the onboard-vs-rotate conditional logic byte-identical.

- [ ] **Step 8: Alias/raw-free grep across all Task-4 files.**
```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -nE "slate-|rose-|emerald-|amber-|brand-|rounded-2xl|rounded-xl|shadow-sm|shadow-lg|shadow-2xl|bg-linear" src/pages/admin/*.tsx src/components/admin/StatCard.tsx src/components/admin/AssetCard.tsx src/components/admin/ActivityFeed.tsx src/components/admin/HistoryDrawer.tsx src/components/admin/SecretAlert.tsx
```
Expected: ZERO matches. Then a WHOLE-ADMIN sweep to confirm the entire area is clean:
```bash
grep -rnE "slate-|rose-|emerald-|amber-|brand-|rounded-2xl|rounded-xl|bg-linear|shadow-2xl" src/pages/admin src/components/admin --include=*.tsx | grep -v ".test."
```
Expected: ZERO matches (whole admin area raw/alias-free).

- [ ] **Step 9: Tests + build.** `cd frontend && npm test` + `cd frontend && npm run build` — both green.

- [ ] **Step 10: Whole-admin live check (light + dark).**
`cd frontend && npm run dev`, Chrome. Log in as an OPERATOR (e.g. `dana@apex.example` / `apex`) so the admin nav + pages are reachable; backend on :8000 for data (fail-soft shows empty/loading, still inspectable). Navigate `/admin/assets`, `/admin/access`, `/admin/tenants`. Verify in BOTH light and dark:
  - Page headers: blue `#2272b4` icon tiles (flat, not gradient), dark `#161616` semibold titles.
  - Tables: white cards on the light chrome, canonical borders, muted-grey column headers, hover-tint rows; status badges (Active = DuBois green, Deactivated = grey); role badges (operator = blue tint); row-action dropdown opens with success/warning/destructive menu items in DuBois greens/oranges/reds.
  - Toggles (AccessGrid): ON = DuBois blue, OFF = neutral.
  - Dialogs: open Onboard / Add user / Verify / a ConfirmDialog / AssetEditor — modal scrim dims, card is white `rounded-md`, inputs have grey border + blue focus ring, error boxes are DuBois red, success/warning callouts are DuBois green/orange, danger confirm button is DuBois red, Cancel is bordered. Drawer (View history) slides in reskinned.
  - StatCards, SecretAlert (trigger onboard → green panel), AssetCards.
  - Dark mode: every surface/text/border/badge/dialog themes correctly and stays legible; no stray slate/white/indigo, no light-on-light. Modal scrim still dims.
  - Console: no unknown-CSS/token errors (ignore /api 401s).

- [ ] **Step 11: Commit.**
```bash
git add frontend/src/pages/admin frontend/src/components/admin/StatCard.tsx frontend/src/components/admin/AssetCard.tsx frontend/src/components/admin/ActivityFeed.tsx frontend/src/components/admin/HistoryDrawer.tsx frontend/src/components/admin/SecretAlert.tsx
git commit -m "feat(admin): reskin admin pages + stat/asset/activity/history/secret components to canonical DuBois

Co-authored-by: Isaac"
```

---

## Self-Review

**Spec coverage (Phase 5 = pages reskinned; this plan = Admin):**
- "Rebuild admin on DuBois — KEEP feature logic, swap presentation" → all 4 tasks are className-only; every hook/CRUD/audit/dialog/toggle handler untouched. ✅
- Canonical DuBois (blue #2272b4, warm neutrals, semantic success/danger/warning, 4/8px radii, DuBois shadow scale, canonical modal scrim) → the mapping table + per-task application. ✅
- Advances raw-color + alias elimination → per-task greps + the whole-admin sweep (Task 4 Step 8). ✅

**Dependency order sound:** shared.tsx (Modal/badges everything renders through) → tables → dialogs (render through Modal) → pages+small (render tables/dialogs/StatCard). Each task's consumers are reskinned before/independently; no task depends on a later one's visuals.

**Type/contract consistency:** no signatures change; `inputCls`/`labelCls` stay string constants; `Button` variants + `accent` props preserved (only what they RENDER remaps). Modal/Drawer keep `createPortal`, `role`, `aria-*`, `onClick`/`stopPropagation`.

**Placeholder scan:** The mapping table IS the concrete content (every raw/alias token → its exact canonical replacement); per-task steps name each file's specific non-mechanical spots (icon tiles→bg-primary, status badges→semantic tokens, danger button→bg-destructive, modal scrim→bg-black/50). Not placeholders — a lookup table + targeted callouts. This is the right altitude for a 3,580-line mechanical token migration; quoting all ~250 individual line edits would bloat the plan and the blast-radius report already enumerates them by file:line.

**Risk notes:** (a) The one behavioral-adjacent change is the modal overlay `bg-black/40 backdrop-blur-sm`→`bg-black/50` (drops the blur) — deliberate, matches canonical DuBois dialog/sheet; verify visually in Task 4. (b) `bg-primary/10` tints + `border-primary/30` are Tailwind opacity modifiers on the canonical primary — used already in the Sidebar/nav, resolve fine. (c) No test asserts admin styling (verified), so no test churn expected; if one surfaces, reconcile in that task. (d) Large surface → sliced into 4 reviewable tasks precisely to keep each diff scannable.
