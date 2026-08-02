# Prism Phase 6 — Alias-Layer Elimination (100% Canonical DuBois) — Design

**Date:** 2026-08-02
**Branch:** `feature/apex-theming`
**Status:** Approved (design), pending spec review
**Relates to:** `docs/superpowers/specs/2026-07-31-prism-dubois-rebuild-design.md` (the parent 6-phase plan; this is Phase 6, the last before the Phase-1 rename)

## Goal

Reach a **100% canonical, alias-free** frontend by (1) migrating the last 9 files that still consume the temporary legacy-alias tokens onto canonical DuBois tokens, then (2) **deleting the temporary alias layer** (`frontend/src/index.css:508–649`), and (3) clearing the accumulated mechanical cleanups from earlier phases.

This is the final token-migration phase. After it, no component references `bg-surface*`, `text-fg*`, `bg-accent`/`text-accent` (as the alias utility), `*-brand-*`, `--fill-*`, `--surface*`, `--fg*`, `--danger*`, `--success-fg`, `--warning-fg`, `--n0..n12`, or the legacy `@theme inline` utility names — and the alias block is gone from `index.css`.

## Background / why this is more than a delete

Phase 5 migrated the **page groups** (Login, Home, Preferences, Admin, Dashboards, Ask APEX/Genie chat surface). A whole-frontend sweep on 2026-08-02 shows the alias layer is **still load-bearing for 9 files** that no Phase-5 group touched:

| File | Legacy hits | Category |
|------|-------------|----------|
| `pages/AskApexLive.tsx` | 31 | **Whole page** — the interactive Genie *App View* (`@mcp-ui/client`, `useGenieAppView`); a distinct live-routed page (`/ask-apex-live`), NOT a duplicate of the just-reskinned `GenieMcpExperience.tsx`, though structurally parallel |
| `components/shell/UserMenu.tsx` | 12 | Shell leaf (kept in Phase 4, never reskinned) |
| `pages/Placeholder.tsx` | 6 | Live-routed page (asset-missing / unknown-route fallback) |
| `components/shell/ClientBadge.tsx` | 3 | Shell leaf |
| `components/shell/Breadcrumb.tsx` | 3 | Shell leaf |
| `registry/RegistryProvider.tsx` | 2 | Boot skeleton (fail-soft loader) |
| `theme/ThemeToggle.tsx` | 1 | Shell control |
| `components/BrandLogo.tsx` | 1 | Logo-mark fallback |

Therefore the alias block **cannot be deleted first** — that would break these files' styling. Two deletion hazards make this concrete:

1. **`--accent` is defined 3×.** Canonical `:root --accent: #f7f7f7` (L214, neutral) and `.dark --accent: #1f272d` (L325) are **overridden by the alias `--accent: var(--primary)` at L546** (later in cascade wins). Deleting the alias reverts `--accent` to canonical neutral. Any component using the `bg-accent` *utility* and expecting blue will silently change color.
2. **`components/ui/skeleton.tsx` uses `bg-accent` and is canonical vendored shadcn — it must NOT be edited.** Today the alias makes its skeleton render *blue* (wrong); after the alias is deleted, `--accent` reverts to neutral `#f7f7f7` and the skeleton renders the *correct* DuBois neutral. So `skeleton.tsx` **self-heals on delete** — it is deliberately excluded from the migration file list. (This is the one file where the alias is actively causing a wrong color today.)

## Non-goals

- **No logic / behavior change.** Same Scope-A token-only reskin as all five Phase-5 groups: only `className` strings, inline-style token names, and string constants change. Every hook, effect, ref, prop, export, import stays byte-identical.
- **No backend / `server/` / `app.py` / `/api/*` change.**
- **No structural component change**, no new/removed components, no framework work.
- **Not the rename.** Product rename → "Prism" (Phase 1) stays LAST, in its own phase.
- **No unrelated refactor** of `AskApexLive` (it is only recolored, not restructured, even though it parallels `GenieMcpExperience`).

## Canonical mapping (the locked table, identical to Phase-5 groups)

Surfaces:
- `bg-surface` → `bg-background`
- `bg-surface-2` → `bg-secondary`
- `bg-surface-3` → `bg-muted`
- `--surface`/`--surface-2` (as `[var(--…)]` or ring) → `--background` / `--secondary`

