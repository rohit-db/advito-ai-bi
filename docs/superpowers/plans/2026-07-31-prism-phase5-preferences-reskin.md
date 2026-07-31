# Prism Phase 5 (Preferences) — PreferencesPage Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin `frontend/src/pages/PreferencesPage.tsx` ("My Filters") off legacy alias tokens onto canonical DuBois — `bg-surface`→`bg-background`, `text-fg`→`text-foreground`, `--fill-hover`/`--overlay` focus ring→canonical input focus, `bg-accent`→`bg-primary`, `--success-fg`→`--success`, tighten radii — and update its test to assert the canonical tokens, preserving ALL filter-prefs data/save/reset logic.

**Architecture:** One task, one component file + its test. PreferencesPage is a self-contained ~183-line settings page (header + a card with per-filter date-range/select rows + a footer with Reset / Save). It styles everything with legacy alias tokens (working via the Phase 2 alias layer). This reskin swaps them for canonical DuBois names + tightens radii, and updates `PreferencesPage.test.tsx` (which currently *asserts* the legacy tokens `bg-surface`/`bg-accent`) to assert canonical ones. No data/logic change.

**Tech Stack:** Vite 7 + React 19 + React Router 7, Tailwind v4 canonical DuBois tokens, lucide-react, our `Button` primitive, Vitest 3 + Testing Library.

## Global Constraints

