# Prism Phase 5 — Ask APEX / Genie Surface Reskin Design

**Date:** 2026-08-01
**Status:** Approved (design brainstorm)
**Group:** Phase 5, "Ask APEX / Genie chat + rail" — the last Phase-5 page group.
**Relates to:** `docs/superpowers/specs/2026-07-31-prism-dubois-rebuild-design.md` (governing 6-phase spec). Follows the same "reskin presentation only, keep all feature logic" pattern as the Login, Home, Preferences, Admin, and Dashboards groups.

---

## 1. Goal & Scope

Reskin the **entire Ask APEX / Genie chat surface** off the legacy alias token layer (and raw `brand-*` classes + hardcoded inline `rgba(...)` colors) onto **canonical DuBois tokens** — **presentation only**. This advances alias-elimination (Phase 6 prep) across the last large cluster of pre-canonical UI.

**Decision (locked in brainstorm): Scope A — token-only reskin.** Keep our existing component structure, our `GenieReasoning` timeline, our `UserBubble`, and our inline composers. Do **NOT** adopt the kit's structural `GenieCodePanel` pattern (`Message` / `GeniePrompt` / `ChainOfThought` / `MessageActions`). Rationale: matches the five prior groups; the kit's feedback affordances (copy / 👍 / 👎) need backend work and are YAGNI for this pass; a structural refactor would re-litigate working MCP/streaming features.

**Files in scope (13), all under `frontend/src/`:**

| # | File | Lines | Test? | Role |
|---|------|-------|-------|------|
| Containers | | | | |
| | `components/DashboardWorkspace.tsx` | 199 | No | Right-side Ask APEX chat rail (wraps dashboard content) |
| | `pages/GenieMcpExperience.tsx` | 275 | No | Full-page Ask APEX experience (history rail + thread + composer) |
| | `components/ExecutiveSummaryModal.tsx` | 189 | No | Modal Genie summary (multi-mode MCP) |
| Genie children | | | | |
| | `genie/ConversationRail.tsx` | 111 | **Yes** | Left history sidebar (full page) — pure UI |
| | `genie/GenieAssistantMessage.tsx` | 126 | **Yes** | Assistant message renderer (full/compact variants) |
| | `genie/GenieReasoning.tsx` | 118 | No | "Genie is thinking…" reasoning timeline |
| | `genie/GenieToolCalls.tsx` | 95 | No | MCP tool-call log (poll dedup) |
| | `genie/GenieSqlBlock.tsx` | 48 | No | Collapsible SQL block |
| | `genie/GenieResultTable.tsx` | 49 | No | Query result table (sm/md) |
| | `genie/GenieDeepLink.tsx` | 26 | No | Deep-link button |
| | `genie/GenieMcpStatus.tsx` | 70 | No | MCP status dot/pill (success/warning/danger) |
| | `components/MarkdownContent.tsx` | 77 | **Yes** | Markdown renderer (shared) |

**Explicitly untouched:** `genie/genieModes.ts` (config/logic, no styling); everything outside this list (backend, SDK, other pages already reskinned).

**Wiring:** `App.tsx` imports both `DashboardWorkspace` (rail around custom dashboards) and `pages/GenieMcpExperience` (the standalone Ask APEX route). `ExecutiveSummaryModal` is opened from the dashboard toolbar. All three containers render the shared genie children; `ExecutiveSummaryModal`, the rail, and the full page share `GenieAssistantMessage`, `GenieResultTable`, `GenieSqlBlock`, `GenieDeepLink`, and `MarkdownContent`.

---

## 2. Canonical Token Mapping

Same rules the prior groups used; all target tokens verified DEFINED in `frontend/src/index.css` (light + dark ramps).

