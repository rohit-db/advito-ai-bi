# DuBois UI Primitives Conversion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the six shared UI primitives (`Badge`, `Button`, `Tabs`, `Popover`, `ScrollArea`, `Avatar`) from hardcoded `slate-*`/`brand-primary`/`white` classes to the premium DuBois token system — so every downstream surface that consumes them (chat, home, admin, dashboards) inherits correct theme-aware, blue-accented styling and flips cleanly in dark mode.

**Why first:** These primitives underpin the whole app. Converting them now (a) fixes the carried-over defect where `AvatarFallback`'s slate default leaked into every avatar via the naive `cn()` join, (b) makes `PopoverContent` (user menu, dropdowns) and `Button`/`Tabs` theme-aware in dark mode, and (c) removes ~14 occurrences of hardcoded color that would otherwise need per-consumer overrides. It's the DRY foundation before the remaining pages + admin plans.

**Architecture:** Pure class substitution against the Phase-0 token seam. No API/prop/behavior changes — every primitive keeps its exact signature and variants. This is a styling-only refactor verified by build + existing consumer tests staying green.

**Tech Stack:** React 19 + TS, Tailwind v4 (Phase-0 `surface-*`/`fg-*`/`accent*`/`border-*` utilities + raw `var(--fill-*)`), Vitest 3.

## Global Constraints

- **Phase-0 tokens only.** Map: `bg-white`→`bg-surface`; `bg-slate-50/100`→`bg-surface-2`/`var(--fill-hover)`; `bg-slate-200/300`→`bg-surface-3`/`var(--fill-active)`; `text-slate-900/800`→`text-fg`; `text-slate-700`→`text-fg-2`; `text-slate-500/600`→`text-fg-muted`; `text-slate-300/400`→`text-fg-subtle`; `border-slate-200/300`→`border-border`; `bg-brand-primary text-white`→`bg-accent text-accent-fg`; `hover:bg-brand-primary-dark`→`hover:bg-accent-hover`; `text-brand-primary`→`text-accent`; `ring-brand-accent`→`ring-accent`; `bg-red-500`/`text-red`→`var(--danger)` state treatment. NO new hex, NO new tokens.
- **No API/behavior change.** Every primitive's props, variants, context, event handling, ARIA, and default values stay byte-for-byte identical. Only `className` string literals change.
- **`cn()` is a naive string-join** — to change a class you replace it in the source literal, not override it.
- **The `AvatarFallback` default is the known carried-over fix:** `bg-slate-200 text-slate-700` → `bg-surface-3 text-fg-muted`. This is IN SCOPE for this plan (the primitive pass the prior phases deferred to).
- Weights ≤ 600; radii from the `--radius` scale (`rounded-sm/md/lg`) — keep existing radius choices unless slate-coupled.
- Existing consumer tests (`BrandLogo.test`, `Sidebar.test`, `AccessGrid.test`, `AssetEditor.test`, `AssetsPage.test`, etc.) must stay green — they assert text/behavior, not primitive classes, so conversion shouldn't break them; if any asserts a slate class, that's a signal to check.
- `cd frontend && npm test` (currently 72/72) and `npm run build` green after every task.
- Commits end with a `Co-authored-by: Isaac` trailer; never `--no-verify`.

**Accent-in-role reminder:** `bg-accent`/`text-accent` only for primary action fills, active tab, focus rings, key highlights — matching how the rest of the app now uses Databricks blue.

---

## File Structure

**Modified (all in `frontend/src/components/ui/`):**
- `badge.tsx` — variant classes → tokens; destructive → danger state.
- `button.tsx` — default→accent fill, outline/ghost→tokens, focus ring→accent.
- `tabs.tsx` — TabsList/Trigger slate → surface/fg; active → `bg-surface text-accent` on `bg-surface-2` track.
- `popover.tsx` — PopoverContent `border-slate-200 bg-white`→`border-border bg-surface` (this is what makes the user menu + dropdowns theme-aware).
- `avatar.tsx` — AvatarFallback default → tokens (the carried-over fix).
- `scroll-area.tsx` — scrollbar-thumb slate → overlay-based.

**Created:**
- `frontend/src/components/ui/primitives.test.tsx` — a focused render test per primitive asserting token classes present + no `slate-`/`bg-white` in the rendered output, and that variants still resolve.

---

### Task 1: `Badge` + `Button` → tokens

**Files:**
- Modify: `frontend/src/components/ui/badge.tsx`, `frontend/src/components/ui/button.tsx`
- Test: `frontend/src/components/ui/primitives.test.tsx` (create, cover Badge + Button)

**Interfaces:** unchanged — `Badge({variant})`, `Button({variant,size,asChild})` keep all variants + the forwardRef.

