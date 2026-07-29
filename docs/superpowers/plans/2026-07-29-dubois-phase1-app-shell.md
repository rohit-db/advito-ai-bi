# DuBois Adoption — Phase 1 (App Shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert APEX's app shell — top bar, sidebar nav, and the main-pane frame — to the DuBois visual language on the Phase-0 token foundation, so the highest-visibility chrome reads as DuBois and flips correctly between light and dark.

**Architecture:** Re-skin existing components by swapping hardcoded `slate-*`/`white` classes for the Phase-0 semantic token utilities (`surface`/`surface-2`/`fg`/`fg-muted`/`border`/`fill-*`) and DuBois metrics (48px top bar, tight nav rows, `--radius` tokens). Per the locked decision, the **sidebar keeps its dark brand gradient in both themes** (a deliberate departure from DuBois's monochrome sidebar) but adopts DuBois nav-item metrics and uses the DuBois `--accent` for the active row. The main content region moves onto theme-aware surface tokens so non-dashboard pages render correctly in dark.

**Tech Stack:** React 19 + TS, Vite 7, Tailwind v4 (Phase-0 `surface-*`/`fg-*`/`accent*` utilities + `--fill-*` CSS vars), lucide-react, Vitest 3 + Testing Library + jsdom.

## Global Constraints

- **Build on the Phase-0 token seam only.** Use the utilities/vars added in Phase 0: `bg-surface`/`bg-surface-2`/`bg-surface-3`, `text-fg`/`text-fg-2`/`text-fg-muted`/`text-fg-subtle`/`text-fg-ghost`, `border-border`/`border-border-hover`, `bg-accent`/`text-accent`/`bg-accent-hover`, and the raw `var(--fill-hover)`/`var(--fill-active)`/`var(--fill-press)` for overlay fills. Do NOT introduce new hex values or new tokens.
- **Never hardcode brand values** (AGENTS.md invariant). No literal `slate-*`, `white`, `#hex`, or `bg-white` left in a converted surface — every color goes through a token. EXCEPTION: the sidebar's dark rail intentionally keeps `white`/`white/NN` opacity utilities for its on-dark text (it is dark in both themes by design) and the `from-brand-sidebar-* via/to` gradient. That exception is limited to `Sidebar.tsx`.
- **DuBois departures are deliberate and must NOT be flagged as defects:** (1) the sidebar stays a dark brand gradient in both themes (DuBois's sidebar is monochrome `n2`); (2) the top-bar avatar keeps its `from-brand-primary to-brand-accent` gradient as a brand "key highlight". Both are approved product decisions.
- **Accent usage stays in-role.** `--accent` (via `bg-accent`/`text-accent`) is allowed only for: primary buttons, the active nav row marker + active nav icon, focus rings, and key highlights. Do not let accent leak into general chrome.
- **DuBois metrics:** top bar 48px tall; nav rows compact with `--radius-md`; type weights never above 500 (`font-medium`, not `font-semibold`, for titles); tight radii from the `--radius` scale.
- **No behavior/route/data change.** Only classes/markup for styling change. Breadcrumb logic, user menu, theme toggle, nav routing, admin gating, and all props stay identical.
- **Out of scope (Phase 3, leave as-is):** the `isCustom` dashboard toolbar (`App.tsx` page-tabs + Executive Summary / Ask APEX buttons), the `FilterBar`, the embedded dashboard iframes, and all `/pages/*` + admin page bodies. It is EXPECTED that on dashboard pages in dark mode the toolbar/filter strip and iframe won't match yet — the spec calls this intermediate state out. React pages (Home, Ask APEX, admin) have no toolbar and should look clean in both themes.
- `cd frontend && npm test` (currently 57/57) and `npm run build` (`tsc -b && vite build`) green after every task.
- Commits end with a `Co-authored-by: Isaac` trailer; never `--no-verify`.

**DuBois shell metrics (verbatim from `kit.css`, for reference):**
```
.topbar   { height:48px; gap:8px; padding:0 12px; background:var(--n2); }
.topbar-title { font-size:12px; font-weight:500; color:var(--n11); }
.shell     { background:var(--n2); }              /* app root */
.shell-main{ background:var(--n1); border:1px solid rgba(var(--overlay),0.08); border-radius:var(--radius-lg); margin:0 8px 8px 0; }
.nav-item  { height:24px; gap:8px; padding:0 8px; border-radius:var(--radius-md); font-size:12px; }
.nav-item.active { background:rgba(var(--overlay),0.08); color:var(--n11); font-weight:500; }
.nav-section { font-size:10px; color:var(--n8); padding:12px 8px 4px; }
.page-title{ font-size:14px; font-weight:500; }
```
(APEX keeps 13px nav/title text rather than DuBois's 12px, to stay legible in this app — a deliberate, consistent local scale. Follow the metrics otherwise.)

---

## File Structure

**Modified:**
- `frontend/src/components/Header.tsx` — top bar → DuBois tokens + 48px + metrics; also fixes the Phase-0 deferred minor (Popover children indentation).
- `frontend/src/components/Sidebar.tsx` — nav-item metrics → DuBois radii/spacing; active markers `bg-brand-accent`→`bg-accent`, `text-brand-accent`→`text-accent`; keep gradient + white text.
- `frontend/src/App.tsx` — shell root + main content region → theme-aware surface tokens + DuBois `shell-main` bordered-pane treatment (only around the shell frame, NOT clipping the iframe scroll area).

**No new files.** Existing tests (`Header` has none; `Sidebar.test.tsx` asserts text, resilient) stay green; add class-level assertions only where a task's DoD needs to prove a token landed.

---

### Task 1: Top bar (Header) → DuBois

**Files:**
- Modify: `frontend/src/components/Header.tsx`
- Test: `frontend/src/components/Header.test.tsx` (create — none exists)

**Interfaces:**
- Consumes: `useUser`, `useRoutes`, `ThemeToggle` (Phase-0), `Avatar`/`Popover` UI primitives — all unchanged.
- Produces: same `Header` default export, same DOM structure/behavior; only classes + the header height change.

- [ ] **Step 1: Write a failing test** — `frontend/src/components/Header.test.tsx`. This locks the DuBois conversion (token classes, no slate) and the correct breadcrumb behavior:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Header from "./Header";
import { RegistryContext } from "@/registry/useRegistry";
import type { Registry } from "@/registry/types";

const registry: Registry = { assets: {} };

function renderHeader(path = "/") {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true, status: 200,
    json: async () => ({ email: "u@x.com", role: "user", tenant: "*", authenticated: true, displayName: "Test User" }),
  })));
  return render(
    <RegistryContext.Provider value={registry}>
      <MemoryRouter initialEntries={[path]}>
        <Header />
      </MemoryRouter>
    </RegistryContext.Provider>
  );
}