**Surfaces & text:**
- `bg-surface` → `bg-background` (#fff)
- `bg-surface-2` → `bg-secondary` (#f7f7f7)
- `bg-surface-3` → `bg-muted` (#f7f7f7) — chrome/header fills
- `text-fg` → `text-foreground` (#161616)
- `text-fg-2` / `text-fg-muted` / `text-fg-subtle` → `text-muted-foreground` (#6f6f6f)
- `border-border` → `border-border` (canonical; #ebebeb — already the canonical name, leave)
- `border-border-hover`/`-emphasis` → `border-neutral-200` / `border-ring`

**Accent / primary (blue user bubble KEPT — locked decision):**
- `bg-accent` + `text-accent-fg` → `bg-primary` + `text-primary-foreground` (filled DuBois blue user bubble, white text)
- `text-accent` → `text-primary`; `accent-hover` / `hover:bg-accent-hover` → `hover:bg-blue-700` (bg) or `hover:text-blue-700` (text)
- `bg-accent/NN` tints (icon backdrops, badges) → `bg-primary/10` (or `/15` where a stronger tint is present) — the canonical tinted-accent used by active nav + KPI tiles
- `--fill-hover` / `--fill-active` → `bg-primary/10` (active) or `var(--action-default-bg-hover)` (neutral hover), matching prior groups
- `focus-within:border-accent` / `focus-within:ring-accent/NN` → `focus-within:ring-2 focus-within:ring-ring`

**`brand-*` (in the genie children + DeepLink):**
- `text-brand-primary` → `text-primary`; `text-brand-accent` → `text-primary` (or keep the AI gradient where the element IS the AI cue)
- `bg-brand-primary` / `bg-brand-primary-dark` → `bg-primary` / `hover:bg-blue-700`
- `bg-brand-primary-light` → `bg-primary/10`; `border-brand-accent` → `border-primary/30`
- The AI mark / gradient cue stays on `--accent-gradient` (canonical AI gradient) — do not flatten it.

**Status colors (canonical semantic set — locked decision):**
- `--success-fg` → `--success` (#277c43); `--danger-fg` / `--danger` → `--destructive` (#c82d4c); `--warning` → `--warning`
- inline `rgba(48,160,80,0.12)` (success tint) → `var(--background-success)`; `rgba(196,64,64,0.12)` (danger tint) → `var(--background-danger)`; warning tint → `var(--background-warning)`
- status borders → `var(--border-success)` / `var(--border-warning)` / `var(--border-danger)`
- These drive `GenieMcpStatus` (connected/degraded/error dot + pill) and any success/error affordances in `GenieReasoning`, `GenieAssistantMessage`, `ExecutiveSummaryModal`.

**Radii:**
- `rounded-2xl` / `rounded-xl` → `rounded-md` (8px container); `rounded-lg` → `rounded-md` (container) or `rounded` (4px interactive, per element)
- `rounded-sm` → `rounded` (4px)
- The user bubble keeps its `rounded-br-sm` speech-tail on a `rounded-md` base (cosmetic tail, not a legacy alias — retained).

---

## 3. Feature Logic — Preserve Byte-Identical

The reskin changes ONLY `className` strings, inline-style token names, and `*_CLS` string constants. Every item below stays untouched:

- **DashboardWorkspace:** `clearChat` on `pageKey` change; scroll-to-bottom `useEffect` on messages; MCP streaming state; SQL-toggle `Record<id,bool>`; auto-fire on suggestion click; composer submit `.trim()` validation; rail open/close.
- **GenieMcpExperience:** history-rail selection, thread rendering, footer composer + "New" seeding, scroll behavior, nav seeding.
- **ExecutiveSummaryModal:** single-fire `sentRef` guard on mount; Escape-to-close; regenerate = clearChat + refire; streaming indicator.
- **GenieAssistantMessage:** answer-collapse detection (600-char threshold), full/compact variant branching, footer + tools toggles, SQL/table/deeplink child wiring.
- **GenieToolCalls:** poll-status dedup + ask/poll filtering.
- **GenieReasoning:** step accumulation, full/compact variants, completed-vs-pending rendering, animations (recolor only — timeline structure and "Genie is thinking…" copy KEPT, per locked decision).
- **ConversationRail / MarkdownContent / GenieResultTable / GenieSqlBlock / GenieDeepLink:** pure UI — no logic to preserve, but no structural change either (recolor only).

---

## 4. Task Decomposition (dependency-ordered, leaves → containers)

Leaf children carry little/no logic and are shared by all three containers, so reskinning them first de-risks the containers (which then only need their own chrome recolored). Four tasks, subagent-driven:

**Task 1 — Shared leaf children:** `MarkdownContent.tsx`, `GenieDeepLink.tsx`, `GenieResultTable.tsx`, `GenieSqlBlock.tsx`. Pure recolor. `MarkdownContent` has a test → update any legacy-token assertions to canonical, keep negative guards.

**Task 2 — Status / reasoning / tools:** `GenieMcpStatus.tsx` (canonical semantic status set + tints), `GenieReasoning.tsx` (recolor timeline, keep structure + animations + copy), `GenieToolCalls.tsx` (recolor, preserve poll-dedup). No tests.

**Task 3 — Assistant message:** `GenieAssistantMessage.tsx`. Has a test → keep green; preserve all variant/collapse/footer branches; canonical status colors for its error/success affordances.

**Task 4 — History rail + containers:** `ConversationRail.tsx` (has a test), then the three containers `DashboardWorkspace.tsx`, `GenieMcpExperience.tsx`, `ExecutiveSummaryModal.tsx`. Blue user bubble (`bg-primary`), canonical composer chrome (`ring-ring` focus), canonical modal scrim. This is the largest task; the leaf children it renders are already canonical by now, so it's container-chrome-only.

**Per-task gates:** alias-free grep on the task's files (zero legacy aliases / `brand-` / target inline-rgba); `cd frontend && npm test && npm run build` both green; commit to `feature/apex-theming`, no PR. After all four: final opus whole-branch review, then a live Chrome check (rail from a dashboard + full Ask APEX page + Executive Summary modal) in **both** light and dark.

**Alias-free target set (per file, after its task):** `bg-surface*`, `text-fg`/`text-fg-2`/`text-fg-muted`/`text-fg-subtle`, `--fill-hover`, `--fill-active`, `rgba(var(--overlay)`, `bg-accent`, `text-accent`, `accent-fg`, `accent-hover`, `--success-fg`, `--danger-fg`, `--danger`(bare), inline `rgba(196,64,64` / `rgba(48,160,80`, `border-border-hover`, `border-border-emphasis`, `brand-`, `rounded-2xl`, `rounded-xl`, `rounded-lg`, `rounded-sm` → all zero. (`text-foreground`, `border-border`, `bg-border`, `--success`/`--warning`/`--destructive`, `--accent-gradient`, `rounded-br-sm` are canonical, not matches.)

---

## 5. Post-group state

After this group: Phase 5 (pages reskinned) is COMPLETE — all page groups done. Remaining Prism work:
- **Phase 6 (Cleanup):** delete the temporary alias layer in `index.css` (now unused everywhere), drop the dead dep `@radix-ui/react-use-controllable-state`, clean the HomePage AreaChart gradient-id nit.
- **Phase 1 (Rename → Prism):** done LAST, includes GitHub repo/remote rename — confirm exact steps first.
- **Deferred cross-group a11y pass:** Home Ask-composer `<input>` + Preferences 6 filter inputs lack `id`/`name` (track separately, not reskin-introduced).

---

## Self-Review

- **Placeholder scan:** none — every mapping is a concrete legacy→canonical rule with verified target tokens; task list is exhaustive over the 13 files.
- **Internal consistency:** the token map (§2) and the per-file grep target set (§4) reference the same legacy/canonical vocabulary; scope decision (A) is applied uniformly (no structural adoption anywhere).
- **Scope check:** single implementation plan, four dependency-ordered tasks — appropriately sized (matches the Admin group's 4-task shape). Not decomposed further.
- **Ambiguity check:** the two judgment calls (blue vs neutral user bubble; canonical-semantic vs primary-only status) are resolved explicitly (blue; canonical semantic). Reasoning-block treatment fixed to recolor-only.
