# Prism Phase 4 — Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the app shell on the canonical DuBois shell structure — a `Sidebar` fed nav data as a prop from our registry, a `TopBar` on the kit's DuBois frame carrying our white-label chrome (BrandLogo, Breadcrumb, ClientBadge, ThemeToggle, UserMenu), an `AppShell` layout with the rounded content-card `main`, and a vendored `PageHeader` — retiring our hand-built shell (BrandBlock + old TopBar/Sidebar layout) with no loss of function.

**Architecture:** Three ordered tasks, each rewriting one shell layer + its `App.tsx` wiring and ending green. (1) **Sidebar** → adopt the kit's canonical `NavItemButton` styling + collapsible labelled sections, but make nav data a **prop** (`SidebarNavSection[]`) that `App` builds from our registry routes + admin context; Sidebar becomes presentational. (2) **TopBar** → rewrite on the kit's DuBois `header` frame (h-12, `bg-secondary`, left collapse-toggle + `BrandLogo` + app name, right cluster), dropping the kit's search/workspace/AppSwitcher/`NewButton` and slotting in our `Breadcrumb`/`ClientBadge`/`ThemeToggle`/`UserMenu`; retire `BrandBlock`. (3) **AppShell + PageHeader** → vendor the kit's `AppShell` rounded-card layout + `PageHeader`, restructure `App.tsx` to compose them (retiring the hand-built full-width layout), keeping the dashboard toolbar (tabs + Exec Summary / Ask APEX) + FilterBar + Routes inside the content region.

**Tech Stack:** Vite 7 + React 19 + React Router 7, Tailwind v4 canonical DuBois tokens, the Phase-3 vendored `ui/*` + 457 icons + `DbIcon`, `next-themes`, Vitest 3 + Testing Library.

## Global Constraints

- **Frontend-only.** No backend / `app.py` / `/api/*` change. (spec §Architecture)
- **Spec §Phase 4 deliverables (verbatim):** "Vendor `AppShell`/`TopBar`/`Sidebar`/`PageHeader`; feed nav from our registry/routes (make the hardcoded `NAV_SECTIONS` a prop); swap `DatabricksLogo` → our `BrandLogo`; drop `NewButton` (Prism has no create-menu); retire our hand-built shell + the full-width top bar."
- **No functional regression.** The white-label chrome our shell provides and the kit's lacks MUST survive: UserMenu (Radix popover + sign-out to `/logout`), ClientBadge (tenant), Breadcrumb (section + page), admin nav context (Back to APEX, admin sections, operator-only Admin footer), registry-fed nav in Insights/Exploration sections, sidebar collapse. Verify each in the live check.
- **Canonical source of styling:** `/tmp/db-starter-kit/src/components/shell/{AppShell,TopBar,Sidebar,PageHeader}.tsx`. Re-clone `github.com/gioa/db-starter-kit` to `/tmp/db-starter-kit` if gone. We ADAPT these (react-router, our data, our chrome) — not verbatim, because the kit versions are Next.js console chrome. `PageHeader` is the one that vendors near-verbatim (it already uses `@/components/ui/button` + `@/components/icons` + `cn`).
- **Canonical DuBois shell conventions to preserve** (spec §Canonical corrections): shell chrome = `secondary` `#f7f7f7`, TopBar + Sidebar share that bg with NO dividing borders, only the content card is `bg-background` + `border` + `rounded-md`; active nav = `bg-primary/10 text-primary font-semibold` + blue icon; 13px text, `font-semibold` never `font-bold`; icons via `DbIcon`/vendored icons or lucide (both fine).
- **Do NOT** import the kit's `GenieCodePanel`, `AppSwitcher`, `NewButton`, `NewMenu`, `DatabricksLogo`, `EditorTabBar`, `SidePanel`, `FilterBar` (kit's), `AppsShell`, `AppsSidebar` — out of scope. Our Ask-APEX rail stays in `DashboardWorkspace` (Phase 5 reskins it).
- **Mobile Sheet drawer sidebar** (kit AppShell feature): OUT OF SCOPE — our app is desktop-embedded analytics; keep the existing collapse behavior only. Note it, don't build it.
- **Each task ends green:** `cd frontend && npm test && npm run build` both pass, then a live Chrome check in **both** light and dark. Push to `feature/apex-theming`, no PRs, batch phases. (spec §Testing)

