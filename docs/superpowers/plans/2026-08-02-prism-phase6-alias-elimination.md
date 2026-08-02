# Prism Phase 6 — Alias-Layer Elimination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the last 9 files off the temporary legacy-alias tokens onto canonical DuBois tokens, then DELETE the alias layer (`frontend/src/index.css:508–649`), reaching a 100% canonical, alias-free frontend — plus the accumulated mechanical cleanups.

**Architecture:** Scope A (token-only) per the approved design `docs/superpowers/specs/2026-08-02-prism-phase6-alias-elimination-design.md`. Four dependency-ordered tasks (shell leaves + small files → AskApexLive → delete alias layer → mechanical cleanups). Every edit is a `className` / inline-style / string-const value change. NO logic, prop, export, or import change in any component.

**Tech Stack:** Vite 7 + React 19 + React Router 7, Tailwind v4 canonical DuBois tokens (`frontend/src/index.css`), lucide-react, `@mcp-ui/client`, Vitest 3.

## Global Constraints

- **Frontend-only.** No `server/` / `app.py` / `/api/*` / hook change. Hooks (`useGenieAppView`, `useUser`, `useRoutes`, `useTheme`, `useRegistry`) are consumed, never edited.
- **KEEP all feature logic, swap presentation only:** every `useState`/`useEffect`/`useRef`, fetch/fail-soft, `clearChat`, scroll, `submit`/`sendMessage`, health/retry, `AppRenderer` wiring, and every component prop signature/export stays byte-identical. Only `className` strings, inline-style token names, and string constants change.
- **Canonical DuBois tokens (all verified DEFINED in `index.css`, light+dark):** `bg-background` (#fff), `bg-secondary`/`bg-muted` (#f7f7f7 / #ebebeb), `text-foreground` (#161616), `text-muted-foreground` (#6f6f6f), `bg-primary`/`text-primary`/`text-primary-foreground` (#2272b4 / #fff), `hover:bg-blue-700`, `hover:text-blue-700`, `bg-primary/10`, `border-border` (#ebebeb), `border-input` (#cbcbcb), `ring-ring`/`focus-within:ring-ring`, `--destructive` (#c82d4c) + `--background-danger` (#fff5f7) + `--border-danger` (#fbd0d8), `--success` (#277c43) + `--background-success` (#f3fcf6) + `--border-success` (#a3d9b6), `--warning` (#be501e) + `--background-warning` (#fff9eb) + `--border-warning` (#f8d4a5), `--accent-gradient`, `var(--action-default-bg-hover)`, `shadow-db-xs`/`shadow-db-lg`. Radii: container `rounded-md` (8px), interactive `rounded` (4px). NO `rounded-2xl`/`rounded-xl`/`rounded-lg`/`rounded-sm` (the user-bubble `rounded-br-md` speech-tail cosmetic corner is retained).
- **Avatar/logo fallback fill (locked decision):** `bg-linear-to-br from-brand-primary to-brand-accent text-white` → flat `bg-primary text-primary-foreground` (the gradient already renders flat blue today since both brand vars alias to `--primary`).
- **`components/ui/skeleton.tsx` is canonical vendored shadcn — DO NOT EDIT.** Its `bg-accent` self-heals when the alias is deleted (Task 3): today the alias forces `--accent`→`--primary` (renders blue, wrong); after delete, `--accent` reverts to canonical neutral `#f7f7f7` (correct).
- **Each task ends green:** `cd frontend && npm test && npm run build` both pass; then a per-file alias grep gate. Push to `feature/apex-theming` at the very end (Task 4), no PRs. Final live check after Task 3.

**Per-file alias grep** (run after each task's files, expect ZERO matches):
```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -nE "bg-surface|text-fg[\" -]|-fg-|--fill-hover|--fill-active|rgba\(var\(--overlay|bg-accent|text-accent|accent-fg|accent-hover|--success-fg|--danger-fg|--danger[^-a-z]|--warning-fg|rgba\(196,64,64|rgba\(48,160,80|rgba\(184,137,46|border-border-hover|border-border-emphasis|brand-|rounded-2xl|rounded-xl|rounded-lg|rounded-sm" <file>
```
(Canonical `text-foreground`/`text-muted-foreground`, `border-border`, `--destructive`, `--success`, `--warning`, `--background-*`, `--border-danger/-success/-warning`, `--accent-gradient`, `rounded-br-md` are NOT matches. In Task 1–2 files, `bg-accent`/`text-accent` MUST be gone; `skeleton.tsx` keeps its `bg-accent` and is not in any task's file list.)

---

## File Structure

**Modified (9 source + 1 test + package.json):**
- Task 1: `components/shell/UserMenu.tsx`, `components/shell/ClientBadge.tsx`, `components/shell/Breadcrumb.tsx`, `theme/ThemeToggle.tsx`, `components/BrandLogo.tsx`, `registry/RegistryProvider.tsx`, `pages/Placeholder.tsx`
- Task 2: `pages/AskApexLive.tsx`
- Task 3: `index.css` (delete alias block 508–649, re-home 3 survivors)
- Task 4: `package.json` (drop dead dep), `pages/HomePage.tsx` (gradient-id), `App.tsx` + new `App.test.tsx`, `components/shell/Sidebar.tsx` + `components/shell/TopBar.tsx` (Phase-4 nits)
**Untouched:** `components/ui/skeleton.tsx` (self-heals), all other `ui/*`, all hooks, backend.

---

### Task 1: Migrate shell leaves + small files

Seven files, ~28 mechanical alias hits. No logic. Pure className/token swaps.

**Files:**
- Modify: `frontend/src/components/shell/UserMenu.tsx`, `frontend/src/components/shell/ClientBadge.tsx`, `frontend/src/components/shell/Breadcrumb.tsx`, `frontend/src/theme/ThemeToggle.tsx`, `frontend/src/components/BrandLogo.tsx`, `frontend/src/registry/RegistryProvider.tsx`, `frontend/src/pages/Placeholder.tsx`

**Interfaces:** Consumes/Produces unchanged — same exports + props on all seven; only class/token strings change.

- [ ] **Step 1: `UserMenu.tsx` swaps**

- L27 (trigger button): `hover:bg-[var(--fill-hover)]` → `hover:bg-[var(--action-default-bg-hover)]`
- L28 (avatar ring): `ring-2 ring-[var(--surface-2)] shadow-sm` → `ring-2 ring-[var(--secondary)] shadow-db-xs`
- L29 (avatar fallback, trigger): `bg-linear-to-br from-brand-primary to-brand-accent text-white text-[11px] font-semibold` → `bg-primary text-primary-foreground text-[11px] font-semibold`
- L33 (name): `text-[13px] font-medium text-fg-2 max-w-[140px] truncate hidden sm:inline` → `text-[13px] font-medium text-muted-foreground max-w-[140px] truncate hidden sm:inline`
- L36 (chevron): `text-fg-muted rotate-90 hidden sm:inline` → `text-muted-foreground rotate-90 hidden sm:inline`
- L40 (popover header): `flex items-center gap-3 px-4 py-3.5 bg-surface-2 border-b border-border` → `flex items-center gap-3 px-4 py-3.5 bg-secondary border-b border-border`
- L41 (avatar ring, popover): `ring-2 ring-[var(--surface-2)] shadow-sm` → `ring-2 ring-[var(--secondary)] shadow-db-xs`
- L42 (avatar fallback, popover): `bg-linear-to-br from-brand-primary to-brand-accent text-white text-[11px] font-semibold` → `bg-primary text-primary-foreground text-[11px] font-semibold`
- L47 (name): `text-sm font-medium text-fg truncate` → `text-sm font-medium text-foreground truncate`
- L48 (email): `text-xs text-fg-muted truncate` → `text-xs text-muted-foreground truncate`
- L53 (logout link): `... text-sm font-medium text-fg-2 hover:bg-[var(--fill-hover)] transition-colors` → `... text-sm font-medium text-muted-foreground hover:bg-[var(--action-default-bg-hover)] transition-colors`
- L55 (logout icon): `text-fg-muted` → `text-muted-foreground`

- [ ] **Step 2: `ClientBadge.tsx` swaps**

- L3 (container): `... rounded-md border border-border bg-surface px-2.5 py-1` → `... rounded-md border border-border bg-background px-2.5 py-1`
- L9 (Client label): `text-[9px] text-fg-muted tracking-[0.14em] uppercase` → `text-[9px] text-muted-foreground tracking-[0.14em] uppercase`
- L10 (tenant): `text-xs font-semibold text-fg truncate` → `text-xs font-semibold text-foreground truncate`
- (L5–L6 `bg-[var(--success)]` dots are canonical — LEAVE.)

- [ ] **Step 3: `Breadcrumb.tsx` swaps**

- L8 (section): `text-[13px] text-fg-muted truncate hidden sm:inline` → `text-[13px] text-muted-foreground truncate hidden sm:inline`
- L9 (chevron): `text-fg-subtle shrink-0 hidden sm:inline` → `text-muted-foreground shrink-0 hidden sm:inline`
- L12 (page): `text-[13px] font-medium text-fg tracking-tight truncate` → `text-[13px] font-medium text-foreground tracking-tight truncate`

- [ ] **Step 4: `ThemeToggle.tsx` swap**

- L14 (button): `grid place-items-center h-6 w-6 rounded-sm text-fg-ghost hover:bg-[var(--fill-hover)] hover:text-fg-muted transition-colors` → `grid place-items-center h-6 w-6 rounded text-muted-foreground hover:bg-[var(--action-default-bg-hover)] hover:text-foreground transition-colors`

- [ ] **Step 5: `BrandLogo.tsx` swap**

- L20 (fallback monogram): `grid place-items-center rounded-xl bg-linear-to-br from-brand-primary to-brand-accent text-white font-bold shadow-lg` → `grid place-items-center rounded-md bg-primary text-primary-foreground font-semibold shadow-db-lg`

- [ ] **Step 6: `RegistryProvider.tsx` swaps**

- L42 (skeleton container): `h-full flex items-center justify-center bg-brand-bg` → `h-full flex items-center justify-center bg-secondary`
- L43 (spinner): `animate-spin text-brand-accent` → `animate-spin text-primary`

- [ ] **Step 7: `Placeholder.tsx` swaps**

- L12 (outer): `flex flex-1 items-center justify-center h-full bg-surface` → `flex flex-1 items-center justify-center h-full bg-background`
- L13 (card): `flex flex-col items-center gap-4 max-w-sm text-center p-8 bg-surface-2 rounded-xl border border-border shadow-sm` → `flex flex-col items-center gap-4 max-w-sm text-center p-8 bg-secondary rounded-md border border-border shadow-db-xs`
- L14 (icon tile): `w-14 h-14 rounded-xl bg-surface-3 flex items-center justify-center` → `w-14 h-14 rounded-md bg-muted flex items-center justify-center`
- L15 (icon): `text-fg-muted` → `text-muted-foreground`
- L18 (h2): `text-base font-semibold text-fg mb-1` → `text-base font-semibold text-foreground mb-1`
- L19 (p): `text-sm text-fg-muted leading-relaxed` → `text-sm text-muted-foreground leading-relaxed`

- [ ] **Step 8: Alias grep (Task 1 files)**

Run the per-file grep on all seven. Expect ZERO matches each.

- [ ] **Step 9: Test + build**

Run: `cd frontend && npm test && npm run build`. Expected: PASS (73 tests; no test covers these seven files directly — confirm no suite breaks).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/shell/UserMenu.tsx frontend/src/components/shell/ClientBadge.tsx frontend/src/components/shell/Breadcrumb.tsx frontend/src/theme/ThemeToggle.tsx frontend/src/components/BrandLogo.tsx frontend/src/registry/RegistryProvider.tsx frontend/src/pages/Placeholder.tsx
git commit -m "feat(shell): reskin shell leaves + Placeholder/RegistryProvider onto canonical DuBois

UserMenu/ClientBadge/Breadcrumb/ThemeToggle/BrandLogo/RegistryProvider/Placeholder:
migrate off legacy alias + brand-* tokens (bg-surface*/text-fg*/--fill-hover/
from-brand-*) onto canonical (bg-background/bg-secondary/bg-muted/text-foreground/
text-muted-foreground/--action-default-bg-hover), flat bg-primary avatar+logo
fallbacks, rounded-xl/sm->rounded-md/rounded, shadow-*->shadow-db-*. No logic change.

Co-authored-by: Isaac"
```

---

### Task 2: Migrate `AskApexLive.tsx`

The interactive Genie App-View page (31 hits). Mirror the exact mapping already shipped for the parallel `GenieMcpExperience.tsx`. Recolor only — the `@mcp-ui/client` `AppRenderer` wiring, health/retry, submit/sendMessage, scroll, and clearChat logic stay byte-identical.

**Files:**
- Modify: `frontend/src/pages/AskApexLive.tsx`

**Interfaces:** Consumes/Produces unchanged — same default export + all subcomponent signatures (`AssistantView`, `HealthPill`, `HeroComposer`, `FooterComposer`, `SendButton`, `UserBubble`); only class/inline-style strings change.

- [ ] **Step 1: Main container + header swaps**

- L71 (main col): `relative flex h-full min-w-0 flex-1 flex-col bg-surface` → `relative flex h-full min-w-0 flex-1 flex-col bg-background`
- L73 (header): `z-10 shrink-0 border-b border-border bg-surface-2 px-6 py-3` → `z-10 shrink-0 border-b border-border bg-secondary px-6 py-3`
- L76 (icon tile): `flex h-9 w-9 items-center justify-center rounded-xl bg-surface-3` → `flex h-9 w-9 items-center justify-center rounded-md bg-muted`
- L77 (BarChart3): `h-[18px] w-[18px] text-fg-muted` → `h-[18px] w-[18px] text-muted-foreground`
- L80 (h1): `text-[15px] font-medium leading-tight tracking-tight text-fg` → `text-[15px] font-medium leading-tight tracking-tight text-foreground`
- L83 (subtitle): `text-[11px] text-fg-muted` → `text-[11px] text-muted-foreground`

- [ ] **Step 2: `viewUnavailable` warning banner (L93)**

- L93: `shrink-0 border-b border-[color:var(--warning)] bg-[rgba(184,137,46,0.12)] px-6 py-2.5 text-[13px] text-[var(--warning-fg)]` → `shrink-0 border-b border-[color:var(--border-warning)] bg-[var(--background-warning)] px-6 py-2.5 text-[13px] text-[var(--warning)]`

- [ ] **Step 3: Hero empty-state swaps**

- L108 (hero h2): `text-3xl font-medium tracking-tight text-fg` → `text-3xl font-medium tracking-tight text-foreground`
- L109 (hero p): `mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-fg-muted` → `mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground`
- L121 (suggestion pill): `rounded-sm border border-border bg-surface px-3.5 py-1.5 text-[13px] text-fg-2 transition-colors hover:bg-[var(--fill-hover)] hover:text-fg` → `rounded border border-border bg-background px-3.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-[var(--action-default-bg-hover)] hover:text-foreground`

- [ ] **Step 4: Footer composer wrap + New button swaps**

- L148 (footer wrap): `shrink-0 bg-surface px-6 pb-5 pt-3` → `shrink-0 bg-background px-6 pb-5 pt-3`
- L154 (New button): `flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 text-sm font-medium text-fg-2 transition-colors hover:bg-[var(--fill-hover)] hover:text-fg` → `flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-[var(--action-default-bg-hover)] hover:text-foreground`

- [ ] **Step 5: `AssistantView` swaps (avatar/error/deeplink)**

- L188 (avatar fallback): `bg-surface-3 text-fg-muted text-xs` → `bg-muted text-muted-foreground text-xs`
- L192 (bubble): `min-w-0 flex-1 text-fg` → `min-w-0 flex-1 text-foreground`
- L194 (loading line): `flex items-center gap-2 text-sm text-fg-muted` → `flex items-center gap-2 text-sm text-muted-foreground`
- L200 (error block): `rounded-lg border border-[color:var(--danger)] bg-[rgba(196,64,64,0.12)] px-3 py-2 text-sm text-[var(--danger-fg)]` → `rounded-md border border-[color:var(--border-danger)] bg-[var(--background-danger)] px-3 py-2 text-sm text-[var(--destructive)]`
- L206 (render wrap): `overflow-hidden rounded-lg` → `overflow-hidden rounded-md`
- L233 (no-view fallback): `text-sm text-fg-2` → `text-sm text-muted-foreground`
- L240 (deep link): `ml-1 inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover` → `ml-1 inline-flex items-center gap-1 font-medium text-primary hover:text-blue-700`

- [ ] **Step 6: `HealthPill` swaps**

- L264 (connecting): `inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-fg-muted` → `inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground`
- L273 (error button): `inline-flex items-center gap-1.5 rounded-full bg-[rgba(196,64,64,0.12)] px-2.5 py-1 text-[11px] font-medium text-[var(--danger-fg)]` → `inline-flex items-center gap-1.5 rounded-full bg-[var(--background-danger)] px-2.5 py-1 text-[11px] font-medium text-[var(--destructive)]`
- L275 (error dot): `h-1.5 w-1.5 rounded-full bg-[var(--danger)]` → `h-1.5 w-1.5 rounded-full bg-[var(--destructive)]`
- L280 (success pill): `inline-flex items-center gap-1.5 rounded-full bg-[rgba(48,160,80,0.12)] px-2.5 py-1 text-[11px] font-medium text-[var(--success-fg)]` → `inline-flex items-center gap-1.5 rounded-full bg-[var(--background-success)] px-2.5 py-1 text-[11px] font-medium text-[var(--success)]`
- L281 (success dot): `h-1.5 w-1.5 rounded-full bg-[var(--success)]` — canonical, LEAVE.

- [ ] **Step 7: `HeroComposer` + `FooterComposer` + `SendButton` swaps**

- L304 (HeroComposer form): `gradient-border group relative flex items-center rounded-md bg-[var(--fill-hover)] px-4 py-2.5 transition-all focus-within:border-border-emphasis focus-within:ring-2 focus-within:ring-[rgba(var(--overlay),0.06)]` → `gradient-border group relative flex items-center rounded-md bg-background px-4 py-2.5 transition-all focus-within:ring-2 focus-within:ring-ring`
- L306 (Sparkles): `mr-2.5 h-4 w-4 shrink-0 text-fg-muted` → `mr-2.5 h-4 w-4 shrink-0 text-muted-foreground`
- L315 (hero input): `flex-1 bg-transparent py-1.5 text-[15px] text-fg placeholder:text-fg-muted focus:outline-none disabled:cursor-not-allowed` → `flex-1 bg-transparent py-1.5 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed`
- L339 (FooterComposer form): `flex flex-1 items-center rounded-md border border-border bg-[var(--fill-hover)] px-4 py-1.5 transition-all focus-within:border-border-emphasis focus-within:ring-2 focus-within:ring-[rgba(var(--overlay),0.06)]` → `flex flex-1 items-center rounded-md border border-input bg-background px-4 py-1.5 transition-all focus-within:ring-2 focus-within:ring-ring`
- L347 (footer input): `h-8 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-muted focus:outline-none disabled:cursor-not-allowed` → `h-8 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed`
- L359 (SendButton): `ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-30` → `ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-30`

- [ ] **Step 8: `UserBubble` swaps (LIGHT tint, mirrors GenieMcpExperience)**

- L369 (bubble): `max-w-[80%] rounded-2xl rounded-br-md bg-[var(--fill-active)] px-4 py-2.5 text-fg` → `max-w-[80%] rounded-md rounded-br-md bg-primary/10 px-4 py-2.5 text-foreground`
- L372 (avatar ring): `h-7 w-7 shrink-0 ring-2 ring-[var(--surface)]` → `h-7 w-7 shrink-0 ring-2 ring-[var(--background)]`
- L373 (avatar fallback): `bg-surface-3 text-[10px] font-semibold text-fg-muted` → `bg-muted text-[10px] font-semibold text-muted-foreground`

- [ ] **Step 9: Alias grep (Task 2 file)**

Run the per-file grep on `src/pages/AskApexLive.tsx`. Expect ZERO matches. (`--background-warning`/`--border-warning`/`--warning`, `--background-danger`/`--border-danger`/`--destructive`, `--background-success`/`--success`, `ring-ring`, `border-input`, `bg-primary/10`, `rounded-br-md`, `gradient-border` are canonical — not matches.)

- [ ] **Step 10: Test + build**

Run: `cd frontend && npm test && npm run build`. Expected: PASS (no test on AskApexLive; confirm no suite breaks).

- [ ] **Step 11: Commit**

```bash
git add frontend/src/pages/AskApexLive.tsx
git commit -m "feat(genie): reskin AskApexLive (MCP App View page) onto canonical DuBois

Migrate the 31 legacy alias + hardcoded-rgba hits onto canonical DuBois, mirroring
the shipped GenieMcpExperience mapping: bg-background/bg-secondary/bg-muted surfaces,
text-foreground/text-muted-foreground, semantic status set (--destructive/--success/
--warning + --background-*/--border-* tints replacing rgba(196,64,64)/(48,160,80)/
(184,137,46)), canonical composer focus (ring-ring, dropped overlay-rgb + border-
emphasis), bg-primary/10 light user bubble, flat bg-primary send button, rounded-md/
rounded radii. All @mcp-ui AppRenderer / health / submit / scroll logic unchanged.

Co-authored-by: Isaac"
```

---

### Task 3: Delete the alias layer

With all consumers migrated (Tasks 1–2 + the five Phase-5 groups), delete the temporary alias block. Preserve the three non-alias survivors by re-homing them into the canonical section.

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:** No component change. Removes CSS-var definitions + a legacy `@theme inline` block; preserves `--accent-gradient`, the font stacks, and `.gradient-border`.

- [ ] **Step 1: Pre-delete whole-frontend consumer sweep**

Confirm nothing outside `skeleton.tsx` still consumes any alias. Run:
```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -rnE "bg-surface|text-fg[\" -]|-fg-|--fill-hover|--fill-active|rgba\(var\(--overlay|text-accent|accent-fg|accent-hover|--success-fg|--danger-fg|--warning-fg|bg-brand|text-brand|from-brand|to-brand|border-brand|--surface[^-a-z]|--surface-[23]|--fg[^a-z-]|--n[0-9]" src --include=*.tsx --include=*.ts
```
Expected: ZERO matches. (If any survive, STOP — migrate them before deleting. `bg-accent` in `skeleton.tsx` is expected and fine — it's not in this grep.)

Also confirm the only `bg-accent`/`--accent` utility consumer left is canonical `skeleton.tsx`:
```bash
grep -rn "bg-accent" src --include=*.tsx | grep -v skeleton
```
Expected: ZERO matches.

- [ ] **Step 2: Re-home the 3 survivors into the canonical `:root`**

Before deleting, add these to the canonical `:root` block (near the other canonical tokens, e.g. after the shadow scale). The `--accent-gradient` and font-stack values are copied verbatim from the alias block:

```css
  /* AI-cue gradient (consumed by .gradient-border + login monogram) */
  --accent-gradient: linear-gradient(135deg, #4299e0 20.5%, #ca42e0 46.91%, #ff5f46 79.5%);
```

And ensure the canonical `@theme inline` block (the one at index.css:142, NOT the legacy one at 609) binds the font stacks. Add there if not already present:
```css
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```
(First check whether `--font-sans`/`--font-mono` already resolve via the canonical block — if the canonical `@theme inline` at L142 already defines them, do NOT duplicate; only the values currently living in the alias block need a canonical home.)

- [ ] **Step 3: Delete the alias block**

Delete `frontend/src/index.css` lines 508–640 — the entire `TEMPORARY ALIAS LAYER` comment, the alias `:root` block (surfaces/fg/borders/fills/overlay/accent/state/viz/shadow/fonts/brand-*/n0..n12), the alias `.dark` block, and the legacy `@theme inline` utility block (L608–640). **KEEP** the `.gradient-border` rule (L642–649) — it is canonical and its `--accent-gradient` + `--card` refs now resolve from the re-homed canonical definition.

(After deletion `--accent`/`--accent-foreground` revert to their canonical `:root` #f7f7f7 / `.dark` #1f272d definitions — intended.)

- [ ] **Step 4: Whole-frontend alias grep gate (the 100%-canonical proof)**

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -rnE "bg-surface|text-fg[\" -]|-fg-|--fill-hover|--fill-active|rgba\(var\(--overlay|text-accent|accent-fg|accent-hover|--success-fg|--danger-fg|--warning-fg|bg-brand|text-brand|from-brand|to-brand|border-brand|--surface-[23]|--n[0-9]|border-border-hover|border-border-emphasis" src
```
Expected: ZERO matches across ALL of `src` (the two `not.toMatch(...)` negative-guard regexes in `GenieAssistantMessage.test.tsx` + `ConversationRail.test.tsx` reference `from-brand-`/`bg-linear-to` inside a *negation* — those are intentional and acceptable; verify each remaining hit, if any, is one of those two).

- [ ] **Step 5: Test + build + skeleton self-heal check**

Run: `cd frontend && npm test && npm run build`. Expected: PASS (73 tests). Then verify `skeleton.tsx`'s `bg-accent` now resolves to canonical neutral: `grep -n "\-\-accent:" src/index.css` should show ONLY the canonical `:root` (#f7f7f7) + `.dark` (#1f272d) definitions — the `var(--primary)` alias line is gone.

- [ ] **Step 6: Live check (light + dark)**

Manual/browser check on the migrated surfaces (shell chrome: TopBar UserMenu/ClientBadge/Breadcrumb/ThemeToggle; Ask APEX Live page `/ask-apex-live`; a Placeholder route; the boot skeleton) in BOTH themes. Confirm: no console errors, skeleton loaders render neutral grey (not blue), avatar/logo fallbacks are flat blue, composers show the blue focus ring.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/index.css
git commit -m "refactor(theme): delete temporary alias layer — 100% canonical DuBois

Remove index.css:508-640 (the legacy --surface/--fg/--accent/--fill-*/--danger*/
--success-fg/--warning-fg/--brand-*/--n0..n12 aliases + legacy @theme inline utility
block) now that all components are migrated. Re-home --accent-gradient + font stacks
into the canonical :root/@theme; keep .gradient-border. --accent reverts to canonical
neutral so skeleton.tsx renders correct grey. Whole-frontend alias grep gate: zero.

Co-authored-by: Isaac"
```

---

### Task 4: Mechanical cleanups (fenced — individually skippable)

Accumulated non-token cleanups. Each step is independent; if any proves non-trivial, defer it out of this phase rather than expand scope.

**Files:**
- Modify: `frontend/package.json`, `frontend/src/pages/HomePage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/shell/Sidebar.tsx`, `frontend/src/components/shell/TopBar.tsx`
- Create: `frontend/src/App.test.tsx`

**Interfaces:** No public API change. Adds a test; drops an unused dependency; fixes a gradient id + two shell nits.

- [ ] **Step 1: Drop dead dep `@radix-ui/react-use-controllable-state`**

Verified: zero direct imports in `src`. Remove the line from `frontend/package.json` dependencies, then:
```bash
cd frontend && npm install
```
Run `npm test && npm run build` — expected PASS (the radix umbrella re-exports it, so `ui/*` still works).

- [ ] **Step 2: HomePage AreaChart gradient-id fix**

In `frontend/src/pages/HomePage.tsx`, find the AreaChart gradient id built as `grad-${accent.replace("#","")}` (now yields the ugly `grad-var(--primary)` after the Home reskin). Replace both the `<linearGradient id=...>` and the `fill="url(#...)"` reference with a stable static id `"apex-spend-grad"`. Verify the two strings match exactly. Run `npm test && npm run build` — PASS. (If the id is already static, mark this step no-op.)

- [ ] **Step 3: Write failing `App.test.tsx` for the admin-context sidebar builder**

`App.tsx` builds `sidebarSections`/`sidebarFooter` differently for operator/admin context (Phase-4 deferred: untested). Write a test asserting the admin-context nav renders the "Back to APEX" + ADMIN_SECTIONS entries and the operator footer. Follow the sibling pattern in `src/components/shell/shell.test.tsx` (RTL render + `screen.getByText`). Example shape:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
// ...providers as shell.test.tsx uses them
import App from "./App";

test("admin context shows Back to APEX + admin sections in sidebar", () => {
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      {/* wrap with the same Theme/Registry providers shell.test.tsx uses */}
      <App />
    </MemoryRouter>
  );
  expect(screen.getByText(/back to apex/i)).toBeInTheDocument();
});
```
Adapt provider wrapping + the exact asserted strings to what `App.tsx` actually renders (read it first). Run the test, confirm it FAILS if the builder is broken / PASSES if correct — the point is a regression guard, so a passing test against current correct code is the expected end state.

- [ ] **Step 4: Sidebar admin-footer collapsed nit**

In `frontend/src/components/shell/Sidebar.tsx`, the admin footer button lacks collapsed `justify-center` + a `title` tooltip (Phase-4 deferred). Add `justify-center` to its className when collapsed and a `title={label}` attribute, matching how the nav items already handle collapsed state in the same file. Run `npm test && npm run build` — PASS.

- [ ] **Step 5: TopBar tenant fallback nit**

In `frontend/src/components/shell/TopBar.tsx`, change the tenant fallback from `??` to `||` so an empty-string tenant falls back to the default label (not a blank). Locate the `tenant ?? ...` expression, change to `tenant || ...`. Run `npm test && npm run build` — PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/pages/HomePage.tsx frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/components/shell/Sidebar.tsx frontend/src/components/shell/TopBar.tsx
git commit -m "chore(cleanup): drop dead dep, stabilize chart grad-id, add App nav test + shell nits

Phase 6 mechanical cleanups: remove unused @radix-ui/react-use-controllable-state
(radix umbrella re-exports it); replace HomePage AreaChart grad-var(--primary) id
with a stable static id; add App.test.tsx covering the admin-context sidebar builder
(Phase-4 untested); Sidebar admin-footer collapsed justify-center + title tooltip;
TopBar tenant fallback ??->|| (empty-string safety).

Co-authored-by: Isaac"
```

