# Prism Phase 3 — Icons + UI Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vendor the canonical DuBois icon set (457 icons) and the full `ui/*` primitive library (52 components) from the starter kit into `frontend/src`, replace our 6 hand-built primitives with the canonical versions, migrate every consumer (including the Button `outline`→`default` variant rename), and formally close the parked `--overlay` finding — leaving the app on 100% canonical DuBois primitives with a green build in both themes.

**Architecture:** Two ordered tasks. (1) Foundations: add the Radix/CVA/cmdk/sonner/vaul/react-hook-form deps the kit requires, wire `tw-animate-css`, and vendor the self-contained icon system (457 icons + barrel + `DbIcon`) — nothing consumes it yet, so it lands green on its own. (2) Vendor all 52 `ui/*` components verbatim (overwriting our 6 hand-built ones), then reconcile the fallout: fix the 4 `variant="outline"` Button call sites → `default`, adapt the handful of consumer API deltas (Popover open-state prop, ScrollArea viewport wrapping, Avatar), rewrite `primitives.test.tsx` for the canonical variant vocabulary, and verify+close the `--overlay` park.

**Tech Stack:** Vite 7 + React 19 + React Router 7, Tailwind v4 (canonical DuBois tokens from Phase 2), `radix-ui` umbrella primitives, `class-variance-authority`, `next-themes` (already present), Vitest 3 + Testing Library + jsdom.

## Global Constraints

