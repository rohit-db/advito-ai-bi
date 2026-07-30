# DuBois Adoption — Phase 2 (Ask APEX Chat) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Ask APEX chat surfaces to feel native to DuBois — flat, dense, theme-aware, monochrome chrome with accent reserved for actions — replacing the current fuchsia/indigo gradients, blur orbs, and rounded gradient bubbles.

**Architecture:** Convert the shared chat primitives first (assistant-message renderer + sub-components + conversation rail), then re-skin the two chat pages (`GenieMcpExperience`, `AskApexLive`) that compose them, then the dashboard-rail host. All styling flows through Phase-0 semantic tokens (`surface`/`fg`/`border`/`fill-*`/`accent`, `--font-mono`, `.data-table`-equivalent utilities). Per the locked decision this is **faithful flat DuBois** (spec §"Ask APEX chat redesign"): no bubbles on assistant messages, no gradients, no orbs, monochrome marks, accent only on primary actions.

**Tech Stack:** React 19 + TS, Vite 7, Tailwind v4 (Phase-0 `surface-*`/`fg-*`/`accent*`/`border-*` utilities + raw `var(--fill-*)`/`var(--font-mono)`), lucide-react, `@mcp-ui/client` (AppRenderer, untouched), Vitest 3.

## Global Constraints

- **Faithful flat DuBois** (spec §"Ask APEX chat redesign"), verbatim targets:
  - **Remove** indigo/fuchsia gradients, rounded gradient bubbles, decorative blur orbs, gradient sparkle marks.
  - **Assistant messages:** NO bubble — flat on `--surface`, body in `--fg`, a small **monochrome** avatar/mark (no gradient fill).
  - **User messages:** minimal — a subtle `--fill-active` / `--surface-2` container with `--fg`, NOT a saturated accent/gradient bubble.
  - **Composer:** DuBois `.input` metrics; send button uses `--accent` (solid `bg-accent text-accent-fg`, not a gradient).
  - **Conversation rail:** DuBois nav-row styling; active row uses an **accent** left-marker + `--fill-active`.
  - **SQL / results / tool calls / reasoning:** `--font-mono` for code, token surfaces, `.tag-*`-style status (state colors), `.data-table` styling for tables.
  - **Status pill / MCP health:** a `--dot` + state color (danger/warning/success), not saturated pill backgrounds beyond the DuBois `.tag-*` opacities.
  - **Suggestion chips:** secondary-button / filter-chip styling, NO gradient hover, no `-translate-y` lift.
- **Build on Phase-0 tokens only** — no new hex, no new tokens, no new dependency. Utilities available: `bg-surface`/`-2`/`-3`, `text-fg`/`-2`/`-muted`/`-subtle`/`-ghost`, `border-border`/`-hover`, `bg-accent`/`text-accent`/`bg-accent-hover`/`text-accent-fg`, and raw `var(--fill-hover|active|press|emphasis)`, `var(--font-mono)`. State colors via `var(--danger|warning|success)` and their `-fg` variants (defined in index.css).
- **No behavior/data/route change.** Only markup + classes. All hooks (`useGenieMcpChat`, `useGenieAppView`, `useGenieMode`), props, conversation persistence, MCP calls, AppRenderer wiring, seeding, scroll behavior stay identical.
- **`cn()` is a naive string-join** (not tailwind-merge): to remove a class you must delete it from the source string, not override it. When asserting "no gradient/slate" in tests, assert on the specific element's own `className`, never subtree `innerHTML`.
- Type weights ≤ 500 (`font-medium` max for headings; DuBois uses 400/500 only). Tight radii from the `--radius` scale (`rounded-sm`/`-md`/`-lg`).
- `cd frontend && npm test` and `npm run build` green after every task.
- Commits end with a `Co-authored-by: Isaac` trailer; never `--no-verify`.