Foreground:
- `text-fg` → `text-foreground`
- `text-fg-2` / `text-fg-muted` / `text-fg-subtle` / `text-fg-ghost` → `text-muted-foreground`
- (`text-fg-ghost` on ThemeToggle idle → `text-muted-foreground`; hover `text-fg-muted` → `text-foreground`)

Accent / brand:
- `bg-accent` (alias utility) / `text-accent` → `bg-primary` / `text-primary`
- `accent-fg` → `primary-foreground`; `hover:*-accent-hover` → `hover:*-blue-700`
- `bg-linear-to-br from-brand-primary to-brand-accent text-white` → **flat `bg-primary text-primary-foreground`** (decision below)
- `bg-brand-bg` → `bg-secondary`; `text-brand-accent` → `text-primary`

Fills / state:
- `hover:bg-[var(--fill-hover)]` → `hover:bg-[var(--action-default-bg-hover)]`
- `bg-[var(--fill-hover)]` (as a resting composer bg) → `bg-background`
- `bg-[var(--fill-active)]` → `bg-primary/10`
- `--danger` / `--danger-fg` → `--destructive`; `--success-fg` → `--success`; `--warning-fg` → `--warning`
  (`bg-[var(--success)]` in ClientBadge is already canonical — LEAVE)

Composer focus (AskApexLive L304 + L339, matching the shipped GenieMcpExperience swap):
- `focus-within:border-border-emphasis focus-within:ring-2 focus-within:ring-[rgba(var(--overlay),0.06)]` → `focus-within:ring-2 focus-within:ring-ring` (drop the legacy border-emphasis + overlay-rgb ring)
- `border-input` for bordered composers where the legacy used `border-border` on a form control

Radii / weight / shadow:
- `rounded-2xl` / `rounded-xl` / `rounded-lg` → `rounded-md` (8px container); `rounded-sm` → `rounded` (4px interactive)
- `rounded-br-md` speech-tail cosmetic corner → retained
- `font-bold` → `font-semibold`
- `shadow-sm` → `shadow-db-xs`; `shadow-lg` → `shadow-db-lg` (verified defined in index.css; fallback to Tailwind built-ins only if a token is missing)

## Design decision: avatar / logo fallback fill

`UserMenu` (×2 avatar-initials fallback) and `BrandLogo` (×1 logo-mark fallback) use `bg-linear-to-br from-brand-primary to-brand-accent text-white`. Since **both `--brand-primary` and `--brand-accent` alias to `--primary`**, this gradient **already renders as flat blue today** — a false gradient.

**Decision (approved):** collapse to **flat `bg-primary text-primary-foreground`**. Rationale: matches what renders today (no visual change), and follows the Admin group's established "gradient icon tile → flat `bg-primary`" precedent. The alternative (adopt the real `--accent-gradient` AI cue on identity marks) was rejected — it would introduce a gradient on marks that were effectively flat, a visual change, not a faithful reskin.

## The alias-layer deletion (index.css:508–649)

Delete the entire `TEMPORARY ALIAS LAYER` region **except three things that are NOT aliases and have real consumers** — re-home these into the canonical section of `index.css` so they survive:

1. **`--accent-gradient`** (L549) — the canonical AI-cue gradient consumed by `.gradient-border` and the login monogram. Move its definition up into `:root`.
2. **`--brand-font-sans` / `--font-mono`** (L568–569) + the `@theme inline` `--font-sans`/`--font-mono` bindings (L638–639) — these set the app's canonical system font stacks (Inter retired). Preserve the font-stack values under canonical names so `font-sans`/`font-mono` utilities keep resolving. (Rename `--brand-font-sans` → a canonical name, e.g. fold its value directly into the `--font-sans` binding.)
3. **`.gradient-border`** rule (L642–649) — canonical, keep verbatim (it already references `--card` + `--accent-gradient`, both canonical/preserved).

Everything else in 508–649 (the `--surface*`/`--fg*`/`--fill-*`/`--danger*`/`--success-fg`/`--warning-fg`/`--overlay`/`--accent*`/`--brand-*`/`--n0..n12` vars in `:root` + `.dark`, and the legacy `--color-*` `@theme inline` utility block) is deleted. After deletion, `--accent`/`--accent-foreground` revert to their canonical `:root`/`.dark` definitions (neutral), which is correct.