- **Frontend-only.** No backend / `app.py` / `/api/*` change. (spec §Architecture)
- **Vendor INTO `frontend/src` — ours to own, not an npm dep on the kit.** Matches the shadcn/starter model. (spec §Components + icons)
- **Full library scope (user decision 2026-07-31):** vendor ALL 52 `ui/*` components this phase, not just the 6 consumed today, so the whole DuBois palette is available for Phase 5. Unused-now components are expected and acceptable this phase.
- **Canonical source, copied verbatim:** `/tmp/db-starter-kit/src/components/{ui,icons}`. Re-clone `github.com/gioa/db-starter-kit` to `/tmp/db-starter-kit` if gone. Do NOT hand-edit canonical component internals except the two mechanical adaptations named below.
- **Two allowed canonical edits:** (a) strip the leading `"use client"` directive (inert in Vite, harmless if left, but remove for cleanliness); (b) nothing else — imports already use `@/` aliases and `radix-ui`, which resolve in our Vite config.
- **Button variant rename (spec §Canonical corrections #7):** DuBois `Button` variants are `primary | destructive | default (bordered) | ghost | link`, default variant `primary`. Our old `default` (filled) → kit `primary` (the new default, so bare `<Button>` stays filled-blue automatically). Our old `outline` (bordered) → kit `default`. Watch every callsite.
- **Icons:** keep `lucide-react` (the kit's own `DbIcon` supports both lucide + DuBois icons); ADD the 457 DuBois icons alongside. No lucide removal this phase.
- **`--overlay` (carried from Phase 2 park):** the alias layer redefines `--overlay` as an RGB triple for `rgba(var(--overlay),x)` consumers. VERIFIED against the kit: kit `dialog`/`sheet`/`drawer` overlays use `bg-black/50`, NOT `var(--overlay)`; the kit's own app code uses the same `rgba(var(--overlay),x)` triple form we do. So vendoring modals introduces no bare-`var(--overlay)` color consumer. This phase CLOSES the park (no rename needed) and updates the in-code warning comment to record the verification.
- **Each task ends green:** `cd frontend && npm test && npm run build` both pass, then a live Chrome check in **both** light and dark. Push to `feature/apex-theming`, no PRs, batch phases. (spec §Testing)

---

## File Structure

**Created:**
- `frontend/src/components/icons/` — 457 `*Icon.tsx` files + `index.ts` barrel (verbatim copy from kit).
- `frontend/src/components/ui/db-icon.tsx` — the `DbIcon` wrapper (verbatim from kit).
- 46 net-new `frontend/src/components/ui/*.tsx` — the kit components we don't already have (accordion, alert, breadcrumb, button-group, card, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, empty, filter-pill, form, hero-search, hint, hover-card, input, input-group, label, list-item, notebook-cell, pagination, progress, radio-group, radio-tile, segmented-control, select, separator, sheet, skeleton, slider, sonner, spinner, split-button, stepper, suggestion-pill, switch, table, textarea, toggle, toggle-group, tooltip, tree).

**Overwritten (our 6 hand-built → canonical):**
- `frontend/src/components/ui/{button,badge,avatar,tabs,popover,scroll-area}.tsx`

**Modified (consumers + config):**
- `frontend/package.json` — add deps.
- `frontend/src/index.css` — import `tw-animate-css`; update the `--overlay` warning comment.
- `frontend/src/components/admin/{ConfirmDialog,VerifyModal,OnboardDialog,UserDialog}.tsx` — Button `variant="outline"` → `variant="default"`.
- `frontend/src/components/shell/UserMenu.tsx` — Popover open-state API delta (see Task 2 Step 5).
- `frontend/src/components/Sidebar.tsx` — ScrollArea viewport wrapping delta (see Task 2 Step 6).
- Any other consumer surfaced by the typecheck in Task 2 Step 8 (Avatar, Tabs, Badge) — fixed inline.
- `frontend/src/components/ui/primitives.test.tsx` — rewrite for canonical variant vocabulary.

**Deleted:** none (the 6 hand-built primitives are overwritten in place, keeping their paths so imports don't move).

---

### Task 1: Foundations — deps, tw-animate-css, and the icon system

Adds every external dependency the full `ui/*` library needs, wires the animation utilities, and vendors the self-contained icon system. Icons depend only on `cn` (already present from Phase 2), so this task compiles and ships green with nothing consuming the new code yet.

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/index.css` (add `tw-animate-css` import)
- Create: `frontend/src/components/icons/` (457 files + `index.ts`)
- Create: `frontend/src/components/ui/db-icon.tsx`

**Interfaces:**
- Consumes: `cn` from `frontend/src/lib/utils.ts` (Phase 2).
- Produces: named icon exports from `@/components/icons` (e.g. `import { ArrowDownIcon } from "@/components/icons"`), each `React.forwardRef<SVGSVGElement, {size?, className?, ariaLabel?} & SVGProps>`; and `DbIcon` from `@/components/ui/db-icon` with `{ icon, size?, color?: "default"|"muted"|"primary"|"danger"|"warning"|"success"|"ai", className?, ariaLabel? }`.

- [ ] **Step 1: Add the dependencies**

The full `ui/*` set imports: `radix-ui` (umbrella), `@radix-ui/react-use-controllable-state` (one singleton), `class-variance-authority`, `cmdk`, `sonner`, `vaul`, `react-hook-form`. (`lucide-react`, `clsx`, `tailwind-merge`, `next-themes`, `tw-animate-css` are already present.) Install at the kit's versions:

```bash
cd frontend && npm install \
  radix-ui@^1.4.3 \
  @radix-ui/react-use-controllable-state@^1.2.2 \
  class-variance-authority@^0.7.1 \
  cmdk@^1.1.1 \
  sonner@^2.0.7 \
  vaul@^1.1.2 \
  react-hook-form@^7.71.2
```

- [ ] **Step 2: Wire `tw-animate-css`**

The canonical primitives use `data-[state=open]:animate-in` / `fade-in-0` / `zoom-in-95` utilities that come from `tw-animate-css` (installed in Phase 2 but not imported). Add its import to `frontend/src/index.css` immediately after the Tailwind import + custom-variant lines at the top:

Current top of file:
```css
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));
```
Change to:
```css
@import "tailwindcss";
@import "tw-animate-css";
@custom-variant dark (&:is(.dark *));
```

- [ ] **Step 3: Vendor the icon directory verbatim**

Copy the entire kit icon directory (457 `*Icon.tsx` + `index.ts` barrel) into our tree. These are self-contained (each imports only `cn` from `@/lib/utils`, which resolves).

```bash
cp -R /tmp/db-starter-kit/src/components/icons /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend/src/components/icons
```

Verify the count and barrel:
```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
ls src/components/icons/*.tsx | wc -l   # expect 457
test -f src/components/icons/index.ts && echo "barrel present"
```

- [ ] **Step 4: Vendor `DbIcon`**

```bash
cp /tmp/db-starter-kit/src/components/ui/db-icon.tsx /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend/src/components/ui/db-icon.tsx
```

`db-icon.tsx` imports `cn` from `@/lib/utils` and `type { LucideIcon }` from `lucide-react` — both resolve. No edits needed.

- [ ] **Step 5: Smoke-test the icon system compiles and renders**

Add a temporary test to prove the barrel + a sample icon + `DbIcon` all import and render, then delete it after it passes (it exists only to gate this task; the real primitive tests come in Task 2). Create `frontend/src/components/icons/icons.smoke.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ArrowDownIcon } from "@/components/icons";
import { DbIcon } from "@/components/ui/db-icon";

describe("DuBois icon system", () => {
  it("renders a vendored icon as an svg", () => {
    const { container } = render(<ArrowDownIcon ariaLabel="down" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute("role")).toBe("img");
  });
  it("DbIcon wraps an icon with a semantic color class", () => {
    const { container } = render(<DbIcon icon={ArrowDownIcon} color="primary" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute("class")).toMatch(/text-primary/);
  });
});
```

- [ ] **Step 6: Run tests**

Run: `cd frontend && npm test`
Expected: PASS, including the new smoke test. (All prior suites unaffected — nothing imports the icons yet except the smoke test.)

- [ ] **Step 7: Run build**

Run: `cd frontend && npm run build`
Expected: `tsc -b` + Vite build succeed. The 457 icons + `db-icon` compile. If `tsc` complains about an icon file, the copy was incomplete — re-copy.

- [ ] **Step 8: Remove the smoke test**

It has served its gate; the canonical primitives (Task 2) will exercise icons in context.
```bash
cd frontend && rm src/components/icons/icons.smoke.test.tsx
```

- [ ] **Step 9: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/index.css frontend/src/components/icons frontend/src/components/ui/db-icon.tsx
git commit -m "feat(ui): vendor 457 DuBois icons + DbIcon; add radix/cva/cmdk/sonner/vaul deps

Co-authored-by: Isaac"
```

---

### Task 2: Vendor all 52 `ui/*` primitives + migrate consumers

Copies the full canonical `ui/*` library in (overwriting our 6 hand-built primitives), then fixes every consumer the swap affects: the Button variant rename, the Popover/ScrollArea/Avatar API deltas, and the primitives test. Closes the `--overlay` park with a verification note.

**Files:**
- Create/overwrite: all 52 `frontend/src/components/ui/*.tsx` (verbatim from kit; `db-icon.tsx` already done in Task 1).
- Modify: `frontend/src/components/admin/ConfirmDialog.tsx:37`, `VerifyModal.tsx:65`, `OnboardDialog.tsx:115`, `UserDialog.tsx:107` (Button variant).
- Modify: `frontend/src/components/shell/UserMenu.tsx` (Popover open-state).
- Modify: `frontend/src/components/Sidebar.tsx` (ScrollArea).
- Modify: `frontend/src/index.css` (`--overlay` comment).
- Rewrite: `frontend/src/components/ui/primitives.test.tsx`.
- Modify inline: any other consumer the typecheck flags (Avatar/Tabs/Badge).

**Interfaces:**
- Consumes: icons + `DbIcon` (Task 1), `cn` (Phase 2), canonical tokens (Phase 2).
- Produces canonical primitive APIs (the ones our app consumes):
  - `Button` — `variant?: "primary"|"destructive"|"default"|"ghost"|"link"` (default `"primary"`), `size?: "default"|"sm"|"xs"|"lg"|"icon"|"icon-sm"|"icon-xs"|"icon-lg"` (default `"sm"`), `asChild?`. Filled-blue = `primary` = the default.
  - `Badge` — `variant?: "default"|"secondary"|"destructive"| <11 tag hues>`, `leadingIcon?`, `trailingIcon?`. Default `"default"` = filled primary.
  - `Avatar`, `AvatarImage`, `AvatarFallback` (+ `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount`) — `Avatar` takes `size?: "default"|"sm"|"lg"` and Radix `Root` props.
  - `Tabs`, `TabsList` (`variant?: "default"|"line"|"contained"`), `TabsTrigger`, `TabsContent` — Radix-based; `Tabs` takes `value`/`defaultValue`/`onValueChange`.
  - `Popover`, `PopoverTrigger`, `PopoverContent` — Radix-based; open state via `<Popover open={} onOpenChange={}>` (Root), NOT a custom prop. `PopoverContent` takes `align`, `sideOffset`.
  - `ScrollArea` — wraps children in an internal Viewport + renders its own scrollbar; consumers pass `className` + children only.

- [ ] **Step 1: Copy the full canonical `ui/*` library in**

Overwrite/create every component from the kit. This replaces our 6 hand-built primitives (same filenames, so imports don't move) and adds the other 46.

```bash
cp -R /tmp/db-starter-kit/src/components/ui/. /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend/src/components/ui/
```

Confirm the set (52 components + our test file):
```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
ls src/components/ui/*.tsx | grep -v test | wc -l   # expect 52
```

- [ ] **Step 2: Strip `"use client"` directives (the one allowed canonical edit)**

The kit is a Next.js app; several `ui/*` files start with `"use client"`, which is inert in Vite. Remove it for cleanliness (it's a no-op line, not logic):

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend/src/components/ui
# remove a leading "use client" line (with or without semicolon) from every ui file
for f in *.tsx; do
  perl -0pi -e 's/\A"use client";?\s*\n//' "$f"
done
grep -rl '"use client"' . && echo "STILL PRESENT — investigate" || echo "clean"
```
Expected: `clean`.

- [ ] **Step 3: Fix the 4 Button `outline` → `default` call sites**

The DuBois rename: our old `variant="outline"` (bordered) is the kit's `variant="default"`. All 4 are admin Cancel buttons. Edit each:

- `frontend/src/components/admin/ConfirmDialog.tsx:37` — `variant="outline"` → `variant="default"`
- `frontend/src/components/admin/VerifyModal.tsx:65` — `variant="outline"` → `variant="default"`
- `frontend/src/components/admin/OnboardDialog.tsx:115` — `variant="outline"` → `variant="default"`
- `frontend/src/components/admin/UserDialog.tsx:107` — `variant="outline"` → `variant="default"`

Confirm none remain:
```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -rn 'variant="outline"' src && echo "STILL PRESENT" || echo "clean"
```
Expected: `clean`. (Bare `<Button>` with no variant stays filled-blue because kit default is `primary`; no change needed for the 19 no-variant sites.)

- [ ] **Step 4: Verify Badge consumers against the canonical variant set**

Badge has no `variant=` usage in production (only className overrides in `admin/shared.tsx` for `TenantStatusBadge`/`AuditStatusBadge`, and bare `<Badge>` in `DashboardWorkspace.tsx` / `ExecutiveSummaryModal.tsx`). Bare `<Badge>` = kit default `"default"` (filled primary). Confirm no consumer passes a variant the kit dropped:

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -rn "<Badge" src --include="*.tsx" | grep 'variant='
```
Kit Badge variants: `default | secondary | destructive | default_tag | charcoal | lemon | lime | teal | turquoise | indigo | purple | pink | brown | coral`. If any consumer passes `variant="outline"` (our old variant, dropped by the kit), change it to `variant="secondary"` (the closest bordered-neutral equivalent) and note it in the report. Expected: no `variant=` usages found → no change.

- [ ] **Step 5: Fix the Popover open-state API delta in `UserMenu.tsx`**

Our old Popover took `open`/`onOpenChange` on the `<Popover>` wrapper via a custom context. The kit's `Popover` is Radix `Popover.Root`, which ALSO takes `open`/`onOpenChange` as props — so a controlled `<Popover open={x} onOpenChange={setX}>` is compatible. BUT the kit's `PopoverTrigger` renders a Radix trigger (no `asChild`-less button wrapper) and `PopoverContent` is portalled with `align`/`sideOffset`. Read `frontend/src/components/shell/UserMenu.tsx` and:
- Ensure the `<PopoverTrigger>` wraps its clickable element with `asChild` if it passes a custom element (Radix requirement); if it passed a bare `className`+children expecting the old component to render a `<button>`, wrap the inner control in `asChild`.
- Keep `open`/`onOpenChange` on `<Popover>` (compatible).
- Keep `align`/`sideOffset` on `<PopoverContent>` (compatible).

Make the minimal edit so `UserMenu` compiles and the menu still opens/closes. Report exactly what changed.

- [ ] **Step 6: Fix the ScrollArea delta in `Sidebar.tsx`**

Our old `ScrollArea` was a single styled div; the kit's `ScrollArea` wraps children in a Radix `Viewport` and renders its own scrollbar (children still passed the same way: `<ScrollArea className="…">{children}</ScrollArea>`). Read `frontend/src/components/Sidebar.tsx` — the existing `<ScrollArea>{nav}</ScrollArea>` usage is API-compatible, but confirm the height/flex classes it passes still produce a scrolling region (the kit Root is `relative`; the Viewport is `size-full`). If the sidebar relied on the old component's specific overflow classes, adjust the `className` on `<ScrollArea>` to give it a bounded height (e.g. keep the existing `flex-1 min-h-0` / height constraint). Make the minimal edit; report what changed.

- [ ] **Step 7: Rewrite `primitives.test.tsx` for canonical variants**

Our old test asserted legacy token classes (`bg-accent`, `bg-surface`, `text-accent`) and legacy variant names. The canonical primitives use canonical classes (`bg-primary`, `bg-popover`, etc.). Replace `frontend/src/components/ui/primitives.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Avatar, AvatarFallback } from "./avatar";

describe("UI primitives — canonical DuBois", () => {
  it("Button default variant (primary) is filled with primary token", () => {
    const { container } = render(<Button>x</Button>);
    const el = container.querySelector("button")!;
    expect(el.className).toMatch(/bg-primary/);
    expect(el.className).not.toMatch(/slate-|brand-primary/);
  });

  it("Button default (bordered, formerly outline) uses input border, not a fill", () => {
    const { container } = render(<Button variant="default">x</Button>);
    const el = container.querySelector("button")!;
    expect(el.className).toMatch(/border-input/);
    expect(el.className).not.toMatch(/bg-primary\b/);
  });

  it("Badge default is filled primary; secondary uses secondary token", () => {
    const { container: a } = render(<Badge>x</Badge>);
    expect((a.querySelector("span")!).className).toMatch(/bg-primary/);
    const { container: b } = render(<Badge variant="secondary">x</Badge>);
    expect((b.querySelector("span")!).className).toMatch(/bg-secondary/);
  });

  it("TabsList/Trigger render with the muted list bg and semibold triggers", () => {
    const { container } = render(
      <Tabs value="a"><TabsList><TabsTrigger value="a">A</TabsTrigger></TabsList></Tabs>
    );
    expect(container.innerHTML).not.toMatch(/slate-/);
    expect(container.querySelector('[data-slot="tabs-list"]')!.className).toMatch(/bg-muted/);
    expect(container.querySelector('[data-slot="tabs-trigger"]')!.className).toMatch(/font-semibold/);
  });

  it("PopoverContent uses popover token surface (theme-aware), no slate/white", () => {
    const { container } = render(
      <Popover open><PopoverTrigger>t</PopoverTrigger><PopoverContent>menu</PopoverContent></Popover>
    );
    const content = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
    expect(content).toBeTruthy();
    expect(content.className).toMatch(/bg-popover/);
    expect(content.className).not.toMatch(/slate-\d|bg-white/);
  });

  it("AvatarFallback uses the muted token, not slate", () => {
    const { container } = render(<Avatar><AvatarFallback>AB</AvatarFallback></Avatar>);
    const fb = container.querySelector('[data-slot="avatar-fallback"]') as HTMLElement;
    expect(fb.className).toMatch(/bg-muted/);
    expect(fb.className).not.toMatch(/slate-/);
  });
});
```

Note: PopoverContent portals to `document.body`, so query via `document.querySelector`, not `container`.

- [ ] **Step 8: Typecheck and fix any remaining consumer deltas**

Run the typecheck to surface every consumer the swap broke (Avatar size prop, Tabs, any prop-type mismatch):

```bash
cd frontend && npx tsc -b --pretty 2>&1 | head -60
```
For each error: make the minimal consumer-side edit to conform to the canonical API (e.g. an Avatar `size` value, a removed prop). Do NOT edit the canonical component internals. Re-run until `tsc` is clean. Report every consumer file touched and why.

- [ ] **Step 9: Verify and CLOSE the `--overlay` park**

Confirm the vendored modal components do not consume `var(--overlay)` as a bare color (they use `bg-black/50`):
```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
grep -rn "var(--overlay)" src/components/ui/ && echo "REVIEW: a ui/* reads --overlay" || echo "no ui/* reads --overlay — park confirmed non-issue"
```
Expected: `no ui/* reads --overlay`. Then update the warning comment in `frontend/src/index.css` (the `--overlay` alias line) to record the closure, e.g. replace the Phase-2 WARNING text with:

```css
  /* --overlay is an RGB triple for rgba(var(--overlay),x) consumers (focus rings, scrollbars,
     dividers). VERIFIED Phase 3: canonical DuBois ui/* modals (dialog/sheet/drawer) use bg-black/50,
     NOT var(--overlay) — so no bare-color consumer exists and this override is safe & kit-aligned.
     (Canonical globals.css defines --overlay as a scrim rgba(0,0,0,0.26) that no component consumes.) */
```

- [ ] **Step 10: Run tests**

Run: `cd frontend && npm test`
Expected: PASS (rewritten primitives test + all prior suites). If a consumer test broke due to a primitive's new DOM shape (e.g. Popover portalling), fix the assertion to match canonical structure — do not revert the primitive.

- [ ] **Step 11: Run build**

Run: `cd frontend && npm run build`
Expected: `tsc -b` + Vite build succeed. Bundle grows (46 new components + 457 icons); a chunk-size warning is expected and fine.

- [ ] **Step 12: Live check both themes**

`cd frontend && npm run dev`, Chrome (backend offline is fine — chrome/shell/login render; /api 401s are expected). Verify:
- The app shell, Sidebar (ScrollArea), UserMenu (Popover), App tabs, admin dialogs, and any Button/Badge render correctly and are interactive (menu opens, tabs switch, dialogs' Cancel button is now bordered not filled).
- Buttons: primary actions filled-blue; the 4 admin Cancel buttons bordered (canonical `default`).
- Toggle dark: primitives theme correctly (popover/menu surfaces, tab list, avatar fallback all legible).
- No console errors beyond `/api` 401s.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/components/ui frontend/src/components/admin frontend/src/components/shell frontend/src/components/Sidebar.tsx frontend/src/index.css
git commit -m "feat(ui): vendor full canonical DuBois ui/* library; migrate consumers + Button variant rename

Co-authored-by: Isaac"
```

(If the typecheck in Step 8 touched other consumer files, add them to the `git add` list.)

---

## Self-Review

**Spec coverage (Phase 3 = "Icons + UI primitives"):**
- "Vendor 457 icons" → Task 1 Steps 3-4. ✅
- "Vendor `ui/*`" (full library per user decision) → Task 2 Step 1. ✅
- "migrate our components off aliases onto canonical primitives + names" → Task 2: overwriting the 6 primitives moves consumers onto canonical components; the canonical components use canonical token classes internally (the alias→canonical migration of remaining raw `var(--surface)`/`bg-surface` utility usages in non-primitive components is Phase 5/6 territory, not gated here — this phase swaps the primitives themselves). ✅
- "Handle the Button-variant rename" → Task 2 Step 3 (+ Badge check Step 4, test Step 7). ✅
- "Add the Radix deps the kit requires (radix-ui umbrella + singletons, cva, tailwind-merge, clsx, next-themes, cmdk, vaul, sonner)" → Task 1 Step 1 (tailwind-merge/clsx/next-themes already from Phase 2; react-hook-form added for `form.tsx`). ✅
- Green build + live check both themes → each task's test/build/Chrome steps. ✅
- `--overlay` park (carried from Phase 2) → Task 2 Step 9 verifies + closes. ✅

**Type consistency:** Canonical primitive APIs are declared in Task 2 Interfaces (Button/Badge/Avatar/Tabs/Popover/ScrollArea signatures) and consumed by the rewritten test (Step 7) and the consumer fixes (Steps 3-6, 8) with matching names. Button default variant = `primary` (filled) stated consistently in Global Constraints + Task 2 Interfaces + Step 3. Icon export shape declared in Task 1 Interfaces, exercised by the smoke test (Task 1 Step 5).

**Placeholder scan:** No TBD/"handle edge cases"/"similar to". The two deliberately investigative steps — Task 2 Step 5 (Popover) and Step 6 (ScrollArea) — name the exact file, the exact API delta, the compatibility facts, and the minimal-edit constraint; Step 8's typecheck-driven fixes are bounded ("minimal consumer-side edit, do not touch canonical internals, report each"). These are reconciliation steps with concrete remedies, not placeholders — the precise line edits depend on consumer code the plan correctly defers reading to implementation time.

**Note on verbatim copies:** Task 1 Step 3 (457 icons) and Task 2 Step 1 (52 components) use `cp` from the named kit path rather than pasting thousands of lines — the requirement is a verbatim vendor of a large tree, and `cp` is exact where re-typing would introduce drift. The re-clone instruction is in Global Constraints.
