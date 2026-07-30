# Fully-Light Shell Re-tune (Lakewatch) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-tune the APEX shell (top-bar brand block + sidebar rail) from dark to a fully-light, Lakewatch-faithful treatment: seamless light bar, light sidebar barely distinct from the main pane, active nav = soft blue-tint pill, gradient mark as the only color pop, plus a subtle config-toggleable dark top-edge strip.

**Architecture:** Class-only token substitution against the Phase-0 seam (replace the dark `--brand-sidebar-*` gradient + `text-white`/`white/NN` classes with light `surface`/`fg`/`border`/`accent` tokens), plus one small config knob (`shell.topStrip`) added to `brand.ts` + `brand.config.json` and rendered in `TopBar`. No behavior/routing/data change.

**Tech Stack:** React 19 + TS, react-router-dom, Tailwind v4 (Phase-0 `surface-*`/`fg-*`/`accent*`/`border-*` + `var(--fill-*)`, plus `bg-accent/10` color-mix tint), Vitest 3.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-30-light-shell-retune-design.md`. This REVERSES the earlier dark-rail / dark-L-shape decisions — the shell is now fully light. The GradientMark, the gradient composer border, and the small gradient user-menu avatar remain the only color flourishes.
- **Valid tokens ONLY** (a missing utility silently emits no CSS): `accent, accent-fg, accent-hover` and `bg-accent/10` (Tailwind v4 color-mix opacity — valid) · `surface, surface-2, surface-3` · `fg, fg-2, fg-muted, fg-subtle` · `border, border-hover, border-emphasis` · arbitrary `[var(--fill-hover|active|press)]`. There is NO `surface-1`, `accent-alt`, `accent-light`, etc.
- **REMOVE all dark-rail classes from the shell:** no `bg-brand-sidebar-from`, no `bg-linear-to-b from-brand-sidebar-*`, no `text-white`, no `text-white/NN`, no `bg-white/NN`, no `border-white/NN` in `BrandBlock.tsx` or `Sidebar.tsx` after this plan. (They were the intentional dark departure — now retired.)
- **The gradient user-menu avatar** (`from-brand-primary to-brand-accent text-white` in `UserMenu.tsx`) is OUT OF SCOPE and stays — do not touch `UserMenu.tsx`.
- **No behavior/routing/data change.** All hooks, routing, collapse state, `NavItem` nav logic, the admin-context switch, and the operator guard stay byte-for-byte. Only className/markup + the one config knob.
- **`cn()` is a naive string-join** — edit the source literal; in tests assert on the element's OWN className where possible (the Sidebar active-row test intentionally asserts on `innerHTML` for the marker/tint — see Task 2).
- **jsdom 29.1.1 has no localStorage** → the mock in `frontend/vitest.setup.ts` is load-bearing; don't touch it.
- Weights ≤ 600; radii from the `--radius` scale (`rounded-md`).
- `cd frontend && npm test` (currently 94/94) and `npm run build` green after every task.
- Commits end with a `Co-authored-by: Isaac` trailer; never `--no-verify`. (Git hooks print harmless zoxide/Databricks warnings on stderr — ignore.)

**Reference:** the already-light `HomePage.tsx` + the converted `ui/*` primitives show the target light-token patterns. Lakewatch screenshots (in the spec) are the visual target: light sidebar ~`bg-surface-2`, active row = blue-tint pill + blue text/icon, muted-gray section headings.

---

## File Structure

**Modified:**
- `frontend/src/components/shell/BrandBlock.tsx` — dark → light brand block; fix tagline truncation.
- `frontend/src/components/shell/shell.test.tsx` — update the BrandBlock assertion (no longer `bg-brand-sidebar-from`).
- `frontend/src/components/Sidebar.tsx` — dark rail → light rail; active row → blue-tint pill.
- `frontend/src/components/Sidebar.test.tsx` — update the active-row assertion to the new pill.
- `frontend/src/theme/brand.ts` — add optional `shell?: { topStrip?: { enabled: boolean; color: string } }` to the `Brand` type.
- `brand.config.json` (repo root) — add the `shell.topStrip` block.
- `frontend/src/components/shell/TopBar.tsx` — render the config-driven top-edge strip.

**No new component files.**

---

### Task 1: `BrandBlock` → light + tagline fix

**Files:**
- Modify: `frontend/src/components/shell/BrandBlock.tsx`
- Test: `frontend/src/components/shell/shell.test.tsx` (update the BrandBlock describe block)

**Interfaces:** unchanged — `BrandBlock({ collapsed: boolean; onToggle: () => void })`, default export.

**Current state:** the block is dark (`bg-brand-sidebar-from border-r border-white/10`), app name `text-white`, tagline `text-white/40 ... truncate` (clips as "TRAVEL INTELLIGEN…"), toggle `text-white/40 hover:text-white hover:bg-white/5`.

- [ ] **Step 1: Update the failing test first.** In `shell/shell.test.tsx`, the BrandBlock "expanded" test currently asserts `expect(container.innerHTML).toMatch(/bg-brand-sidebar-from/)`. Replace that line with light-token assertions:
```tsx
    // light brand block (dark rail retired) — no dark classes
    expect(container.innerHTML).not.toMatch(/bg-brand-sidebar-from|text-white|white\//);
    expect(container.innerHTML).toMatch(/w-\[224px\]/);
    expect(screen.getByTitle(/collapse sidebar/i)).toBeInTheDocument();
```
(Keep the other two BrandBlock tests — collapsed `w-[60px]` + expand affordance, and the onToggle-fires test — unchanged; they don't reference dark classes.)

- [ ] **Step 2: Run → the expanded test fails** (current code still emits dark classes). `cd frontend && npx vitest run src/components/shell/shell.test.tsx`.

- [ ] **Step 3: Convert `BrandBlock.tsx`** to light. Replace the component body with:
```tsx
import { cn } from "@/lib/utils";
import { PanelLeftClose } from "lucide-react";
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
        "flex items-center h-full shrink-0 border-r border-border transition-all duration-200",
        collapsed ? "w-[60px] justify-center" : "w-[224px] gap-2.5 px-3"
      )}
    >
      {collapsed ? (
        <button
          onClick={onToggle}
          title="Expand sidebar"
          className="p-1 rounded-lg hover:bg-[var(--fill-hover)] transition-colors"
        >
          <BrandLogo variant="mark" className="w-8 h-8 text-base" />
        </button>
      ) : (
        <>
          <BrandLogo variant="mark" className="w-8 h-8 text-base shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold tracking-tight text-fg leading-none">
              {brand.identity.appName}
            </div>
            <div className="text-[8.5px] text-fg-muted tracking-[0.16em] uppercase mt-1 truncate">
              {brand.identity.tagline}
            </div>
          </div>
          <button
            onClick={onToggle}
            title="Collapse sidebar"
            className="p-1.5 text-fg-muted hover:text-fg hover:bg-[var(--fill-hover)] transition-colors rounded-lg shrink-0"
          >
            <PanelLeftClose size={16} />
          </button>
        </>
      )}
    </div>
  );
}
```
(Tagline fix: tightened tracking `0.18em`→`0.16em` so "TRAVEL INTELLIGENCE" fits the 224px block without clipping. `truncate` is kept as a safety net. The current `brand.config.json` tagline is "Travel Intelligence"; verify it fits — if the live check in Task 4 still shows a clip, the fallback is fine since `truncate` prevents overflow.)

- [ ] **Step 4: Run → passes.** Then full suite + build. `cd frontend && npm test && npm run build`.
- [ ] **Step 5: Grep guard.** `cd frontend && grep -nE "bg-brand-sidebar|text-white|white/|bg-white" src/components/shell/BrandBlock.tsx` → empty.
- [ ] **Step 6: Commit.**
```bash
git add frontend/src/components/shell/BrandBlock.tsx frontend/src/components/shell/shell.test.tsx
git commit -m "feat(shell): light BrandBlock (retire dark rail, fix tagline clip)

Co-authored-by: Isaac"
```

---

### Task 2: `Sidebar` → light rail + blue-tint active pill

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Test: `frontend/src/components/Sidebar.test.tsx` (update the active-row assertion)

**Interfaces:** unchanged — `Sidebar({ collapsed: boolean })`, default export. NavItem logic, the admin-context switch, and the operator guard are byte-for-byte preserved; ONLY color classes change.

**Current dark classes to replace (there are several occurrences of the same patterns):**
- `<aside>`: `bg-linear-to-b from-brand-sidebar-from via-brand-sidebar-via to-brand-sidebar-to` → `bg-surface-2 border-r border-border`.
- `NavItem` active: `bg-white/10 text-white` → `bg-accent/10 text-accent`; inactive: `text-white/55 hover:bg-white/5 hover:text-white` → `text-fg-2 hover:bg-[var(--fill-hover)] hover:text-fg`.
- `NavItem` active left marker span `bg-accent` — **REMOVE** the whole `{isActive && !collapsed && (<span ... bg-accent />)}` block (Lakewatch uses the tint pill, no marker); the tint pill now carries the active state.
- `NavItem` icon active `text-accent` (keep) / inactive `text-white/55 group-hover:text-white` → `text-fg-muted group-hover:text-fg`.
- `NavItem` placeholder chip: `bg-white/10 text-white/50` → `bg-accent/10 text-accent`.
- "Back to APEX" button: `text-white/55 hover:bg-white/5 hover:text-white` → `text-fg-2 hover:bg-[var(--fill-hover)] hover:text-fg`; its `ArrowLeft` icon `text-white/55 group-hover:text-white` → `text-fg-muted group-hover:text-fg`.
- Section headings (3 occurrences: "Administration", "Insights & Analytics", "Exploration"): `text-white/30` → `text-fg-muted`.
- Admin footer border `border-white/10` → `border-border`; the Admin button `text-white/55 hover:bg-white/5 hover:text-white` → `text-fg-2 hover:bg-[var(--fill-hover)] hover:text-fg`; its `Settings` icon `text-white/55 group-hover:text-white` → `text-fg-muted group-hover:text-fg`.

- [ ] **Step 1: READ `Sidebar.tsx`** fully to see every dark class occurrence before editing.

- [ ] **Step 2: Update the failing test.** In `Sidebar.test.tsx`, the active-row test (currently: `expect(home.innerHTML).toMatch(/bg-accent\b/)` for the left marker) must change to assert the new tint pill. Replace the two assertion lines in that test with:
```tsx
    // active row uses the DuBois blue-tint pill (not the legacy brand-accent, not a dark pill)
    expect(home.className).toMatch(/bg-accent\/10/);
    expect(home.className).toMatch(/text-accent/);
    expect(home.innerHTML).not.toMatch(/bg-brand-accent\b|bg-white\//);
```
(Note: assert on `home.className` — the active classes are now on the button itself, not a child marker span. `home` is `screen.getByText("Home").closest("button")`.)

- [ ] **Step 3: Run → fails.** `cd frontend && npx vitest run src/components/Sidebar.test.tsx`.

- [ ] **Step 4: Apply the class replacements** listed above to `Sidebar.tsx`. Specifically:
  - `<aside>` className: replace the `bg-linear-to-b from-brand-sidebar-from via-brand-sidebar-via to-brand-sidebar-to` segment with `bg-surface-2 border-r border-border`.
  - In `NavItem`: change the active/inactive branches to `bg-accent/10 text-accent` / `text-fg-2 hover:bg-[var(--fill-hover)] hover:text-fg`; DELETE the `{isActive && !collapsed && (<span ... bg-accent />)}` marker block entirely; icon inactive → `text-fg-muted group-hover:text-fg` (active stays `text-accent`); placeholder chip → `bg-accent/10 text-accent`.
  - "Back to APEX" button + its icon → light tokens as listed.
  - All three section-heading `text-white/30` → `text-fg-muted`.
  - Admin footer border + button + icon → light tokens as listed.

- [ ] **Step 5: Run → passes.** Full suite + build. `cd frontend && npm test && npm run build`.
- [ ] **Step 6: Grep guard.** `cd frontend && grep -nE "brand-sidebar|text-white|white/|bg-white" src/components/Sidebar.tsx` → empty.
- [ ] **Step 7: Commit.**
```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/Sidebar.test.tsx
git commit -m "feat(shell): light sidebar rail + blue-tint active nav pill

Co-authored-by: Isaac"
```

---

### Task 3: Config-driven top-edge strip

**Files:**
- Modify: `frontend/src/theme/brand.ts`, `brand.config.json` (repo root), `frontend/src/components/shell/TopBar.tsx`
- Test: `frontend/src/components/shell/shell.test.tsx` (extend the TopBar describe block)

**Interfaces:**
- `brand.ts` `Brand` type gains: `shell?: { topStrip?: { enabled: boolean; color: string } }`.
- `TopBar` reads `brand.shell?.topStrip` and renders a ~2px top-edge strip when `enabled`.

- [ ] **Step 1: Add the type** to `frontend/src/theme/brand.ts` `Brand` interface (after `defaults`):
```ts
  shell?: {
    topStrip?: { enabled: boolean; color: string };
  };
```

- [ ] **Step 2: Add the config** to `brand.config.json` (repo root) — a new top-level `"shell"` key (sibling of `"colors"`, `"typography"`, `"defaults"`):
```json
  "shell": {
    "topStrip": { "enabled": true, "color": "#191D24" }
  }
```
(`#191D24` = the dark n11 neutral — a subtle near-black hairline. Place it as a new key; keep valid JSON — add a comma after the preceding block.)

- [ ] **Step 3: Add the failing test** to the TopBar describe block in `shell/shell.test.tsx`:
```tsx
  it("renders the config-driven top-edge strip when enabled", () => {
    const { container } = renderTopBar();
    // a thin top strip element carrying the configured color as an inline style
    const strip = container.querySelector('[data-testid="topbar-strip"]');
    expect(strip).not.toBeNull();
  });
```

- [ ] **Step 4: Run → fails.** `cd frontend && npx vitest run src/components/shell/shell.test.tsx`.

- [ ] **Step 5: Render the strip** in `TopBar.tsx`. Import `brand`:
```tsx
import { brand } from "@/theme/brand";
```
Inside the component, read the config and render the strip as the first child of the `<header>` (absolutely positioned along the top edge). Change the `<header>` return to:
```tsx
  const topStrip = brand.shell?.topStrip;
  return (
    <header className="relative z-40 h-12 flex shrink-0 border-b border-border">
      {topStrip?.enabled && (
        <div
          data-testid="topbar-strip"
          className="absolute inset-x-0 top-0 h-[2px] z-50"
          style={{ backgroundColor: topStrip.color }}
        />
      )}
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
```
(The strip color is an inline element style — that's fine here: it's a brand-config value, NOT a theme-variant neutral, so it does not violate the "no inline neutral ramp" invariant. It's a fixed hairline color by design.)

- [ ] **Step 6: Run → passes.** Full suite + build.
- [ ] **Step 7: Grep guard.** `cd frontend && grep -nE "brand-sidebar|text-white|white/" src/components/shell/TopBar.tsx` → empty. And confirm `brand.config.json` is valid: `cd frontend && node -e "JSON.parse(require('fs').readFileSync('../brand.config.json','utf8')); console.log('valid json')"`.
- [ ] **Step 8: Commit.**
```bash
git add frontend/src/theme/brand.ts brand.config.json frontend/src/components/shell/TopBar.tsx frontend/src/components/shell/shell.test.tsx
git commit -m "feat(shell): config-driven top-edge strip (shell.topStrip)

Co-authored-by: Isaac"
```

---

### Task 4: Verification checkpoint (no code)

- [ ] **Step 1: Full green.** `cd frontend && npm test && npm run build`.
- [ ] **Step 2: Whole-plan grep guard.**
```bash
cd frontend && grep -rnE "brand-sidebar|text-white|white/[0-9]|bg-white" src/components/shell/ src/components/Sidebar.tsx | grep -v ".test." || echo "shell light — clean"
```
Expected: `shell light — clean`.
- [ ] **Step 3: Live Chrome check** (dev server http://localhost:5173/), BOTH light + dark:
  - Top bar is one seamless light surface — no dark navy block, no hard dark/light seam.
  - Sidebar is a subtle light tint (`bg-surface-2`), barely distinct from the main pane, thin right border.
  - Active nav row = soft blue-tint pill (`bg-accent/10`) + blue text + blue icon; inactive rows dark-gray; hover a subtle fill.
  - Section headings are muted-gray uppercase.
  - Tagline reads fully ("Travel Intelligence"), not clipped.
  - The top-edge strip is a subtle ~2px dark hairline along the very top.
  - Collapse still works (224↔60, brand + sidebar in lockstep, dividers aligned).
  - Dark mode: the whole shell flips to dark surfaces cleanly; blue-tint pill still reads; 0 console errors (401s from the missing backend are expected).
  - Screenshots `/tmp/apex-lightshell-{light,dark}.png` + `/tmp/apex-lightshell-collapsed.png`.
- [ ] **Step 4: Update ledger/memory** (`apex-design-system-adoption` — note the shell is now fully light; the dark-rail departure retired). Do NOT push (batch per Rohit's cadence / await his call).

---

## Self-Review

**Spec coverage:** Light top bar + brand block (Task 1). Tagline fix (Task 1). Light sidebar rail + blue-tint active pill + muted headings + light admin nav/footer (Task 2). Config-toggleable top strip (Task 3). Dark-mode via existing tokens (verified Task 4). Config-driven preserved — `shell.topStrip` knob + `bg-accent/10` auto-tint, no hardcoded shell colors (Tasks 2-3). ✅

**Placeholder scan:** Every task carries the exact classes/code to write; the Sidebar task enumerates each dark-class occurrence + its light replacement; no "convert appropriately". ✅

**Type consistency:** `BrandBlock`/`Sidebar`/`TopBar` signatures unchanged. `brand.ts` adds an OPTIONAL `shell` field (won't break existing `brand.test.ts` which reads `colors.*`). `TopBar` reads `brand.shell?.topStrip` (optional-chained, safe if absent). ✅

**Ordering rationale:** BrandBlock first (biggest single visual win, isolated), Sidebar second (the bulk of the dark→light class work, independently testable), top strip third (additive flourish, needs the light bar to exist first to look right), verify last. Each task independently shippable + testable, and each ends green. ✅

## Execution Handoff

(see chat)
