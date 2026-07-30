# Full-Width Top Bar (Modular Shell) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the APEX app shell so the top bar spans the entire page width at the top (brand in its top-left, dark L-shape continuous with the sidebar rail) and the sidebar starts below it — built from small, reusable `shell/*` components.

**Architecture:** Decompose the bar into focused components under `frontend/src/components/shell/` (`Breadcrumb`, `ClientBadge`, `UserMenu`, `BrandBlock`, `TopBar`), each with a clean prop interface. Then flip `App.tsx` from a row layout `[Sidebar | (Header + body)]` to a column `[TopBar] / [Sidebar | main]`, slim `Sidebar.tsx` to pure nav, and retire `Header.tsx`. Pure layout + markup relocation — no behavior/routing/data change.

**Tech Stack:** React 19 + TS, react-router-dom, Tailwind v4 (Phase-0 `surface-*`/`fg-*`/`accent*`/`border-*` + `var(--fill-*)`, state `var(--danger|warning|success)`, legacy `--brand-sidebar-*` for the dark rail), Vitest 3 + @testing-library/react.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-30-full-width-topbar-design.md`. Four locked decisions: (1) brand zone width tracks the sidebar (224px ↔ 60px); (2) collapse toggle lives in the brand block; (3) client badge moves into the top bar's right cluster; (4) dark L-shape — the dark gradient extends up into the brand block, rest of the bar is light.
- **Modular:** one responsibility per file, clean prop interfaces, composed by `TopBar` — no monolithic Header. (Rohit's standing preference.)
- **No behavior/routing/data change.** All hooks, routing, filter state, and the operator-admin guard are byte-for-byte preserved. Only component structure + className/markup move.
- **Valid tokens ONLY** (a missing Tailwind utility silently emits no CSS — build stays green): `accent, accent-fg, accent-hover, accent-gradient` · `surface, surface-2, surface-3` · `fg, fg-2, fg-muted, fg-subtle` · `border, border-hover, border-emphasis` · arbitrary `[var(--fill-hover|active|press)]`, `[var(--danger|warning|success)]`, `[var(--surface-2)]`. There is NO `surface-1`, `accent-alt`, `success-500`, etc.
- **Intentional NON-token classes to KEEP (deliberate departures — do NOT "fix"):** the dark rail + brand block use `bg-brand-sidebar-from` + `text-white`/`white/NN` opacity utilities; the user-menu + avatar keep the `bg-linear-to-br from-brand-primary to-brand-accent text-white` gradient avatar. These are the documented dark-rail + gradient-mark departures.
- **`cn()` is a naive string-join** (not tailwind-merge) — to change a class, edit the source literal; in tests assert on the element's OWN `className`, not subtree `innerHTML`.
- **jsdom 29.1.1 has no localStorage** → the mock in `frontend/vitest.setup.ts` is load-bearing; don't touch it.
- Weights ≤ 600; radii from the `--radius` scale (`rounded-md`/`-lg`).
- `cd frontend && npm test` (currently 86/86) and `npm run build` green after every task.
- Commits end with a `Co-authored-by: Isaac` trailer; never `--no-verify`.

**Reference files (read when unsure):** current `src/components/Header.tsx` (breadcrumb + user menu source), `src/components/Sidebar.tsx` (brand header + client badge source), `src/components/BrandLogo.tsx`, `src/theme/ThemeToggle.tsx`, `src/hooks/useUser.ts`.

---

## File Structure

**Created:**
- `frontend/src/components/shell/Breadcrumb.tsx` — section › page trail. `Breadcrumb({ section?, page })`.
- `frontend/src/components/shell/ClientBadge.tsx` — workspace-context chip (pulse dot + `Client · <tenant>`), light-token variant. `ClientBadge({ tenant })`.
- `frontend/src/components/shell/UserMenu.tsx` — avatar + Popover + sign-out. `UserMenu({ user })`.
- `frontend/src/components/shell/BrandBlock.tsx` — dark brand segment: mark + name + tagline + collapse toggle; width keyed off `collapsed`. `BrandBlock({ collapsed, onToggle })`.
- `frontend/src/components/shell/TopBar.tsx` — full-width bar; composes BrandBlock + Breadcrumb + ThemeToggle + ClientBadge + UserMenu. `TopBar({ collapsed, onToggle })`.
- `frontend/src/components/shell/shell.test.tsx` — focused render tests for the shell components.

**Modified:**
- `frontend/src/App.tsx` — row → column layout; render `<TopBar>` then `[Sidebar | main]`; pass `{collapsed,onToggle}` to TopBar, `{collapsed}` to Sidebar.
- `frontend/src/components/Sidebar.tsx` — remove brand header + client badge + collapse toggle; drop `onToggle` prop; becomes pure nav + admin footer.
- `frontend/src/components/Sidebar.test.tsx` — update render helpers to `<Sidebar collapsed={false} />` (drop `onToggle`).

**Deleted:**
- `frontend/src/components/Header.tsx` — replaced by `shell/TopBar.tsx`.
- `frontend/src/components/Header.test.tsx` — replaced by `shell/shell.test.tsx` coverage.

---

### Task 1: `Breadcrumb` + `ClientBadge` (leaf presentational components)

**Files:**
- Create: `frontend/src/components/shell/Breadcrumb.tsx`, `frontend/src/components/shell/ClientBadge.tsx`
- Test: `frontend/src/components/shell/shell.test.tsx` (create)

**Interfaces:**
- Produces: `Breadcrumb({ section?: string; page: string })` (default export); `ClientBadge({ tenant: string })` (default export). Consumed by `TopBar` in Task 4.

- [ ] **Step 1: Write the failing test** — `shell/shell.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Breadcrumb from "./Breadcrumb";
import ClientBadge from "./ClientBadge";