- **Frontend-only.** No backend / `app.py` / `/api/*` change.
- **KEEP all feature logic, swap presentation only** (spec §Phase 5): every `useState`/`useEffect`/`fetchFilterPrefs`/`saveFilterPrefs`, the `dirty` memo, `set`/`save`/`reset` handlers, the `apex:filter-prefs-saved` CustomEvent dispatch, the `DEFAULT_PREFS_KEY` sentinel, and the filter-row rendering logic stay byte-identical. Only `className` strings / the `INPUT_CLS` token names change.
- **Canonical DuBois tokens (target — all in `frontend/src/index.css`):** `bg-background` (#fff), `bg-secondary` (#f7f7f7), `text-foreground` (#161616), `text-muted-foreground` (#6f6f6f), `bg-primary`/`text-primary-foreground` (#2272b4 / #fff), `hover:bg-blue-700`, `border-border` (#ebebeb), `border-input`/`border-neutral-200`, `ring-ring` (focus), `--success` (#277c43) + `--background-success` (#f3fcf6 tint). Radii: container `rounded-md` (8px), interactive `rounded` (4px) — no `rounded-2xl`/`rounded-xl`.
- **Advances alias-elimination:** after this, PreferencesPage.tsx must reference NO legacy alias token (`bg-surface*`, `text-fg*`, `-fg-`, `--fill-hover`, `rgba(var(--overlay)`, `bg-accent`, `text-accent`, `accent-fg`, `accent-hover`, `--success-fg`, `--danger-fg`, `border-border-hover`, `border-border-emphasis`, `rounded-2xl`, `rounded-xl`). (Aliases remain defined for other pages until Phase 6.)
- **The test currently enforces legacy tokens** (`PreferencesPage.test.tsx:37` asserts `bg-surface`, `:65` asserts `bg-accent`) — it MUST be updated to canonical (`bg-background`, `bg-primary`) or it will fail. Keep the test's *intent* (no slate/white/brand-gradient; canonical surface + solid primary button).
- **Task ends green:** `cd frontend && npm test && npm run build` both pass, then a live Chrome check in **both** light and dark. Push to `feature/apex-theming`, no PRs.

---

## File Structure

**Modified:** `frontend/src/pages/PreferencesPage.tsx`, `frontend/src/pages/PreferencesPage.test.tsx`.
**Untouched:** `@/config` helpers, `Button` primitive, everything else.

---

### Task 1: Reskin PreferencesPage to canonical DuBois + update its test

Precise token swaps across the file, plus the test assertions. Each edit gives the exact current string → replacement.

**Files:**
- Modify: `frontend/src/pages/PreferencesPage.tsx`
- Modify: `frontend/src/pages/PreferencesPage.test.tsx`

**Interfaces:**
- Consumes: unchanged (`FILTERS`, `DEFAULT_FILTERS`, `DEFAULT_PREFS_KEY`, `fetchFilterPrefs`, `saveFilterPrefs`, `Button`).
- Produces: same default export + behavior; only visual classes change.

- [ ] **Step 1: `INPUT_CLS` (lines 22-24)**

Current:
```ts
const INPUT_CLS =
  "h-9 px-3 text-sm rounded-md border border-border bg-[var(--fill-hover)] text-fg " +
  "hover:border-border-hover focus:outline-none focus:border-border-emphasis focus:ring-2 focus:ring-[rgba(var(--overlay),0.06)] transition-colors placeholder:text-fg-muted";
```
Replace with (canonical input: transparent-ish bg, `border-input`, blue focus ring; DuBois inputs are 4px `rounded` not `rounded-md`):
```ts
const INPUT_CLS =
  "h-9 px-3 text-sm rounded border border-input bg-background text-foreground " +
  "hover:border-neutral-200 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring transition-colors placeholder:text-muted-foreground";
```

- [ ] **Step 2: Root wrapper (line 70)**

- `<div className="h-full overflow-y-auto bg-surface">` → `<div className="h-full overflow-y-auto bg-background">`

- [ ] **Step 3: Header icon tile + heading (lines 74-79)**

- Icon tile (line 74): `rounded-xl bg-accent text-accent-fg shadow-sm` → `rounded-md bg-primary text-primary-foreground shadow-sm`
- `<h1>` (line 78): `text-fg` → `text-foreground`
- `<p>` (line 79): `text-fg-muted` → `text-muted-foreground`

- [ ] **Step 4: Card container + section header (lines 86-88)**

- Card (line 86): `rounded-2xl border border-border bg-surface-2 shadow-sm` → `rounded-md border border-border bg-secondary shadow-sm`
- Section `<h2>` (line 88): `text-fg` → `text-foreground`

- [ ] **Step 5: Loading + filter rows (lines 92-149)**

- Loading (line 92): `text-fg-muted` → `text-muted-foreground`
- Row label (line 103): `text-fg` → `text-foreground`
- Row sublabel (line 108): `text-fg-muted` → `text-muted-foreground`
- Date-range arrow (line 121): `text-fg-subtle` → `text-muted-foreground`
- Select chevron (line 148): `text-fg-muted` → `text-muted-foreground`

(The `divide-y divide-border` on line 94 is canonical — leave it. `INPUT_CLS` on the date/select inputs is handled by Step 1.)

- [ ] **Step 6: Footer (lines 159-176)**

- Footer bar (line 159): `border-t border-border bg-surface` → `border-t border-border bg-background`
- Reset button (line 163): `text-fg-2 ... hover:text-fg` → `text-muted-foreground ... hover:text-foreground`
- Saved chip (line 170): `text-[var(--success-fg)] bg-[rgba(48,160,80,0.12)]` → `text-[var(--success)] bg-[var(--background-success)]`
- Save Button (line 174): `bg-accent text-accent-fg hover:bg-accent-hover` → `bg-primary text-primary-foreground hover:bg-blue-700`

- [ ] **Step 7: Verify PreferencesPage.tsx is alias-free**

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -nE "bg-surface|-fg-|text-fg[\" ]|--fill-hover|rgba\(var\(--overlay|bg-accent|text-accent|accent-fg|accent-hover|--success-fg|--danger-fg|border-border-hover|border-border-emphasis|rounded-2xl|rounded-xl" src/pages/PreferencesPage.tsx
```
Expected: ZERO matches. (`text-foreground`/`bg-background`/`bg-primary`/`text-primary-foreground` are canonical, not matches. `border-border` and `divide-border` are canonical.)

- [ ] **Step 8: Update `PreferencesPage.test.tsx` to canonical tokens**

Two assertions currently enforce legacy tokens; update them (keep every other test + all the negative assertions):

- Line 34-38, the "uses DuBois surface token" test — change the assertion from `bg-surface` to `bg-background`:
```tsx
  it("page wrapper uses DuBois surface token", () => {
    const { container } = renderPage();
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toMatch(/\bbg-background\b/);
  });
```

- Line 59-68, the "save button uses solid accent tokens" test — change `bg-accent` to `bg-primary`:
```tsx
  it("save button uses solid primary tokens and no legacy brand gradient", async () => {
    const { container } = renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /save defaults/i })).toBeInTheDocument());
    const btn = screen.getByRole("button", { name: /save defaults/i });
    expect(btn.className).toMatch(/\bbg-primary\b/);
    expect(btn.className).not.toMatch(/from-brand/);
    expect(btn.className).not.toMatch(/bg-linear/);
  });
