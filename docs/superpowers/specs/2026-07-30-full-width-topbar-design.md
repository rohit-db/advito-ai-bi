# Full-Width Top Bar (Lakewatch-style shell) — Design Spec

**Date:** 2026-07-30
**Branch:** `feature/apex-theming`
**Status:** Approved (design), ready for implementation plan
**Related:** [DuBois design-system adoption](2026-07-29-dubois-design-system-adoption-design.md) · memory `apex-modular-components`, `apex-design-system-adoption`

## Goal

Restructure the APEX app shell so the top bar runs **edge-to-edge across the entire
page width** at the very top, with the brand in its top-left corner and the sidebar
starting **below** the bar — matching the Lakewatch reference app. Do it with **modular,
reusable components** so the bar can be recomposed and extended later.

## Motivation

Today APEX puts the sidebar full-height on the LEFT with the top bar only spanning the
content area to its right (`[Sidebar | (Header + body)]`). Rohit flagged the Lakewatch
full-width top-bar treatment as the anchor move for a more premium, app-like shell. This
spec captures that structural change plus a modular decomposition of the bar.

## Layout

Root shell flips from a **row** to a **column**:

```
┌─ TopBar (full width, h-12) ──────────────────────────────┐
│ ██ ◆ APEX  ≡ ██ │  Section › Page   •Client  ☀  ○ User    │
├─ dark brand ────┼──────────── light bar ──────────────────┤
│ ██ nav        ██ │                                          │
│ ██ (dark rail)██ │   toolbar / FilterBar / main pane        │
│ ██            ██ │                                          │
└─────────────────┴──────────────────────────────────────────┘
```

- `App.tsx` root becomes `flex flex-col`. `TopBar` renders first (full width), then a
  `flex-1 flex min-h-0` body row holds `[Sidebar | main-column]`. The dashboard toolbar,
  `FilterBar`, and `<main>` move **inside** the main-column (right of the sidebar, below
  the bar) — their internals are unchanged.
- **Brand block** = the left segment of the TopBar. It is **dark**
  (`bg-brand-sidebar-from`, the top of the sidebar gradient) so it reads continuous with
  the dark rail below → the **dark L-shape**. Its width **tracks `sidebarCollapsed`**
  (224px expanded ↔ 60px collapsed) so the brand/bar divider lines up with the
  sidebar/main divider. Holds: BrandLogo mark + "APEX" + tagline (expanded) or just the
  mark (collapsed), plus the **collapse toggle** at its right edge.
- **Right of the brand block** = the existing light top bar (`bg-surface-2`): breadcrumb
  on the left; then the **client badge** (moved up from the sidebar as a workspace-context
  chip) + `ThemeToggle` + user-menu Popover on the right.

## Locked decisions (from brainstorming)

1. **Brand zone tracks sidebar width** — collapses 224px → 60px with the sidebar; grid
   dividers stay aligned.
2. **Collapse toggle lives in the brand block** — at its right edge, next to the app name.
   Sidebar column below has no header chrome, just nav.
3. **Client badge moves into the top bar** — right cluster, near theme toggle + user menu,
   as a workspace-context chip.
4. **Dark L-shape** — the dark gradient extends up into the brand block; the rest of the
   bar is light.

## Component decomposition (modular)

New directory `frontend/src/components/shell/`, small single-purpose components:

| File | Responsibility | Interface |
|------|----------------|-----------|
| `TopBar.tsx` | Full-width bar; composes BrandBlock + Breadcrumb + right cluster. Layout only, no business logic. | `TopBar({ collapsed, onToggle })` |
| `BrandBlock.tsx` | Dark brand segment: mark + name + tagline + collapse toggle. Width keyed off `collapsed`. | `BrandBlock({ collapsed, onToggle })` |
| `Breadcrumb.tsx` | Section › page trail (extracted from today's Header nav). | `Breadcrumb({ section, page })` |
| `ClientBadge.tsx` | Workspace-context chip (pulse dot + `Client · <tenant>`), light-token variant. | `ClientBadge({ tenant })` |
| `UserMenu.tsx` | Avatar + Popover + sign-out (extracted from Header). | `UserMenu({ user })` |

- `TopBar` composes the existing `@/theme/ThemeToggle` (kept where it is — not duplicated
  into `shell/`) and `BrandBlock` composes the existing `@/components/BrandLogo` (not
  re-implemented).
- Each component is independently testable with a clean prop interface. The bar can be
  extended later (e.g. a global search slot between breadcrumb and client badge) by
  dropping a component into `TopBar` without touching the others.

## Changes to existing files

- **`Header.tsx`** — retired/replaced by `shell/TopBar.tsx`. Its breadcrumb, theme toggle,
  and user menu move into `Breadcrumb`, (composed) `ThemeToggle`, and `UserMenu`.
- **`Sidebar.tsx`** — loses its brand header, client badge, and collapse toggle. Becomes
  pure nav (insights/exploration or admin sections) + the operator "Admin" footer. Keeps
  the `collapsed` prop (for width + label hiding); `onToggle` drops (toggle now in
  `BrandBlock`). The `useUser`/tenant lookup for the client badge moves to where
  `ClientBadge` is rendered.
- **`App.tsx`** — root → `flex flex-col`; renders `<TopBar collapsed onToggle />` then the
  body row `[Sidebar | main-column]`. Still owns `sidebarCollapsed` state. Passes
  `{ collapsed, onToggle }` to `TopBar`, `{ collapsed }` to `Sidebar`. Toolbar + FilterBar
  + `<main>` relocate into the main-column; their JSX is otherwise unchanged.

## Config-driven / invariants preserved

- Dark rail + dark brand block use the existing `--brand-sidebar-*` vars → still fully
  config-driven; **no new tokens**.
- Client badge keeps its green pulse dot, but on the **light** bar its treatment re-tunes
  to light tokens: `text-fg-muted` label, `text-fg` value, subtle `border-border` /
  `bg-surface` chip (instead of the `white/10` dark treatment it had in the sidebar). No
  raw slate/indigo; DuBois token mapping applies.
- **No behavior/routing/data change.** Pure layout + markup relocation. All hooks,
  routing, filter state, and the operator-admin guard are untouched.

## Testing

- `Header.test` / `Sidebar.test` updates: brand + client-badge assertions move from
  Sidebar → the new shell components; Sidebar tests assert nav-only; the collapse-toggle
  test moves to `BrandBlock`.
- New focused render tests for the extracted `shell/*` components (props → expected
  content + token classes, no slate/`bg-white` leaks; assert on each element's OWN
  className per the naive-`cn()` rule).
- Live Chrome check both themes: the two dividers align, dark L-shape is continuous,
  collapse behavior works (224 ↔ 60 for both brand block and sidebar in lockstep), client
  badge legible on light, 0 console errors. Screenshots `/tmp/apex-topbar-{light,dark}.png`.

## Out of scope

- Login page, dashboard toolbar/frame conversion, admin section — tracked separately in
  the DuBois adoption backlog.
- Global search or any new bar feature — the decomposition makes these easy later, but
  they are not built here.