describe("shell — Breadcrumb", () => {
  it("renders the page title with fg token, no slate", () => {
    const { container } = render(<Breadcrumb page="Spend" />);
    const title = screen.getByText("Spend");
    expect(title.className).toMatch(/text-fg\b/);
    expect(container.innerHTML).not.toMatch(/slate-\d/);
  });
  it("renders the section label when provided", () => {
    render(<Breadcrumb section="Insights & Analytics" page="Spend" />);
    expect(screen.getByText("Insights & Analytics")).toBeInTheDocument();
    expect(screen.getByText("Spend")).toBeInTheDocument();
  });
});

describe("shell — ClientBadge", () => {
  it("renders the tenant with light tokens, no slate/emerald", () => {
    const { container } = render(<ClientBadge tenant="Acme Corp" />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText(/client/i)).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/slate-\d|emerald-\d/);
  });
});
```

- [ ] **Step 2: Run → fails** (files don't exist). `cd frontend && npx vitest run src/components/shell/shell.test.tsx`.

- [ ] **Step 3: Create `Breadcrumb.tsx`:**
```tsx
import { ChevronRight } from "lucide-react";

export default function Breadcrumb({ section, page }: { section?: string; page: string }) {
  return (
    <nav className="flex items-center gap-1.5 min-w-0" aria-label="Breadcrumb">
      {section && (
        <>
          <span className="text-[13px] text-fg-muted truncate hidden sm:inline">{section}</span>
          <ChevronRight size={14} className="text-fg-subtle shrink-0 hidden sm:inline" />
        </>
      )}
      <span className="text-[13px] font-medium text-fg tracking-tight truncate">{page}</span>
    </nav>
  );
}
```

- [ ] **Step 4: Create `ClientBadge.tsx`** (light-token variant of the old sidebar badge; pulse dot → `--success`):
```tsx
export default function ClientBadge({ tenant }: { tenant: string }) {
  return (
    <div className="hidden md:flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-60 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]" />
      </span>
      <div className="flex items-baseline gap-1.5 min-w-0 leading-none">
        <span className="text-[9px] text-fg-muted tracking-[0.14em] uppercase">Client</span>
        <span className="text-xs font-semibold text-fg truncate">{tenant}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run → passes.** Then full suite + build: `cd frontend && npm test && npm run build`.
- [ ] **Step 6: Grep guard.** `cd frontend && grep -nE "slate-[0-9]|indigo-|emerald-[0-9]|bg-white([^/]|$)" src/components/shell/Breadcrumb.tsx src/components/shell/ClientBadge.tsx` → empty.
- [ ] **Step 7: Commit.**
```bash
git add frontend/src/components/shell/Breadcrumb.tsx frontend/src/components/shell/ClientBadge.tsx frontend/src/components/shell/shell.test.tsx
git commit -m "feat(shell): add modular Breadcrumb + ClientBadge components

Co-authored-by: Isaac"
```

---

### Task 2: `UserMenu` (extract avatar + popover + sign-out)

**Files:**
- Create: `frontend/src/components/shell/UserMenu.tsx`
- Test: extend `frontend/src/components/shell/shell.test.tsx`

**Interfaces:**
- Consumes: `Avatar`, `AvatarFallback` from `@/components/ui/avatar`; `Popover`, `PopoverContent`, `PopoverTrigger` from `@/components/ui/popover`.
- Produces: `UserMenu({ user })` (default export) where `user` is `{ displayName?, email?, initials? } | null`. Consumed by `TopBar` in Task 4.

**This is a verbatim extraction** of the user-menu markup from the current `Header.tsx` (lines 52–86) — the gradient avatar is a documented deliberate departure and MUST be preserved.

- [ ] **Step 1: Add failing test** to `shell/shell.test.tsx`:
```tsx
import UserMenu from "./UserMenu";

describe("shell — UserMenu", () => {
  it("renders display name + initials, keeps the gradient avatar, no slate chrome", () => {
    const { container } = render(
      <UserMenu user={{ displayName: "Dana Lee", email: "dana@x.com", initials: "DL" }} />
    );
    expect(screen.getAllByText("DL").length).toBeGreaterThan(0);
    // gradient avatar (deliberate departure) preserved
    expect(container.innerHTML).toMatch(/from-brand-primary/);
    // no legacy slate chrome
    expect(container.innerHTML).not.toMatch(/slate-\d/);
  });
  it("falls back to 'User' / '?' when user is null", () => {
    render(<UserMenu user={null} />);
    expect(screen.getByText("User")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Create `UserMenu.tsx`:**
```tsx
import { ChevronRight, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface UserLike {
  displayName?: string;
  email?: string;
  initials?: string;
}

export default function UserMenu({ user }: { user: UserLike | null }) {
  const initials =
    user?.initials ??
    user?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ??
    "?";
  const displayName = user?.displayName ?? "User";
  const email = user?.email;

  return (
    <Popover>
      <PopoverTrigger className="group gap-2.5 rounded-full pl-1 pr-2.5 py-1 hover:bg-[var(--fill-hover)] transition-colors">
        <Avatar size="sm" className="ring-2 ring-[var(--surface-2)] shadow-sm">
          <AvatarFallback className="bg-linear-to-br from-brand-primary to-brand-accent text-white text-[11px] font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="text-[13px] font-medium text-fg-2 max-w-[140px] truncate hidden sm:inline">
          {displayName}
        </span>
        <ChevronRight size={14} className="text-fg-muted rotate-90 hidden sm:inline" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5 bg-surface-2 border-b border-border">
          <Avatar size="sm" className="ring-2 ring-[var(--surface-2)] shadow-sm">
            <AvatarFallback className="bg-linear-to-br from-brand-primary to-brand-accent text-white text-[11px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-sm font-medium text-fg truncate">{displayName}</div>
            {email && <div className="text-xs text-fg-muted truncate">{email}</div>}
          </div>
        </div>
        <a
          href="/logout"
          className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-fg-2 hover:bg-[var(--fill-hover)] transition-colors"
        >
          <LogOut size={15} className="text-fg-muted" />
          Sign out
        </a>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Run → passes.** Full suite + build.
- [ ] **Step 5: Grep guard.** `cd frontend && grep -nE "slate-[0-9]|indigo-|bg-white([^/]|$)" src/components/shell/UserMenu.tsx` → empty.
- [ ] **Step 6: Commit.**
```bash
git add frontend/src/components/shell/UserMenu.tsx frontend/src/components/shell/shell.test.tsx
git commit -m "feat(shell): extract UserMenu (avatar + popover + sign-out)

Co-authored-by: Isaac"
```

---

### Task 3: `BrandBlock` (dark brand segment + collapse toggle)

**Files:**
- Create: `frontend/src/components/shell/BrandBlock.tsx`
- Test: extend `frontend/src/components/shell/shell.test.tsx`

**Interfaces:**
- Consumes: `BrandLogo` from `@/components/BrandLogo`; `brand` from `@/theme/brand`; `cn` from `@/lib/utils`; `PanelLeftClose`, `PanelLeft` from `lucide-react`.
- Produces: `BrandBlock({ collapsed: boolean; onToggle: () => void })` (default export). Consumed by `TopBar` in Task 4.

**Behavior:** width tracks `collapsed` (224px ↔ 60px) on a single persistent outer div (so width animates). Expanded shows mark + app name + tagline + a collapse toggle at the right. Collapsed (60px is too narrow for both) shows the mark centered, and the mark button itself is the expand affordance. Dark background `bg-brand-sidebar-from` for L-shape continuity with the rail.

- [ ] **Step 1: Add failing test** to `shell/shell.test.tsx`:
```tsx
import BrandBlock from "./BrandBlock";

describe("shell — BrandBlock", () => {
  it("expanded: shows app name + a collapse toggle, dark rail background", () => {
    const { container } = render(<BrandBlock collapsed={false} onToggle={() => {}} />);
    expect(container.innerHTML).toMatch(/bg-brand-sidebar-from/);
    expect(container.innerHTML).toMatch(/w-\[224px\]/);
    expect(screen.getByTitle(/collapse sidebar/i)).toBeInTheDocument();
  });
  it("collapsed: shrinks to 60px and offers an expand affordance", () => {
    const { container } = render(<BrandBlock collapsed={true} onToggle={() => {}} />);
    expect(container.innerHTML).toMatch(/w-\[60px\]/);
    expect(screen.getByTitle(/expand sidebar/i)).toBeInTheDocument();
  });
  it("fires onToggle when the toggle is clicked", () => {
    let n = 0;
    render(<BrandBlock collapsed={false} onToggle={() => { n++; }} />);
    screen.getByTitle(/collapse sidebar/i).click();
    expect(n).toBe(1);
  });
});
```

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Create `BrandBlock.tsx`:**
```tsx
import { cn } from "@/lib/utils";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { brand } from "@/theme/brand";
import { BrandLogo } from "@/components/BrandLogo";

export default function BrandBlock({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center h-full shrink-0 border-r border-white/10 bg-brand-sidebar-from transition-all duration-200",
        collapsed ? "w-[60px] justify-center" : "w-[224px] gap-2.5 px-3"
      )}
    >
      {collapsed ? (
        <button
          onClick={onToggle}
          title="Expand sidebar"
          className="p-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <BrandLogo variant="mark" className="w-8 h-8 text-base" />
        </button>
      ) : (
        <>
          <BrandLogo variant="mark" className="w-8 h-8 text-base shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold tracking-tight text-white leading-none">
              {brand.identity.appName}
            </div>
            <div className="text-[8.5px] text-white/40 tracking-[0.18em] uppercase mt-1 truncate">
              {brand.identity.tagline}
            </div>
          </div>
          <button
            onClick={onToggle}
            title="Collapse sidebar"
            className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 transition-colors rounded-lg shrink-0"
          >
            <PanelLeftClose size={16} />
          </button>
        </>
      )}
    </div>
  );
}
```
(`PanelLeft` is imported for the expand affordance parity with the old sidebar; if the mark-as-button covers expand and `PanelLeft` ends up unused, remove the import so the build has no unused symbol.)

- [ ] **Step 4: Run → passes.** Full suite + build.
- [ ] **Step 5: Grep guard.** `cd frontend && grep -nE "slate-[0-9]|indigo-|bg-white([^/]|$)" src/components/shell/BrandBlock.tsx` → empty (note: `bg-brand-sidebar-from`, `text-white`, `white/NN` are the intentional dark-rail classes and are expected).
- [ ] **Step 6: Commit.**
```bash
git add frontend/src/components/shell/BrandBlock.tsx frontend/src/components/shell/shell.test.tsx
git commit -m "feat(shell): add BrandBlock (dark brand segment + collapse toggle)

Co-authored-by: Isaac"
```

---

### Task 4: `TopBar` (composition)

**Files:**
- Create: `frontend/src/components/shell/TopBar.tsx`
- Test: extend `frontend/src/components/shell/shell.test.tsx`

**Interfaces:**
- Consumes: `useLocation` (react-router-dom); `useRoutes` from `@/registry/useRegistry`; `useUser` from `@/hooks/useUser`; `ThemeToggle` from `@/theme/ThemeToggle`; and the four `shell/*` components from Tasks 1–3.
- Produces: `TopBar({ collapsed: boolean; onToggle: () => void })` (default export). Consumed by `App.tsx` in Task 5.

**Note:** `SECTION_LABELS` and the route/section derivation move here from the retired `Header.tsx` verbatim. `TopBar` owns all the hooks and passes plain props down to the leaf components (keeping them pure).

- [ ] **Step 1: Add failing test** to `shell/shell.test.tsx` (needs the router + registry providers):
```tsx
import { vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TopBar from "./TopBar";
import { RegistryContext } from "@/registry/useRegistry";
import type { Registry } from "@/registry/types";

function renderTopBar(collapsed = false) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));
  const registry: Registry = { assets: {} };
  return render(
    <RegistryContext.Provider value={registry}>
      <MemoryRouter initialEntries={["/"]}>
        <TopBar collapsed={collapsed} onToggle={() => {}} />
      </MemoryRouter>
    </RegistryContext.Provider>
  );
}

describe("shell — TopBar", () => {
  afterEach(() => vi.restoreAllMocks());
  it("renders a full-width h-12 bar with a light surface section, no slate", () => {
    const { container } = renderTopBar();
    const header = container.querySelector("header")!;
    expect(header.className).toMatch(/\bh-12\b/);
    expect(container.innerHTML).toMatch(/bg-surface-2/);
    expect(header.className).not.toMatch(/slate-/);
  });
  it("mounts the theme toggle and the collapse toggle", () => {
    renderTopBar(false);
    expect(screen.getByRole("button", { name: /switch to (dark|light) theme/i })).toBeInTheDocument();
    expect(screen.getByTitle(/collapse sidebar/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Create `TopBar.tsx`:**
```tsx
import { useLocation } from "react-router-dom";
import { useRoutes } from "@/registry/useRegistry";
import { useUser } from "@/hooks/useUser";
import ThemeToggle from "@/theme/ThemeToggle";
import BrandBlock from "./BrandBlock";
import Breadcrumb from "./Breadcrumb";
import ClientBadge from "./ClientBadge";
import UserMenu from "./UserMenu";

const SECTION_LABELS: Record<string, string> = {
  insights: "Insights & Analytics",
  exploration: "Exploration",
};

export default function TopBar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const location = useLocation();
  const { user } = useUser();
  const routes = useRoutes();

  const currentRoute = routes.find((r) => r.path === location.pathname);
  const pageTitle = currentRoute?.label ?? "APEX";
  const sectionLabel = currentRoute ? SECTION_LABELS[currentRoute.section] : undefined;
  const clientName = user?.tenant || "All clients";

  return (
    <header className="relative z-40 h-12 flex shrink-0 border-b border-border">
      <BrandBlock collapsed={collapsed} onToggle={onToggle} />
      <div className="flex-1 flex items-center justify-between gap-3 px-4 bg-surface-2 min-w-0">
        <Breadcrumb section={sectionLabel} page={pageTitle} />
        <div className="flex items-center gap-2 shrink-0">
          <ClientBadge tenant={clientName} />
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run → passes.** Full suite + build.
- [ ] **Step 5: Grep guard.** `cd frontend && grep -nE "slate-[0-9]|indigo-|bg-white([^/]|$)" src/components/shell/TopBar.tsx` → empty.
- [ ] **Step 6: Commit.**
```bash
git add frontend/src/components/shell/TopBar.tsx frontend/src/components/shell/shell.test.tsx
git commit -m "feat(shell): add TopBar composing the modular shell components

Co-authored-by: Isaac"
```

---

### Task 5: Rewire `App.tsx` + slim `Sidebar.tsx` + retire `Header`

**Files:**
- Modify: `frontend/src/App.tsx`, `frontend/src/components/Sidebar.tsx`, `frontend/src/components/Sidebar.test.tsx`
- Delete: `frontend/src/components/Header.tsx`, `frontend/src/components/Header.test.tsx`

**Interfaces:**
- `Sidebar` signature changes: `Sidebar({ collapsed: boolean })` — the `onToggle` prop is REMOVED (the toggle now lives in `BrandBlock`).
- `App.tsx` still owns `sidebarCollapsed` state and passes `{ collapsed: sidebarCollapsed, onToggle }` to `TopBar` and `{ collapsed: sidebarCollapsed }` to `Sidebar`.

**This is the integration task — the app must still build + pass tests + render correctly.**

- [ ] **Step 1: READ** `src/App.tsx` and `src/components/Sidebar.tsx` fully to confirm current structure before editing.

- [ ] **Step 2: Update `App.tsx` imports** — remove `import Header from "@/components/Header";`, add `import TopBar from "@/components/shell/TopBar";`.

- [ ] **Step 3: Replace the shell JSX** in `App.tsx`. The current return (the outer `<div className="h-full flex bg-surface-2">` with `<Sidebar collapsed onToggle/>` then a `flex-1 flex flex-col` column containing `<Header/>`, the toolbar, `<FilterBar/>`, and the `<main>` body) becomes a COLUMN with the TopBar on top:
```tsx
  return (
    <div className="h-full flex flex-col bg-surface-2">
      <TopBar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex-1 flex min-h-0">
        <Sidebar collapsed={sidebarCollapsed} />
        <div className="flex-1 flex flex-col min-w-0">

          {/* Unified dashboard toolbar: page tabs (left) + page actions (right) */}
          {isCustom && (
            <div className="shrink-0 bg-white px-5 pt-3 pb-1 flex items-center justify-between gap-3">
              {isCustom && pages.length > 0 ? (
                <Tabs value={effectivePageId} onValueChange={setActivePageId}>
                  <TabsList>
                    {pages.map((page) => (
                      <TabsTrigger key={page.pageId} value={page.pageId}>
                        {page.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSummaryOpen(true)}
                  className="gap-1.5 text-brand-primary border-brand-primary-light hover:bg-brand-primary-light hover:text-brand-primary-dark"
                >
                  <Sparkles size={14} />
                  <span>Executive Summary</span>
                </Button>
                <Button
                  size="sm"
                  variant={railOpen ? "default" : "outline"}
                  onClick={() => setRailOpen((o) => !o)}
                  className="gap-1.5"
                >
                  <MessageCircle size={14} />
                  <span>Ask APEX</span>
                </Button>
              </div>
            </div>
          )}

          {isCustom && filterKeys.length > 0 && (
            <FilterBar filters={filters} onChange={handleFilterChange} filterKeys={filterKeys} />
          )}

          <div className="flex-1 flex min-h-0">
            <main className="flex-1 flex flex-col min-w-0 bg-surface border border-border rounded-lg mr-2 mb-2 overflow-y-auto">
              <Routes>
                {/* Operator-only admin. Self-guards via 401/403 in AdminLayout; nav hidden for non-operators. */}
                <Route path={ADMIN_BASE} element={<AdminLayout />}>
                  <Route index element={<Navigate to={ADMIN_ASSETS_PATH} replace />} />
                  <Route path="assets" element={<AssetsPage />} />
                  <Route path="access" element={<AccessPage />} />
                  <Route path="tenants" element={<TenantsPage />} />
                </Route>
                {routes.map((route) => (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={
                      <RouteRenderer
                        route={route}
                        filters={filters}
                        filtersReady={filtersReady}
                        activePageId={effectivePageId}
                        railOpen={railOpen}
                        onRailOpenChange={setRailOpen}
                        summaryOpen={summaryOpen}
                        onSummaryOpenChange={setSummaryOpen}
                      />
                    }
                  />
                ))}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
```
(The toolbar's `bg-white` + legacy `brand-primary` button classes are the separately-tracked dashboard-toolbar work — leave them UNCHANGED here; they are out of scope for this plan and must NOT be converted in this task.)

- [ ] **Step 4: Slim `Sidebar.tsx`:**
  - Change the signature: `interface SidebarProps { collapsed: boolean; }` and `export default function Sidebar({ collapsed }: SidebarProps)` — remove `onToggle`.
  - DELETE the "Logo + collapse toggle" block (the `<div className="px-3 py-4 border-b border-white/10 shrink-0">…</div>` containing `BrandLogo` + app name + the toggle button) and the "Client badge" block (both the expanded `<div className="px-3 py-3 border-b …">` and the collapsed `<div className="py-2.5 border-b …">` variants).
  - The `<aside>` keeps its `bg-linear-to-b from-brand-sidebar-from via-brand-sidebar-via to-brand-sidebar-to` rail + `h-full` + collapsed width classes. The `ScrollArea` nav sections + the operator "Admin" footer stay exactly as-is.
  - Remove now-unused imports: `PanelLeftClose`, `PanelLeft` (lucide), `brand` (`@/theme/brand`), `BrandLogo` (`@/components/BrandLogo`), and the `clientName`/`user`-for-badge usage if it becomes unused (keep `useUser`/`isOperator` — still needed for the Admin footer + admin-context nav). Keep `ArrowLeft`, `Settings`, `ScrollArea`, `cn`, `ICON_MAP`, `useRoutes`, `ADMIN_*`.
  - Build will flag any genuinely-unused import — resolve until clean.

- [ ] **Step 5: Update `Sidebar.test.tsx`** — in BOTH `renderSidebar` and `renderSidebarAt`, change `<Sidebar collapsed={false} onToggle={() => {}} />` to `<Sidebar collapsed={false} />`. No other assertions change (the existing tests only check nav items + admin sections, which are unaffected).

- [ ] **Step 6: Delete `Header.tsx` + `Header.test.tsx`:**
```bash
cd frontend && git rm src/components/Header.tsx src/components/Header.test.tsx
```

- [ ] **Step 7: Run the full suite + build.** `cd frontend && npm test && npm run build`. All green (86 tests minus the 2 deleted Header tests, plus the new shell tests). Fix any TS/unused-import errors.

- [ ] **Step 8: Grep guard** on the shell integration (App + Sidebar should carry no NEW slate; the toolbar `bg-white` is the known out-of-scope exception):
```bash
cd frontend && grep -nE "slate-[0-9]|indigo-[0-9]" src/App.tsx src/components/Sidebar.tsx || echo "clean"
```
Expected: clean. (`bg-white` on the dashboard toolbar in `App.tsx` is the tracked out-of-scope exception and may remain.)

- [ ] **Step 9: Commit.**
```bash
git add frontend/src/App.tsx frontend/src/components/Sidebar.tsx frontend/src/components/Sidebar.test.tsx
git rm frontend/src/components/Header.tsx frontend/src/components/Header.test.tsx
git commit -m "feat(shell): full-width top bar — column layout, slim Sidebar, retire Header

Co-authored-by: Isaac"
```

---

### Task 6: Verification checkpoint (no code)

- [ ] **Step 1: Full green.** `cd frontend && npm test && npm run build`.
- [ ] **Step 2: Whole-plan grep guard.**
```bash
cd frontend && grep -rnE "slate-[0-9]|indigo-[0-9]" src/components/shell/ | grep -v ".test." || echo "shell clean"
```
Expected: `shell clean`.
- [ ] **Step 3: Live Chrome check** (dev server at http://localhost:5173/), BOTH light + dark:
  - The top bar spans the full page width; the dark brand block sits top-left and reads continuous with the sidebar rail below (dark L-shape).
  - The brand/bar vertical divider lines up with the sidebar/main divider.
  - Collapse toggle in the brand block collapses BOTH the brand block and the sidebar to 60px in lockstep; expand restores 224px; the divider stays aligned in both states.
  - Client badge renders legibly on the light bar (pulse dot visible), theme toggle + user menu work, user-menu Popover is theme-aware.
  - Breadcrumb shows section › page correctly as you navigate.
  - 0 console errors. Screenshots `/tmp/apex-topbar-{light,dark}.png` and `/tmp/apex-topbar-collapsed.png`.
- [ ] **Step 4: Update ledger/memory** (`apex-design-system-adoption` — mark full-width top bar DONE; note the new `shell/` module). Do NOT push yet (await Rohit / batch per his push cadence).

---

## Self-Review

**Spec coverage:** Layout flip (row→column) → Task 5. Modular decomposition (Breadcrumb/ClientBadge/UserMenu/BrandBlock/TopBar) → Tasks 1–4. Four locked decisions: brand tracks width (Task 3 `w-[224px]`/`w-[60px]`) ✅; toggle in brand block (Task 3) ✅; client badge into top bar (Tasks 1 + 4) ✅; dark L-shape (Task 3 `bg-brand-sidebar-from` + Task 5 sidebar rail continuity) ✅. Header retired + Sidebar slimmed → Task 5. ✅

**Placeholder scan:** Every component has complete code; the App.tsx replacement JSX is given in full (including the untouched out-of-scope toolbar); no "convert appropriately". ✅

**Type/behavior consistency:** `Sidebar` drops `onToggle` (Task 5) and its test is updated in the same task (Step 5) — no window where the signature and its caller/test disagree. `TopBar({collapsed,onToggle})` and `BrandBlock({collapsed,onToggle})` interfaces match their consumers. `UserMenu`'s `UserLike` is a structural subset of `useUser`'s `User`, so `user={user}` type-checks. `SECTION_LABELS`/section derivation moves intact from Header to TopBar. ✅

**Ordering rationale:** Leaf presentational components first (Tasks 1–3, cheap/mechanical, independently testable while the old Header still runs the app), then the composer (Task 4), then the single integration task that flips the layout and removes the old pieces atomically (Task 5) so the app never sits in a half-wired broken state. Task 6 verifies. ✅

## Execution Handoff

(see chat)