- [ ] **Step 7: Push the branch**

```bash
git push origin feature/apex-theming
```
(Confirm active gh account is `rohit-db` — the repo owner with write access — not `rohit-bhagwat_data`. If push 403s: `gh auth switch --user rohit-db && gh auth setup-git`, then retry.)

---

## Self-Review

**Spec coverage (design = 100%-canonical alias elimination):**
- All 9 straggler files mapped to tasks (7 in T1, AskApexLive in T2; skeleton.tsx deliberately excluded — self-heals). ✅
- Alias-layer delete + 3 survivors re-homed (T3 S2–S3). ✅
- `--accent` cascade-flip hazard handled: every intentionally-blue `bg-accent` consumer migrated to explicit `bg-primary` in T1–T2 before delete; skeleton left to revert to neutral (T3 S5 verifies). ✅
- Whole-frontend grep gate as the 100%-canonical proof (T3 S4). ✅
- Avatar/logo flat-`bg-primary` decision applied (T1 S1, S5). ✅
- The 2 `rgba(var(--overlay))` consumers (AskApexLive L304/L339) eliminated in T2 S7 → confirmed gone before delete (T3 S1). ✅
- Mechanical cleanups: dead dep, gradient-id, Phase-4 nits (T4). ✅

**Type/contract consistency:** no prop/signature/import/export change in any of the 9 migrated files; all edits are className / inline-style / string-const values. Task 4 adds one test file and drops one dependency; no runtime API change.

**Placeholder scan:** none — T1/T2/T3 give exact current→replacement strings with line numbers. T4 S2/S3 read-then-adapt steps are bounded and explicit about the expected end state (stable id; regression-guard test); T3 S2 flags the "don't duplicate if canonical already defines" check rather than assuming.

**Risk notes:** (a) Lowest-novelty phase — mechanical swaps identical to six prior groups; AskApexLive mirrors the just-shipped GenieMcpExperience. (b) The single sharp hazard (alias delete flipping `--accent`) is de-risked by ordering (migrate all blue consumers first) + an explicit skeleton self-heal verification. (c) Line numbers assume no drift from this plan's authoring; each step also quotes the full current string, so an implementer can locate the target even if lines shift. (d) T4 is fenced last + individually skippable so a fiddly nit can't block the alias-elimination deliverable.
