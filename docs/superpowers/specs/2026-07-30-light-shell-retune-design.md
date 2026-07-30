# Fully-Light Shell Re-tune (Lakewatch-faithful) — Design Spec

**Date:** 2026-07-30
**Branch:** `feature/apex-theming`
**Status:** Approved (design), ready for implementation plan
**Supersedes:** the dark L-shape / dark-rail decisions in
[full-width top-bar spec](2026-07-30-full-width-topbar-design.md) and the earlier locked
"keep a dark rail" choice. Related: [DuBois adoption](2026-07-29-dubois-design-system-adoption-design.md),
memory `apex-design-system-adoption`, `apex-modular-components`.

## Goal

Re-tune the APEX app shell (top bar + sidebar) to be **fully light**, matching the
**Lakewatch** reference: a quiet, cool, low-contrast chrome where the dark navy brand
block and dark sidebar rail are REPLACED by light surfaces, and color is reserved for the
gradient brand mark, blue accents/links, and data. This brings the shell into line with
the already-converted page bodies (Home, chat, cards).

## Motivation

The full-width top bar shipped with a **dark L-shape** brand block + a **dark gradient
sidebar rail** (both were earlier locked decisions). Against the converted light page
bodies, Rohit found the dark chrome heavy and un-premium. The Lakewatch reference (its
actual Databricks security app) shows the target: the ENTIRE shell is light. This spec
reverses the dark-rail decision.

## What Lakewatch does (from reference screenshots)

- **Top bar:** one seamless light surface, no dark block. Left: collapse toggle → small
  logo → workspace name (bold dark) + app name (muted, lighter). A very thin dark hairline
  runs along the very top edge. Right: context chips + icons + avatar.
- **Sidebar:** a very subtle cool tint (barely distinct from the white main pane), NO
  heavy border. Nav text is dark-gray; icons gray. Section headings are small muted-gray
  uppercase.
- **Active nav item:** soft blue-tint pill background + blue text + blue icon.
- Color is reserved for: the gradient composer border, blue links/accents, and data viz.

## Design

### Top bar (`shell/BrandBlock.tsx` + `shell/TopBar.tsx`)
- **No dark block.** The entire `<header>` is one light surface. `BrandBlock` drops
  `bg-brand-sidebar-from` + all `text-white`/`white/NN` classes and uses light tokens:
  background transparent/`bg-surface` (same as the rest of the bar → seamless, no seam),
  a right hairline `border-border` only if needed for the collapse-alignment grid.
- **Brand content on light:** collapse toggle (`text-fg-muted hover:text-fg`,
  `hover:bg-[var(--fill-hover)]`) → **GradientMark** logo (unchanged — the only color pop)
  → "APEX" in `text-fg` (bold) + tagline in `text-fg-muted`. Fix the tagline truncation
  (it clipped as "TRAVEL INTELLIGEN…"): allow it to fit or drop gracefully; do not show a
  clipped word.
- **Thin top-edge strip:** a subtle ~2–3px dark accent line along the very top edge of the
  bar (Lakewatch's touch). Config-toggleable via `brand.config.json`
  (`shell.topStrip: { enabled, color }`) with a sensible default; when disabled, no strip.
- The `<header>` keeps `h-12`, full-width, `border-b border-border`. Right cluster
  (ClientBadge, ThemeToggle, UserMenu) is already light — unchanged.

### Sidebar (`Sidebar.tsx`)
- **Light rail.** The `<aside>` drops
  `bg-linear-to-b from-brand-sidebar-from via-brand-sidebar-via to-brand-sidebar-to` and
  uses `bg-surface-2` (a hair cooler than the main pane's `bg-surface`) + a right hairline
  `border-r border-border`.
- **Nav rows (`NavItem`):** inactive → `text-fg-2 hover:bg-[var(--fill-hover)]
  hover:text-fg`; icons `text-fg-muted group-hover:text-fg`. Active → **soft blue tint**
  `bg-accent/10 text-accent` with a blue icon (`text-accent`); the existing left accent
  marker becomes optional/removed since the tint pill now carries the active state
  (decide in plan — match Lakewatch's pill, no marker).
- **Section headings** ("Insights & Analytics", "Exploration", "Administration") →
  `text-fg-muted` small uppercase (same structure, light tokens).
- **Client-context / admin nav + Back-to-APEX + Admin footer** → light tokens
  (`text-fg-2`, hover `var(--fill-hover)`, borders `border-border`).
- The `placeholder` "soon" chip → light tokens (`bg-surface-3 text-fg-muted` or
  `bg-accent/10 text-accent`).

### Dark mode
The whole shell now follows the existing dark tokens: `bg-surface-2`/`border-border`/`fg*`
all flip via the established `[data-theme="dark"]` cascade — so the light rail becomes a
dark surface in dark theme automatically, consistent with the rest of the app. The
`bg-accent/10` active tint works in both themes (accent is theme-invariant; the tint is a
color-mix over transparent).

## Config-driven / invariants preserved

- The shell stops consuming `--brand-sidebar-*` (the dark gradient). Those vars are
  retired from the shell (kept dormant in `brand.config.json`/`brand.ts` for now; Phase-4
  cleanup removes them if nothing else references them).
- New optional `shell.topStrip` config knob (enabled + color) for the top-edge accent
  line. Default provided; a rebrand can disable or recolor it.
- Active-nav tint uses `bg-accent/10` (Tailwind v4 `color-mix`) — no new token, no new RGB
  triple; a rebrand's `duboisAccent` change re-tints it automatically.
- **A rebrand still = editing `brand.config.json` alone** (accent + neutrals + gradient +
  the new topStrip). No hardcoded shell colors.
- **No behavior/routing/data change.** Only className/markup + the config knob. All hooks,
  routing, collapse state, and the operator-admin guard are untouched.

## Deliberate departure being REMOVED

The "sidebar keeps its dark brand gradient in both themes" departure (and the top-bar dark
L-shape) are hereby **retired** — this spec makes the shell light. The GradientMark and the
gradient composer border remain the rationed color flourishes. The gradient avatar in the
user menu stays as-is (small, deliberate).

## Testing

- Update `shell/shell.test.tsx`: `BrandBlock` no longer asserts `bg-brand-sidebar-from`;
  assert light tokens + brand text + toggle presence + the top-strip (when enabled).
- Update `Sidebar.test.tsx`: the active-row assertion changes from the dark
  `bg-accent` marker to the new `bg-accent/10 text-accent` pill (the existing
  "not bg-brand-accent" guard still holds); nav-item + admin-section text assertions
  unaffected.
- `brand.test.ts`: cover the new `topStrip` config path if `brand.ts` exposes it.
- Live Chrome BOTH themes: seamless light bar (no dark seam), light sidebar barely-distinct
  from main pane, active nav = blue-tint pill + blue text/icon, section headings muted,
  tagline not clipped, top-edge strip subtle, collapse still works + aligned, 0 console
  errors. Screenshots `/tmp/apex-lightshell-{light,dark}.png`.

## Out of scope

- Dashboard toolbar (`bg-white` + legacy `brand-primary*` buttons), login page, admin
  section body, Spend/Sustainability dashboard frames — tracked separately in the DuBois
  backlog. (The toolbar `bg-white` will still visibly clash until its own pass — noted.)
- Global search or new bar features.
