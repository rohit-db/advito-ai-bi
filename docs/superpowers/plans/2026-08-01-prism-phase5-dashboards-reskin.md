# Prism Phase 5 (Dashboards) — Dashboard Viewing Surface Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the dashboard *viewing* surface — the filter bar (`FilterBar.tsx`), the Databricks embed container's loading/error/empty chrome (`CustomDashboard.tsx`), and the one brand-tinted toolbar button (`App.tsx:249`) — off legacy alias tokens and raw `brand-*` classes onto canonical DuBois tokens, preserving ALL iframe SDK, token-refresh, and filter-state logic.

**Architecture:** Three small, dependency-free tasks, one component file each. This group is the dashboard *chrome around* the embedded iframe — NOT the iframe's internal Databricks-rendered content (which we can't style), and NOT the Genie surfaces (`DashboardWorkspace.tsx` Ask-APEX rail + `ExecutiveSummaryModal.tsx`), which belong to the separate Ask APEX / Genie group. Each task is pure className/token substitution: no data flow, hooks, SDK calls, or filter math change.

**Tech Stack:** Vite 7 + React 19 + React Router 7, Tailwind v4 canonical DuBois tokens (from Phase 2 `frontend/src/index.css`), `@databricks/aibi-client` SDK, lucide-react, the vendored `Button`/`Tabs` primitives, Vitest 3.

## Global Constraints