---

## File Structure

**Rewritten (adapted from kit, keep our path):**
- `frontend/src/components/Sidebar.tsx` — presentational, nav-as-prop (Task 1).
- `frontend/src/components/shell/TopBar.tsx` — kit DuBois frame + our chrome (Task 2).

**Created (vendored/adapted from kit):**
- `frontend/src/components/shell/AppShell.tsx` — rounded-card layout wrapper (Task 3).
- `frontend/src/components/shell/PageHeader.tsx` — vendored near-verbatim (Task 3).

**Modified:**
- `frontend/src/App.tsx` — build Sidebar `sections` prop from routes+admin (Task 1); drop old TopBar props (Task 2); compose AppShell (Task 3).
- Tests: `frontend/src/components/Sidebar.test.tsx` (Task 1), `frontend/src/components/shell/shell.test.tsx` (Task 2).

**Deleted (retire hand-built shell):**
- `frontend/src/components/shell/BrandBlock.tsx` + its role folds into TopBar (Task 2).

**Untouched (reused as-is):** `BrandLogo.tsx`, `shell/Breadcrumb.tsx`, `shell/ClientBadge.tsx`, `shell/UserMenu.tsx`, `theme/ThemeToggle.tsx`, `registry/*`, `config.ts` (`ICON_MAP`, `buildRoutes`, `useRoutes`), `components/admin/adminContext.ts`.

---

### Task 1: Sidebar — canonical DuBois styling, nav data as a prop

Rewrite `Sidebar` to the kit's canonical `NavItemButton` styling and collapsible-section structure, but presentational: it receives `SidebarNavSection[]` + an optional footer. `App` builds the sections from `useRoutes()` (Insights/Exploration) or the admin context — moving the data logic up and satisfying the spec's "make `NAV_SECTIONS` a prop."

**Files:**
- Rewrite: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/App.tsx` (build + pass `sections`, `footer`)
- Modify: `frontend/src/components/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `ICON_MAP` from `@/config`; `useRoutes` from `@/registry/useRegistry`; `ADMIN_SECTIONS`, `ADMIN_BASE`, `ADMIN_ASSETS_PATH` from `@/components/admin/adminContext`; `useUser`; `DbIcon` from `@/components/ui/db-icon` (optional — lucide via `ICON_MAP` also fine, keep `ICON_MAP` for zero icon-mapping churn).
- Produces (exported from `Sidebar.tsx`):
  ```ts
  export interface SidebarNavItem { path: string; label: string; icon: string; placeholder?: boolean; }
  export interface SidebarNavSection { label?: string; items: SidebarNavItem[]; }
  export interface SidebarProps {
    collapsed: boolean;
    sections: SidebarNavSection[];
    footer?: React.ReactNode;   // e.g. the operator Admin button, or Back-to-APEX handled as a section
  }
  export default function Sidebar(props: SidebarProps): JSX.Element
  ```
  Active detection stays inside Sidebar via `useLocation().pathname === item.path` (keeps App from threading active state).

- [ ] **Step 1: Rewrite `Sidebar.tsx` to presentational + canonical styling**

Replace the file. Nav data comes from props; active state from the router; styling matches the kit's `NavItemButton` (`bg-primary/10 text-primary font-semibold` active, `text-foreground hover:bg-[var(--action-default-bg-hover)]` inactive, `h-7 rounded px-3 gap-2`, blue active icon), on the shared `bg-secondary` chrome (no gradient, no border).