**`--overlay`:** the alias redefines it as an RGB triple. Verified in Phase 3 that canonical `ui/*` modals use `bg-black/50`, not `var(--overlay)`. A 2026-08-02 sweep found exactly **2 remaining `rgba(var(--overlay),0.06)` consumers, both in `AskApexLive.tsx`** (the two composer `focus-within` rings, L304 + L339). Both are eliminated by Task 2's mapping — the same `focus-within:border-border-emphasis` + `rgba(var(--overlay))` ring → `focus-within:ring-ring` swap already shipped for the parallel `GenieMcpExperience` composers. So by the time Task 3 deletes the alias, zero `var(--overlay)` consumers remain. Task 3 re-greps to confirm before deleting.

## Mechanical cleanups (accumulated from earlier phases)

- **Drop dead dep** `@radix-ui/react-use-controllable-state` from `package.json` (the radix umbrella re-exports it; Phase 3 note). Verify no direct import first.
- **HomePage `AreaChart` gradient-id** — replace the fragile `grad-${accent.replace("#","")}` (which produced `grad-var(--primary)` after the Home reskin) with a stable static id.
- **Phase-4 deferred nits** (fenced in their own final task so they can't block the alias work): add `App.test.tsx` covering the admin-context `sidebarSections`/`sidebarFooter` builder (currently untested); admin footer button collapsed `justify-center` + title tooltip; TopBar tenant fallback `??` → `||`. If any nit proves non-trivial, defer it out rather than expand this phase.

## Task breakdown (dependency-ordered)

1. **Task 1 — Migrate the shell leaves + small files** (`UserMenu`, `ClientBadge`, `Breadcrumb`, `ThemeToggle`, `BrandLogo`, `RegistryProvider`, `Placeholder`). Mechanical swaps per the table + flat-`bg-primary` decision. ~28 hits across 7 small files.
2. **Task 2 — Migrate `AskApexLive.tsx`** (31 hits). Largest single file; mirror the exact mapping already shipped for the parallel `GenieMcpExperience.tsx` (composers, hero, user bubble = `bg-primary/10` tint, avatar fallback, suggestion pills). Recolor only — no restructure.
3. **Task 3 — Delete the alias layer** (`index.css:508–649`), preserving `--accent-gradient` + font stacks + `.gradient-border` re-homed into canonical section. Then run the **whole-frontend** alias grep gate → zero matches (this is the phase's proof of 100% canonical). Confirm `skeleton.tsx` renders neutral (self-heal check).
4. **Task 4 — Mechanical cleanups** (dead dep, HomePage gradient-id, Phase-4 nits). Fenced last; individually skippable.

Each task ends green: `cd frontend && npm test && npm run build` both pass. Live check (light + dark) after Task 3 covers shell chrome, Ask APEX Live page, and Placeholder. Push to `feature/apex-theming` at the end (no PR).

## Verification

- **Per-task:** file-level alias grep = zero on that task's files; `npm test && npm run build` green.
- **Phase gate (after Task 3):** whole-`frontend/src` grep for the full legacy-token set = **zero matches** (excluding the `not.toMatch(...)` negative-guard regexes in test files, which are intentional). This is the definition of done for "100% canonical."
- **Live:** light + dark, affected surfaces render correctly; no console errors; skeleton renders neutral not blue.

## Risks / notes

- **Largest novelty is low** — mechanical swaps identical in kind to six prior groups. The one genuine decision (avatar/logo fill) is locked to flat `bg-primary`.
- **`--accent` cascade flip** on delete is the sharpest hazard — mitigated by (a) excluding canonical `skeleton.tsx` from edits (it wants neutral) and (b) migrating every *intentionally-blue* `bg-accent` consumer to explicit `bg-primary` in Tasks 1–2 first, so nothing depends on the alias override at delete time.
- **`--accent-gradient` / fonts / `.gradient-border`** must survive the delete — re-homed, not dropped.
- **`AskApexLive` is recolored, not refactored** — resisting the temptation to dedupe it against `GenieMcpExperience` keeps scope honest (a merge is a separate, logic-touching decision).