- [ ] **Step 1: Write the failing test** — `primitives.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge } from "./badge";
import { Button } from "./button";

describe("UI primitives — DuBois tokens", () => {
  it("Badge default uses accent fill, no slate/brand-primary", () => {
    const { container } = render(<Badge>x</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/bg-accent/);
    expect(el.className).not.toMatch(/slate-|brand-primary|bg-red-/);
  });
  it("Badge secondary/outline use surface/border tokens", () => {
    const { container } = render(<Badge variant="secondary">x</Badge>);
    expect((container.firstChild as HTMLElement).className).not.toMatch(/slate-/);
  });
  it("Button default uses accent fill; outline/ghost use tokens, no slate/white", () => {
    const { container } = render(<Button>x</Button>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/bg-accent/);
    expect(el.className).not.toMatch(/brand-primary/);
  });
  it("Button outline has no slate/bg-white", () => {
    const { container } = render(<Button variant="outline">x</Button>);
    expect((container.firstChild as HTMLElement).className).not.toMatch(/slate-|bg-white/);
  });
});
```

- [ ] **Step 2: Run → fails.** `cd frontend && npx vitest run src/components/ui/primitives.test.tsx`.

- [ ] **Step 3: Convert `badge.tsx`** `variantClasses`:
```tsx
const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-accent text-accent-fg border-transparent",
  secondary: "bg-surface-2 text-fg-2 border-transparent",
  outline: "border border-border text-fg-2 bg-transparent",
  destructive: "text-[var(--danger-fg)] border-transparent bg-[rgba(196,64,64,0.12)]",
};
```
and the focus ring `focus:ring-brand-accent` → `focus:ring-accent`.

- [ ] **Step 4: Convert `button.tsx`** `variantClasses`:
```tsx
const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-accent text-accent-fg hover:bg-accent-hover shadow-sm",
  outline: "border border-border bg-surface text-fg hover:bg-[var(--fill-hover)] shadow-sm",
  ghost: "text-fg-2 hover:bg-[var(--fill-hover)] hover:text-fg",
};
```
and the focus ring `focus-visible:ring-brand-accent` → `focus-visible:ring-accent`.

- [ ] **Step 5: Run → passes.** Then full suite + build. `cd frontend && npm test && npm run build`.
- [ ] **Step 6: Commit.**
```bash
git add frontend/src/components/ui/badge.tsx frontend/src/components/ui/button.tsx frontend/src/components/ui/primitives.test.tsx
git commit -m "feat(ui): tokenize Badge + Button (accent fill, DuBois surfaces)

Co-authored-by: Isaac"
```

---

### Task 2: `Tabs` + `Popover` → tokens

**Files:**
- Modify: `frontend/src/components/ui/tabs.tsx`, `frontend/src/components/ui/popover.tsx`
- Test: extend `primitives.test.tsx`

**Interfaces:** unchanged.

- [ ] **Step 1: Add failing test cases** to `primitives.test.tsx`:
```tsx
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { Popover, PopoverContent } from "./popover";

it("TabsList/Trigger use surface/fg tokens, active uses accent", () => {
  const { container } = render(
    <Tabs value="a"><TabsList><TabsTrigger value="a">A</TabsTrigger></TabsList></Tabs>
  );
  expect(container.innerHTML).not.toMatch(/slate-/);
  expect(container.innerHTML).toMatch(/text-accent/); // active trigger
});
it("PopoverContent uses surface/border tokens (theme-aware), no slate/bg-white", () => {
  const { container } = render(
    <Popover open><PopoverContent>menu</PopoverContent></Popover>
  );
  const content = container.querySelector('[class*="absolute"]') as HTMLElement;
  expect(content.className).toMatch(/bg-surface/);
  expect(content.className).not.toMatch(/slate-|bg-white/);
});
```

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Convert `tabs.tsx`:**
  - `TabsList`: `bg-slate-100/80 … ring-1 ring-slate-200/60` → `bg-surface-2 p-1 gap-1 border border-border`.
  - `TabsTrigger` focus ring `ring-brand-accent` → `ring-accent`; active branch `bg-white text-brand-primary shadow-sm ring-1 ring-slate-200/70` → `bg-surface text-accent shadow-sm`; inactive `text-slate-500 hover:text-slate-800` → `text-fg-muted hover:text-fg`.
  - `TabsContent` focus ring `ring-brand-accent` → `ring-accent`.

- [ ] **Step 4: Convert `popover.tsx`** `PopoverContent`: `border-slate-200 bg-white p-4 shadow-md` → `border-border bg-surface p-4 shadow-md` (keep `rounded-md`, `z-50`, sizing, the shadow — `--shadow-md` is theme-aware already).

