# DuBois Design-System Adoption — HANDOFF / Resume Guide

**Last updated:** 2026-07-30
**Branch:** `feature/apex-theming` · **Pushed HEAD:** `234b036` (origin up to date)
**Status:** Non-admin app fully converted to premium DuBois (blue accent + cool neutrals + rationed gradient flourishes). Admin section + a few user-facing frames remain.

This doc is the single source of truth to resume after a context clear. It duplicates
the key state from `~/.claude/.../memory/apex-design-system-adoption.md` so nothing is lost.

---

## The initiative in one paragraph

Adopt the Databricks **DuBois** design system across the whole APEX UI, kept fully
**config-driven** (a rebrand = edit `brand.config.json` alone). After an initial flat-
monochrome attempt was judged "not premium" and the indigo accent "weird", we pivoted
(per Rohit + the **Lakewatch** reference app) to: **Databricks-blue accent (#2272B4)**,
**crisp cool neutrals** (not warm beige), and a **rationed gradient flourish**
(blue→purple→coral) used ONLY on the brand mark + hero composers. Everything flows
through the Phase-0 token seam.

---

## What's DONE and pushed (origin `feature/apex-theming` @ 234b036)

- **Phase 0 — token foundation.** Three-layer token model in `frontend/src/index.css`
  (`:root` = light, `[data-theme="dark"]` = dark), light default + dark toggle,
  `useTheme`/`ThemeToggle`, JetBrains Mono.
- **Phase 1 — app shell.** Top bar (48px), sidebar (KEPT dark gradient rail by Rohit's
  choice), main-pane frame → tokens.
- **Premium re-tune.** Blue accent + cool neutrals + config-driven `accentGradient`
  toggle + `GradientMark` component + `.gradient-border` composer. Applied to both chat
  pages, dashboard rail, and Home (light hero, retired multicolor chips).
- **Plan 1 — UI primitives.** All 6 `ui/*` (Badge, Button, Tabs, Popover, Avatar,
  ScrollArea) → tokens. Closed the AvatarFallback slate leak; user-menu dropdown now
  theme-aware in dark.
- **Plan 2 — user-facing pages.** MarkdownContent, FilterBar, ExecutiveSummaryModal,
  PreferencesPage, CustomDashboard frame, Placeholder → tokens.

**Result: everything a normal (non-operator) user touches is coherent blue+neutral in
both themes.** 86/86 frontend tests, build green.

### To review right now
Dev server running at **http://localhost:5173/**. Toggle light/dark via the sun/moon
top-right. Good pages to look at: `/` (Home), `/genie-mcp` (Ask APEX chat),
`/preferences` (My Filters). NOTE: embedded dashboards need the Python backend + SP
token (not running locally) — dashboard routes may redirect to Home; only chrome/theming
is viewable offline.

---

## What's LEFT (not started)

Ordered by the recommended sequence; each is its own PR-sized plan + SDD run:

1. **PLAN 3 — Admin section (~18 files, ~250 occurrences — the big one).** Operator-only.
   Files: `src/components/admin/{TenantTable, OnboardDialog, UsersTable, shared,
   VerifyModal, UserDialog, AssetEditor, ActivityFeed, AccessGrid, SecretAlert,
   AssetCard, HistoryDrawer, StatCard, ConfirmDialog}.tsx` +
   `src/pages/admin/{AdminLayout, AssetsPage, TenantsPage, AccessPage}.tsx`.
2. **Login page** (`server/`-rendered Python template — user-facing, still slate/indigo).
3. **Dashboard toolbar + Spend/Sustainability dashboard frames** (the `isCustom` toolbar
   in `App.tsx` with the page tabs + Exec Summary / Ask APEX buttons — still `bg-white`).
4. **Shell-polish** — Rohit's early feedback that the shell felt weak: top-bar presence,
   elevation/contrast. Re-evaluate now that page bodies are converted.
5. **Phase-4 cleanup** (see backlog below).

**Open priority question for Rohit (unanswered):** admin is operator-only (low
visibility); the **login page + dashboard toolbar/frames are user-facing** and still
clash. Consider doing those BEFORE the big admin plan. Rohit was asked; decide on resume.
**Home-hero style** was defaulted to LIGHT (Lakewatch Overview style) — can flip to dark
if wanted.

---

## HOW WE WORK (critical process notes — follow these on resume)

- **Per PR-sized plan:** brainstorm/decide → `superpowers:writing-plans` → commit plan →
  `superpowers:subagent-driven-development` (SDD). Fresh implementer subagent per task
  (Haiku for verbatim/mechanical, Sonnet for read-then-convert/judgment), then a Sonnet
  task review, fix-loop via SendMessage to the SAME implementer, scoped re-review; final
  whole-branch review (Sonnet for mechanical class-swap plans, Opus for foundational).
- **SDD ledger** at `.superpowers/sdd/<plan-basename>/progress.md` is the recovery map;
  workspaces are git-ignored and deleted after each plan's final review.
- **Controller (you) never fixes code** — route fixes through the implementer. Verify
  gates independently (grep/build/tests). Do live Chrome MCP checks per plan.
- **Commits** end with `Co-authored-by: Isaac`; never `--no-verify`.
- **Push cadence:** Rohit's pattern = push to `feature/apex-theming`, NO PRs. Batch a
  couple of plans per push. (Plans 1+2 pushed together @ 234b036.)

### The token mapping (apply to every conversion)
`bg-white`→`bg-surface`/`bg-surface-2`; `bg-slate-50/100`→`bg-surface-2`/`var(--fill-hover)`;
`bg-slate-200/300`→`bg-surface-3`/`var(--fill-active)`; `text-slate-900/800`→`text-fg`;
`text-slate-700`→`text-fg-2`; `text-slate-500/600`→`text-fg-muted`;
`text-slate-300/400`→`text-fg-subtle`; `border-slate-*`→`border-border`(/`-hover`);
accent link/active→`text-accent`(`hover:text-accent-hover`); accent fill/CTA→SOLID
`bg-accent text-accent-fg hover:bg-accent-hover`; state → `var(--danger|warning|success[-fg])`
on `rgba(...)` tints; inputs → `.input` feel (`border-border bg-[var(--fill-hover)]
rounded-md` + accent focus ring); code → `font-mono` on `bg-surface-2`.

### ⚠️ RECURRING FAILURE MODE — invented tokens
Implementers have TWICE invented non-existent tokens (`surface-1`, `accent-alt`) — a
missing Tailwind utility silently emits NO css, so **build passes green anyway**. In every
task brief: (1) list the EXACT valid tokens, (2) demand a per-file grep guard, (3) have
the reviewer check each class exists. **The ONLY valid tokens are:**
`accent, accent-fg, accent-hover, accent-gradient` · `surface, surface-2, surface-3` ·
`fg, fg-2, fg-muted, fg-subtle, fg-ghost, fg-disabled` · `border, border-hover,
border-emphasis` · and arbitrary `[var(--fill-hover|active|press|emphasis)]`,
`[var(--danger|warning|success)]` + their `-fg`, `[var(--overlay)]`, `[rgba(...)]`.
There is NO surface-1, accent-alt, accent-dark, accent-light, color-danger utility.

### Other invariants
- **Neutral ramp + `--overlay` are THEME-VARIANT** → live in cascade rules only
  (`index.css` fallback + the `<style id="apex-neutrals">` ThemeProvider injects from
  `brand.config.json`). NEVER write `--n*`/`--overlay` as inline element styles (breaks
  dark mode). Accent vars ARE written inline (theme-invariant).
- **`cn()` is a naive string-join** (not tailwind-merge). To remove a class, delete it
  from the source literal. In tests, assert on the element's OWN `className`, not subtree
  `innerHTML` (primitive defaults leak through the join).
- **jsdom 29.1.1 has no localStorage** → the mock in `frontend/vitest.setup.ts` is
  load-bearing; don't remove it.
- **Gradient is rationed** — only GradientMark + `.gradient-border` (brand mark + hero
  composers). Buttons are SOLID `bg-accent`. Never gradient chrome/buttons.
- **Deliberate departures (don't "fix"):** sidebar keeps its dark brand gradient in both
  themes; the top-bar/home avatar keeps its brand gradient; the emissions trend chart
  keeps `#10b981` as a data-viz hue.

---

## Config-driven proof (Rohit's hard requirement)
A rebrand = edit `brand.config.json` only: `colors.duboisAccent` (+ accentFg/Hover),
`colors.neutrals.{light,dark}.{ramp[13],overlay}`, `colors.accentGradient.{enabled,stops}`.
Proven live: flipping `accentGradient.enabled:false` drops the flourish to solid blue with
no code change.

---

## Phase-4 CLEANUP backlog (do near the end)
- stale "SPIKE" comment in `index.css` (light ramp is now config-wired).
- dead `--brand-dubois-accent` var (emitted by brandToCssVars generic loop, no consumer).
- dead `bg-[var(--fill-hover)]` under `.gradient-border` composers (opaque padding-box
  covers it) — 3 hero composers.
- vestigial `relative z-10` wrapper on Home hero (after orb removal).
- danger-rgba inconsistency: ExecSummaryModal `rgba(196,64,64,0.12)` vs CustomDashboard
  `rgba(208,64,64,0.06)` — reconcile.
- `--success-rgb` triple token (so success tints match light `--success` #28A745, not the
  dark 48,160,80 literal used everywhere).
- Placeholder icon chip `text-fg-muted` → `text-accent` (fidelity nit).
- MarkdownContent `<a>` renderer drops rare markdown `title` attr.
- AvatarFallback ui/* primitive: DONE (converted in Plan 1).
- test-doc minors in `primitives.test.tsx` (secondary/outline desc; ScrollArea untested).
- legacy `--brand-sidebar-*` vars: KEEP (the intentionally-dark sidebar rail uses them).
- retire remaining legacy `--brand-*` once nothing references them.

---

## Docs & specs
- Design spec: `docs/superpowers/specs/2026-07-29-dubois-design-system-adoption-design.md`
- Plans (committed): `docs/superpowers/plans/2026-07-*-dubois-*.md`
- This handoff: `docs/superpowers/HANDOFF-dubois-adoption.md`
- Full memory: `~/.claude/projects/-Users-rohit-bhagwat-Documents-github-advito-ai-bi/memory/apex-design-system-adoption.md`

## To resume Plan 3 (admin)
1. Read this file + the memory note.
2. `git -C <repo> log --oneline origin/feature/apex-theming..HEAD` (should be clean/empty
   if 234b036 is HEAD).
3. Confirm the priority question above with Rohit (admin vs login/toolbar first).
4. `superpowers:writing-plans` for the chosen subsystem → commit plan → SDD.
5. Apply the token mapping + invented-token guard religiously.