```tsx
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ICON_MAP } from "@/config";

export interface SidebarNavItem {
  path: string;
  label: string;
  icon: string;
  placeholder?: boolean;
}
export interface SidebarNavSection {
  label?: string;
  items: SidebarNavItem[];
}
export interface SidebarProps {
  collapsed: boolean;
  sections: SidebarNavSection[];
  footer?: React.ReactNode;
}

export default function Sidebar({ collapsed, sections, footer }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col bg-secondary transition-all duration-200 overflow-hidden",
        collapsed ? "w-[60px]" : "w-[224px]"
      )}
    >
      <nav
        className={cn(
          "flex flex-1 flex-col gap-4 overflow-y-auto py-4",
          collapsed ? "px-1.5" : "px-3",
          "[&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
        )}
      >
        {sections.map((section, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {section.label && !collapsed && (
              <div className="px-2 mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {section.label}
              </div>
            )}
            {section.items.map((item) => (
              <NavItem key={item.path} item={item} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>
      {footer && <div className="shrink-0 border-t border-border px-3 py-3">{footer}</div>}
    </aside>
  );
}

function NavItem({ item, collapsed }: { item: SidebarNavItem; collapsed: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const Icon = ICON_MAP[item.icon];
  const active = location.pathname === item.path;

  return (
    <button
      onClick={() => navigate(item.path)}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group flex h-7 w-full items-center gap-2 rounded px-3 text-left text-[13px] transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-foreground font-medium hover:bg-[var(--action-default-bg-hover)]"
      )}
    >
      {Icon && (
        <Icon
          size={16}
          className={cn(
            "shrink-0 transition-colors",
            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          )}
        />
      )}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.placeholder && (
            <span className="rounded bg-[var(--action-default-bg-hover)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              soon
            </span>
          )}
        </>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Build the `sections` + `footer` in `App.tsx` and pass them**

`App` already calls `useRoutes()`. Add the admin-context branch (it needs `useUser`, `useLocation` — `useLocation` is already imported; add `useUser`). Compute `sections` and the `footer` (operator Admin button / Back-to-APEX), then pass to `<Sidebar>`.

Add imports at the top of `App.tsx`:
```tsx
import { ArrowLeft, Settings } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { ADMIN_SECTIONS, ADMIN_ACCESS_PATH } from "@/components/admin/adminContext";
import type { SidebarNavSection } from "@/components/Sidebar";
```
(`ADMIN_BASE`, `ADMIN_ASSETS_PATH` are already imported.)

Inside `App()`, after `const routes = useRoutes();`, add:
```tsx
  const { user } = useUser();
  const isOperator = user?.role === "operator";
  const inAdmin = location.pathname.startsWith(ADMIN_BASE);

  const sidebarSections: SidebarNavSection[] = inAdmin && isOperator
    ? [
        { items: [{ path: "/", label: "Back to APEX", icon: "ArrowLeftNav" }] },
        {
          label: "Administration",
          items: ADMIN_SECTIONS.map((s) => ({ path: s.path, label: s.label, icon: s.icon })),
        },
      ]
    : [
        {
          label: "Insights & Analytics",
          items: routes
            .filter((r) => r.section === "insights")
            .map((r) => ({ path: r.path, label: r.label, icon: r.icon, placeholder: r.mode === "placeholder" })),
        },
        {
          label: "Exploration",
          items: routes
            .filter((r) => r.section === "exploration")
            .map((r) => ({ path: r.path, label: r.label, icon: r.icon, placeholder: r.mode === "placeholder" })),
        },
      ];

  const sidebarFooter = isOperator && !inAdmin ? (
    <button
      onClick={() => navigate(ADMIN_ASSETS_PATH)}
      className="group flex h-7 w-full items-center gap-2 rounded px-3 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--action-default-bg-hover)]"
    >
      <Settings size={16} className="shrink-0 text-muted-foreground group-hover:text-foreground" />
      {!sidebarCollapsed && <span>Admin</span>}
    </button>
  ) : undefined;