- [ ] **Step 5: Run → passes.** Full suite + build.
- [ ] **Step 6: Commit.**
```bash
git add frontend/src/components/ui/tabs.tsx frontend/src/components/ui/popover.tsx frontend/src/components/ui/primitives.test.tsx
git commit -m "feat(ui): tokenize Tabs + Popover (theme-aware dropdown surface, accent active tab)

Co-authored-by: Isaac"
```

---

### Task 3: `Avatar` (carried-over fix) + `ScrollArea` → tokens

**Files:**
- Modify: `frontend/src/components/ui/avatar.tsx`, `frontend/src/components/ui/scroll-area.tsx`
- Test: extend `primitives.test.tsx`

**Interfaces:** unchanged.

- [ ] **Step 1: Add failing test** to `primitives.test.tsx`:
```tsx
import { Avatar, AvatarFallback } from "./avatar";

it("AvatarFallback default uses surface/fg tokens, not slate (carried-over fix)", () => {
  const { container } = render(<Avatar><AvatarFallback>AB</AvatarFallback></Avatar>);
  const fb = container.querySelector('[class*="rounded-full"][class*="items-center"]') as HTMLElement;
  expect(fb.className).toMatch(/bg-surface-3/);
  expect(fb.className).not.toMatch(/slate-/);
});
```

- [ ] **Step 2: Run → fails** (current default is `bg-slate-200 text-slate-700`).

- [ ] **Step 3: Convert `avatar.tsx`** `AvatarFallback` default:
```tsx
        "flex h-full w-full items-center justify-center rounded-full bg-surface-3 text-fg-muted font-medium",
```
(This is the fix the chat/shell reviews flagged — consumers that pass their own gradient/accent className still override it; consumers relying on the default now get a theme-aware neutral instead of leaking slate.)

- [ ] **Step 4: Convert `scroll-area.tsx`** scrollbar thumb: `[&::-webkit-scrollbar-thumb]:bg-slate-300` → `[&::-webkit-scrollbar-thumb]:bg-[rgba(var(--overlay),0.20)]`; `hover:[&::-webkit-scrollbar-thumb]:bg-slate-400` → `hover:[&::-webkit-scrollbar-thumb]:bg-[rgba(var(--overlay),0.30)]`.

- [ ] **Step 5: Run → passes.** Full suite + build.
- [ ] **Step 6: Commit.**
```bash
git add frontend/src/components/ui/avatar.tsx frontend/src/components/ui/scroll-area.tsx frontend/src/components/ui/primitives.test.tsx
git commit -m "feat(ui): tokenize Avatar fallback (carried-over slate fix) + ScrollArea thumb

Co-authored-by: Isaac"
```

---

### Task 4: Verification checkpoint (no code)

- [ ] **Step 1: Full green.** `cd frontend && npm test && npm run build`.
- [ ] **Step 2: Grep guard on the primitives dir.** Run:
```bash
cd frontend && grep -rnE "slate-|bg-white|brand-primary|bg-red-[0-9]|ring-brand-accent|text-brand" src/components/ui/*.tsx | grep -v ".test." || echo "primitives clean"
```
Expected: clean (every primitive on tokens). Note: `avatar.tsx` may still be referenced by consumers passing gradient classNames — that's fine; the guard is on the primitive files themselves.
- [ ] **Step 3: Live Chrome check.** Start dev server; verify in BOTH themes: the user-menu Popover (top-right avatar dropdown) now renders on a theme-aware surface (dark surface in dark mode, not white); any Button/Badge/Tabs on visible pages look correct; avatars show the neutral fallback (not slate). 0 console errors. Screenshot `/tmp/apex-ui-primitives-{light,dark}.png`.
- [ ] **Step 4: Update ledger/memory;** do NOT push (await Rohit / batch with the next plans).

---

## Self-Review

**Coverage:** All 6 primitives from the inventory (badge, button, tabs, popover, scroll-area, avatar) → Tasks 1–3. The carried-over AvatarFallback slate fix → Task 3. ✅

**Placeholder scan:** Every task carries the exact token strings to write; no "convert appropriately". ✅

**Type/behavior consistency:** No prop/variant/signature changes — only `className` literals. `Button.forwardRef`, `Tabs` context, `Popover` context + click-outside/Escape handlers, `Avatar` sizeClasses all untouched. Consumer tests (which assert text/behavior) should stay green; Task 4 verifies. ✅

**Risk:** The only behavioral-adjacent change is visual (dark-mode surfaces). The `destructive` badge + focus rings change color role (red→danger token, brand-accent→accent) — intentional and in-role. Live check (Task 4) covers the Popover theme-aware surface, the highest-value user-visible outcome.

## Execution Handoff

(see chat)
