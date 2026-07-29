# DuBois Design System Adoption — Design

**Date:** 2026-07-29
**Status:** Approved for planning
**Branch (current):** `feature/apex-theming`

## Problem

APEX's UI is functional and already token-driven (customizable brand color,
logo, font via `brand.config.json`), but its visual language — indigo gradients,
rounded chat bubbles, airy 15px+ type — reads as dated next to the Databricks
**DuBois** design system. We want to adopt DuBois's look and density across the
app while **keeping colors customizable**, and modernize the Ask APEX chat
surface in particular.

## Goals

- Adopt the DuBois visual language (neutral-ramp chrome, dense 12/18 type, tight
  radii, flat surfaces, state-only color) across the whole app.
- **Preserve customization**: brand color and font stay tenant-configurable
  through the existing `brand.config.json` → CSS-vars → Tailwind seam. No new
  styling paradigm, no foreign CSS import, no new dependency.
- Modernize the Ask APEX chat to feel native to DuBois.
- Ship **light default with a dark toggle** (DuBois defines both).

## Non-goals

- Re-theming the embedded AI/BI dashboards themselves (they render in their own
  iframe theme; a matching dark publish is a separate follow-up).
- Adopting the `@databricks/design-system` React library.
- Changing app behavior, routes, data flow, or the persistence/tenant layers.

## Reference

Databricks DuBois, imported via the Claude Design MCP project
`78fa3cd3-ca72-4045-a392-e69280dd28fb` ("Databricks Apps interface design").
Key source files read: `colors_and_type.css` (tokens + type scale), `kit.css`
(component styles), and `Databricks Apps - Apps list.dc.html` (shell
composition). The DuBois thesis, verbatim from its own docs:

- **One neutral ramp (n0–n12) does almost all chrome.** Page bg, cards,
  sidebars, text, borders, and even the "primary" button fill (near-white n12).
- **Color is reserved for STATE and DATA, never chrome.** Only danger/warning/
  success and a 3-color viz palette carry hue. Even the Databricks brand red
  "DOES NOT appear in chrome."
- **Dense & small.** Body 12px/18px, titles 14–16px, controls 24px tall, weights
  never above 500. Radii tight (4/6/8/12px from one `--radius` base).
- **Overlay opacity system.** An `--overlay` RGB triple flips white↔black per
  theme; only four opacities express hover/active/press/emphasis.
- **Dark mode is DuBois's default; light is derived** (`data-theme="light"`).

## Decisions (from brainstorming)

1. **Color philosophy — Accent + tunable neutrals.** Adopt DuBois's monochrome
   chrome faithfully, but swap the single "primary" role (DuBois's n12 fill) for
   a **customizable `--accent`**, used *only* where DuBois uses primary fill:
   primary buttons, active nav, focus rings, key highlights. Additionally expose
   the neutral ramp's **temperature** (`--overlay` triple / warm-cool gray) and
   the light/dark default as tenant-tunable knobs. Everything else stays
   monochrome per DuBois.
2. **Scope — Whole app, phased.** Convert the entire app (shell, sidebar,
   topbar, dashboards frame, admin, login, chat), shipped in ordered phases:
   foundation → shell → chat → remaining pages. Coherent end state, controlled
   risk.
3. **Default theme — Light default with dark toggle.** APEX stays light by
   default (closer to today and to the embedded dashboards), with a dark toggle.
   Both themes ship on the DuBois token seam. **This inverts DuBois's
   convention**, so our `:root` holds DuBois's *light* values and
   `[data-theme="dark"]` holds its dark values (DuBois ships it the other way).

## Architecture — Approach A (chosen)

Port DuBois into APEX's **existing** token seam rather than importing DuBois CSS
or adopting its React lib. Rationale: customization stays exactly where it lives
today (`brand.config.json` + `ThemeProvider`), Tailwind v4 remains the only
styling system, and a working app changes the least.

### Token model — three layers in `frontend/src/index.css`

**Layer 1 — DuBois primitives.** `:root` carries DuBois's *light* values;
`[data-theme="dark"]` overrides with DuBois's *dark* values.
- Neutral ramp `--n0 … --n12`.
- `--overlay` RGB triple + the four opacity aliases.
- State colors `--danger/-fg`, `--warning/-fg`, `--success/-fg`.
- Viz palette `--viz1/2/3`.
- `--radius` base + `--radius-sm/md/lg/xl/full` via `calc()`.
- `--font-sans`, `--font-mono`.
- `--dur-instant/fast/normal`.

**Layer 2 — semantic aliases** (what components reference, never raw n-values):
`--surface`, `--surface-2`, `--surface-3`, `--fg`, `--fg-2`, `--fg-muted`,
`--fg-subtle`, `--fg-ghost`, `--border`, `--border-hover`, `--border-emphasis`,
`--fill-hover`, `--fill-active`, `--fill-press`, `--fill-emphasis`.

**Layer 3 — customizable overrides (the "keep it customizable" seam):**
- `--accent`, `--accent-fg`, `--accent-hover` — replaces DuBois's monochrome
  primary. Written at runtime by `ThemeProvider` from `brand.config.json`.
- `--overlay` (neutral temperature) — optionally tenant-tunable.

**Tailwind `@theme inline`** maps `--color-brand-*`, `--color-surface-*`,
`--color-fg-*`, `--color-accent*`, radii, and fonts onto these vars so existing
`brand-*` utilities keep resolving and new `surface-*` / `fg-*` / `accent`
utilities become available at the element level (enabling future per-tenant
scoping).

### Key departure from pure DuBois

DuBois primary fill = monochrome `n12`. We remap that single role to `--accent`
(customizable). All other chrome remains monochrome, preserving DuBois's
discipline while satisfying "at least colors customizable."

### `brand.config.json` / `brand.ts` changes

- Extend the `colors` block: introduce `accent`, `accentFg`, `accentHover`, and
  an optional `neutralTemperature` (drives `--overlay`). Retain existing keys for
  back-compat during the transition; `brandToCssVars` maps the new keys to the
  Layer-3 vars.
- `ThemeProvider` gains: (a) writing the new accent/overlay vars, (b) applying
  the persisted light/dark choice to `document.documentElement` (`data-theme`),
  defaulting to light.
- A small `useTheme` hook + a toggle control (placed in the top bar) persists the
  user's light/dark preference (localStorage; server-side persistence via
  existing prefs is a possible later enhancement, out of scope here).