```

`App` needs `navigate` — add `useNavigate` to the `react-router-dom` import and `const navigate = useNavigate();`. The "Back to APEX" item uses icon key `"ArrowLeftNav"` — add that to `ICON_MAP` in `config.ts` (Step 3) mapping to lucide `ArrowLeft`, so Sidebar's `ICON_MAP[icon]` resolves it. Then change the Sidebar usage:
```tsx
        <Sidebar collapsed={sidebarCollapsed} sections={sidebarSections} footer={sidebarFooter} />
```

- [ ] **Step 3: Add the `ArrowLeftNav` icon key to `ICON_MAP`**

In `frontend/src/config.ts`, add `ArrowLeft` to the lucide import and map a nav-friendly key (the admin Back item). In the `ICON_MAP` object add:
```ts
  ArrowLeftNav: ArrowLeft,
```
and ensure `ArrowLeft` is in the `lucide-react` import at the top of `config.ts`. (Reuse the existing `Settings`/etc. import style.)

- [ ] **Step 4: Update `Sidebar.test.tsx`**

The Sidebar is now presentational (props-driven), so tests render it directly with `sections`/`footer` inside a `MemoryRouter`, not via the registry. Rewrite `frontend/src/components/Sidebar.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar, { type SidebarNavSection } from "./Sidebar";

const sections: SidebarNavSection[] = [
  { label: "Insights & Analytics", items: [{ path: "/", label: "Home", icon: "LayoutDashboard" }] },
  { label: "Exploration", items: [{ path: "/genie-mcp", label: "Ask APEX", icon: "Sparkles" }] },
];

function renderAt(path: string, props?: Partial<React.ComponentProps<typeof Sidebar>>) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar collapsed={false} sections={sections} {...props} />
    </MemoryRouter>
  );
}