**DuBois chat-relevant patterns (verbatim from `kit.css`, for reference):**
```
.input       { height:24px; padding:0 8px; font-size:12px; color:var(--n11); background:rgba(var(--overlay),0.04); border:1px solid rgba(var(--overlay),0.08); border-radius:var(--radius-sm); }
.input:focus { border-color:rgba(var(--overlay),0.12); box-shadow:0 0 0 2px rgba(var(--overlay),0.06); }
.btn-primary { background:var(--n12); color:var(--n1); }   /* → we use bg-accent text-accent-fg */
.nav-item.active { background:rgba(var(--overlay),0.08); color:var(--n11); }
code.inline  { font-family:var(--font-mono); background:var(--n2); padding:1px 6px; border-radius:var(--radius-sm); color:var(--n11); font-size:11px; }
.data-table th { font-size:10px; color:var(--n8); padding:6px 16px; }  td { padding:8px 16px; font-size:12px; color:var(--n10); }
.dot { width:6px; height:6px; border-radius:9999px; }  .dot-pulse { animation:dot-pulse 1.4s infinite; }
.tag-success { background:rgba(48,160,80,0.12); color:var(--success-fg); }  (danger/warning analogous)
```
(APEX keeps 13–15px chat body text for readability rather than DuBois's 12px — a deliberate local scale. Follow the flat/monochrome/token rules otherwise.)

---

## File Structure

**Modified (chat surfaces):**
- `frontend/src/components/genie/GenieAssistantMessage.tsx` — flat, bubble-less, monochrome mark. (shared by both pages + dashboard rail — the highest-leverage file)
- `frontend/src/components/genie/ConversationRail.tsx` — DuBois list rows, accent marker; drop the `accent="indigo"|"fuchsia"` prop (monochrome now).
- `frontend/src/components/genie/GenieReasoning.tsx`, `GenieSqlBlock.tsx`, `GenieResultTable.tsx`, `GenieToolCalls.tsx`, `GenieDeepLink.tsx`, `GenieMcpStatus.tsx` — tokens, `--font-mono`, `.data-table`/`.tag-*` treatment.
- `frontend/src/pages/GenieMcpExperience.tsx` — flat page: header, remove orbs, flat hero, DuBois composer + accent send, minimal user message, suggestion chips; **de-dupe: use the shared `ConversationRail`, delete the local one**.
- `frontend/src/pages/AskApexLive.tsx` — same flat treatment (fuchsia → accent/monochrome).
- `frontend/src/components/DashboardWorkspace.tsx` — the rail host wrapper → tokens (hosts the compact `GenieAssistantMessage`).

**Created (tests):**
- `frontend/src/components/genie/GenieAssistantMessage.test.tsx` — flat + monochrome assertions.
- `frontend/src/components/genie/ConversationRail.test.tsx` — accent-marker + token assertions.

---

### Task 1: `GenieAssistantMessage` → flat, bubble-less, monochrome mark

**Files:**
- Modify: `frontend/src/components/genie/GenieAssistantMessage.tsx`
- Test: `frontend/src/components/genie/GenieAssistantMessage.test.tsx` (create)

**Interfaces:**
- Consumes: `MarkdownContent`, `Avatar`/`AvatarFallback`, sub-components (`GenieReasoning`/`GenieSqlBlock`/`GenieResultTable`/`GenieToolCalls`/`GenieDeepLink`), `GenieMcpMessage` type — all unchanged in signature.
- Produces: same default export + same props (`message`, `variant`, `sqlOpen`, `onToggleSql`, `toolsOpen`, `onToggleTools`, `collapsibleAnswer`, `showFooter`). Only classes/markup change.

- [ ] **Step 1: Write the failing test** — `GenieAssistantMessage.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import GenieAssistantMessage from "./GenieAssistantMessage";
import type { GenieMcpMessage } from "@/hooks/useGenieMcpChat";

const msg = (over: Partial<GenieMcpMessage> = {}): GenieMcpMessage => ({
  id: "m1", role: "assistant", content: "Total spend was **$4.2M**.",
  steps: [], sql: [], table: null, toolCalls: [], deepLink: null,
  isStreaming: false, error: null, status: "completed", ...over,
} as GenieMcpMessage);

describe("GenieAssistantMessage (flat DuBois)", () => {
  it("renders the answer with NO bubble (no bg-white/shadow/gradient) and a monochrome mark", () => {
    const { container } = render(
      <GenieAssistantMessage message={msg()} variant="full" sqlOpen={false} onToggleSql={() => {}} />
    );
    const html = container.innerHTML;
    // flat: no white bubble, no card shadow, no gradient anywhere in the assistant message
    expect(html).not.toMatch(/bg-white/);
    expect(html).not.toMatch(/from-brand-|from-fuchsia|bg-linear-to/);
    expect(html).not.toMatch(/shadow-sm|shadow-md/);
    // the answer text still renders
    expect(container.textContent).toMatch(/Total spend/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.** Run: `cd frontend && npx vitest run src/components/genie/GenieAssistantMessage.test.tsx`
Expected: FAIL — current renderer has `bg-white … shadow-sm border-slate-200` bubble + `bg-linear-to-br from-brand-accent to-brand-primary` mark.

- [ ] **Step 3: Rewrite the component's presentational classes.** Keep ALL logic (the long-answer collapse, streaming states, sub-component wiring) identical; change only these:

  (a) The `bubble` constant (lines ~45-47) — remove the card entirely; the assistant message is flat on the page surface with just left padding to align under the mark:
```tsx
  const bubble = compact
    ? "flex-1 min-w-0 min-h-0 text-fg"
    : "flex-1 min-w-0 min-h-0 text-fg";
```
  (b) The avatar mark (lines ~51-55) — monochrome, no gradient:
```tsx
      <Avatar className={`${avatarSize} shrink-0`}>
        <AvatarFallback className="bg-surface-3 text-fg-muted">
          <Sparkles size={iconSize} />
        </AvatarFallback>
      </Avatar>
```
  (c) The error box (lines ~59-63) — token/state colors instead of red-*:
```tsx
        {message.error && (
          <div className="rounded-md px-3 py-2 text-sm" style={{ background: "rgba(196,64,64,0.12)", color: "var(--danger-fg)" }}>
            {message.error}
          </div>
        )}
```
  (d) The long-answer fade (line ~71) `from-white` → `from-[var(--surface)]`; the "Show full answer" button (line ~76) `text-brand-accent hover:text-brand-accent-dark` → `text-accent hover:text-accent-hover`.
  (e) The footer (lines ~108-115) `text-slate-400` → `text-fg-subtle`, `text-amber-600` → `text-[var(--warning-fg)]`.
  (f) The streaming/loading line (lines ~118-122) `text-slate-400` → `text-fg-muted`.

- [ ] **Step 4: Run test to verify it passes.** Run: `cd frontend && npx vitest run src/components/genie/GenieAssistantMessage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + build.** Run: `cd frontend && npm test && npm run build`
Expected: PASS both.

- [ ] **Step 6: Commit.**
```bash
git add frontend/src/components/genie/GenieAssistantMessage.tsx frontend/src/components/genie/GenieAssistantMessage.test.tsx
git commit -m "feat(chat): flat bubble-less assistant message, monochrome mark

Co-authored-by: Isaac"
```

---

### Task 2: Genie sub-components → tokens + mono + data-table

**Files:**
- Modify: `frontend/src/components/genie/GenieReasoning.tsx`, `GenieSqlBlock.tsx`, `GenieResultTable.tsx`, `GenieToolCalls.tsx`, `GenieDeepLink.tsx`, `GenieMcpStatus.tsx`
- Test: none new (covered by the page-level checkpoint); keep suite green.

**Interfaces:** all unchanged — pure class conversion.

- [ ] **Step 1: Read each of the 6 files** and convert every hardcoded color to a token, per this mapping (apply consistently; leave all logic/props/structure intact):
  - `bg-white` → `bg-surface` (or remove if it was a bubble already handled by the parent).
  - `bg-slate-50`/`bg-slate-100` → `bg-surface-2`; `bg-slate-*` darker → `bg-surface-3`.
  - `text-slate-900/800` → `text-fg`; `text-slate-600/700` → `text-fg-2`; `text-slate-400/500` → `text-fg-muted`; `text-slate-300` → `text-fg-subtle`.
  - `border-slate-200/100` → `border-border`.
  - `text-brand-primary`/`text-brand-accent` (as link/accent) → `text-accent`; `hover:text-brand-*-dark` → `hover:text-accent-hover`.
  - SQL/code: the code/`<pre>` font → add `font-mono` (`var(--font-mono)`); code background `bg-slate-*` → `bg-surface-2`.
  - Result table (`GenieResultTable`): header cells `text-fg-subtle` on `bg-surface-2`, body cells `text-fg-2`, row borders `border-border` — the `.data-table` treatment.
  - Status/tags (`GenieMcpStatus`): success → `var(--success-fg)` on `rgba(48,160,80,0.12)`; error/danger → `var(--danger-fg)` on `rgba(196,64,64,0.12)`; connecting → `text-fg-muted` on `bg-surface-2`; the status dot uses those state colors. No emerald-*/red-*/amber-* literals remain.
- [ ] **Step 2: Build + full suite.** Run: `cd frontend && npm run build && npm test`
Expected: PASS both.
- [ ] **Step 3: Grep guard.** Run: `cd frontend && grep -rnE "slate-|bg-white|emerald-|from-brand|from-fuchsia|red-[0-9]|amber-[0-9]" src/components/genie/*.tsx | grep -v ".test."` — expected: no matches (all converted).
- [ ] **Step 4: Commit.**
```bash
git add frontend/src/components/genie/
git commit -m "feat(chat): tokenize Genie sub-components (mono code, data-table, state tags)

Co-authored-by: Isaac"
```

---

### Task 3: `ConversationRail` → DuBois list rows, accent marker (drop accent prop)

**Files:**
- Modify: `frontend/src/components/genie/ConversationRail.tsx`
- Test: `frontend/src/components/genie/ConversationRail.test.tsx` (create)

**Interfaces:**
- Produces: same default export; **REMOVE the `accent?: "indigo" | "fuchsia"` prop** (monochrome now). Consumers (`AskApexLive` passes `accent="fuchsia"`) must drop that prop — handled in Task 5. Other props (`conversations`, `activeId`, `onSelect`, `onNew`, `onDelete`, `disabled`) unchanged.

- [ ] **Step 1: Write the failing test** — `ConversationRail.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ConversationRail from "./ConversationRail";

const convos = [
  { id: "a", title: "Spend Q1", updated_at: new Date().toISOString() },
  { id: "b", title: "Emissions", updated_at: new Date().toISOString() },
];

describe("ConversationRail (DuBois)", () => {
  it("marks the active row with the accent marker + fill, no gradient/fuchsia", () => {
    const { container } = render(
      <ConversationRail conversations={convos} activeId="a" onSelect={() => {}} onNew={() => {}} onDelete={() => {}} />
    );
    const html = container.innerHTML;
    expect(html).not.toMatch(/fuchsia|from-brand-|bg-linear-to/);
    // active row carries an accent marker
    const activeRow = screen.getByText("Spend Q1").closest("div")!;
    expect(activeRow.parentElement!.innerHTML).toMatch(/bg-accent/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.** Run: `cd frontend && npx vitest run src/components/genie/ConversationRail.test.tsx`
Expected: FAIL — current rail uses fuchsia/brand-primary accents + gradient New button.

- [ ] **Step 3: Rewrite `ConversationRail.tsx`.** Remove the `accent` prop and all the `accent === "fuchsia" ? … : …` branches; use monochrome tokens throughout with `--accent` only for the active marker/New button:
  - `<aside>` `border-slate-200 bg-white` → `border-border bg-surface-2` (rail sits one elevation up; matches DuBois `.detail-nav`/sidebar `n2`).
  - History label `text-slate-700` → `text-fg-2`; the header icon → `text-fg-muted`.
  - New button: `bg-linear-to-br ${accentBtn}` → `bg-accent text-accent-fg hover:bg-accent-hover` (solid accent, no gradient).
  - Empty text `text-slate-400` → `text-fg-muted`.
  - Row: hover `hover:bg-slate-50` → `hover:bg-[var(--fill-hover)]`; active `activeBg` → `bg-[var(--fill-active)] text-fg`; radius `rounded-lg` → `rounded-md`.
  - Active marker span: `${activeBar}` → `bg-accent`.
  - Row icon active `${activeIcon}` → `text-accent`; inactive `text-slate-400` → `text-fg-muted`.
  - Title active `${activeTitle}` → `text-fg`; inactive `text-slate-700` → `text-fg-2`; timestamp `text-slate-400` → `text-fg-subtle`.
  - Delete button `text-slate-300 hover:text-rose-500` → `text-fg-subtle hover:text-[var(--danger-fg)]`.
  - Footer: border `border-slate-100` → `border-border`; text `text-slate-400` → `text-fg-subtle`; the "Lakebase" emphasis `${accentText}` → `text-accent`; the emerald dot → `bg-[var(--success)]`.

- [ ] **Step 4: Run test to verify it passes.** Run: `cd frontend && npx vitest run src/components/genie/ConversationRail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + build.** Run: `cd frontend && npm test && npm run build`
Expected: `npm run build` may FAIL if `AskApexLive.tsx` still passes `accent="fuchsia"` (removed prop). If so, that's expected — it's fixed in Task 5. To keep this task's gate green, ALSO do the trivial consumer fix now: in `AskApexLive.tsx` line ~68 remove the `accent="fuchsia"` prop from `<ConversationRail>` (just that one attribute; the rest of AskApexLive is Task 5). Re-run build → green. Note this small cross-file touch in the report.

- [ ] **Step 6: Commit.**
```bash
git add frontend/src/components/genie/ConversationRail.tsx frontend/src/components/genie/ConversationRail.test.tsx frontend/src/pages/AskApexLive.tsx
git commit -m "feat(chat): monochrome DuBois conversation rail, accent active marker

Co-authored-by: Isaac"
```

---

### Task 4: `GenieMcpExperience` page → flat DuBois (+ de-dupe rail)

**Files:**
- Modify: `frontend/src/pages/GenieMcpExperience.tsx`

**Interfaces:** same default export; all hooks/seeding/scroll behavior unchanged.

- [ ] **Step 1: Convert the page shell + de-dupe the rail.** Concrete edits (logic untouched):
  - **De-dupe:** add `import ConversationRail from "@/components/genie/ConversationRail";` at top, and DELETE the local `ConversationRail` function (lines ~285-376) and its now-unused `formatRelative` (lines ~270-283) + unused imports (`MessageSquare`, `Trash2`, `History`, `ConversationMeta`). The page already renders `<ConversationRail …/>` at line 64 with the right props (no `accent` prop → monochrome). Verify the render call matches the shared component's props.
  - Page bg `bg-slate-50` → `bg-surface`.
  - Header (`<header>`): `border-slate-200/70 bg-white/70 backdrop-blur-md` → `border-border bg-surface-2`; the mark `bg-linear-to-br from-brand-primary to-brand-accent shadow-*` → `bg-surface-3` (monochrome) with icon `text-fg-muted`; title `text-slate-900` → `text-fg`, weight ≤ `font-medium`; subtitle `text-slate-500` → `text-fg-muted`.
  - Empty hero: DELETE the two blur-orb divs (the `aria-hidden` block, lines ~96-99). Mark `bg-linear-to-br … shadow-lg ring-white/40` → `bg-surface-3` monochrome, icon `text-fg-muted`. `h2 text-slate-900` → `text-fg` (`font-medium`, drop `font-bold`); `p text-slate-500` → `text-fg-muted`.
  - Suggestion chips: `border-slate-200 bg-white/70 text-slate-600 … hover:-translate-y-0.5 hover:border-brand-primary-light hover:text-brand-primary hover:shadow` → `border border-border bg-surface text-fg-2 hover:bg-[var(--fill-hover)] hover:text-fg` (drop the lift + gradient hover; keep `rounded-sm`).
  - Footer composer wrap: `bg-linear-to-t from-slate-50 via-slate-50 to-transparent` → `bg-surface` (flat, no fade gradient).
  - "New" button: `border-slate-200 bg-white text-slate-600 … hover:border-brand-primary-light hover:bg-brand-primary-light hover:text-brand-primary` → `border border-border bg-surface text-fg-2 hover:bg-[var(--fill-hover)] hover:text-fg`; `rounded-2xl` → `rounded-md`.
  - `HeroComposer` + `FooterComposer` + `SendButton`: input wrap `border-slate-200 bg-white shadow-* focus-within:border-brand-accent focus-within:ring-* ` → `border border-border bg-[var(--fill-hover)] focus-within:border-border-emphasis focus-within:ring-2 focus-within:ring-[rgba(var(--overlay),0.06)]` (drop shadow-xl/ring-4); `rounded-2xl` → `rounded-md`. Sparkles `text-brand-accent` → `text-fg-muted`. Input `text-slate-800 placeholder-slate-400` → `text-fg placeholder:text-fg-muted`. SendButton `bg-linear-to-br from-brand-primary to-brand-accent … disabled:from-slate-300 disabled:to-slate-300` → `bg-accent text-accent-fg hover:bg-accent-hover disabled:opacity-30`; `rounded-xl` → `rounded-sm`.
  - `UserBubble`: `bg-linear-to-br from-brand-primary to-brand-accent text-white shadow-*` → `bg-[var(--fill-active)] text-fg` (minimal container, per spec); keep `rounded-2xl rounded-br-md` OR tighten to `rounded-lg`; avatar `bg-brand-primary-light text-brand-primary` → `bg-surface-3 text-fg-muted`, `ring-white` → `ring-[var(--surface)]`.

- [ ] **Step 2: Build + full suite.** Run: `cd frontend && npm run build && npm test`
Expected: PASS both (no test asserts these page classes; behavior unchanged). Fix any unused-import TS errors from the de-dupe.

- [ ] **Step 3: Grep guard.** Run: `cd frontend && grep -nE "slate-|bg-white|from-brand|from-fuchsia|blur-3xl|-translate-y" src/pages/GenieMcpExperience.tsx` — expected: no matches.

- [ ] **Step 4: Commit.**
```bash
git add frontend/src/pages/GenieMcpExperience.tsx
git commit -m "feat(chat): flat DuBois Ask APEX page + de-dupe conversation rail

Co-authored-by: Isaac"
```

---

### Task 5: EARLY VISUAL CHECKPOINT — controller + Rohit live look (no code)

**This is a deliberate feedback gate before converting the second surface.** The primary Ask APEX page (`GenieMcpExperience`) + all shared chat primitives are now flat DuBois; `AskApexLive` still has its old fuchsia look (that's fine — it's the comparison).

- [ ] **Step 1: Full green.** Run: `cd frontend && npm test && npm run build`.
- [ ] **Step 2: Live Chrome check (controller).** Start dev server, load `/genie-mcp` in BOTH themes: verify flat assistant messages (no bubble), monochrome mark, minimal user message, DuBois composer + accent send, monochrome rail with accent active marker, no orbs/gradients, legible in dark, 0 console errors. Capture `/tmp/apex-phase2-genie-{light,dark}.png` (empty hero + a seeded conversation if possible).
- [ ] **Step 3: PAUSE for Rohit.** Present the screenshots and get an explicit read on whether flat-DuBois chat is landing BEFORE converting `AskApexLive` + the dashboard rail. If Rohit wants to adjust the direction (more depth, restrained accent, etc.), revise the remaining tasks first. If approved, proceed to Task 6.

---

### Task 6: `AskApexLive` page → flat DuBois

**Files:**
- Modify: `frontend/src/pages/AskApexLive.tsx`

**Interfaces:** same default export; `useGenieAppView`, AppRenderer wiring, sandbox proxy untouched.

- [ ] **Step 1: Apply the same flat conversion as Task 4** (this page is the fuchsia twin). Same mapping, plus the fuchsia-specifics:
  - `bg-slate-50` page → `bg-surface`; header `bg-white/70 backdrop-blur-md border-slate-200/70` → `bg-surface-2 border-border`.
  - Mark `bg-linear-to-br from-fuchsia-600 to-brand-primary shadow-*` (both header + hero) → `bg-surface-3` monochrome, icon `text-fg-muted`.
  - Blur orbs (lines ~106-109): DELETE.
  - Titles `text-slate-900` → `text-fg` (`font-medium`); subtitles `text-slate-500` → `text-fg-muted`.
  - Suggestion chips `border-slate-200 bg-white/70 text-slate-600 … hover:border-fuchsia-300 hover:text-fuchsia-700` → `border border-border bg-surface text-fg-2 hover:bg-[var(--fill-hover)] hover:text-fg` (drop lift).
  - `viewUnavailable` banner `border-amber-200 bg-amber-50 text-amber-800` → `border-[color:var(--warning)] text-[var(--warning-fg)]` on `bg-[rgba(184,137,46,0.12)]`.
  - `AssistantView`: mark `from-fuchsia-500 to-brand-primary` → `bg-surface-3 text-fg-muted`; the bubble `rounded-2xl rounded-tl-md border-slate-200 bg-white shadow-sm` → flat `text-fg` (no bubble, matching Task 1); loading `text-slate-400` → `text-fg-muted`; error box red-* → `var(--danger-fg)` on `rgba(196,64,64,0.12)`; the "Genie answered, no View" text `text-slate-600` → `text-fg-2`, its deep link `text-brand-primary hover:text-brand-primary-dark` → `text-accent hover:text-accent-hover`.
  - `HealthPill`: connecting `bg-slate-100 text-slate-500` → `bg-surface-2 text-fg-muted`; error `bg-red-50 text-red-600` → state danger tokens + dot; ready `bg-emerald-50 text-emerald-700` → `bg-[rgba(48,160,80,0.12)] text-[var(--success-fg)]` + `bg-[var(--success)]` dot.
  - Footer wrap gradient fade → `bg-surface`; "New" button + `Composer` + send button → same DuBois treatment as Task 4 (accent send, `.input` metrics, no gradient).
  - `UserBubble`: `from-fuchsia-600 to-brand-primary text-white shadow-*` → `bg-[var(--fill-active)] text-fg`; avatar `bg-fuchsia-100 text-fuchsia-700` → `bg-surface-3 text-fg-muted`.

- [ ] **Step 2: Build + full suite + grep guard.** Run: `cd frontend && npm run build && npm test && grep -nE "slate-|bg-white|fuchsia|from-brand|blur-3xl|emerald-|amber-[0-9]|red-[0-9]" src/pages/AskApexLive.tsx` — expected: PASS both, grep no matches.

- [ ] **Step 3: Commit.**
```bash
git add frontend/src/pages/AskApexLive.tsx
git commit -m "feat(chat): flat DuBois Ask APEX MCP View page

Co-authored-by: Isaac"
```

---

### Task 7: `DashboardWorkspace` rail host → tokens

**Files:**
- Modify: `frontend/src/components/DashboardWorkspace.tsx`

**Interfaces:** unchanged — this wraps the compact `GenieAssistantMessage` + Executive Summary modal launcher in the dashboard view.

- [ ] **Step 1: Read `DashboardWorkspace.tsx`** and convert its rail/panel chrome to tokens (same mapping as Task 2): the assistant-rail container background → `bg-surface`/`bg-surface-2`, borders → `border-border`, text → `fg-*`, any accent link → `text-accent`, composer (if present) → DuBois `.input` + accent send, remove any gradient/shadow bubble. Leave the embedded iframe + modal logic untouched. (Read first — the exact classes depend on current content; apply the Task-2 mapping consistently.)
- [ ] **Step 2: Build + full suite + grep.** Run: `cd frontend && npm run build && npm test && grep -nE "slate-|bg-white|from-brand|from-fuchsia" src/components/DashboardWorkspace.tsx` — expected: PASS both; grep no matches (or only justified exceptions noted in the report).
- [ ] **Step 3: Commit.**
```bash
git add frontend/src/components/DashboardWorkspace.tsx
git commit -m "feat(chat): tokenize dashboard assistant-rail host

Co-authored-by: Isaac"
```

---

### Task 8: Phase-2 verification checkpoint (no code)

- [ ] **Step 1: Full green.** `cd frontend && npm test && npm run build`.
- [ ] **Step 2: Grep guard across the whole chat surface.** Run:
```bash
cd frontend && grep -rnE "slate-|bg-white|from-fuchsia|fuchsia-|blur-3xl|-translate-y" src/components/genie/*.tsx src/pages/GenieMcpExperience.tsx src/pages/AskApexLive.tsx src/components/DashboardWorkspace.tsx | grep -v ".test." || echo "clean"
```
Expected: clean (any surviving match must be a justified, documented exception).
- [ ] **Step 3: Live Chrome check (both chat pages + the dashboard rail), light + dark:** flat messages, monochrome marks, accent-only actions, no gradients/orbs, legible dark contrast, 0 console errors. Screenshots `/tmp/apex-phase2-{genie,live,rail}-{light,dark}.png`.
- [ ] **Step 4: Update ledger/memory** with Phase-2 outcome + deferrals; do NOT push (await Rohit).

---

## Self-Review

**Spec coverage (spec §"Ask APEX chat redesign" bullets):**
- Remove gradients/bubbles/orbs/sparkle marks → Tasks 1, 4, 6 (delete orbs, monochrome marks, flat messages). ✅
- Assistant messages flat, no bubble, monochrome mark → Task 1 (shared renderer). ✅
- User messages minimal fill-active container → Tasks 4, 6. ✅
- Composer DuBois `.input` + accent send → Tasks 4, 6. ✅
- Conversation rail nav-row + accent marker → Task 3. ✅
- SQL/results/tool calls/reasoning → mono/data-table/tag → Task 2. ✅
- Status pill / MCP health → dot + state colors → Tasks 2 (McpStatus), 6 (HealthPill). ✅
- Suggestion chips → filter-chip/secondary, no gradient hover → Tasks 4, 6. ✅
- Phasing "Phase 2 = the full chat redesign" → all tasks; early checkpoint (Task 5) added for risk control given shell feedback. ✅

**Placeholder scan:** Tasks 1, 3 carry exact code; Tasks 2, 4, 6, 7 use a concrete, exhaustive class-mapping table applied to named files/lines (not "handle colors"). Task 7 is a read-then-apply-mapping because its current classes weren't read at plan time — flagged explicitly with the exact mapping to apply, not a vague directive. ✅

**Type consistency:** `ConversationRail` loses its `accent` prop (Task 3) and every consumer is updated (AskApexLive in Task 3 Step 5, GenieMcpExperience de-dupes to the shared one in Task 4). No other signature changes. ✅

## Execution Handoff

(see chat)
