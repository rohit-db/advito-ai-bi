# Prism Phase 5 (Home) — HomePage Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin `frontend/src/pages/HomePage.tsx` onto canonical DuBois tokens — migrate every legacy alias token (`bg-surface`/`text-fg`/`--accent`/`--fill-hover`/`--overlay`/`--success-fg`/`--danger-fg`) to canonical names (`bg-background`/`text-foreground`/`--primary`/`--action-default-bg-hover`/`--ring`/`--success`/`--destructive`), tighten radii to the DuBois 4px/8px scale, and make the trend-chart colors theme-aware — preserving ALL data, hooks, navigation, and chart logic.

**Architecture:** One task, one file. HomePage is a self-contained ~543-line page (hero + Ask composer + KPI strip + two inline-SVG trend charts + quick-access cards) with internal sub-components (`KpiCard`, `DeltaChip`, `KpiSkeleton`, `TrendCard`, `AreaChart`, `BarChart`, `QuickCard`). It currently styles everything with legacy alias tokens (which resolve to canonical DuBois values via the Phase 2 alias layer, so it already looks roughly on-brand). This reskin swaps those aliases for the canonical token names + tightens radii + fixes the hardcoded emissions green — no data/logic change. No test file exists.

**Tech Stack:** Vite 7 + React 19 + React Router 7, Tailwind v4 canonical DuBois tokens (from Phase 2 `index.css`), lucide-react icons, Vitest 3.

## Global Constraints