## Component mapping (DuBois → APEX)

The DuBois `kit.css` patterns become the target for each APEX surface. We
re-implement them as Tailwind utility compositions (not by importing kit.css),
matching DuBois metrics (24px controls, radii, overlay opacities, type roles):

| APEX surface | DuBois pattern |
|---|---|
| App shell / main pane | `.shell`, `.shell-main` (bordered n1 pane, radius-lg) |
| Top bar | `.topbar` (48px, brand mark + title, centered search, avatar) — hosts the new theme toggle |
| Sidebar nav | `.sidebar` (200px, n2), `.nav-item` (24px rows; `.active` uses `--accent`), `.nav-section` uppercase caption |
| Page header | `.page-header`, `.page-title`, `.page-desc` |
| Buttons | `.btn-primary` (→ accent fill), `.btn-secondary/ghost/outline/danger`, `.btn-icon` |
| Inputs / search | `.input`, `.search-input`, `.topbar-search` |
| Chips / tags / status | `.filter-chip`, `.tag-*`, `.dot`, `.dot-pulse` |
| Segmented / tabs | `.segmented`, `.seg-item` (`.active` → accent) |
| Dropdown / popover / modal | `.dropdown`, `.popover`, `.modal`, `.scrim` |
| Cards / metrics | `.card`, `.app-card`, `.metric` |
| Data tables (admin) | `.data-table`, `.table-wrap` |
| Code / SQL blocks (chat) | `code.inline`, `.mono` (JetBrains Mono) |

## Ask APEX chat redesign

DuBois has **no canonical chat component** (the reference is an apps-list
screen), so the chat is *composed* from DuBois primitives rather than copied:

- **Remove** indigo gradients, rounded gradient bubbles, decorative blur orbs,
  and the gradient sparkle marks.
- **Assistant messages:** no bubble — flat on `--surface`, body in `--fg`, with
  a small monochrome avatar/mark; matches DuBois's flat-surface density.
- **User messages:** minimal — a subtle `--fill-active` / `--surface-2` container
  with `--fg`, not a saturated accent bubble (accent stays reserved for actions).
- **Composer:** DuBois `.input` metrics; send button uses `--accent`.
- **Conversation rail:** DuBois `.nav-item` / list-row styling; active row uses
  the accent left-marker + `--fill-active`.
- **SQL / results / tool calls / reasoning:** DuBois `.mono`, `code.inline`, and
  `.tag-*` for status; tables use `.data-table`.
- **Status pill / MCP health:** `.dot` + `.dot-pulse` with state colors.
- Suggestion chips: `.filter-chip` / secondary-button styling, no gradient hover.

## Phasing (each phase independently shippable & testable)

- **Phase 0 — Foundation.** Rewrite `index.css` token layers, extend
  `brand.config.json` + `brand.ts`, update `ThemeProvider`, add `useTheme` +
  toggle. Fonts: add JetBrains Mono. No component visually "finished" yet but the
  app still renders (utilities resolve to DuBois defaults). Verify build + Jest.
- **Phase 1 — App shell.** Top bar, sidebar, main-pane frame, page headers to
  DuBois. Highest-visibility structural change.
- **Phase 2 — Ask APEX chat.** The full chat redesign above.
- **Phase 3 — Remaining pages.** Admin (tables, cards, editors, access grid),
  login, dashboard page frames, filter bar, preferences, home.
- **Phase 4 — Cleanup.** Remove dead indigo/gradient utilities and legacy brand
  keys; docs (`AGENTS.md`, `docs/customizing.md`) updated for the new token model
  and theme toggle.

Each phase is its own PR-sized change with its own tests.

## Testing & verification

- `frontend && npm run build` (`tsc -b && vite build`) green after every phase.
- Jest component tests updated where class/DOM assertions change; existing tests
  (e.g. `AccessGrid.test.tsx`, `AssetsPage.test.tsx`, `Sidebar.test.tsx`) kept
  green.
- Manual visual check in both light and dark for each converted surface.
- Accessibility: verify text contrast of `--fg*` roles on `--surface*` in both
  themes; preserve existing ARIA (switches, roles) in AccessGrid/chat.

## Risks & mitigations

- **Half-converted app looks broken.** Mitigated by phase ordering (foundation
  first keeps everything rendering) and by shell-before-pages.
- **Embedded dashboards won't match dark chrome.** Out of scope; called out as a
  follow-up. Light default reduces the immediate mismatch.
- **Accent overuse re-colors chrome.** Guard: accent is allowed *only* in the
  primary-fill role list above; reviewers check nothing else gains hue.
- **Contrast regressions in dark mode.** Mitigated by the a11y check step.

## Open questions (deferrable, not blocking)

- Persist theme choice server-side (via existing prefs) vs localStorage-only?
  Plan assumes localStorage for now.
- Do we expose `neutralTemperature` to tenants in this pass, or ship the var but
  leave it fixed? Plan ships the var, default fixed.