describe("Header (DuBois top bar)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders the top bar with the DuBois 48px height + surface token, no slate", () => {
    const { container } = renderHeader();
    const header = container.querySelector("header")!;
    expect(header).toBeInTheDocument();
    // 48px tall (h-12) and surface-2 background token
    expect(header.className).toMatch(/\bh-12\b/);
    expect(header.className).toMatch(/bg-surface-2/);
    // no legacy slate/white chrome anywhere in the header markup
    expect(header.innerHTML).not.toMatch(/slate-/);
    expect(header.className).not.toMatch(/bg-white/);
  });

  it("mounts the theme toggle", () => {
    renderHeader();
    expect(screen.getByRole("button", { name: /switch to (dark|light) theme/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.** Run: `cd frontend && npx vitest run src/components/Header.test.tsx`
Expected: FAIL — current header is `h-14` + `bg-white/90` + `slate-*`.

- [ ] **Step 3: Rewrite `frontend/src/components/Header.tsx`.** Replace the file with the DuBois-tokenized version below. Changes: `h-14`→`h-12`, `bg-white/90 backdrop-blur-sm border-slate-200`→`bg-surface-2 border-border`, `px-5`→`px-4`; breadcrumb slate colors → `fg-*`; title `text-[15px] font-semibold text-slate-900`→`text-[13px] font-medium text-fg`; user-menu slate → tokens; sign-out hover → `var(--fill-hover)`; and the theme-toggle + Popover wrapped in the flex cluster with correct indentation (this also resolves the Phase-0 deferred Header indentation minor). Avatar gradient is KEPT (approved brand highlight).
```tsx
import { useLocation } from "react-router-dom";
import { ChevronRight, LogOut } from "lucide-react";
import { useRoutes } from "@/registry/useRegistry";
import { useUser } from "@/hooks/useUser";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ThemeToggle from "@/theme/ThemeToggle";

const SECTION_LABELS: Record<string, string> = {
  insights: "Insights & Analytics",
  exploration: "Exploration",
};

export default function Header() {
  const location = useLocation();
  const { user } = useUser();
  const routes = useRoutes();

  const currentRoute = routes.find((r) => r.path === location.pathname);
  const pageTitle = currentRoute?.label ?? "APEX";
  const sectionLabel = currentRoute ? SECTION_LABELS[currentRoute.section] : undefined;

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
    <header className="relative z-40 h-12 bg-surface-2 border-b border-border flex items-center justify-between px-4 shrink-0">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 min-w-0" aria-label="Breadcrumb">
        {sectionLabel && (
          <>
            <span className="text-[13px] text-fg-muted truncate hidden sm:inline">{sectionLabel}</span>
            <ChevronRight size={14} className="text-fg-subtle shrink-0 hidden sm:inline" />
          </>
        )}
        <span className="text-[13px] font-medium text-fg tracking-tight truncate">
          {pageTitle}
        </span>
      </nav>

      {/* Right cluster: theme toggle + user menu */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
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
      </div>
    </header>
  );
}
```
Note: `PopoverContent` background comes from the popover primitive; if it renders white in dark mode that's a Phase-3 primitive conversion — do NOT change the primitive here. This task only converts `Header.tsx`.

- [ ] **Step 4: Run the test to verify it passes.** Run: `cd frontend && npx vitest run src/components/Header.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Full suite + build.** Run: `cd frontend && npm test && npm run build`
Expected: PASS both (was 57, now 59 with the +2 Header tests).

- [ ] **Step 6: Commit.**
```bash
git add frontend/src/components/Header.tsx frontend/src/components/Header.test.tsx
git commit -m "feat(shell): DuBois top bar — 48px, surface/fg tokens, theme-aware

Converts Header off slate/white onto Phase-0 semantic tokens; adopts the
48px DuBois top-bar height and 500-weight title. Keeps the brand-gradient
avatar as an approved accent highlight. Fixes the Phase-0 Popover-wrap
indentation.

Co-authored-by: Isaac"
```

---

### Task 2: Sidebar nav → DuBois metrics (dark rail kept)

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Test: `frontend/src/components/Sidebar.test.tsx` (existing — keep green; add one active-marker assertion)

**Interfaces:**
- Consumes: `useRoutes`, `useUser`, `ICON_MAP`, `BrandLogo`, admin context — all unchanged.
- Produces: same `Sidebar` default export + `SidebarProps`; behavior identical. Only nav-row radii/spacing tighten and the active-state markers move from `brand-accent` (legacy #6366f1) to `accent` (DuBois #4f46e5).

- [ ] **Step 1: Add a failing assertion** to `frontend/src/components/Sidebar.test.tsx` — prove the active nav row uses the DuBois `--accent` marker, not the legacy sidebar accent. Add this case inside the `describe("Sidebar", …)` block:
```tsx
  it("marks the active nav row with the DuBois accent (bg-accent), not the legacy brand-accent", () => {
    renderSidebar({ assets: { spend: asset("Spend", "/", 1) } });
    // The "/" (Home) route is active in MemoryRouter's default location.
    const home = screen.getByText("Home").closest("button")!;
    // active left marker span uses bg-accent
    expect(home.innerHTML).toMatch(/bg-accent\b/);
    expect(home.innerHTML).not.toMatch(/bg-brand-accent\b/);
  });
```

- [ ] **Step 2: Run the test to verify it fails.** Run: `cd frontend && npx vitest run src/components/Sidebar.test.tsx`
Expected: FAIL on the new case — current markers are `bg-brand-accent` / `text-brand-accent`.

- [ ] **Step 3: Edit `frontend/src/components/Sidebar.tsx`.** Three concrete edits; leave the gradient (`from-brand-sidebar-*`), white text, and all logic untouched.

  (a) In `NavItem`, tighten the row radius and spacing to DuBois and switch the active markers to accent. Replace the active-marker span (currently line ~53):
```tsx
        {isActive && !collapsed && (
          <span className="absolute left-0 inset-y-1.5 w-[3px] rounded-r-full bg-accent" />
        )}
```
and the icon's active color (currently line ~59) — change `text-brand-accent` to `text-accent`:
```tsx
            className={cn("shrink-0 transition-colors", isActive ? "text-accent" : "text-white/55 group-hover:text-white")}
```
and change the row container's `rounded-lg` → `rounded-md` (DuBois nav radius) in the NavItem `className` (line ~45):
```tsx
          "group relative w-full flex items-center rounded-md transition-all duration-150",
```

  (b) Apply the same `rounded-lg`→`rounded-md` to the two other nav-style buttons for consistency: the "Back to APEX" button (line ~143) and the Admin footer button (line ~230). (Both currently `rounded-lg`.)

  (c) Leave the collapse-toggle button, client badge, section captions, and logo block as-is (already DuBois-dense and on the dark rail).

- [ ] **Step 4: Run the test to verify it passes.** Run: `cd frontend && npx vitest run src/components/Sidebar.test.tsx`
Expected: PASS — all existing cases + the new active-marker case.

- [ ] **Step 5: Full suite + build.** Run: `cd frontend && npm test && npm run build`
Expected: PASS both.

- [ ] **Step 6: Commit.**
```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/Sidebar.test.tsx
git commit -m "feat(shell): sidebar adopts DuBois nav metrics + accent active row

Tightens nav rows to --radius-md and moves the active marker/icon onto the
DuBois --accent role. Keeps the dark brand-gradient rail (deliberate
departure from DuBois's monochrome sidebar).

Co-authored-by: Isaac"
```

---

### Task 3: Shell frame → theme-aware surfaces + DuBois main pane

**Files:**
- Modify: `frontend/src/App.tsx` (shell layout only — the JSX returned from `App()`, lines ~182-268; do NOT touch `RouteRenderer`, the filter/prefs logic, or routing)

**Interfaces:**
- Consumes: `Sidebar`, `Header`, `FilterBar`, the route table — unchanged.
- Produces: same component tree + routes; only the shell wrapper backgrounds/frame classes change so the chrome is theme-aware and the main pane reads as the DuBois `shell-main`.

- [ ] **Step 1: Convert the shell wrappers in `App.tsx`.** Make exactly these class edits in the `return (…)` block. No structural/route changes.

  (a) Shell root — give it the DuBois shell background (`--surface-2`). Current (line ~183):
  ```tsx
      <div className="h-full flex">
  ```
  →
  ```tsx
      <div className="h-full flex bg-surface-2">
  ```

  (b) Main content region — the DuBois `shell-main` is a bordered `--surface` pane with `radius-lg`. Apply it to `<main>` WITHOUT `overflow-hidden` on the flex column (dashboards/iframes manage their own scroll; clipping would break them). Current (line ~236):
  ```tsx
          <main className="flex-1 flex flex-col min-w-0">
  ```
  →
  ```tsx
          <main className="flex-1 flex flex-col min-w-0 bg-surface border border-border rounded-lg mr-2 mb-2 overflow-y-auto">
  ```
  (Border + `radius-lg` + right/bottom margin = the DuBois inset pane; the sidebar's dark rail and the top bar form the other two edges, matching DuBois's shell composition. `overflow-y-auto` scrolls content inside the pane; the flex children still lay out normally.)

  (c) The wrapper `<div className="flex-1 flex min-h-0">` around `<main>` (line ~235) — leave as-is (it's the flex row that lets the future Phase-2 rail sit beside main).

  Leave the `isCustom` toolbar (`bg-white`, line ~193) and `FilterBar` UNCHANGED — Phase 3 owns those. It is expected they won't match in dark yet.

- [ ] **Step 2: Build + full suite.** Run: `cd frontend && npm run build && npm test`
Expected: PASS both (no test asserts these shell classes; behavior unchanged).

- [ ] **Step 3: Live iframe safety + dark-mode check (controller does this in Task 4's checkpoint, but the implementer must self-verify the pane doesn't clip).** Reason about it: `<main>` is `flex flex-col` + `overflow-y-auto`; the embedded dashboard (`CustomDashboard`) and react pages fill it. Confirm from the code that no child relies on `<main>` being `overflow-visible` in a way the pane breaks. If uncertain, note it as a concern in the report for the controller's live check — do not guess.

- [ ] **Step 4: Commit.**
```bash
git add frontend/src/App.tsx
git commit -m "feat(shell): DuBois shell frame — surface-2 root + bordered main pane

App root → --surface-2; <main> becomes the DuBois shell-main (bordered
--surface pane, radius-lg, inset margins) so non-dashboard chrome is
theme-aware. Dashboard toolbar/filter strip left for Phase 3.

Co-authored-by: Isaac"
```

---

### Task 4: Phase-1 verification checkpoint (no code)

**Files:** none (verification only).

- [ ] **Step 1: Full green.** Run: `cd frontend && npm test && npm run build`
Expected: entire Vitest suite PASS (59); build PASS.

- [ ] **Step 2: Grep guard — no leftover hardcoded chrome in converted files (sidebar's intentional white/gradient excepted).** Run:
```bash
cd frontend && echo "--- Header (expect NO slate/bg-white) ---" && grep -nE "slate-|bg-white" src/components/Header.tsx || echo "clean" ; echo "--- App shell wrappers (expect NO slate on the shell divs; bg-white toolbar is Phase-3, allowed) ---" && grep -nE "slate-" src/App.tsx || echo "clean"
```
Expected: Header clean; `App.tsx` has no `slate-` (the `bg-white` toolbar match is the known Phase-3 deferral, acceptable).

- [ ] **Step 3: Manual visual check (controller, Chrome MCP, dev server).** Load the app as a normal user and verify in BOTH themes:
  - **Light:** top bar reads as a clean 48px surface bar; sidebar dark gradient intact with tighter DuBois nav rows and the accent (#4f46e5) active marker; Home page sits in the bordered main pane; no visual regressions vs pre-phase.
  - **Dark (toggle):** top bar, breadcrumb, main pane, and Home page all flip to dark surfaces/text with legible contrast; sidebar stays dark (by design); NO white flashes on the shell chrome. (Dashboard toolbar/filter strip + iframe on a dashboard route may not match yet — expected, Phase 3.)
  - **Dashboard route (e.g. Spend):** confirm the embedded dashboard iframe STILL renders and scrolls inside the new main pane — the pane must not clip or collapse it.
  - 0 console errors. Capture `/tmp/apex-phase1-{light,dark}.png` and `/tmp/apex-phase1-dashboard.png`.

- [ ] **Step 4: Update the ledger/memory** with Phase 1 outcome + any deferrals; do NOT push (await Rohit).

---

## Self-Review

**Spec coverage (spec §"Component mapping" shell rows + §Phasing Phase 1):**
- App shell / main pane → Task 3 (`shell`/`shell-main`). ✅
- Top bar (48px, hosts theme toggle) → Task 1. ✅
- Sidebar nav (nav-item metrics, active → accent, nav-section caption) → Task 2; dark-rail departure documented per locked decision. ✅
- Page header/breadcrumb → Task 1 (breadcrumb in the top bar; in-page `.page-header` bodies are page-level, Phase 3). ✅
- "Foundation-first keeps everything rendering; shell before pages" → Phase 0 done; this is shell; pages deferred. ✅
- Light+dark verification each surface → Task 4 checkpoint. ✅
- Accent-overuse guard → Global Constraints + Task 2 marker test. ✅

**Placeholder scan:** No TBD/TODO; Header + Sidebar edits carry exact code/classes. Task 3 gives exact before→after class strings. Task 3 Step 3 is a reasoning step with a concrete escalation path (note concern for live check), not a vague "handle edge cases". ✅

**Type consistency:** No new types/signatures — all three components keep their existing exports and props (`Header` default, `Sidebar` default + `SidebarProps`, `App` default). Token utility names match Phase-0 exactly (`bg-surface-2`, `text-fg-muted`, `bg-accent`, `var(--fill-hover)`). ✅

## Execution Handoff

(see chat)
