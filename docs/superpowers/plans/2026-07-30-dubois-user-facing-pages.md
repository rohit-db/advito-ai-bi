# DuBois User-Facing Pages Conversion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the remaining non-admin, user-facing surfaces — Preferences, FilterBar, Executive Summary modal, Markdown content, the Custom Dashboard frame, and the Placeholder page — from hardcoded `slate-*`/`brand-*`/`white` classes to the DuBois token system, so the entire surface a normal (non-operator) user touches is coherent blue+neutral in both themes.

**Background:** Phase 0 (tokens), Phase 1 (shell), the premium re-tune (blue accent + cool neutrals + gradient flourishes on chat/home), and Plan 1 (ui/* primitives) are all done and merge-ready on this branch. These 6 files are the last user-facing surfaces still wearing the old slate/indigo look — they'll clash with the converted chat/home until done. Admin (operator-only) is a separate later plan; the dashboard toolbar + login are tracked separately.

**Architecture:** Class-only token substitution against the Phase-0 seam + Plan-1 primitives. Same mapping applied across all prior conversions. No behavior/data/logic change.

**Tech Stack:** React 19 + TS, Tailwind v4 (Phase-0 `surface-*`/`fg-*`/`accent*`/`border-*` + raw `var(--fill-*)`, state `var(--danger|warning|success[-fg])`), Vitest 3.

## Global Constraints

- **The token mapping (apply exhaustively, every task):**
  - `bg-white` → `bg-surface` (panels/cards) / `bg-surface-2` (elevated) — or remove if a parent owns it.
  - `bg-slate-50/100` → `bg-surface-2` or `var(--fill-hover)`; `bg-slate-200/300` → `bg-surface-3` or `var(--fill-active)`.
  - `text-slate-900/800` → `text-fg`; `text-slate-700` → `text-fg-2`; `text-slate-500/600` → `text-fg-muted`; `text-slate-300/400` → `text-fg-subtle`.
  - `border-slate-200/100` → `border-border`; `border-slate-300` → `border-border-hover`.
  - accent link/active/icon `text-brand-primary`/`text-brand-accent` → `text-accent`; `hover:*-dark` → `hover:text-accent-hover`; accent fill `bg-brand-primary`/gradient CTA → `bg-accent text-accent-fg hover:bg-accent-hover`.
  - decorative gradients (`from-brand-*`, `from-fuchsia-*`, `from-emerald-*`, `from-sky-*`, blur orbs, `shadow-xl/2xl`) → flat token surfaces (remove the gradient/heavy shadow).
  - state colors: success `text-[var(--success-fg)]` on `bg-[rgba(48,160,80,0.12)]`; danger/error `text-[var(--danger-fg)]` on `bg-[rgba(196,64,64,0.12)]`; warning `text-[var(--warning-fg)]` on `bg-[rgba(184,137,46,0.12)]`. No emerald-/red-/amber-/rose- literals remain.
  - inputs → DuBois `.input` feel: `border-border bg-[var(--fill-hover)] rounded-md`, focus `focus:border-border-emphasis focus:ring-2 focus:ring-[rgba(var(--overlay),0.06)]`; placeholder `placeholder:text-fg-muted`.
- **Data-viz hues MAY stay** as inline SVG chart colors (DuBois permits chart series color) — note any you keep.
- **No behavior/data/logic change.** Only className/markup. All hooks, handlers, filter/pref persistence, markdown parsing, iframe wiring, props unchanged.
- **`cn()` is a naive string-join** — replace classes in the source literal; when asserting "no slate" in a test, assert on the element's OWN className, not subtree innerHTML.
- Weights ≤ 600; radii from the `--radius` scale.
- Each task ends with a per-file grep guard returning empty (except noted data-viz exceptions).
- `cd frontend && npm test` (currently 79/79) and `npm run build` green after every task.
- Commits end with a `Co-authored-by: Isaac` trailer; never `--no-verify`.

**Reference:** the already-converted `HomePage.tsx`, `GenieMcpExperience.tsx`, and the Plan-1 primitives show the target patterns (GradientMark, gradient-border composer, token cards, DuBois inputs). Implementers should read a reference file when unsure.

---

## File Structure

**Modified:**
- `frontend/src/pages/PreferencesPage.tsx` (18 hits) — the "My Filters" preferences page (user-facing).
- `frontend/src/components/FilterBar.tsx` (14 hits) — the dashboard filter strip (appears above custom dashboards).
- `frontend/src/components/ExecutiveSummaryModal.tsx` (22 hits) — the AI exec-summary modal launched from the dashboard toolbar.
- `frontend/src/components/MarkdownContent.tsx` (12 hits) — renders assistant/markdown text (used across chat + exec summary); prose/code/link styling.
- `frontend/src/pages/CustomDashboard.tsx` (4 hits) — the embedded-dashboard frame wrapper.
- `frontend/src/pages/Placeholder.tsx` (4 hits) — the "coming soon" placeholder page.

**No new component files.** Tests: add class-assertion coverage only where a conversion is substantial (Preferences, MarkdownContent); the rest are verified by grep + build + existing green suite.

---

### Task 1: `MarkdownContent` → tokens (highest leverage — used everywhere)

**Files:**
- Modify: `frontend/src/components/MarkdownContent.tsx`
- Test: `frontend/src/components/MarkdownContent.test.tsx` (create)

**Why first:** it renders inside chat messages AND the exec-summary modal, so converting it first makes those surfaces fully coherent and de-risks the modal task.

**Interfaces:** unchanged — same props (`content`, `compact?`), same markdown parsing/rendering logic.

- [ ] **Step 1: READ `frontend/src/components/MarkdownContent.tsx`** fully. Identify every hardcoded color in the prose/heading/link/code/list/blockquote/table styling.
- [ ] **Step 2: Write a failing test** — `MarkdownContent.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import MarkdownContent from "./MarkdownContent";

describe("MarkdownContent (DuBois tokens)", () => {
  it("renders markdown with no slate/hardcoded chrome classes", () => {
    const { container } = render(
      <MarkdownContent content={"# Title\n\nBody **bold** and `code` and [a link](https://x.com)."} />
    );
    expect(container.innerHTML).not.toMatch(/slate-\d|text-brand-primary|bg-white/);
    // links use the accent token
    const link = container.querySelector("a");
    if (link) expect(link.className).toMatch(/text-accent/);
    expect(container.textContent).toMatch(/Title/);
  });
});
```
- [ ] **Step 3: Run → fails.** `cd frontend && npx vitest run src/components/MarkdownContent.test.tsx`.
- [ ] **Step 4: Apply the mapping** to `MarkdownContent.tsx`: prose text → `text-fg`/`text-fg-2`; headings → `text-fg`; links `text-brand-primary`/`text-brand-accent` → `text-accent hover:text-accent-hover`; inline code + code blocks → `font-mono` on `bg-surface-2 text-fg` (per DuBois `code.inline`); blockquote border → `border-border`, muted text → `text-fg-muted`; tables (if any) → the `.data-table` treatment (header `text-fg-subtle` on `bg-surface-2`, cells `text-fg-2`, borders `border-border`); list markers → `text-fg-muted`.
- [ ] **Step 5: Run → passes.** Full suite + build.
- [ ] **Step 6: Grep guard.** `cd frontend && grep -nE "slate-[0-9]|bg-white|from-brand|text-brand|red-[0-9]|emerald-[0-9]" src/components/MarkdownContent.tsx` → empty.
- [ ] **Step 7: Commit** (`feat(ui): tokenize MarkdownContent prose/code/links`).

---

### Task 2: `FilterBar` → tokens

**Files:** Modify `frontend/src/components/FilterBar.tsx`.

**Interfaces:** unchanged — `FilterBar({filters, onChange, filterKeys})`, all select/chip logic intact.

- [ ] **Step 1: READ the file.** It's the filter strip above custom dashboards (selects/dropdowns/chips for currentPeriod/travelSector/etc).
- [ ] **Step 2: Apply the mapping** — strip bg `bg-white`/`bg-slate-50` → `bg-surface`/`bg-surface-2`; borders → `border-border`; labels `text-slate-*` → `text-fg-muted`/`text-fg-2`; the select/dropdown controls → DuBois `.input`/`filter-chip` feel (`border-border bg-surface rounded-md`, focus ring accent); any active/selected chip → `bg-[var(--fill-active)] text-fg` or `text-accent`; clear/reset link → `text-accent`.
- [ ] **Step 3: Build + suite + grep** (`slate-[0-9]|bg-white|from-brand|text-brand`) → empty.
- [ ] **Step 4: Commit** (`feat(ui): tokenize FilterBar`).

---

### Task 3: `ExecutiveSummaryModal` → tokens

**Files:** Modify `frontend/src/components/ExecutiveSummaryModal.tsx`.

**Interfaces:** unchanged — modal open/close, the Genie summary fetch, props all intact. (Consumes MarkdownContent, converted in Task 1.)

- [ ] **Step 1: READ the file.** It's the AI exec-summary modal (scrim + panel + header mark + body via MarkdownContent + loading/error states).
- [ ] **Step 2: Apply the mapping** — scrim stays `bg-black/50` (that's a DuBois `.scrim`, fine); modal panel `bg-white` → `bg-surface-2` (DuBois `.modal` uses n2), border → `border-border`, `rounded-xl`; header mark if gradient → monochrome `bg-surface-3 text-fg-muted` OR a `<GradientMark>` (this is a "hero"-ish AI surface — a small GradientMark is appropriate; import from `@/theme/GradientMark`); title `text-slate-900` → `text-fg`; loading `text-slate-400` → `text-fg-muted`; error box → danger state tokens; any accent button → `bg-accent text-accent-fg`.
- [ ] **Step 3: Build + suite + grep** (`slate-[0-9]|bg-white|from-brand|from-fuchsia|red-[0-9]`) → empty.
- [ ] **Step 4: Commit** (`feat(ui): tokenize Executive Summary modal`).

---

### Task 4: `PreferencesPage` → tokens

**Files:** Modify `frontend/src/pages/PreferencesPage.tsx`.

**Interfaces:** unchanged — the My-Filters preference form + save logic (`saveFilterPrefs`, the `apex:filter-prefs-saved` event) intact.

- [ ] **Step 1: READ the file** (~183 lines). It's the user's global filter-defaults page (form controls + save button + section cards).
- [ ] **Step 2: Apply the mapping** — page/card bg → `bg-surface`/`bg-surface-2` + `border-border`; headings → `text-fg`, labels → `text-fg-2`/`text-fg-muted`; the select/input controls → DuBois `.input`; the Save button → `bg-accent text-accent-fg hover:bg-accent-hover`; any saved/success toast → success state tokens; section dividers → `border-border`.
- [ ] **Step 3: Build + suite + grep** (`slate-[0-9]|bg-white|from-brand|text-brand|emerald-[0-9]|green-[0-9]`) → empty.
- [ ] **Step 4: Commit** (`feat(ui): tokenize Preferences page`).

---

### Task 5: `CustomDashboard` frame + `Placeholder` → tokens

**Files:** Modify `frontend/src/pages/CustomDashboard.tsx`, `frontend/src/pages/Placeholder.tsx`.

**Interfaces:** unchanged — CustomDashboard's iframe embed logic (`cropIframeHeader`, containerRef, the `relative overflow-hidden` + `absolute inset-0` embed structure) MUST stay byte-for-byte; only the frame/loading/error chrome converts. Placeholder is a static "coming soon" page.

- [ ] **Step 1: READ both files.** CustomDashboard: only the WRAPPER chrome (`bg-brand-bg` frame bg, any loading/error overlay) converts — do NOT touch the iframe sizing/crop logic. Placeholder: the icon + heading + text.
- [ ] **Step 2: Apply the mapping** — CustomDashboard frame `bg-brand-bg`/`bg-white`/slate → `bg-surface`/`bg-surface-2` tokens; loading spinner/text → `text-fg-muted`; Placeholder icon chip → `bg-surface-3 text-fg-muted` (or `bg-accent/10 text-accent`), heading `text-slate-900` → `text-fg`, text `text-slate-500` → `text-fg-muted`.
- [ ] **Step 3: Build + suite + grep** both files (`slate-[0-9]|bg-white|from-brand|text-brand`) → empty (note: `bg-brand-bg` may be an intentional token utility — if so, leave it and note; else convert to `bg-surface`).
- [ ] **Step 4: Commit** (`feat(ui): tokenize CustomDashboard frame + Placeholder`).

---

### Task 6: Verification checkpoint (no code)

- [ ] **Step 1: Full green.** `cd frontend && npm test && npm run build`.
- [ ] **Step 2: Whole-plan grep guard.** Run:
```bash
cd frontend && grep -rnE "slate-[0-9]|bg-white|from-brand|from-fuchsia|from-emerald|from-sky|emerald-[0-9]|red-[0-9]|amber-[0-9]|rose-[0-9]|text-brand-primary" src/pages/PreferencesPage.tsx src/components/FilterBar.tsx src/components/ExecutiveSummaryModal.tsx src/components/MarkdownContent.tsx src/pages/CustomDashboard.tsx src/pages/Placeholder.tsx | grep -v ".test." || echo "clean"
```
Expected: clean (except any noted data-viz/`bg-brand-bg` exceptions).
- [ ] **Step 3: Live Chrome check**, light + dark: the Preferences page, the FilterBar (on a dashboard route — may need backend, so at minimum confirm it renders theme-aware), the Exec Summary modal (open it), and markdown rendering in a chat message. Legible dark, no white flashes, 0 console errors. Screenshots `/tmp/apex-userpages-{light,dark}.png`.
- [ ] **Step 4: Update ledger/memory;** do NOT push (batch with subsequent plans).

---

## Self-Review

**Coverage:** All 6 files from the inventory's user-facing set (PreferencesPage, FilterBar, ExecutiveSummaryModal, MarkdownContent, CustomDashboard, Placeholder). ✅

**Placeholder scan:** Each task is READ-then-apply-the-explicit-mapping with a named grep guard — the proven pattern from the retune's DashboardWorkspace + Genie-sub-components tasks (the exact classes depend on file content not in my context, so the mapping table + reference files is the correct instruction form, not a vague directive). Tasks 1 + 4 (the substantial ones) get real test code. ✅

**Type/behavior consistency:** No signature changes. CustomDashboard's iframe/crop logic explicitly fenced off (styling-only). MarkdownContent converted first so the modal (Task 3) that consumes it is already coherent. ✅

**Ordering rationale:** MarkdownContent first (highest reuse), then FilterBar/Modal/Preferences (independent), then the two small frames. Each task independently shippable + testable.

## Execution Handoff

(see chat)
