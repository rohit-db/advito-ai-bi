# Prism Phase 5 (Ask APEX / Genie) — Surface Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the entire Ask APEX / Genie chat surface (13 files) off legacy alias tokens + raw `brand-*` classes + hardcoded inline `rgba(...)` colors onto canonical DuBois tokens — presentation only, preserving ALL MCP/streaming/state logic.

**Architecture:** Scope A (token-only) per the approved design `docs/superpowers/specs/2026-08-01-prism-genie-reskin-design.md`. Four dependency-ordered tasks (leaf children → status/reasoning/tools → assistant message → history rail + 3 containers). NO structural adoption of the kit's `Message`/`GeniePrompt`/`ChainOfThought`/`MessageActions`. Each task = className/token swaps + test-assertion updates where a test enforces a legacy token.

**Tech Stack:** Vite 7 + React 19 + React Router 7, Tailwind v4 canonical DuBois tokens (from `frontend/src/index.css`), lucide-react, react-markdown, our `Badge`/`Avatar` primitives, Vitest 3.

## Global Constraints

- **Frontend-only.** No backend / `app.py` / `/api/*` / hook change. `useGenieMcpChat` is consumed, never edited.
- **KEEP all feature logic, swap presentation only** (spec §3): every `useState`/`useEffect`/`useRef`, `clearChat`-on-pageKey, scroll-to-bottom, `sentRef` auto-fire guard, Escape-to-close, regenerate, poll-status dedup, answer-collapse (600-char) threshold, SQL/tools toggles, `.trim()` submit validation, URL `?q=` seeding, and every component prop signature stay byte-identical. Only `className` strings, inline-style token names, and `*_CLS`/`accent`/`color`/`pre` string constants change.
- **NO structural change:** no new/removed components, no `Message`/`GeniePrompt`/`ChainOfThought` wrappers, no feedback buttons, reasoning timeline keeps its structure + animations + "Genie is thinking…" copy (recolor only).
- **Canonical DuBois tokens (all verified DEFINED in `frontend/src/index.css`, light+dark):** `bg-background` (#fff), `bg-secondary`/`bg-muted` (#f7f7f7), `text-foreground` (#161616), `text-muted-foreground` (#6f6f6f), `bg-primary`/`text-primary`/`text-primary-foreground` (#2272b4 / #fff), `hover:bg-blue-700`, `hover:text-blue-700`, `bg-primary/10`, `border-border` (#ebebeb), `border-input` (#cbcbcb), `border-neutral-200`, `ring-ring`/`focus-within:ring-ring`, `--destructive` (#c82d4c) + `--background-danger` (#fff5f7) + `--border-danger` (#fbd0d8), `--success` (#277c43) + `--background-success` + `--border-success`, `--warning` + `--background-warning`, `--accent-gradient` (AI cue), `var(--action-default-bg-hover)`. Radii: container `rounded-md` (8px), interactive `rounded` (4px). NO `rounded-2xl`/`rounded-xl`/`rounded-lg`/`rounded-sm` (the user-bubble `rounded-br-sm`/`rounded-br-md` speech-tail is a cosmetic corner, retained).
- **Legacy `--danger`/`--danger-fg`/`--success-fg`/`--warning-fg` are alias-layer entries** that already resolve to canonical `--destructive`/`--success`/`--warning`; swap the *references* to the canonical names so the file is alias-free (behavior identical).
- **Blue user bubble KEPT** (locked): `DashboardWorkspace` UserBubble `bg-accent`→`bg-primary` (filled blue, white text); `GenieMcpExperience` UserBubble is currently a neutral tint `bg-[var(--fill-active)]`→`bg-primary/10` (preserve its lighter weight — faithful reskin keeps each surface's current emphasis).
- **Two test files enforce legacy tokens and MUST be updated:** `MarkdownContent.test.tsx:13` asserts `text-accent` → change to `text-primary`; `ConversationRail.test.tsx:19` asserts `bg-accent` → change to `bg-primary`. Keep all negative guards.
- **Each task ends green:** `cd frontend && npm test && npm run build` both pass; then a per-file alias-free grep gate (zero matches). Push to `feature/apex-theming`, no PRs. Final live check after Task 4 covers all three surfaces in light + dark.

---

## File Structure

**Modified (13 source + 2 test):**
- Task 1: `components/MarkdownContent.tsx` (+ `MarkdownContent.test.tsx`), `components/genie/GenieDeepLink.tsx`, `components/genie/GenieResultTable.tsx`, `components/genie/GenieSqlBlock.tsx`
- Task 2: `components/genie/GenieMcpStatus.tsx`, `components/genie/GenieReasoning.tsx`, `components/genie/GenieToolCalls.tsx`
- Task 3: `components/genie/GenieAssistantMessage.tsx`
- Task 4: `components/genie/ConversationRail.tsx` (+ `ConversationRail.test.tsx`), `components/DashboardWorkspace.tsx`, `pages/GenieMcpExperience.tsx`, `components/ExecutiveSummaryModal.tsx`
**Untouched:** `components/genie/genieModes.ts`, `hooks/useGenieMcpChat.ts`, `theme/GradientMark.tsx`, all primitives, everything else.

**Per-file alias-free grep** (run after each task's files, expect ZERO matches):
```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -nE "bg-surface|text-fg[\" -]|-fg-|--fill-hover|--fill-active|rgba\(var\(--overlay|bg-accent|text-accent|accent-fg|accent-hover|--success-fg|--danger-fg|--danger[^-a-z]|--warning-fg|rgba\(196,64,64|rgba\(48,160,80|border-border-hover|border-border-emphasis|brand-|rounded-2xl|rounded-xl|rounded-lg|rounded-sm" <file>
```
(Canonical `text-foreground`, `border-border`, `bg-border`, `--destructive`, `--success`, `--warning`, `--background-*`, `--border-danger/-success/-warning`, `--accent-gradient`, `rounded-br-sm`/`rounded-br-md` are NOT matches. `--danger[^-a-z]` catches bare `--danger)` but not `--danger-fg` — both must be gone anyway.)

---

### Task 1: Reskin the shared leaf children (+ MarkdownContent test)

Four pure-presentation leaves shared by all three containers. No logic. Do the exact swaps, then update the one test assertion.

**Files:**
- Modify: `frontend/src/components/MarkdownContent.tsx`, `frontend/src/components/MarkdownContent.test.tsx`, `frontend/src/components/genie/GenieDeepLink.tsx`, `frontend/src/components/genie/GenieResultTable.tsx`, `frontend/src/components/genie/GenieSqlBlock.tsx`

**Interfaces:** Consumes/Produces unchanged — same exports + props on all four; only class/token strings change.

- [ ] **Step 1: `MarkdownContent.tsx` token swaps**

Apply these exact replacements (each is a unique substring):
- L17: `text-fg mt-3 mb-1` → `text-foreground mt-3 mb-1` (and change `font-bold` → `font-semibold`: `${compact ? "text-sm" : "text-lg"} font-semibold text-foreground mt-3 mb-1`)
- L20: `${compact ? "text-xs font-bold" : "text-base font-bold"} text-fg mt-3 mb-1` → `${compact ? "text-xs font-semibold" : "text-base font-semibold"} text-foreground mt-3 mb-1`
- L23: `${base} font-semibold text-fg mt-2 mb-0.5` → `${base} font-semibold text-foreground mt-2 mb-0.5`
- L26: `${base} text-fg-2 leading-relaxed mb-2` → `${base} text-muted-foreground leading-relaxed mb-2`
- L32: `list-disc list-inside ${base} text-fg-2 mb-2 space-y-0.5` → `list-disc list-inside ${base} text-muted-foreground mb-2 space-y-0.5`
- L35: `list-decimal list-inside ${base} text-fg-2 mb-2 space-y-0.5` → `list-decimal list-inside ${base} text-muted-foreground mb-2 space-y-0.5`
- L38: `marker:text-fg-muted` → `marker:text-muted-foreground`
- L41: `text-accent hover:text-accent-hover underline` → `text-primary hover:text-blue-700 underline`
- L51: `bg-surface-2 font-semibold text-fg-subtle` → `bg-secondary font-semibold text-muted-foreground`
- L54: `border-b border-border whitespace-nowrap text-fg-subtle` → `border-b border-border whitespace-nowrap text-muted-foreground`
- L57: `border-b border-border whitespace-nowrap text-fg-2` → `border-b border-border whitespace-nowrap text-muted-foreground`
- L60: `border-l-2 border-border pl-3 my-2 text-fg-muted` → `border-l-2 border-border pl-3 my-2 text-muted-foreground`
- L65: `font-mono bg-surface-2 text-fg text-xs px-1 py-0.5 rounded` → `font-mono bg-secondary text-foreground text-xs px-1 py-0.5 rounded`
- L67: `font-mono bg-surface-2 text-fg text-xs p-2 rounded-md overflow-x-auto my-2` → `font-mono bg-secondary text-foreground text-xs p-2 rounded-md overflow-x-auto my-2`

(`font-bold`→`font-semibold` on h1/h2 is the canonical DuBois weight correction applied in prior groups — DuBois never uses 700. `rounded-md` on the code pre is canonical container radius, keep.)

- [ ] **Step 2: `MarkdownContent.test.tsx` assertion update**

- L13: `if (link) expect(link.className).toMatch(/text-accent/);` → `if (link) expect(link.className).toMatch(/text-primary/);`

(Keep the negative guard on L10 — `slate-\d|text-brand-primary|bg-white` — as-is; still passes.)

- [ ] **Step 3: `GenieDeepLink.tsx` token swaps**

- L14: `const color = compact ? "bg-brand-primary hover:bg-brand-primary-dark" : "bg-brand-accent hover:bg-brand-accent-dark";` → `const color = "bg-primary hover:bg-blue-700";`
- L20: `mt-3 inline-flex items-center gap-1.5 rounded-lg text-white font-medium transition-colors ${color} ${size}` → `mt-3 inline-flex items-center gap-1.5 rounded text-primary-foreground font-medium transition-colors ${color} ${size}`

(Both variants collapse to the canonical primary fill — the old brand-primary/brand-accent split was a legacy dual-hue that DuBois doesn't have. `text-white`→`text-primary-foreground` (canonical white-on-primary); `rounded-lg`→`rounded` (4px interactive).)

- [ ] **Step 4: `GenieResultTable.tsx` token swaps**

- L20: `mt-3 overflow-auto max-h-60 border border-border rounded-lg` → `mt-3 overflow-auto max-h-60 border border-border rounded-md`
- L21: `mt-3 overflow-x-auto border border-border rounded-lg` → `mt-3 overflow-x-auto border border-border rounded-md`
- L26: `bg-surface-2 ${sm ? "sticky top-0" : ""}` → `bg-secondary ${sm ? "sticky top-0" : ""}`
- L29: `${cell} text-left font-semibold text-fg-subtle whitespace-nowrap` → `${cell} text-left font-semibold text-muted-foreground whitespace-nowrap`
- L39: `${cell} text-fg-2 whitespace-nowrap border-t border-border` → `${cell} text-muted-foreground whitespace-nowrap border-t border-border`

- [ ] **Step 5: `GenieSqlBlock.tsx` token swaps**

- L20: `const accent = compact ? "text-brand-primary" : "text-brand-accent";` → `const accent = "text-primary";`
- L25: `mt-2 bg-surface-2 text-fg-2 p-2.5 rounded-lg text-[10px] font-mono overflow-x-auto` → `mt-2 bg-secondary text-muted-foreground p-2.5 rounded-md text-[10px] font-mono overflow-x-auto`
- L26: `mt-2 bg-surface-2 text-fg-2 p-3 rounded-lg text-[11px] font-mono overflow-x-auto` → `mt-2 bg-secondary text-muted-foreground p-3 rounded-md text-[11px] font-mono overflow-x-auto`

(The full/compact accent split collapses to `text-primary`; the SQL `<pre>` is a container → `rounded-md`.)

- [ ] **Step 6: Alias-free grep (Task 1 files)**

Run the per-file grep (see File Structure) on all four source files. Expect ZERO matches each.

- [ ] **Step 7: Test + build**

Run: `cd frontend && npm test && npm run build`. Expected: PASS (MarkdownContent suite included — the updated `text-primary` assertion + negative guard both pass).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/MarkdownContent.tsx frontend/src/components/MarkdownContent.test.tsx frontend/src/components/genie/GenieDeepLink.tsx frontend/src/components/genie/GenieResultTable.tsx frontend/src/components/genie/GenieSqlBlock.tsx
git commit -m "feat(genie): reskin shared leaf children onto canonical DuBois tokens

MarkdownContent, GenieDeepLink, GenieResultTable, GenieSqlBlock: migrate off
legacy alias + brand-* tokens (bg-surface-2/text-fg*/text-brand-*/rounded-lg)
onto canonical (bg-secondary/text-foreground/text-muted-foreground/text-primary/
bg-primary/rounded-md), font-bold->font-semibold, and flip the MarkdownContent
link-token test assertion to text-primary. No logic change.

Co-authored-by: Isaac"
```

---

### Task 2: Reskin status / reasoning / tool-call children

Three children with visible logic (poll dedup, reasoning steps, MCP status) — recolor only, keep every branch. Uses the canonical semantic status set.

**Files:**
- Modify: `frontend/src/components/genie/GenieMcpStatus.tsx`, `frontend/src/components/genie/GenieReasoning.tsx`, `frontend/src/components/genie/GenieToolCalls.tsx`

**Interfaces:** Consumes/Produces unchanged — same `McpStatusPill`/`McpStatusDot` exports, same `GenieReasoning`/`GenieToolCalls` default exports + props + `summarizeToolResult`. Only class/inline-style token strings change.

- [ ] **Step 1: `GenieMcpStatus.tsx` — canonical status tokens**

- L9 (connecting pill): `text-fg-muted bg-surface-2` → `text-muted-foreground bg-secondary`
- L23-27 (error pill inline style): change the `style` object
  ```
        style={{
          background: "rgba(196,64,64,0.12)",
          borderColor: "rgba(196,64,64,0.30)",
          color: "var(--danger-fg)",
        }}
  ```
  →
  ```
        style={{
          background: "var(--background-danger)",
          borderColor: "var(--border-danger)",
          color: "var(--destructive)",
        }}
  ```
- L29 (error dot): `style={{ background: "var(--danger)" }}` → `style={{ background: "var(--destructive)" }}`
- L39-43 (success pill inline style):
  ```
        background: "rgba(48,160,80,0.12)",
        borderColor: "rgba(48,160,80,0.30)",
        color: "var(--success-fg)",
  ```
  →
  ```
        background: "var(--background-success)",
        borderColor: "var(--border-success)",
        color: "var(--success)",
  ```
- L45 (success dot): `style={{ background: "var(--success)" }}` — already canonical, LEAVE.
- L47 (success sub-label): `style={{ color: "var(--success-fg)", opacity: 0.7 }}` → `style={{ color: "var(--success)", opacity: 0.7 }}`
- L61 (`McpStatusDot` error): `{ background: "var(--danger)" }` → `{ background: "var(--destructive)" }`
- L60 (`McpStatusDot` connecting): `{ background: "var(--warning)" }` — already canonical, LEAVE. L58 connected `var(--success)` — LEAVE.

- [ ] **Step 2: `GenieReasoning.tsx` — recolor timeline, keep structure**

- L38 (empty streaming, full): `text-xs text-fg-muted mb-1` → `text-xs text-muted-foreground mb-1`; and `<ThinkingDots accent="bg-brand-accent" />` → `<ThinkingDots accent="bg-primary" />`
- L49 (full card): `mb-3 rounded-lg border border-brand-primary-light bg-brand-primary-light/60 p-3` → `mb-3 rounded-md border border-primary/20 bg-primary/5 p-3`
- L56 (reasoning eyebrow): `text-brand-accent` → `text-primary`
- L58 (step-label span): `text-brand-accent normal-case font-medium` → `text-primary normal-case font-medium`
- L62 (ChevronUp): `text-brand-accent shrink-0` → `text-primary shrink-0`
- L64 (ChevronDown): `text-brand-accent shrink-0` → `text-primary shrink-0`
- L73 (step li): `text-xs text-fg-2` → `text-xs text-muted-foreground`
- L75 (pending spinner): `border-2 border-brand-accent border-t-transparent` → `border-2 border-primary border-t-transparent`
- L77 (CheckCircle2, full): `style={{ color: "var(--success-fg)" }}` → `style={{ color: "var(--success)" }}`
- L85 (collapsed preview): `text-xs text-fg-muted truncate` → `text-xs text-muted-foreground truncate`
- L94 (empty streaming, compact): `text-[11px] text-fg-muted mb-1.5` → `text-[11px] text-muted-foreground mb-1.5`; and `<ThinkingDots accent="bg-brand-primary" />` → `<ThinkingDots accent="bg-primary" />`
- L103 (compact streaming line): `text-[11px] text-fg-2` → `text-[11px] text-muted-foreground`
- L104 (compact spinner): `border-2 border-brand-primary border-t-transparent` → `border-2 border-primary border-t-transparent`
- L111 (compact done line): `text-[11px] text-fg-muted` → `text-[11px] text-muted-foreground`
- L112 (CheckCircle2, compact): `style={{ color: "var(--success-fg)" }}` → `style={{ color: "var(--success)" }}`

(Timeline structure, `Zap` icon, step accumulation, animations, "Genie is thinking…"/"Thinking…" copy all UNCHANGED. The reasoning card's brand-tinted background collapses to the canonical primary tint `bg-primary/5` + `border-primary/20`.)

- [ ] **Step 3: `GenieToolCalls.tsx` — recolor, keep poll-dedup logic**

- L38 (root): `mt-3 border-t border-border pt-3` — already canonical, LEAVE.
- L40 (header label): `text-xs font-semibold text-fg-2 uppercase tracking-wide` → `text-xs font-semibold text-muted-foreground uppercase tracking-wide`
- L47 (ChevronUp): `text-fg-muted` → `text-muted-foreground`
- L49 (ChevronDown): `text-fg-muted` → `text-muted-foreground`
- L56 (ask card): `rounded-lg border border-border bg-surface-2 p-2.5` → `rounded-md border border-border bg-secondary p-2.5`
- L57 (ask mono row): `text-[11px] font-mono text-brand-accent` → `text-[11px] font-mono text-primary`
- L58 (ask badge): `px-1.5 py-0.5 bg-brand-primary-light rounded uppercase` → `px-1.5 py-0.5 bg-primary/10 rounded uppercase`
- L61 (ask pre): `mt-1.5 text-[10px] text-fg-2 font-mono ...` → `mt-1.5 text-[10px] text-muted-foreground font-mono ...`
- L65 (ask result): `mt-1 text-[10px] text-fg-muted` → `mt-1 text-[10px] text-muted-foreground`
- L71 (poll card): `rounded-lg border border-border bg-surface-2 p-2.5` → `rounded-md border border-border bg-secondary p-2.5`
- L72 (poll mono row): `text-[11px] font-mono text-brand-primary` → `text-[11px] font-mono text-primary`
- L73 (poll badge): `px-1.5 py-0.5 bg-brand-primary-light rounded uppercase` → `px-1.5 py-0.5 bg-primary/10 rounded uppercase`
- L75 (poll count): `text-fg-muted` → `text-muted-foreground`
- L81 (arrow): `text-fg-subtle text-[10px]` → `text-muted-foreground text-[10px]`
- L82 (status chip): `text-[10px] font-mono px-1.5 py-0.5 bg-surface border border-border rounded text-fg-2` → `text-[10px] font-mono px-1.5 py-0.5 bg-background border border-border rounded text-muted-foreground`

(The `asks`/`polls` filter + `pollStatuses` dedup loop (L27-35) is UNCHANGED.)

- [ ] **Step 4: Alias-free grep (Task 2 files)**

Run the per-file grep on all three. Expect ZERO matches each. (Note: `var(--success)`, `var(--warning)`, `var(--destructive)`, `var(--background-danger)`, `var(--border-success)` are canonical — not matches. The pattern `--danger[^-a-z]` should find nothing since all `--danger`/`--danger-fg` are gone.)

- [ ] **Step 5: Test + build**

Run: `cd frontend && npm test && npm run build`. Expected: PASS (no tests on these three files; confirm no other suite breaks).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/genie/GenieMcpStatus.tsx frontend/src/components/genie/GenieReasoning.tsx frontend/src/components/genie/GenieToolCalls.tsx
git commit -m "feat(genie): reskin status/reasoning/tool-call children onto DuBois

GenieMcpStatus/GenieReasoning/GenieToolCalls: migrate legacy alias + brand-*
tokens and hardcoded rgba status tints onto canonical DuBois — semantic status
set (--destructive/--success/--warning + --background-*/--border-* tints),
text-muted-foreground, bg-secondary, text-primary, bg-primary/10 tints,
rounded-lg->rounded-md. Reasoning timeline structure, poll-dedup, and all
animations unchanged.

Co-authored-by: Isaac"
```

---

### Task 3: Reskin `GenieAssistantMessage`

The shared assistant renderer. Keep every variant/collapse/footer/tools branch; recolor + fix the collapse-gradient's legacy `--surface` reference.

**Files:**
- Modify: `frontend/src/components/genie/GenieAssistantMessage.tsx`

**Interfaces:** Consumes the (now-canonical) children from Tasks 1-2; Produces the same default export + props. Only class/inline-style strings change.

- [ ] **Step 1: Token swaps**

- L46-47 (bubble const, both branches identical): `"flex-1 min-w-0 min-h-0 text-fg"` → `"flex-1 min-w-0 min-h-0 text-foreground"` (replace_all — appears twice, L46 and L47)
- L52 (avatar fallback): `bg-surface-3 text-fg-muted` → `bg-muted text-muted-foreground`
- L60 (error block inline style): `style={{ background: "rgba(196,64,64,0.12)", color: "var(--danger-fg)" }}` → `style={{ background: "var(--background-danger)", color: "var(--destructive)" }}`
- L71 (collapse fade gradient): `bg-linear-to-t from-[var(--surface)] to-transparent` → `bg-linear-to-t from-[var(--background)] to-transparent`
- L76 (show-more button): `text-xs font-medium text-accent hover:text-accent-hover` → `text-xs font-medium text-primary hover:text-blue-700`
- L109 (footer): `mt-3 flex items-center gap-2 text-[11px] text-fg-subtle` → `mt-3 flex items-center gap-2 text-[11px] text-muted-foreground`
- L113 (footer status): `style={{ color: "var(--warning-fg)" }}` → `style={{ color: "var(--warning)" }}`
- L119 (connecting line): `${compact ? "text-xs" : "text-sm"} text-fg-muted` → `${compact ? "text-xs" : "text-sm"} text-muted-foreground`

(`LONG_ANSWER_CHARS`/`answerOpen`/`collapsed`/`showTools`/variant branching + all child wiring UNCHANGED. The collapse fade must reference `--background` — the canonical name for the surface it fades into — since `--surface` is a legacy alias.)

- [ ] **Step 2: Alias-free grep (Task 3 file)**

Run the per-file grep. Expect ZERO matches. (`--background`, `--destructive`, `--warning`, `text-primary`, `bg-muted` canonical.)

- [ ] **Step 3: Test + build**

Run: `cd frontend && npm test && npm run build`. Expected: PASS — the `GenieAssistantMessage.test.tsx` negative guards (`bg-white`, `from-brand-`/`from-fuchsia`/`bg-linear-to`, `shadow-sm/md`) still hold. NOTE: the test asserts `not.toMatch(/from-brand-|from-fuchsia|bg-linear-to/)` — the collapse gradient uses `bg-linear-to-t`, which WOULD match `bg-linear-to`. BUT that gradient only renders when `collapsibleAnswer` is true AND content > 600 chars; the test's default message is short + `collapsibleAnswer` unset, so the gradient is not in the DOM and the guard passes. Do NOT change the test. If it somehow fails, the cause is unrelated — investigate, don't weaken the guard.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/genie/GenieAssistantMessage.tsx
git commit -m "feat(genie): reskin GenieAssistantMessage onto canonical DuBois tokens

Migrate off legacy alias tokens (text-fg/bg-surface-3/text-accent/--danger-fg/
--warning-fg/--surface fade) onto canonical (text-foreground/bg-muted/text-primary/
--destructive+--background-danger/--warning/--background fade). All variant,
answer-collapse, footer, tools, and child-wiring logic unchanged.

Co-authored-by: Isaac"
```

---

### Task 4: Reskin the history rail + three containers

`ConversationRail` (has a test) + the three container surfaces. Leaf children are canonical by now, so this is container-chrome + composer + user-bubble recolor. Largest task; blue user bubble per locked decision.

**Files:**
- Modify: `frontend/src/components/genie/ConversationRail.tsx`, `frontend/src/components/genie/ConversationRail.test.tsx`, `frontend/src/components/DashboardWorkspace.tsx`, `frontend/src/pages/GenieMcpExperience.tsx`, `frontend/src/components/ExecutiveSummaryModal.tsx`

**Interfaces:** All Consumes/Produces unchanged — same exports + props; only class/token strings change.

- [ ] **Step 1: `ConversationRail.tsx` token swaps**

- L36 (aside): `border-r border-border bg-surface-2` → `border-r border-border bg-secondary`
- L38 (header row): `text-fg-2` → `text-muted-foreground`
- L39 (History icon): `text-fg-muted` → `text-muted-foreground`
- L47 (New button): `flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-fg shadow-sm transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40` → `flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground shadow-db-xs transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40`
- L54 (empty state): `text-xs leading-relaxed text-fg-muted` → `text-xs leading-relaxed text-muted-foreground`
- L67 (row active/hover): `active ? "bg-[var(--fill-active)] text-fg" : "hover:bg-[var(--fill-hover)]"` → `active ? "bg-primary/10 text-foreground" : "hover:bg-[var(--action-default-bg-hover)]"`
- L71 (active marker): `w-0.5 rounded-full bg-accent` → `w-0.5 rounded-full bg-primary`
- L75 (MessageSquare): `active ? "text-accent" : "text-fg-muted"` → `active ? "text-primary" : "text-muted-foreground"`
- L80 (title): `active ? "text-fg" : "text-fg-2"` → `active ? "text-foreground" : "text-muted-foreground"`
- L85 (timestamp): `text-[11px] text-fg-subtle` → `text-[11px] text-muted-foreground`
- L94 (delete btn): `shrink-0 p-1 text-fg-subtle opacity-0 transition-all hover:text-[var(--danger-fg)] group-hover:opacity-100` → `shrink-0 p-1 text-muted-foreground opacity-0 transition-all hover:text-[var(--destructive)] group-hover:opacity-100`
- L104 (footer line): `text-[10px] text-fg-subtle` → `text-[10px] text-muted-foreground`
- L105 (success dot): `bg-[var(--success)]` — canonical, LEAVE.
- L106 (Lakebase label): `font-semibold text-accent` → `font-semibold text-primary`

(`shadow-db-xs` is the canonical DuBois small shadow used by prior groups; if unsure it exists, `shadow-sm` is an acceptable fallback but prefer `shadow-db-xs`. Verify in index.css — see Step 6 note.)

- [ ] **Step 2: `ConversationRail.test.tsx` assertion update**

- L19: `expect(activeRow.parentElement!.innerHTML).toMatch(/bg-accent/);` → `expect(activeRow.parentElement!.innerHTML).toMatch(/bg-primary/);`

(Keep the negative guard L16 `fuchsia|from-brand-|bg-linear-to` — still passes. The active marker is now `bg-primary`, which the updated assertion matches.)

- [ ] **Step 3: `DashboardWorkspace.tsx` token swaps**

- L74 (aside): `w-[400px] shrink-0 border-l border-border bg-surface-2 flex flex-col h-full` → `w-[400px] shrink-0 border-l border-border bg-secondary flex flex-col h-full`
- L76 (rail header): `bg-surface-3 px-4 pt-4 pb-3 shrink-0` → `bg-muted px-4 pt-4 pb-3 shrink-0`
- L79 (icon backdrop): `w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center` → `w-8 h-8 rounded bg-primary/10 flex items-center justify-center`
- L80 (Sparkles): `text-accent` → `text-primary`
- L83 (title): `text-sm font-semibold text-fg flex items-center gap-1.5` → `text-sm font-semibold text-foreground flex items-center gap-1.5`
- L87 (subtitle): `text-[11px] text-fg-muted` → `text-[11px] text-muted-foreground`
- L93 (clear btn): `p-1.5 text-fg-muted hover:text-fg hover:bg-surface rounded-md transition-colors` → `p-1.5 text-muted-foreground hover:text-foreground hover:bg-background rounded transition-colors`
- L100 (close btn): `p-1.5 text-fg-muted hover:text-fg hover:bg-surface rounded-md transition-colors` → `p-1.5 text-muted-foreground hover:text-foreground hover:bg-background rounded transition-colors`
- L110 (context badge): `bg-accent/15 text-accent border-accent/30 text-[11px] px-2 py-0.5` → `bg-primary/10 text-primary border-primary/30 text-[11px] px-2 py-0.5`
- L117 (messages container): `flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-surface-2` → `flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-secondary`
- L120 (empty prompt): `text-xs text-fg-muted text-center` → `text-xs text-muted-foreground text-center`
- L122 (suggested header): `text-[10px] uppercase tracking-wider text-fg-muted font-semibold px-1` → `text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1`
- L129 (suggestion pill): `w-full text-left px-3 py-2 text-sm text-fg-2 bg-surface hover:bg-accent/10 hover:text-accent rounded-lg border border-border transition-colors` → `w-full text-left px-3 py-2 text-sm text-muted-foreground bg-background hover:bg-primary/10 hover:text-primary rounded-md border border-border transition-colors`
- L154 (composer container): `border-t border-border bg-surface px-3 py-3 shrink-0` → `border-t border-border bg-background px-3 py-3 shrink-0`
- L157 (composer form): `flex items-center gap-2 bg-[var(--fill-hover)] border border-border rounded-md px-3 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all` → `flex items-center gap-2 bg-background border border-input rounded-md px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring transition-all`
- L164 (input): `flex-1 bg-transparent text-sm text-fg placeholder-fg-muted focus:outline-none py-0.5` → `flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none py-0.5`
- L170 (send button): `w-7 h-7 flex items-center justify-center bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-accent-fg rounded-full transition-colors shrink-0` → `w-7 h-7 flex items-center justify-center bg-primary hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground rounded-full transition-colors shrink-0`
- L194 (UserBubble — BLUE, filled): `max-w-[88%] bg-accent text-accent-fg rounded-2xl rounded-br-sm px-3 py-2.5 text-sm` → `max-w-[88%] bg-primary text-primary-foreground rounded-md rounded-br-sm px-3 py-2.5 text-sm`

- [ ] **Step 4: `GenieMcpExperience.tsx` token swaps**

- L74 (main col): `relative flex-1 flex flex-col h-full min-w-0 bg-surface` → `relative flex-1 flex flex-col h-full min-w-0 bg-background`
- L76 (header): `z-10 shrink-0 border-b border-border bg-surface-2 px-6 py-3` → `z-10 shrink-0 border-b border-border bg-secondary px-6 py-3`
- L79 (icon tile): `flex h-9 w-9 items-center justify-center rounded-xl bg-surface-3` → `flex h-9 w-9 items-center justify-center rounded-md bg-muted`
- L80 (Sparkles): `h-[18px] w-[18px] text-fg-muted` → `h-[18px] w-[18px] text-muted-foreground`
- L83 (h1): `text-[15px] font-medium leading-tight tracking-tight text-fg` → `text-[15px] font-medium leading-tight tracking-tight text-foreground`
- L86 (subtitle): `text-[11px] text-fg-muted` → `text-[11px] text-muted-foreground`
- L98 (hero h2): `text-3xl font-medium tracking-tight text-fg` → `text-3xl font-medium tracking-tight text-foreground`
- L101 (hero p): `mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-fg-muted` → `mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground`
- L120 (suggestion pill): `rounded-sm border border-border bg-surface px-3.5 py-1.5 text-[13px] text-fg-2 transition-colors hover:bg-[var(--fill-hover)] hover:text-fg` → `rounded border border-border bg-background px-3.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-[var(--action-default-bg-hover)] hover:text-foreground`
- L154 (footer composer wrap): `shrink-0 bg-surface px-6 pb-5 pt-3` → `shrink-0 bg-background px-6 pb-5 pt-3`
- L160 (New button): `flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 text-sm font-medium text-fg-2 transition-colors hover:bg-[var(--fill-hover)] hover:text-fg` → `flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-[var(--action-default-bg-hover)] hover:text-foreground`
- L199 (HeroComposer form): `gradient-border group relative flex items-center rounded-md bg-[var(--fill-hover)] px-4 py-2.5 transition-all focus-within:border-border-emphasis focus-within:ring-2 focus-within:ring-[rgba(var(--overlay),0.06)]` → `gradient-border group relative flex items-center rounded-md bg-background px-4 py-2.5 transition-all focus-within:ring-2 focus-within:ring-ring`
- L201 (Sparkles): `mr-2.5 h-4 w-4 shrink-0 text-fg-muted` → `mr-2.5 h-4 w-4 shrink-0 text-muted-foreground`
- L210 (hero input): `flex-1 bg-transparent py-1.5 text-[15px] text-fg placeholder:text-fg-muted focus:outline-none disabled:cursor-not-allowed` → `flex-1 bg-transparent py-1.5 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed`
- L234 (FooterComposer form): `flex flex-1 items-center rounded-md border border-border bg-[var(--fill-hover)] px-4 py-1.5 transition-all focus-within:border-border-emphasis focus-within:ring-2 focus-within:ring-[rgba(var(--overlay),0.06)]` → `flex flex-1 items-center rounded-md border border-input bg-background px-4 py-1.5 transition-all focus-within:ring-2 focus-within:ring-ring`
- L242 (footer input): `h-8 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-muted focus:outline-none disabled:cursor-not-allowed` → `h-8 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed`
- L254 (SendButton): `ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-30` → `ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-30`
- L264 (UserBubble — LIGHT tint, preserve weight): `max-w-[80%] rounded-2xl rounded-br-md bg-[var(--fill-active)] px-4 py-2.5 text-fg` → `max-w-[80%] rounded-md rounded-br-md bg-primary/10 px-4 py-2.5 text-foreground`
- L267 (Avatar ring): `ring-2 ring-[var(--surface)]` → `ring-2 ring-[var(--background)]`
- L268 (avatar fallback): `bg-surface-3 text-[10px] font-semibold text-fg-muted` → `bg-muted text-[10px] font-semibold text-muted-foreground`

(The two composers keep their `gradient-border` AI cue — canonical — and drop the legacy `focus-within:border-border-emphasis` + `rgba(var(--overlay))` ring for the canonical `focus-within:ring-ring`.)

- [ ] **Step 5: `ExecutiveSummaryModal.tsx` token swaps**

- L65 (scrim): `fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4` — already canonical (`bg-black/50`), LEAVE.
- L69 (modal card): `w-full max-w-2xl max-h-[85vh] flex flex-col bg-surface-2 rounded-xl border border-border shadow-2xl overflow-hidden` → `w-full max-w-2xl max-h-[85vh] flex flex-col bg-secondary rounded-md border border-border shadow-db-xl overflow-hidden`
- L73 (header): `shrink-0 bg-surface-3 px-5 py-4 flex items-start justify-between` → `shrink-0 bg-muted px-5 py-4 flex items-start justify-between`
- L77 (title): `text-base font-semibold text-fg` → `text-base font-semibold text-foreground`
- L79 (page badge): `bg-[var(--fill-hover)] text-fg-2 border-border text-[11px] px-2 py-0.5` → `bg-background text-muted-foreground border-border text-[11px] px-2 py-0.5`
- L82 (via label): `text-[11px] text-fg-muted` → `text-[11px] text-muted-foreground`
- L91 (regenerate): `p-2 text-fg-2 hover:text-fg hover:bg-[var(--fill-hover)] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed` → `p-2 text-muted-foreground hover:text-foreground hover:bg-[var(--action-default-bg-hover)] rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed`
- L98 (close): `p-2 text-fg-2 hover:text-fg hover:bg-[var(--fill-hover)] rounded-lg transition-colors` → `p-2 text-muted-foreground hover:text-foreground hover:bg-[var(--action-default-bg-hover)] rounded transition-colors`
- L106 (body): `flex-1 overflow-y-auto px-5 py-5 bg-surface` → `flex-1 overflow-y-auto px-5 py-5 bg-background`
- L111 (error): `rounded-lg bg-[rgba(196,64,64,0.12)] border border-[var(--danger)] px-3 py-2.5 text-sm text-[var(--danger-fg)]` → `rounded-md bg-[var(--background-danger)] border border-[color:var(--border-danger)] px-3 py-2.5 text-sm text-[var(--destructive)]`
- L117 (content card): `bg-surface-2 rounded-xl border border-border px-5 py-4 shadow-sm` → `bg-secondary rounded-md border border-border px-5 py-4 shadow-db-xs`
- L120 (refining ribbon): `mb-3 flex items-center gap-2 text-[11px] text-accent` → `mb-3 flex items-center gap-2 text-[11px] text-primary`
- L142 (footer): `shrink-0 border-t border-border bg-surface-2 px-5 py-2.5 flex items-center justify-between` → `shrink-0 border-t border-border bg-secondary px-5 py-2.5 flex items-center justify-between`
- L143 (footer text): `text-[11px] text-fg-muted` → `text-[11px] text-muted-foreground`
- L148 (footer close): `text-xs font-medium text-fg-2 hover:text-fg px-3 py-1.5 rounded-lg hover:bg-[var(--fill-hover)] transition-colors` → `text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded hover:bg-[var(--action-default-bg-hover)] transition-colors`
- L160 (AwaitingState card): `bg-surface-2 rounded-xl border border-border px-5 py-6 shadow-sm` → `bg-secondary rounded-md border border-border px-5 py-6 shadow-db-xs`
- L164 (pulse dot): `absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-2 bg-accent animate-pulse` → `absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-secondary bg-primary animate-pulse`
- L167 (awaiting title): `text-sm font-medium text-fg` → `text-sm font-medium text-foreground`
- L168 (awaiting subtitle): `text-[11px] text-fg-muted mt-0.5 min-h-[14px]` → `text-[11px] text-muted-foreground mt-0.5 min-h-[14px]`
- L178 (skeleton heading): `h-3 w-28 rounded bg-surface-3 mb-2` → `h-3 w-28 rounded bg-muted mb-2`
- L180-182 (three skeleton lines): `rounded bg-[var(--fill-hover)] animate-pulse` → `rounded bg-muted animate-pulse` (replace_all — appears 3×)

- [ ] **Step 6: Verify shadow tokens exist**

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -nE "shadow-db-xs|shadow-db-xl" src/index.css
```
If `shadow-db-xs` / `shadow-db-xl` are NOT defined, fall back to `shadow-sm` / `shadow-xl` respectively in the edits above (Tailwind built-ins). (Prior groups used `shadow-db-*`; confirm before committing.)

- [ ] **Step 7: Alias-free grep (Task 4 files)**

Run the per-file grep on all four source files. Expect ZERO matches each. (`--action-default-bg-hover`, `--background`, `--destructive`, `--border-danger`, `bg-primary/10`, `border-input`, `ring-ring`, `rounded-br-sm`/`rounded-br-md` canonical.)

- [ ] **Step 8: Test + build**

Run: `cd frontend && npm test && npm run build`. Expected: PASS — `ConversationRail.test.tsx` (updated `bg-primary` assertion + negative guard) green; all other suites unaffected.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/genie/ConversationRail.tsx frontend/src/components/genie/ConversationRail.test.tsx frontend/src/components/DashboardWorkspace.tsx frontend/src/pages/GenieMcpExperience.tsx frontend/src/components/ExecutiveSummaryModal.tsx
git commit -m "feat(genie): reskin history rail + containers onto canonical DuBois

ConversationRail, DashboardWorkspace (rail), GenieMcpExperience (full page),
ExecutiveSummaryModal: migrate off legacy alias + brand-* tokens onto canonical
DuBois — bg-background/bg-secondary/bg-muted surfaces, text-foreground/
text-muted-foreground, bg-primary/10 tints + active states, canonical composer
focus (ring-ring), DuBois destructive error, rounded-md/rounded radii, shadow-db-*.
Blue filled user bubble (rail) + light-tint user bubble (page) per design. All
MCP/streaming/scroll/clearChat/sentRef/Escape/seed logic unchanged; flip the
ConversationRail active-marker test assertion to bg-primary.

Co-authored-by: Isaac"
```

---

## Self-Review

**Spec coverage (design = Scope A token-only reskin of the 13-file Genie surface):**
- All 13 files mapped to tasks (4 leaves T1, 3 status/reasoning/tools T2, assistant message T3, rail + 3 containers T4). ✅
- Canonical token map from spec §2 applied per-file with exact current→replacement strings. ✅
- Blue user bubble decision: DashboardWorkspace UserBubble→`bg-primary` filled (T4 S3 L194); GenieMcpExperience UserBubble→`bg-primary/10` tint preserving its lighter weight (T4 S4 L264). ✅
- Canonical semantic status set (not primary-only): GenieMcpStatus + GenieReasoning + GenieAssistantMessage use `--destructive`/`--success`/`--warning` + `--background-*`/`--border-*`. ✅
- Reasoning timeline recolored not restructured (T2 S2 keeps Zap/steps/animations/copy). ✅
- Advances alias-elimination: per-file grep gate each task (T1 S6, T2 S4, T3 S2, T4 S7). ✅
- Test updates for the two legacy-token-enforcing assertions (MarkdownContent T1 S2, ConversationRail T4 S2); negative guards kept. ✅

**Type/contract consistency:** no prop/signature/import/export change in any file; all edits are className / inline-style / string-const values. `summarizeToolResult`, all component exports, all hooks calls unchanged.

**Placeholder scan:** none — every step gives exact current→replacement. Two conditional fallbacks are explicit and bounded (T4 S6 shadow-db-* vs shadow-* built-ins; verified by a concrete grep). The T3 S3 note explains why the `bg-linear-to` negative guard still passes (gradient not in the test's DOM) rather than leaving it ambiguous.

**Risk notes:** (a) Largest group so far (~1,450 LOC) but lowest-novelty — mechanical swaps identical in kind to the five prior groups; leaf-first ordering means containers only recolor their own chrome. (b) The `GenieMcpExperience` UserBubble intentionally maps to a *lighter* token (`bg-primary/10`) than the rail's (`bg-primary`) — this preserves each surface's existing emphasis; flagged so a reviewer doesn't read it as an inconsistency. (c) `--danger`/`--danger-fg`/`--success-fg`/`--warning-fg` are alias→canonical indirections; swapping references to canonical names is behavior-identical (verified: they're defined as `var(--destructive)` etc.). (d) `shadow-db-*` existence is verified before commit (T4 S6) with a built-in fallback. (e) The collapse fade + avatar ring must reference `--background` (canonical) not `--surface` (alias) — same rendered color, alias-free.