```

(The input/select tests assert `border-border` — that stays true since `INPUT_CLS` keeps a `border-*`… wait: Step 1 changes `border-border` → `border-input`. So those two tests (lines 45, 54) that assert `/border-border/` will FAIL.) Update them to assert `border-input`:
- Line 45: `expect(input.className).toMatch(/border-border/);` → `expect(input.className).toMatch(/border-input/);`
- Line 54: `expect(select.className).toMatch(/border-border/);` → `expect(select.className).toMatch(/border-input/);`

Keep all the negative assertions (no `slate-`, no `bg-white`, no `from-brand`, no `emerald-`) as-is — they should still pass and guard against regressions.

- [ ] **Step 9: Run tests**

Run: `cd frontend && npm test`
Expected: PASS — the PreferencesPage suite included. If a PreferencesPage assertion fails, it's one of the four token assertions updated in Step 8 (surface→background, accent→primary, border-border→border-input ×2); reconcile so the assertion matches the reskinned class.

- [ ] **Step 10: Run build**

Run: `cd frontend && npm run build`
Expected: `tsc -b` + Vite build succeed. (`border-input`, `bg-blue-700`, `focus:ring-ring`, `bg-[var(--background-success)]` all resolve against the Phase-2 canonical layer.)

- [ ] **Step 11: Live check both themes**

`cd frontend && npm run dev`, Chrome (log in; the page is at `/preferences` / "My Filters" in the Exploration nav; backend on :8000 for prefs load, but layout renders regardless). Verify:
- Page bg is white content card; the header icon tile is filled DuBois blue `#2272b4`.
- The "Default selection" card is warm-grey `#f7f7f7` (`bg-secondary`) with a `rounded-md` border; rows divided by hairlines.
- Date inputs + selects: white bg, grey (`border-input`) border, 4px radius; focusing shows a blue ring; the select chevron is muted grey.
- Footer: Reset link muted→darker on hover; Save button filled DuBois blue, darkening on hover, disabled until dirty; saving then shows a green "Saved" chip (DuBois green on light-green tint).
- Toggle dark: every surface/text/input themes correctly and stays legible; the blue icon tile + Save button brighten; the Saved chip green stays legible on its dark-green tint. No stray light-on-light.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/pages/PreferencesPage.tsx frontend/src/pages/PreferencesPage.test.tsx
git commit -m "feat(prefs): reskin My Filters page onto canonical DuBois tokens

Migrate off legacy alias tokens (bg-surface/text-fg/--fill-hover/--overlay/
bg-accent/--success-fg) onto canonical DuBois (bg-background/text-foreground/
border-input+ring-ring focus/bg-primary/--success+--background-success),
tighten radii to 4px/8px, and update the test to assert canonical tokens.
All filter-prefs data/save/reset logic unchanged.

Co-authored-by: Isaac"
```

---

## Self-Review

**Spec coverage (Phase 5 = pages reskinned; this plan = Preferences):**
- "Rebuild Preferences on DuBois — KEEP feature logic, swap presentation" → Task 1 is className/token-only; all data/handlers/CustomEvent untouched. ✅
- Canonical DuBois values (blue primary, warm neutrals, 4/8px radii, blue focus ring, DuBois success chip) → Steps 1-6 mapping. ✅
- Advances alias-elimination → Step 7 verifies alias-free. ✅
- Test kept green + meaningful → Step 8 updates the 4 token assertions (2 that enforced legacy `bg-surface`/`bg-accent`, 2 `border-border`→`border-input`) while keeping all negative guards. ✅

**Type/contract consistency:** no signature/import change; `INPUT_CLS` stays a string constant. Test still imports/mocks `@/config` the same way.

**Placeholder scan:** No TBD/"handle edge cases". Every step gives exact current→replacement. Step 7 grep + Step 11 visual checks are concrete.

**Risk notes:** (a) The one subtlety is `INPUT_CLS` `border-border`→`border-input` — this is deliberate (DuBois inputs use the darker `--input #cbcbcb` border, distinct from the lighter `--border #ebebeb` used for card/divider edges), and it forces the two test `border-border`→`border-input` updates (Step 8) — flagged so the implementer doesn't miss them. (b) Low blast radius: one page + its test, no other consumers.