- **Frontend-only.** No backend / `app.py` / `/api/*` change. (Login was the one approved exception; Home is a normal React page — frontend-only holds.)
- **KEEP all feature logic, swap presentation only** (spec §Phase 5): every `useState`/`useEffect`/`fetchKpis`/`fetchKpiTrend`/`useNavigate`/`useUser`, all KPI/delta math, format functions, chart coordinate computation, form submit + suggestion handlers, and icon props stay byte-identical. Only `className` strings, inline-style token names, and the two chart `accent` prop values change.
- **Canonical DuBois tokens (target — all exist in `frontend/src/index.css`):** `--background`/`bg-background` (#fff), `--secondary`/`bg-secondary` (#f7f7f7), `--muted`/`bg-muted`, `--foreground`/`text-foreground` (#161616), `--muted-foreground`/`text-muted-foreground` (#6f6f6f), `--primary`/`bg-primary`/`text-primary` (#2272b4), `--primary-foreground`, `hover:bg-blue-700`, `border-border` (#ebebeb), `border-input`/`border-neutral-200`, `--ring`, `--destructive` (#c82d4c), `--success` (#277c43), `--chart-2` (#277c43 light / #3ba65e dark), `--background-success` (#f3fcf6), `--background-danger` (#fff5f7), `--action-default-bg-hover`. Radii: DuBois container `rounded-md` (8px), interactive `rounded` (4px). Do NOT use `rounded-2xl`/`rounded-xl` (drifted).
- **This reskin advances alias-elimination:** after it, HomePage must reference NO legacy alias token (`--surface`, `--fg`, `--accent`, `--n*`, `--fill-*`, `--overlay`, `--success-fg`, `--danger-fg`, `bg-surface*`, `text-fg*`, `border-border-hover`, `bg-accent`, `text-accent`, `accent-fg`, `accent-hover`). (Aliases stay defined for other pages until Phase 6; HomePage just stops using them.) `GradientMark` (uses `--accent-gradient`) is the one allowed exception — it's the AI mark, `--accent-gradient` is the canonical AI gradient, and GradientMark is out of scope this task.
- **Task ends green:** `cd frontend && npm test && npm run build` both pass, then a live Chrome check in **both** light and dark. Push to `feature/apex-theming`, no PRs.

---

## File Structure

**Modified:** `frontend/src/pages/HomePage.tsx` (only this file).
**Untouched:** `@/config` (fetch/format helpers), `useUser`, `GradientMark`, everything else.

---

### Task 1: Migrate HomePage to canonical DuBois tokens + radii + theme-aware charts

Section-by-section token/radii swaps, plus the two chart `accent` values and the DeltaChip semantic colors. Each edit below gives the exact current string → replacement (these are precise `Edit` operations; do them in order, then run the alias-free verification grep).

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx`

**Interfaces:**
- Consumes: unchanged (`fetchKpis`, `fetchKpiTrend`, `useUser`, `useNavigate`, `GradientMark`, lucide icons).
- Produces: same component export + same sub-component signatures; only visual classes/token names change. Chart `accent` props change type-compatibly (still `string`, now CSS-var references).

- [ ] **Step 1: Root + Hero section**

Root wrapper (line 132):
- `<div className="flex-1 overflow-y-auto bg-surface">` → `<div className="flex-1 overflow-y-auto bg-background">`

Hero `<section>` (line 135):
- `className="rounded-2xl border border-border bg-surface-2 px-7 py-8 md:px-10 md:py-10"` → `className="rounded-md border border-border bg-secondary px-7 py-8 md:px-10 md:py-10"`

Hero tenant eyebrow (line 137): `text-fg-muted` → `text-muted-foreground`

Hero `<h1>` (line 141): `text-fg` → `text-foreground` (keep `font-bold`? DuBois uses semibold max — change `font-bold` → `font-semibold`)
- `className="mt-2 text-2xl md:text-[28px] font-bold tracking-tight text-fg"` → `className="mt-2 text-2xl md:text-[28px] font-semibold tracking-tight text-foreground"`

Hero `<p>` (line 144): `text-fg-muted` → `text-muted-foreground`

- [ ] **Step 2: Ask composer (form + input + submit + suggestions)**

Composer `<form>` (line 155): drop the alias focus tokens; keep the `gradient-border` AI cue (canonical `--accent-gradient`), canonicalize bg + focus ring:
- current: `className="gradient-border group relative mt-6 flex items-center rounded-md bg-[var(--fill-hover)] px-4 py-2.5 transition-all focus-within:border-border-emphasis focus-within:ring-2 focus-within:ring-[rgba(var(--overlay),0.06)]"`
- → `className="gradient-border group relative mt-6 flex items-center rounded-md bg-background px-4 py-2.5 transition-all focus-within:ring-2 focus-within:ring-ring"`

Sparkles icon (line 157): `text-fg-muted` → `text-muted-foreground`

Input (line 164): `text-fg placeholder:text-fg-muted` → `text-foreground placeholder:text-muted-foreground`
- current: `className="flex-1 bg-transparent py-1 text-[15px] text-fg placeholder:text-fg-muted focus:outline-none"`
- → `className="flex-1 bg-transparent py-1 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"`

Submit button (line 169): `rounded-sm bg-accent text-accent-fg hover:bg-accent-hover` → `rounded bg-primary text-primary-foreground hover:bg-blue-700`
- current: `className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-30"`
- → `className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-30"`

Suggestion buttons (line 180): `rounded-sm border border-border bg-surface ... text-fg-2 ... hover:bg-[var(--fill-hover)] hover:text-fg`
- current: `className="rounded-sm border border-border bg-surface px-3.5 py-1.5 text-[12.5px] text-fg-2 transition-colors hover:bg-[var(--fill-hover)] hover:text-fg"`
- → `className="rounded border border-border bg-background px-3.5 py-1.5 text-[12.5px] text-foreground transition-colors hover:bg-[var(--action-default-bg-hover)] hover:text-blue-700"`

- [ ] **Step 3: KPI strip section headers**

Section header `<h2>` (line 193): `text-fg-subtle` → `text-muted-foreground`
Section "vs. prior year" span (line 196): `text-fg-muted` → `text-muted-foreground`

- [ ] **Step 4: Trend chart accent props (theme-aware)**

Spend TrendCard (line 221): `accent="var(--accent)"` → `accent="var(--primary)"`
Emissions TrendCard (line 231): `accent="#10b981"` → `accent="var(--chart-2)"` (canonical DuBois green, theme-aware)

- [ ] **Step 5: Quick-access section**

Section `<h2>` (line 243): `text-fg-subtle` → `text-muted-foreground`

- [ ] **Step 6: KpiCard sub-component (lines 291-303)**

Card div (line 292): `rounded-2xl border border-border bg-surface ... hover:border-border-hover`
- → `rounded-md border border-border bg-background p-4 transition-colors hover:border-neutral-200`

Icon tile (line 295): `rounded-xl bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-accent`
- → `rounded bg-primary/10 text-primary`
(Remove the `color-mix` arbitrary value entirely; `bg-primary/10` is the canonical DuBois tinted-accent, matching the active-nav treatment.)

Value div (line 301): `text-fg` → `text-foreground` (keep `font-bold` → change to `font-semibold`)
- current: `className="mt-3 text-2xl font-bold tracking-tight text-fg"` → `className="mt-3 text-2xl font-semibold tracking-tight text-foreground"`

Label div (line 302): `text-fg-muted` → `text-muted-foreground`

- [ ] **Step 7: DeltaChip sub-component (lines 318-323) — canonical semantic colors**

Neutral tone (line 318): `let tone = "bg-surface-3 text-fg-2";` → `let tone = "bg-secondary text-muted-foreground";`

Good/bad tones (lines 321-323):
- current:
  ```
      tone = good
        ? "bg-[rgba(48,160,80,0.12)] text-[var(--success-fg)]"
        : "bg-[rgba(196,64,64,0.12)] text-[var(--danger-fg)]";
  ```
- →
  ```
      tone = good
        ? "bg-[var(--background-success)] text-[var(--success)]"
        : "bg-[var(--background-danger)] text-[var(--destructive)]";
  ```

- [ ] **Step 8: KpiSkeleton sub-component (lines 339-342)**

- Card (line 339): `rounded-2xl border border-border bg-surface p-4` → `rounded-md border border-border bg-background p-4`
- Icon bar (line 340): `rounded-xl bg-surface-3` → `rounded bg-muted`
- Value bar (line 341): `rounded bg-surface-3` → `rounded bg-muted`
- Label bar (line 342): `rounded bg-surface-2` → `rounded bg-muted`

- [ ] **Step 9: TrendCard sub-component (lines 388-419)**

- Card (line 388): `rounded-2xl border border-border bg-surface p-4` → `rounded-md border border-border bg-background p-4`
- Title (line 391): `text-fg` → `text-foreground`
- Subtitle (line 392): `text-fg-muted` → `text-muted-foreground`
- "Latest" label (line 396): `text-fg-subtle` → `text-muted-foreground`
- Latest value (line 397): `text-fg` → `text-foreground`
- Loading placeholder (line 404): `rounded-lg bg-surface-2` → `rounded bg-muted`
- "Not enough data" (line 406): `text-fg-muted` → `text-muted-foreground`
- Axis labels (line 417): `text-fg-muted` → `text-muted-foreground`

(The `AreaChart`/`BarChart` SVG internals use the `accent` prop passed in — now `var(--primary)` / `var(--chart-2)` — no change needed inside them.)

- [ ] **Step 10: QuickCard sub-component (lines 523-538)**

- Button (line 523): `rounded-2xl border border-border bg-surface ... hover:border-border-hover`
  - → `group flex items-start gap-3.5 rounded-md border border-border bg-background p-4 text-left transition-colors hover:border-neutral-200`
- Icon tile (line 526): `rounded-xl bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-accent` → `rounded bg-primary/10 text-primary`
- Title span (line 532): `text-fg` → `text-foreground`
- ArrowRight (line 535): `text-fg-subtle ... group-hover:text-accent` → `text-muted-foreground ... group-hover:text-primary`
- Desc `<p>` (line 538): `text-fg-muted` → `text-muted-foreground`

- [ ] **Step 11: Verify HomePage references NO legacy alias token**

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -nE "bg-surface|text-fg|--fill-hover|rgba\(var\(--overlay|--success-fg|--danger-fg|border-border-hover|bg-accent|text-accent|accent-fg|accent-hover|--accent[^-]|rounded-2xl|rounded-xl|color-mix" src/pages/HomePage.tsx
```
Expected: NO matches (empty). The only permitted survivors are: `--accent-gradient` (none directly in HomePage — it's inside GradientMark, out of scope) and `text-primary`/`bg-primary` (canonical, not alias). If the grep hits `text-fg` inside `text-foreground`? No — the pattern `text-fg` would match `text-foreground`'s prefix. To avoid false positives, use word-ish checks: re-run with `grep -nE "text-fg[^o]|text-fg\"|bg-surface|..."` OR just visually confirm each hit is inside a canonical token. Simplest: `grep -nE "bg-surface|-fg-|text-fg[\" ]|bg-accent|text-accent|rounded-2xl|rounded-xl|color-mix|fill-hover|success-fg|danger-fg|border-border-hover" src/pages/HomePage.tsx` → expect empty.

- [ ] **Step 12: Run tests**

Run: `cd frontend && npm test`
Expected: PASS (no HomePage test exists; confirm the swap didn't break any other suite — it shouldn't, HomePage is isolated).

- [ ] **Step 13: Run build**

Run: `cd frontend && npm run build`
Expected: `tsc -b` + Vite build succeed. If Tailwind flags an unknown utility (e.g. a mistyped canonical class), fix it. (`bg-blue-700`, `border-neutral-200`, `bg-primary/10`, `text-primary`, arbitrary `bg-[var(--background-success)]` all resolve against the Phase-2 canonical token layer.)

- [ ] **Step 14: Live check both themes**

`cd frontend && npm run dev`, open in Chrome (log in with a demo user so `/` renders; backend on :8000 needed for KPI/trend data, but the layout renders regardless — /api failures just show skeletons/empty which is fine to inspect visually). Verify on the Home page:
- Hero card is warm-grey `#f7f7f7` (`bg-secondary`) inside the white content card; heading is `#161616` semibold (not bolder/700).
- Ask composer shows the subtle AI-gradient border; focusing it gives a blue ring; the submit arrow button is filled DuBois blue `#2272b4`, darkening on hover; suggestion chips are white/bordered, hover tints blue.
- KPI tiles: white cards, icon tiles are blue-tinted (`bg-primary/10`) with a blue icon; delta chips are green (good) / red (bad) / grey (neutral) using DuBois tones; hover lightly darkens the border.
- Trend charts: the Spend area chart draws in DuBois blue `#2272b4`; the Emissions bar chart draws in DuBois green (not the old teal `#10b981`).
- Quick-access cards: white, blue-tinted icon tiles, arrow turns blue on hover.
- Toggle dark mode: every surface/text/icon themes correctly and stays legible; charts recolor (primary brightens, green brightens) because they now use CSS vars. No stray light-on-light or hardcoded color.

- [ ] **Step 15: Commit**

```bash
git add frontend/src/pages/HomePage.tsx
git commit -m "feat(home): reskin HomePage onto canonical DuBois tokens

Migrate off legacy alias tokens (bg-surface/text-fg/--accent/--fill-hover/
--overlay/--success-fg/--danger-fg) onto canonical DuBois (bg-background/
text-foreground/--primary/--action-default-bg-hover/--ring/--success/
--destructive), tighten radii to 4px/8px, and make trend-chart colors
theme-aware (var(--primary) + var(--chart-2), replacing hardcoded #10b981).
All data/hooks/navigation/chart logic unchanged.

Co-authored-by: Isaac"
```

---

## Self-Review

**Spec coverage (Phase 5 = pages reskinned; this plan = Home):**
- "Rebuild Home on DuBois primitives — KEEP feature logic, swap presentation" → Task 1 migrates all styling to canonical tokens + radii; every hook/handler/chart computation untouched (Steps 1-10 are className/token-only, plus two `accent` prop string values). ✅
- Canonical DuBois values (blue #2272b4 primary, warm neutrals, 4/8px radii, semibold not bold, theme-aware chart colors) → the mapping table + per-step edits. ✅
- Advances alias-elimination (Phase 6 prep) → Step 11 verifies HomePage uses zero legacy alias tokens. ✅

**Type/contract consistency:** all sub-component signatures unchanged; `accent` props stay `string` (now CSS-var refs). No new imports, no removed exports. `GradientMark` left as-is (documented exception). No test file to update.

**Placeholder scan:** No TBD/"handle edge cases". Every step gives the exact current string → replacement. Step 11's grep has an explicit false-positive caveat + the exact safe pattern. Step 14 names the concrete visual checks. Not placeholders.

**Risk notes:** (a) Low blast radius — one isolated file, no tests, no consumers of its internals. (b) The `bg-primary/10` swap replaces a `color-mix(... var(--accent) 12% ...)` with the canonical DuBois tinted-accent (matches active-nav treatment) — visually equivalent, cleaner. (c) `font-bold` → `font-semibold` on hero h1 + KPI value is a deliberate canonical correction (DuBois never uses 700). (d) Emissions chart color changing from teal `#10b981` to DuBois green `var(--chart-2)` is an intentional on-brand fix, not a regression.