describe("Sidebar", () => {
  it("renders section labels and nav items from props", () => {
    renderAt("/");
    expect(screen.getByText("Insights & Analytics")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Ask APEX")).toBeInTheDocument();
  });

  it("marks the active route with the canonical active classes (bg-primary/10 text-primary)", () => {
    renderAt("/");
    const active = screen.getByText("Home").closest("button")!;
    expect(active.className).toMatch(/bg-primary\/10/);
    expect(active.className).toMatch(/text-primary/);
    expect(active.className).toMatch(/font-semibold/);
  });

  it("renders a footer when provided", () => {
    renderAt("/", { footer: <button>Admin</button> });
    expect(screen.getByRole("button", { name: "Admin" })).toBeInTheDocument();
  });

  it("collapses to icon-only width", () => {
    const { container } = render(
      <MemoryRouter><Sidebar collapsed sections={sections} /></MemoryRouter>
    );
    expect((container.firstChild as HTMLElement).className).toMatch(/w-\[60px\]/);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd frontend && npm test`
Expected: PASS. If any consumer still imports the old Sidebar prop shape, `tsc` (run in build) or the test surfaces it — fix the consumer.

- [ ] **Step 6: Run build**

Run: `cd frontend && npm run build`
Expected: `tsc -b` + Vite build succeed.

- [ ] **Step 7: Live check both themes**

`cd frontend && npm run dev`, Chrome (backend offline fine). Confirm: sidebar renders Insights & Analytics + Exploration nav from the registry; active item has the blue `bg-primary/10 text-primary` pill + blue icon; hover fill works; collapse (via the still-present old TopBar toggle) narrows it; as an operator, the Admin footer button shows and navigating to `/admin` swaps the sidebar to the admin sections + Back to APEX. Legible in light AND dark.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/Sidebar.test.tsx frontend/src/App.tsx frontend/src/config.ts
git commit -m "feat(shell): Sidebar is presentational + canonical DuBois nav; nav fed as a prop from registry

Co-authored-by: Isaac"
```

---

### Task 2: TopBar — kit DuBois frame + our white-label chrome; retire BrandBlock

Rewrite `TopBar` on the kit's canonical `header` frame (h-12, `bg-secondary`, left toggle + logo, right cluster), dropping the kit's console chrome (search, workspace selector, `AppSwitcher`, `NewButton`, `DatabricksLogo`) and slotting in our functional pieces: `BrandLogo` + app name/tagline (left, replacing `BrandBlock`), `Breadcrumb` (center), `ClientBadge` + `ThemeToggle` + `UserMenu` (right). Retire `BrandBlock.tsx`.

**Files:**
- Rewrite: `frontend/src/components/shell/TopBar.tsx`
- Delete: `frontend/src/components/shell/BrandBlock.tsx`
- Modify: `frontend/src/components/shell/shell.test.tsx`
- Modify: `frontend/src/App.tsx` (TopBar props unchanged — still `collapsed`/`onToggle`; verify)

**Interfaces:**
- Consumes: `BrandLogo` from `@/components/BrandLogo`; `Breadcrumb`, `ClientBadge`, `UserMenu` from `./`; `ThemeToggle` from `@/theme/ThemeToggle`; `useRoutes`, `useUser`; `brand` from `@/theme/brand`; `SidebarOpenIcon`/`SidebarClosedIcon` from `@/components/icons` (vendored Phase 3) OR lucide `PanelLeftClose`/`PanelLeft` (either fine; use lucide to match current imports).
- Produces: `TopBar` with unchanged props `{ collapsed: boolean; onToggle: () => void }` (so `App` needs no change here).

- [ ] **Step 1: Rewrite `TopBar.tsx`**

Replace the file. Keep the existing data derivation (current route → page title + section label, user → tenant) that our TopBar already does; put it on the kit's h-12 `bg-secondary` frame.

```tsx
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import Breadcrumb from "./Breadcrumb";
import ClientBadge from "./ClientBadge";
import UserMenu from "./UserMenu";
import ThemeToggle from "@/theme/ThemeToggle";
import { useLocation } from "react-router-dom";
import { useRoutes } from "@/registry/useRegistry";
import { useUser } from "@/hooks/useUser";
import { brand } from "@/theme/brand";

const SECTION_LABELS: Record<string, string> = {
  insights: "Insights & Analytics",
  exploration: "Exploration",
};

export default function TopBar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const routes = useRoutes();
  const { user } = useUser();

  const currentRoute = routes.find((r) => r.path === location.pathname);
  const pageTitle = currentRoute?.label ?? brand.identity.appName;
  const sectionLabel = currentRoute ? SECTION_LABELS[currentRoute.section] : undefined;
  const clientName = user?.tenant ?? "All clients";

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 bg-secondary px-3">
      {/* Left: collapse toggle + brand */}
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="grid h-8 w-8 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-[var(--action-default-bg-hover)] hover:text-foreground"
      >
        {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
      </button>
      <div className="flex items-center gap-2 shrink-0">
        <BrandLogo variant="mark" className="h-7 w-7 text-base shrink-0" />
        <div className="min-w-0 leading-none">
          <div className="text-[15px] font-semibold tracking-tight text-foreground">
            {brand.identity.appName}
          </div>
          {brand.identity.tagline && (
            <div className="mt-0.5 truncate text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground">
              {brand.identity.tagline}
            </div>
          )}
        </div>
      </div>

      {/* Center: breadcrumb */}
      <div className="flex-1 min-w-0 px-4">
        <Breadcrumb section={sectionLabel} page={pageTitle} />
      </div>

      {/* Right: client + theme + user */}
      <div className="flex items-center gap-2 shrink-0">
        <ClientBadge tenant={clientName} />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
```

Note: this moves the collapse toggle from `BrandBlock` into the TopBar left (kit pattern), and the BrandLogo+name replaces `BrandBlock` — so `App.tsx` still passes `collapsed`/`onToggle` unchanged.

- [ ] **Step 2: Delete `BrandBlock.tsx`**

```bash
cd frontend && rm src/components/shell/BrandBlock.tsx
```
Confirm nothing else imports it:
```bash
cd frontend && grep -rn "BrandBlock" src && echo "STILL REFERENCED" || echo "clean"
```
Expected: `clean`.

- [ ] **Step 3: Update `shell.test.tsx`**

The shell test asserts BrandBlock behavior and the old TopBar structure. Remove the BrandBlock describe block; update the TopBar test to the new structure (h-12 `bg-secondary`, renders collapse toggle + app name + breadcrumb + theme toggle + user menu). Read `frontend/src/components/shell/shell.test.tsx` and:
- Delete the `describe("BrandBlock", …)` block entirely.
- In the TopBar test, wrap the render in `MemoryRouter` (TopBar now uses `useLocation`/`useRoutes`), and assert: the header has class `bg-secondary` and `h-12`; the collapse toggle button (aria-label "Collapse sidebar") is present and fires `onToggle`; the app name (`brand.identity.appName`) renders; a theme-toggle button (aria-label matching `/theme/i`) is present. Keep the Breadcrumb/ClientBadge/UserMenu describe blocks unchanged (those components are untouched). If the existing TopBar test rendered `<TopBar collapsed onToggle={fn} />` bare, add the `MemoryRouter` wrapper and a `RegistryProvider` if `useRoutes` requires it (check how other tests that use `useRoutes` set up — mirror that provider setup).

- [ ] **Step 4: Run tests**

Run: `cd frontend && npm test`
Expected: PASS. If `useRoutes`/`useUser` in TopBar need a provider in the test, add the same wrapper the other route-consuming tests use (grep the test dir for `RegistryProvider` to copy the pattern).

- [ ] **Step 5: Run build**

Run: `cd frontend && npm run build`
Expected: succeeds; no dangling `BrandBlock` import.

- [ ] **Step 6: Live check both themes**

`cd frontend && npm run dev`, Chrome. Confirm: the top bar is the light `#f7f7f7` chrome with NO bottom divider border; left shows collapse toggle + BrandLogo + "APEX" + tagline; center shows the breadcrumb (section › page); right shows ClientBadge (tenant + green dot) + theme toggle + UserMenu; clicking the UserMenu opens the Radix popover with name/email + Sign out; the collapse toggle narrows the sidebar. Legible in light AND dark.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/shell/TopBar.tsx frontend/src/components/shell/shell.test.tsx
git rm frontend/src/components/shell/BrandBlock.tsx
git commit -m "feat(shell): TopBar on canonical DuBois frame with BrandLogo + our chrome; retire BrandBlock

Co-authored-by: Isaac"
```

---

### Task 3: AppShell layout + PageHeader; restructure App.tsx

Introduce the canonical `AppShell` rounded-card layout and vendor `PageHeader`, then restructure `App.tsx` so the shell composes `AppShell(TopBar + Sidebar + content)` — retiring the hand-built full-width layout. The dashboard toolbar (tabs + Exec Summary / Ask APEX), FilterBar, and Routes stay inside the content region. `PageHeader` is vendored and available (Phase 5 wires it per-page).

**Files:**
- Create: `frontend/src/components/shell/AppShell.tsx`
- Create: `frontend/src/components/shell/PageHeader.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/components/shell/AppShell.test.tsx`

**Interfaces:**
- `AppShell` (adapted from kit — desktop-only, no mobile Sheet, no GenieCodePanel):
  ```tsx
  interface AppShellProps {
    topBar: React.ReactNode;
    sidebar: React.ReactNode;
    children: React.ReactNode;       // content region (toolbar + filterbar + routed main)
    className?: string;
  }
  export function AppShell({ topBar, sidebar, children, className }: AppShellProps): JSX.Element
  ```
- `PageHeader` — vendored near-verbatim from the kit (props: `breadcrumbs?`, `title`, `avatar?`, `starred?`, `onStarToggle?`, `titleIcons?`, `badge?`, `description?`, `actions?`, `onOverflow?`, `className?`). It imports `Button` + `StarIcon`/`StarFillIcon`/`OverflowIcon` from our vendored set — all present from Phase 3.

- [ ] **Step 1: Create `AppShell.tsx`**

Adapt the kit's `AppShell` to our desktop-only shell: `bg-secondary` outer, top bar, then a flex row of sidebar + a rounded-card `main`. Drop the mobile Sheet and GenieCodePanel. The content card is the ONLY bordered/rounded surface (canonical rule). Take `topBar`/`sidebar`/`children` as slots (so App keeps owning the data wiring).

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  topBar: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ topBar, sidebar, children, className }: AppShellProps) {
  return (
    <div className={cn("flex h-dvh flex-col overflow-hidden bg-secondary", className)}>
      {topBar}
      <div className="flex flex-1 overflow-hidden">
        {sidebar}
        <div className="flex flex-1 flex-col min-w-0">{children}</div>
      </div>
    </div>
  );
}
```

Note: the rounded content card (`bg-background border border-border rounded-md`) stays on the `<main>` inside `App.tsx` (Step 3), because our content region also has the toolbar + FilterBar above the card — the card wraps only the routed `<main>`, matching today's layout.

- [ ] **Step 2: Vendor `PageHeader.tsx`**

Copy the kit's PageHeader and strip `"use client"`:
```bash
cp /tmp/db-starter-kit/src/components/shell/PageHeader.tsx /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend/src/components/shell/PageHeader.tsx
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
perl -0pi -e 's/\A"use client";?\s*\n//' src/components/shell/PageHeader.tsx
```
It imports `Button` from `@/components/ui/button` and `StarIcon, StarFillIcon, OverflowIcon` from `@/components/icons` — all present. Verify it typechecks in Step 5. No further edits.

- [ ] **Step 3: Restructure `App.tsx` to compose `AppShell`**

Replace the outer layout `return` (currently the `<div className="h-full flex flex-col bg-surface-2">…</div>` tree, lines ~182-271) with `AppShell` slots. Keep the dashboard toolbar + FilterBar + routed `<main>` exactly as-is inside the `children` slot; only the outer wrapper changes.

Add import:
```tsx
import { AppShell } from "@/components/shell/AppShell";
```

New `return`:
```tsx
  return (
    <AppShell
      topBar={<TopBar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />}
      sidebar={<Sidebar collapsed={sidebarCollapsed} sections={sidebarSections} footer={sidebarFooter} />}
    >
      {/* Unified dashboard toolbar: page tabs (left) + page actions (right) */}
      {isCustom && (
        <div className="shrink-0 bg-background px-5 pt-3 pb-1 flex items-center justify-between gap-3">
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
              variant="default"
              onClick={() => setSummaryOpen(true)}
              className="gap-1.5 text-brand-primary border-brand-primary-light hover:bg-brand-primary-light hover:text-brand-primary-dark"
            >
              <Sparkles size={14} />
              <span>Executive Summary</span>
            </Button>
            <Button
              size="sm"
              variant={railOpen ? "primary" : "default"}
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
        <main className="flex-1 flex flex-col min-w-0 bg-background border border-border rounded-md mr-2 mb-2 overflow-y-auto">
          <Routes>
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
    </AppShell>
  );
```

Changes vs. the old tree: outer `<div>`+manual TopBar/Sidebar rows → `AppShell` slots; toolbar `bg-white` → `bg-background`; `<main>` `rounded-lg` → `rounded-md` (canonical 8px container). Everything else (state, RouteRenderer, conditional toolbar/FilterBar) is unchanged.

- [ ] **Step 4: Add an `AppShell.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("renders topBar, sidebar, and children slots on the secondary chrome", () => {
    const { container } = render(
      <AppShell topBar={<div>TOPBAR</div>} sidebar={<div>SIDEBAR</div>}>
        <div>CONTENT</div>
      </AppShell>
    );
    expect(screen.getByText("TOPBAR")).toBeInTheDocument();
    expect(screen.getByText("SIDEBAR")).toBeInTheDocument();
    expect(screen.getByText("CONTENT")).toBeInTheDocument();
    expect((container.firstChild as HTMLElement).className).toMatch(/bg-secondary/);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd frontend && npm test`
Expected: PASS (AppShell test + all prior). `App.tsx` is exercised indirectly by any App-level test; if one asserts the old outer class (`bg-surface-2`), update it to `bg-secondary`.

- [ ] **Step 6: Run build**

Run: `cd frontend && npm run build`
Expected: `tsc -b` + Vite build succeed. PageHeader compiles (unused for now — that's fine; it's vendored for Phase 5).

- [ ] **Step 7: Live check both themes**

`cd frontend && npm run dev`, Chrome. Confirm the full shell: light `#f7f7f7` chrome, TopBar + Sidebar share that bg with no dividers, the routed content sits in a white `rounded-md` bordered card with right/bottom margin; a dashboard page shows the toolbar (tabs + Exec Summary + Ask APEX) above the card and the FilterBar when present; nav + collapse + UserMenu + admin context all still work; toggle dark — the whole shell themes correctly (chrome dark, card dark, primitives legible). No console errors beyond `/api` 401s.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/shell/AppShell.tsx frontend/src/components/shell/AppShell.test.tsx frontend/src/components/shell/PageHeader.tsx frontend/src/App.tsx
git commit -m "feat(shell): compose canonical AppShell (rounded content card) + vendor PageHeader; retire hand-built layout

Co-authored-by: Isaac"
```

---

## Self-Review

**Spec coverage (Phase 4 = "Shell"):**
- "Vendor `AppShell`" → Task 3 Step 1 (adapted: desktop-only, no Sheet/GenieCodePanel — documented deviations). ✅
- "`TopBar`" → Task 2 (adapted to our chrome). ✅
- "`Sidebar`" → Task 1 (canonical styling). ✅
- "`PageHeader`" → Task 3 Step 2 (vendored near-verbatim; wired per-page in Phase 5). ✅
- "feed nav from our registry/routes (make the hardcoded `NAV_SECTIONS` a prop)" → Task 1 (Sidebar takes `sections` prop; App builds them from `useRoutes()`). ✅
- "swap `DatabricksLogo` → our `BrandLogo`" → Task 2 (TopBar uses `BrandLogo`; kit's `DatabricksLogo` never imported). ✅
- "drop `NewButton`" → not imported anywhere (kit Sidebar's `NewButton` is gone in our rewrite). ✅
- "retire our hand-built shell + the full-width top bar" → Task 2 deletes `BrandBlock`; Task 3 replaces the hand-built full-width layout with `AppShell`. ✅
- Green build + live check both themes → each task. ✅
- No functional regression (UserMenu/ClientBadge/Breadcrumb/admin context/collapse) → preserved in Tasks 1-2, verified in live checks. ✅

**Type consistency:** `SidebarNavItem`/`SidebarNavSection`/`SidebarProps` defined in Task 1 Interfaces + exported from `Sidebar.tsx`, imported by `App.tsx` (Task 1 Step 2) and used in `Sidebar.test.tsx` (Step 4) with matching shape. `TopBar` props `{collapsed,onToggle}` unchanged across Task 2 + Task 3's `AppShell` slot. `AppShell` slot props (`topBar`/`sidebar`/`children`) defined Task 3 Interfaces + used in App Step 3. `ICON_MAP` gains `ArrowLeftNav` (Task 1 Step 3) consumed by the admin Back item (Step 2).

**Placeholder scan:** No TBD/"handle edge cases"/"similar to". The two investigate-then-edit steps — Task 2 Step 3 (shell.test provider setup) and Step 4 (mirror existing `RegistryProvider` test wrapper) — name the exact remedy and where to copy the pattern from, bounded to the test. `App.tsx` edits give full replacement JSX. Not placeholders.

**Deviations from spec, called out:** (a) shell components are ADAPTED not verbatim-vendored (the kit's are Next.js console chrome; verbatim would import search/workspace/switcher/create-menu that Prism explicitly rejects) — the user chose the "literal spec: vendor + strip" path, and stripping to our chrome is the faithful realization; (b) mobile Sheet sidebar + GenieCodePanel dropped from AppShell (out of scope — desktop analytics app); (c) our functional leaf components (UserMenu/ClientBadge/Breadcrumb/BrandLogo) are reused rather than replaced, since the kit has no equivalent — retiring them would be a functional regression the Global Constraints forbid.