- **Frontend-only.** No backend / `app.py` / `/api/*` / SDK-config change. (Login was the one approved server exception; these are normal React files.)
- **KEEP all feature logic, swap presentation only** (spec §Phase 5): every `useState`/`useEffect`/`useRef`, the `DatabricksDashboard` SDK instantiation, `fetchEmbedToken`/`getNewToken` token refresh, `cropIframeHeader`, `reloadWithFilters`/`reapplyConfigOnNextReady`, the `DATABRICKS_EMBED_READY` message handlers, `buildTokenEmbedUrl`, `shouldPassEmbedFilters`, `LOGO_CONFIG`/`HEADER_OFFSET`, and in FilterBar the `draft` state, `apply`/`clear`, `isDirty`/`hasNonDefault` memos and `onChange` contract stay byte-identical. Only `className` strings / inline token names change.
- **Scope boundary — DO NOT TOUCH this group:** `frontend/src/components/DashboardWorkspace.tsx` and `frontend/src/components/ExecutiveSummaryModal.tsx` (both Genie surfaces — reserved for the Ask APEX / Genie group). Also do not touch the `Tabs`/`TabsList`/`TabsTrigger` usage in `App.tsx` (already canonical from Phase 4) or the "Ask APEX" button at `App.tsx:254-262` (already canonical). ONLY the "Executive Summary" button className at `App.tsx:249` changes in App.tsx.
- **Canonical DuBois tokens (target — all verified DEFINED in `frontend/src/index.css`):** `bg-background` (#fff), `bg-secondary`/`bg-muted` (#f7f7f7), `text-foreground` (#161616), `text-muted-foreground` (#6f6f6f), `bg-primary`/`text-primary`/`text-primary-foreground` (#2272b4 / #fff), `hover:bg-blue-700`, `border-border` (#ebebeb), `border-input` (#cbcbcb), `ring-ring` (focus), `--destructive` (#c82d4c), `--background-danger` (#fff5f7), `--border-danger` (#fbd0d8), `--action-default-bg-hover`. Radii: DuBois interactive `rounded` (4px), container `rounded-md` (8px) — NO `rounded-lg`/`rounded-xl`/`rounded-2xl`.
- **Advances alias-elimination:** after this group, all three files must reference ZERO legacy alias token (`bg-surface*`, `text-fg`, `-fg-`, `text-fg-2`, `--fill-hover`, `--fill-active`, `rgba(var(--overlay)`, `bg-accent`, `text-accent`, `accent-fg`, `accent-hover`, `border-border-emphasis`, `--danger`, `--danger-fg`, `bg-fg`, `brand-`, `rounded-lg`, `rounded-xl`, `rounded-2xl`). (Aliases stay defined for the still-pending Genie group until Phase 6.)
- **Each task ends green:** `cd frontend && npm test && npm run build` both pass, then a live Chrome check. Push to `feature/apex-theming`, no PRs.

---

## File Structure

**Modified:** `frontend/src/components/FilterBar.tsx`, `frontend/src/pages/CustomDashboard.tsx`, `frontend/src/App.tsx` (line 249 only).
**Untouched:** the SDK, `@/config` helpers, `Button`/`Tabs` primitives, DashboardWorkspace, ExecutiveSummaryModal, everything else.
**Tests:** none of the three files has a test today; none is added (pure visual token swap, consistent with the Home group which also had no test).

---

### Task 1: Reskin FilterBar to canonical DuBois

The filter bar is the most alias-heavy in-scope file (date inputs, selects, Filter chip, labels, Apply/Clear buttons). Precise per-line swaps below; do them in order, then run the alias-free grep.

**Files:**
- Modify: `frontend/src/components/FilterBar.tsx`

**Interfaces:**
- Consumes: unchanged (`DEFAULT_FILTERS`, `FILTERS`, `FilterKey`, `FilterState`, `Button`, `cn`).
- Produces: same default export + same `FilterBarProps` contract; only visual classes change.

- [ ] **Step 1: `DATE_INPUT_CLS` (line 8-9)**

Current:
```ts
const DATE_INPUT_CLS =
  "h-8 px-2.5 text-xs rounded-lg border border-border bg-surface text-fg hover:border-border focus:bg-surface focus:outline-none focus:border-border-emphasis focus:ring-2 focus:ring-[rgba(var(--overlay),0.06)] transition-colors";
```
Replace with (DuBois input: 4px radius, darker `border-input`, blue focus ring):
```ts
const DATE_INPUT_CLS =
  "h-8 px-2.5 text-xs rounded border border-input bg-background text-foreground hover:border-neutral-200 focus:bg-background focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring transition-colors";
```

- [ ] **Step 2: `StyledSelect` classes (lines 16-19)**

- Line 16: `"h-8 px-2.5 pr-7 text-xs font-medium rounded-lg border border-border bg-surface text-fg"` → `"h-8 px-2.5 pr-7 text-xs font-medium rounded border border-input bg-background text-foreground"`
- Line 18: `"focus:bg-surface focus:outline-none focus:ring-2 focus:ring-[rgba(var(--overlay),0.06)] focus:border-border-emphasis"` → `"focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"`
- Line 19: `"hover:border-border transition-colors"` → `"hover:border-neutral-200 transition-colors"`

- [ ] **Step 3: Select chevron (line 27)**

- `className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none"` → `className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"`

- [ ] **Step 4: Root bar container (line 74)**

- `<div className="shrink-0 bg-surface border-b border-border">` → `<div className="shrink-0 bg-background border-b border-border">`

(The `Divider` on line 33 uses `bg-border` — canonical, leave it.)

- [ ] **Step 5: Filter chip + label (lines 77, 80)**

- Line 77: `className="grid place-items-center w-6 h-6 rounded-lg bg-[var(--fill-active)] text-accent"` → `className="grid place-items-center w-6 h-6 rounded bg-primary/10 text-primary"`
- Line 80: `text-fg-muted` → `text-muted-foreground` (in `"text-[10px] font-semibold uppercase tracking-widest text-fg-muted select-none"`)

- [ ] **Step 6: Filter row labels + arrow (lines 90, 97, 107)**

- Line 90: `className="text-xs text-fg-muted font-medium"` → `className="text-xs text-muted-foreground font-medium"`
- Line 97: `className="text-xs text-fg-2"` → `className="text-xs text-muted-foreground"`
- Line 107: `className="text-xs text-fg-muted font-medium"` → `className="text-xs text-muted-foreground font-medium"`

- [ ] **Step 7: Apply button (lines 135, 139)**

- Line 135 (active branch): `"bg-accent text-accent-fg hover:bg-accent-hover"` → `"bg-primary text-primary-foreground hover:bg-blue-700"`
- Line 139 (dirty status dot): `<span className="w-1.5 h-1.5 rounded-full bg-fg/90" />` → `<span className="w-1.5 h-1.5 rounded-full bg-primary-foreground/90" />`

Rationale for the dot: the Apply button is a filled DuBois-blue primary; `bg-fg/90` (legacy `--fg` → dark #161616) rendered a near-invisible dark dot on blue. `bg-primary-foreground/90` is the canonical white-on-primary dot — a deliberate legibility correction, not a behavior change.

- [ ] **Step 8: Clear button (line 145)**

- `className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"` → `className="flex items-center gap-1 text-xs text-primary hover:text-blue-700 transition-colors"`

- [ ] **Step 9: Verify FilterBar is alias-free**

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -nE "bg-surface|text-fg[\" -]|-fg-|--fill-hover|--fill-active|rgba\(var\(--overlay|bg-accent|text-accent|accent-fg|accent-hover|border-border-emphasis|bg-fg|brand-|rounded-lg|rounded-xl|rounded-2xl" src/components/FilterBar.tsx
```
Expected: ZERO matches. (`text-foreground`/`text-primary`/`text-muted-foreground`/`bg-background`/`bg-primary`/`border-input`/`border-border`/`bg-border` are canonical, not matches.)

- [ ] **Step 10: Test + build**

Run: `cd frontend && npm test && npm run build`
Expected: PASS (no FilterBar test exists; confirm no other suite breaks). `border-input`, `border-neutral-200`, `bg-primary/10`, `bg-blue-700`, `focus:ring-ring`, `bg-primary-foreground/90` all resolve against the Phase-2 canonical layer.

- [ ] **Step 11: Live check both themes**

`cd frontend && npm run dev`, Chrome, log in, open a custom dashboard page (one with `filterKeys` — the analytics dashboards under Insights/Exploration). Verify:
- The bar is white (`bg-background`) with a hairline bottom border; the "Filters" chip is blue-tinted (`bg-primary/10`) with a blue Filter icon.
- Date inputs + selects: white bg, grey `border-input`, 4px radius; focusing shows a blue ring; select chevron is muted grey; labels are muted grey.
- Apply button: filled DuBois blue, darkens on hover, `opacity-40` disabled until a filter is edited; when dirty, a small white dot precedes "Apply".
- Clear link (appears only with a non-default filter): blue, darkens on hover.
- Toggle dark: every surface/input/label themes correctly and stays legible; the blue chip/Apply brighten. No stray light-on-light.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/components/FilterBar.tsx
git commit -m "feat(dashboards): reskin FilterBar onto canonical DuBois tokens

Migrate off legacy alias tokens (bg-surface/text-fg/--fill-active/--overlay/
bg-accent/accent-*) onto canonical DuBois (bg-background/text-foreground/
border-input+ring-ring focus/bg-primary/10 chip/bg-primary Apply), tighten
input radii to 4px, and fix the dirty-dot to primary-foreground for on-blue
legibility. All filter draft/apply/clear/isDirty logic unchanged.

Co-authored-by: Isaac"
```

---

### Task 2: Reskin CustomDashboard embed chrome to canonical DuBois

Only the empty / error / loading chrome around the iframe uses legacy tokens. The SDK/iframe logic is untouched. Two hardcoded RGBA reds become canonical DuBois destructive tokens.

**Files:**
- Modify: `frontend/src/pages/CustomDashboard.tsx`

**Interfaces:**
- Consumes: unchanged (`DatabricksDashboard`, `@/config` helpers, types).
- Produces: same default export + `CustomDashboardProps`; only the JSX class strings on the empty/error/loading branches change.

- [ ] **Step 1: Empty state (line 178)**

- `<div className="h-full flex items-center justify-center text-sm text-fg-muted">` → `<div className="h-full flex items-center justify-center text-sm text-muted-foreground">`

- [ ] **Step 2: Error card (lines 187, 192)**

- Line 187: `<div className="max-w-md rounded-xl border border-[color:var(--danger)] bg-[rgba(208,64,64,0.06)] p-5 text-sm text-[var(--danger-fg)]">` → `<div className="max-w-md rounded-md border border-[color:var(--border-danger)] bg-[var(--background-danger)] p-5 text-sm text-[var(--destructive)]">`
- Line 192: `<p className="text-[var(--danger-fg)]">{error}</p>` → `<p className="text-[var(--destructive)]">{error}</p>`

(This maps the hand-rolled danger palette to canonical DuBois: border `--border-danger` #fbd0d8, bg `--background-danger` #fff5f7, text `--destructive` #c82d4c — the same error treatment the login + admin groups adopted. `rounded-xl` → `rounded-md` container radius.)

- [ ] **Step 3: Iframe frame + loading overlay (lines 200, 202, 203, 204)**

- Line 200: `<div className="flex-1 relative overflow-hidden bg-surface">` → `<div className="flex-1 relative overflow-hidden bg-background">`
- Line 202: `<div className="absolute inset-0 z-10 flex items-center justify-center bg-surface">` → `<div className="absolute inset-0 z-10 flex items-center justify-center bg-background">`
- Line 203: `<div className="flex flex-col items-center gap-3 text-fg-muted">` → `<div className="flex flex-col items-center gap-3 text-muted-foreground">`
- Line 204: `<Loader2 size={28} className="animate-spin text-accent" />` → `<Loader2 size={28} className="animate-spin text-primary" />`

- [ ] **Step 4: Verify CustomDashboard is alias-free**

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -nE "bg-surface|text-fg[\" -]|-fg-|--fill-hover|bg-accent|text-accent|accent-fg|--danger[^-]|--danger-fg|brand-|rounded-lg|rounded-xl|rounded-2xl|rgba\(208" src/pages/CustomDashboard.tsx
```
Expected: ZERO matches. (`--destructive`/`--background-danger`/`--border-danger`/`text-primary`/`bg-background`/`text-muted-foreground` are canonical.)

- [ ] **Step 5: Test + build**

Run: `cd frontend && npm test && npm run build`
Expected: PASS. Arbitrary `bg-[var(--background-danger)]` / `text-[var(--destructive)]` / `border-[color:var(--border-danger)]` all resolve against the canonical token layer.

- [ ] **Step 6: Live check both themes**

`cd frontend && npm run dev`, Chrome, open a custom dashboard. Verify:
- Loading: the "Preparing secure dashboard…" overlay sits on a white (`bg-background`) surface with a muted-grey label and a DuBois-blue spinner.
- If the embed token can't mint locally (expired Databricks token → error branch fires; acceptable per prior groups): the error card shows the DuBois destructive treatment — soft pink `#fff5f7` bg, `#fbd0d8` border, `#c82d4c` text, `rounded-md`. If the token IS valid and the dashboard renders, confirm the surrounding frame is white and the crop still hides the Databricks header (unchanged logic).
- Empty state (a dashboard with zero pages, if reachable) reads in muted grey.
- Toggle dark: the frame/overlay/label recolor and stay legible; spinner blue brightens; the error card's destructive tokens stay legible on the dark ramp.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/CustomDashboard.tsx
git commit -m "feat(dashboards): reskin embed chrome onto canonical DuBois tokens

Migrate the empty/error/loading chrome around the Databricks embed iframe
off legacy alias tokens (bg-surface/text-fg-muted/text-accent) and the
hand-rolled danger palette (--danger/--danger-fg + hardcoded rgba) onto
canonical DuBois (bg-background/text-muted-foreground/text-primary and
--destructive/--background-danger/--border-danger), rounded-xl -> rounded-md.
All SDK/token-refresh/filter/iframe-crop logic unchanged.

Co-authored-by: Isaac"
```

---

### Task 3: Reskin the Executive Summary toolbar button in App.tsx

One line: the dashboard toolbar's "Executive Summary" button carries `brand-*` overrides. Map them to canonical primary tints. (The button's `onClick`/modal wiring and the adjacent "Ask APEX" button stay untouched — only this className changes.)

**Files:**
- Modify: `frontend/src/App.tsx` (line 249 only)

**Interfaces:**
- Consumes/Produces: unchanged — same button, same `onClick={() => setSummaryOpen(true)}`; only the className string changes.

- [ ] **Step 1: Executive Summary button className (line 249)**

Current:
```tsx
              className="gap-1.5 text-brand-primary border-brand-primary-light hover:bg-brand-primary-light hover:text-brand-primary-dark"
```
Replace with (canonical primary-tinted `default`/bordered button — matches the DuBois tinted-accent treatment used for active nav + the KPI icon tiles):
```tsx
              className="gap-1.5 text-primary border-primary/30 hover:bg-primary/10 hover:text-blue-700"
```

- [ ] **Step 2: Verify no `brand-` survivor in the touched toolbar block**

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -nE "brand-" src/App.tsx
```
Expected: ZERO matches. (If any other `brand-` hits appear elsewhere in App.tsx, they are OUT OF SCOPE for this task — report them to the controller, do NOT fix them here; this task changes only line 249.)

- [ ] **Step 3: Test + build**

Run: `cd frontend && npm test && npm run build`
Expected: PASS. `text-primary`, `border-primary/30`, `hover:bg-primary/10`, `hover:text-blue-700` all resolve against the canonical layer.

- [ ] **Step 4: Live check both themes**

`cd frontend && npm run dev`, Chrome, open a custom dashboard. Verify:
- The "Executive Summary" button (top-right of the dashboard toolbar, left of "Ask APEX") is a bordered `default`-variant button with blue text + a subtle blue border; hovering tints it blue (`bg-primary/10`) and deepens the text. It sits consistently beside the "Ask APEX" button.
- Toggle dark: text/border/hover stay legible and on-brand.
- (Optional) Clicking it still opens the Executive Summary modal — logic unchanged; the modal itself is a Genie surface reskinned in a later group, so its internals may still look legacy. That's expected and out of scope here.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(dashboards): reskin Executive Summary toolbar button to DuBois primary

Map the brand-* overrides on the dashboard toolbar's Executive Summary
button to canonical DuBois primary tints (text-primary/border-primary-30/
hover:bg-primary-10/hover:text-blue-700). Button wiring unchanged.

Co-authored-by: Isaac"
```

---

## Self-Review

**Spec coverage (Phase 5 = pages reskinned; this plan = the Dashboards viewing surface):**
- "Rebuild dashboards on DuBois — KEEP feature logic, swap presentation" → all three tasks are className/token-only; every SDK call, token-refresh, filter-state memo, iframe-crop, and message handler untouched. ✅
- Canonical DuBois values (blue primary, warm neutrals, 4/8px radii, blue focus ring, DuBois destructive error, `bg-primary/10` tinted accent) → the per-step mappings. ✅
- Advances alias-elimination (Phase 6 prep) → each task ends with an alias-free grep gate (Steps 9 / 4 / 2). ✅
- Scope discipline → the two Genie surfaces (DashboardWorkspace, ExecutiveSummaryModal) and the already-canonical Tabs/Ask-APEX button are explicitly fenced out in Global Constraints + Task 3 Step 2. ✅

**Type/contract consistency:** no signature/prop/import change in any task. `DATE_INPUT_CLS` stays a string constant; `FilterBarProps`, `CustomDashboardProps` unchanged; the App.tsx button keeps its `onClick`.

**Placeholder scan:** none — every step gives the exact current string → replacement, each grep is concrete, each live check names the observable result. No TBD/"handle edge cases".

**Risk notes:** (a) Low blast radius — three isolated files, no tests, no internal consumers. (b) The `bg-fg/90` → `bg-primary-foreground/90` dirty-dot swap (Task 1 Step 7) is a deliberate legibility correction (white dot on the filled-blue Apply button), flagged so the reviewer doesn't read it as an unmotivated color change. (c) The CustomDashboard error branch may not fire locally if the embed token is valid, and WILL fire if the local Databricks token is expired — either way the card is inspectable; consistent with the fail-soft live-check convention from Home/Preferences. (d) `border-input` on the date/select inputs (vs the lighter `border-border`) is deliberate — DuBois form controls use the darker `--input` #cbcbcb edge, matching the Preferences reskin.
