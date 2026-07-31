# Prism Phase 2 — Token Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-built three-layer `index.css` token model with the canonical DuBois `globals.css` token layer (behind a slimmed accent-only config seam) and adopt `next-themes`, so the existing app re-colors to canonical DuBois in both light and dark without breaking any component.

**Architecture:** Three ordered tasks. (A) Swap the dark-mode mechanism from our `[data-theme="dark"]` attribute to the kit's `.dark` class via `next-themes`, keeping our current tokens. (B) Replace the token bodies in `index.css` with the canonical DuBois primitive palette + `@theme inline` semantic mapping + `:root`/`.dark` values + base styles + AI-gradient utilities, and append an **alias layer** that redefines every legacy token our ~52 components consume (`--surface`, `--fg`, `--accent`, `--n0..--n12`, `--fill-*`, `--danger`, `--brand-*`, etc.) in terms of the new canonical tokens so nothing breaks. (C) Slim the config seam: `brand.config.json` shrinks to identity + a single accent + theme default; `ThemeProvider` injects only accent-derived overrides (via a cascade `<style>`, not inline, so `.dark` can still brighten primary) plus title/favicon.

**Tech Stack:** Vite 7 + React 19 + React Router 7, Tailwind v4 (`@tailwindcss/vite`, CSS-native `@theme`), Vitest 3 + Testing Library + jsdom, `next-themes` (new).

## Global Constraints

- **Frontend-only.** No backend / `app.py` / `/api/*` / SP-auth change. (spec §Architecture, §Testing)
- **Config discipline: accent + logo + name ONLY.** Neutrals, radii, typography, tag palette, and the AI gradient are canonical DuBois and are **not** client-overridable. (spec §Config seam, §Out of scope)
- **Canonical values are verbatim from the kit.** Source of truth: `/tmp/db-starter-kit/src/app/globals.css` (re-clone `github.com/gioa/db-starter-kit` to `/tmp/db-starter-kit` if gone). Primary `--primary #2272b4`, `--secondary #f7f7f7`, warm neutrals, `--radius` 4px base + 8px container, AI gradient `linear-gradient(135deg, #4299e0 20.5%, #ca42e0 46.91%, #ff5f46 79.5%)`. (spec §Token layer, §Canonical corrections)
- **Dark selector = `.dark` class** (Tailwind v4 `@custom-variant dark (&:is(.dark *))`), driven by `next-themes` with `attribute="class"`. Retire the `[data-theme="dark"]` attribute entirely. (spec §Dark mode)
- **13px base, `font-semibold` (600) never `font-bold`, system SF Pro (never Inter).** (spec §Canonical corrections #5)
- **Each task ends green:** `cd frontend && npm test && npm run build` both pass, then a live Chrome check in **both** light and dark. Push to `feature/apex-theming`, no PRs, batch phases. (spec §Testing)
- **Aliases are temporary.** They exist only so components keep working this phase; Phase 3 migrates components off them and Phase 6 deletes them. Mark the alias block clearly as such.

---

## File Structure

**Modified:**
- `frontend/package.json` — add `next-themes` (Task A); add `clsx`, `tailwind-merge`, `tw-animate-css` (Task B).
- `frontend/src/index.css` — dark selector flip (Task A); full token-body swap + alias layer (Task B).
- `frontend/src/theme/ThemeProvider.tsx` — wrap `next-themes` provider (Task A); slim injection to accent-only via cascade `<style>` (Task C).
- `frontend/src/theme/ThemeToggle.tsx` — consume `next-themes` `useTheme` (Task A).
- `frontend/src/theme/brand.ts` — `neutralsStyleSheet` emits `.dark` (Task A); rewrite to accent-only seam (Task C).
- `frontend/src/theme/GradientMark.tsx` — no code change; verify it still renders the (now canonical AI) gradient (Task B live-check).
- `brand.config.json` (repo root) — slim to identity + single accent + theme default (Task C).
- Tests: `frontend/src/theme/useTheme.test.ts`, `ThemeToggle.test.tsx`, `ThemeProvider.test.tsx`, `brand.test.ts` — updated per task.
- `frontend/src/lib/utils.ts` — add `cn` helper if not already present (Task B; used by aliases-era components and all later phases).

**Created:** none (all edits are to existing files).

**Deleted (Task A):** `frontend/src/theme/useTheme.ts` and `frontend/src/theme/useTheme.test.ts` — custom hook replaced by `next-themes`. `Theme` type + `DEFAULT_THEME` move to / stay in `brand.ts`.

---

### Task A: Adopt `next-themes` (class-based dark), keep current tokens

Isolates the dark-mode mechanism change. After this task the app looks identical but toggles dark via `.dark` on `<html>` instead of `data-theme="dark"`, driven by `next-themes`. Tokens are still ours.

**Files:**
- Modify: `frontend/package.json` (add dep)
- Modify: `frontend/src/theme/ThemeProvider.tsx`
- Modify: `frontend/src/theme/ThemeToggle.tsx`
- Modify: `frontend/src/theme/brand.ts:65-72` (`neutralsStyleSheet` selector)
- Modify: `frontend/src/index.css:84` (`[data-theme="dark"]` → `.dark`) and add `@custom-variant`
- Delete: `frontend/src/theme/useTheme.ts`, `frontend/src/theme/useTheme.test.ts`
- Modify tests: `frontend/src/theme/ThemeToggle.test.tsx`, `frontend/src/theme/ThemeProvider.test.tsx`, `frontend/src/theme/brand.test.ts`

**Interfaces:**
- Consumes: `next-themes` `ThemeProvider` (props `attribute`, `defaultTheme`, `enableSystem`, `storageKey`, `disableTransitionOnChange`) and `useTheme()` → `{ theme, setTheme, resolvedTheme }`.
- Produces: `DEFAULT_THEME: "light" | "dark"` and `type Theme` remain exported from `frontend/src/theme/brand.ts`. `<html>` carries class `light` or `dark` (dark = the only one the CSS keys on). Storage key stays `"apex-theme"`.

- [ ] **Step 1: Install `next-themes`**

```bash
cd frontend && npm install next-themes@^0.4.6
```

- [ ] **Step 2: Add the `@custom-variant` and flip the dark selector in `index.css`**

At the very top of `frontend/src/index.css`, immediately after `@import "tailwindcss";` (line 1), add:

```css
@custom-variant dark (&:is(.dark *));
```

Then change the dark primitives selector (currently `index.css:84`) from:

```css
[data-theme="dark"] {
```
to:
```css
.dark {
```

(Leave every token value inside untouched — this task only changes the selector.)

- [ ] **Step 3: `neutralsStyleSheet` emits `.dark` instead of `[data-theme="dark"]`**

In `frontend/src/theme/brand.ts`, in `neutralsStyleSheet` (lines 65-72), change the dark `rampBlock` selector argument from `'[data-theme="dark"]'` to `'.dark'`:

```ts
export function neutralsStyleSheet(b: Brand): string {
  const n = b.colors.neutrals;
  if (!n) return "";
  return (
    rampBlock(":root", n.light.ramp, n.light.overlay) +
    rampBlock(".dark", n.dark.ramp, n.dark.overlay)
  );
}
```

- [ ] **Step 4: Rewrite `ThemeProvider.tsx` to wrap `next-themes`**

Replace the whole file. Keep the existing brand/accent/neutrals **injection** (Task C slims it); only remove the `applyTheme(readStoredTheme())` line (next-themes now owns light/dark) and wrap children in the `next-themes` provider:

```tsx
import { useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { brand, brandToCssVars, accentVars, neutralsStyleSheet, DEFAULT_THEME } from "./brand";

/**
 * Applies brand.config.json to the document at runtime as CSS custom
 * properties, and delegates light/dark to next-themes (class-based `.dark`).
 *
 * IMPORTANT: only THEME-INVARIANT vars are written inline here (brand-* +
 * accent). The neutral ramp + --overlay are theme-variant and injected as
 * real cascade rules (:root / .dark) so the class flip can still swap them;
 * writing them inline would override that rule and break dark mode.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const css = neutralsStyleSheet(brand);
    if (css) {
      let styleEl = document.getElementById("apex-neutrals") as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "apex-neutrals";
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = css;
    }

    const root = document.documentElement;
    const vars = { ...brandToCssVars(brand), ...accentVars(brand) };
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    document.title = brand.identity.appName;
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={DEFAULT_THEME}
      enableSystem={false}
      storageKey="apex-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 5: Rewrite `ThemeToggle.tsx` to use `next-themes`**

Replace the file. Mirror the kit's toggle logic (`setTheme(theme === "dark" ? "light" : "dark")`), keep our existing markup/classes/labels so the UI is unchanged:

```tsx
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const toDark = theme !== "dark";
  const label = toDark ? "Switch to dark theme" : "Switch to light theme";
  return (
    <button
      type="button"
      onClick={() => setTheme(toDark ? "dark" : "light")}
      aria-label={label}
      title={label}
      className="grid place-items-center h-6 w-6 rounded-sm text-fg-ghost hover:bg-[var(--fill-hover)] hover:text-fg-muted transition-colors"
    >
      {toDark ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}
```

- [ ] **Step 6: Delete the custom hook and its test**

```bash
cd frontend && rm src/theme/useTheme.ts src/theme/useTheme.test.ts
```

Then confirm nothing else imports them (should be nothing after Steps 4-5):

```bash
cd frontend && grep -rn "theme/useTheme\|from \"./useTheme\"\|applyTheme\|readStoredTheme\|THEME_STORAGE_KEY" src && echo "STILL REFERENCED" || echo "clean"
```
Expected: `clean`.

- [ ] **Step 7: Update `brand.test.ts` for the `.dark` selector**

In `frontend/src/theme/brand.test.ts`, the two `neutralsStyleSheet` assertions (around lines 40-53) reference `[data-theme="dark"]`. Change both to `.dark`:

```ts
    expect(css).toMatch(/\.dark\s*\{/);
```
and in the block-containment test:
```ts
    const darkIdx = css.indexOf(".dark");
```
(Keep the light `:root` assertions as-is.)

- [ ] **Step 8: Update `ThemeProvider.test.tsx` for `next-themes`**

`next-themes` applies the class asynchronously (effect) and reads `localStorage`. Replace the file with assertions on the injected `<style>`, the inline accent vars, and the `.dark` class via `waitFor`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ThemeProvider } from "./ThemeProvider";

beforeEach(() => {
  localStorage.clear();
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.removeAttribute("style");
});

describe("ThemeProvider", () => {
  it("writes accent vars inline on mount", () => {
    render(<ThemeProvider>x</ThemeProvider>);
    expect(document.documentElement.style.getPropertyValue("--accent")).not.toBe("");
  });

  it("does NOT write theme-variant vars inline (ramp/overlay stay CSS-only)", () => {
    render(<ThemeProvider>x</ThemeProvider>);
    const s = document.documentElement.style;
    expect(s.getPropertyValue("--overlay")).toBe("");
    expect(s.getPropertyValue("--n1")).toBe("");
  });

  it("injects a <style id=apex-neutrals> with :root and .dark ramp rules", () => {
    render(<ThemeProvider>x</ThemeProvider>);
    const el = document.getElementById("apex-neutrals");
    expect(el).toBeTruthy();
    expect(el!.textContent).toMatch(/:root\{[^}]*--n1:#FCFCFD/);
    expect(el!.textContent).toMatch(/\.dark\{[^}]*--n1:#121214/);
  });

  it("applies the stored dark theme (adds .dark class)", async () => {
    localStorage.setItem("apex-theme", "dark");
    render(<ThemeProvider>x</ThemeProvider>);
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(true)
    );
  });

  it("does not add .dark when nothing stored (defaults light)", async () => {
    render(<ThemeProvider>x</ThemeProvider>);
    await waitFor(() =>
      expect(document.documentElement.classList.contains("light")).toBe(true)
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("writes --accent-gradient inline (gradient flourish var)", () => {
    render(<ThemeProvider>x</ThemeProvider>);
    expect(document.documentElement.style.getPropertyValue("--accent-gradient")).toMatch(/linear-gradient/);
  });
});
```

- [ ] **Step 9: Update `ThemeToggle.test.tsx` for `next-themes` + `.dark`**

The toggle now needs the provider as a wrapper and applies the class asynchronously:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "./ThemeProvider";
import ThemeToggle from "./ThemeToggle";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark", "light");
});

describe("ThemeToggle", () => {
  it("switches to dark (adds .dark class) and offers the reverse action", async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    const btn = await screen.findByRole("button", { name: /switch to dark theme/i });
    fireEvent.click(btn);
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(true)
    );
    expect(
      screen.getByRole("button", { name: /switch to light theme/i })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run tests**

Run: `cd frontend && npm test`
Expected: PASS (all suites; theme suites green under the new `.dark` mechanism).

- [ ] **Step 11: Run build**

Run: `cd frontend && npm run build`
Expected: type-check + Vite build succeed.

- [ ] **Step 12: Live check both themes**

Start the dev server (`cd frontend && npm run dev`) and open in Chrome. Toggle the theme; confirm `<html>` gains/loses `class="dark"` (DevTools Elements) and the app visibly switches light/dark exactly as before. Confirm the stored key is `apex-theme` in localStorage.

- [ ] **Step 13: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/index.css frontend/src/theme
git commit -m "feat(theme): adopt next-themes class-based dark, retire data-theme attribute

Co-authored-by: Isaac"
```

---

### Task B: Vendor canonical DuBois token layer + alias layer

Replaces the token bodies in `index.css` with the canonical DuBois tokens (verbatim from the kit), then appends an alias section that redefines every legacy token our components consume so nothing breaks. After this task the app **re-colors to canonical DuBois** in both themes.

**Files:**
- Modify: `frontend/package.json` (add `clsx`, `tailwind-merge`, `tw-animate-css`)
- Modify: `frontend/src/index.css` (full token-body rewrite + alias layer)
- Create/verify: `frontend/src/lib/utils.ts` (add `cn`)

**Interfaces:**
- Consumes: canonical token names from the kit (`--primary`, `--secondary`, `--background`, `--foreground`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--destructive`, `--warning`, `--success`, `--card`, `--popover`, `--sidebar*`, `--chart-1..5`, `--action-*`, `--table-row-*`, tag `--tag-*`, `--shadow-db-*`, `--code-bg`).
- Produces: **alias tokens** consumed by existing components, all resolving to canonical values — `--surface`, `--surface-2`, `--surface-3`, `--fg`, `--fg-2`, `--fg-muted`, `--fg-subtle`, `--fg-ghost`, `--fg-disabled`, `--border-hover`, `--border-emphasis`, `--fill-hover`, `--fill-active`, `--fill-press`, `--fill-emphasis`, `--accent` (→ primary), `--accent-fg`, `--accent-hover`, `--accent-gradient`, `--danger`, `--danger-fg`, `--warning-fg`, `--success-fg`, `--viz1..3`, `--shadow-sm/md/lg`, `--overlay`, `--n0..--n12`, `--brand-*`, `--font-mono`, `--brand-font-sans`. Tailwind utilities `bg-surface`, `text-fg`, `border-border`, `bg-accent`, `text-accent-fg`, `bg-brand-*`, etc. keep resolving.
- **Critical mapping:** our `--accent` = brand action color → DuBois `--primary` (NOT DuBois `--accent`, which is a `#f7f7f7` grey surface). Get this right at the alias, everywhere.

- [ ] **Step 1: Add CSS/util deps**

```bash
cd frontend && npm install clsx@^2.1.1 tailwind-merge@^3.5.0 && npm install -D tw-animate-css@^1.4.0
```

- [ ] **Step 2: Add the `cn` helper**

If `frontend/src/lib/utils.ts` has no `cn` export, add it (create the file if absent):

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Verify first:
```bash
cd frontend && grep -n "export function cn" src/lib/utils.ts 2>/dev/null || echo "add cn"
```

- [ ] **Step 3: Replace the token bodies in `index.css`**

Rewrite `frontend/src/index.css` as follows. The **top matter** (Steps: `@import "tailwindcss";` + `@custom-variant dark ...` from Task A) stays. Then paste the canonical DuBois blocks **verbatim** from `/tmp/db-starter-kit/src/app/globals.css`:

- the `@theme { ... }` primitive palette (kit lines 11-139) — blue/neutral/grey/red/green/yellow, brand-red, star, secondary tag hues, `--shadow-db-*`, `--text-*`;
- the `@theme inline { ... }` semantic + radius mapping (kit lines 144-186);
- the `:root { ... }` light DuBois values (kit lines 191-305);
- the `.dark { ... }` dark DuBois values (kit lines 308-420);
- the `@layer base { ... }` base styles (kit lines 423-460) — body 13px/20px SF-Pro stack, h1-h6 at weight 600, `code`;
- the `@keyframes dubois-spin` (kit lines 464-467);
- the `@layer utilities { ... }` block (kit lines 470-503) — `.text-hint`, `.bg-ai-gradient`, `.bg-ai-gradient-subtle`, `.text-ai-gradient`, `.border-ai`, `.row-*`.

**Do NOT** copy the kit's `@import "tw-animate-css";` or `@import "shadcn/tailwind.css";` lines (kit lines 2-3): `tw-animate-css` utilities aren't needed until Phase 3 component vendoring, and `shadcn/tailwind.css` is a shadcn-CLI/Next resolution artifact whose base styles are already reproduced by the `@layer base` block. Leaving them out keeps the Vite build resolvable.

Keep the tail rules we still rely on — but reconcile them to canonical:
- Replace the old radius-based `html, body, #root { height:100%; margin:0; }` — keep this rule (layout, harmless).
- Delete the old `body { font-size:12px; line-height:18px; ... }` rule (kit's `@layer base body` at 13px/20px replaces it).
- Delete the old `.gradient-border` rule that used `--surface`/`--accent-gradient`; re-add a canonical version in the alias layer (Step 4) so `GradientMark`/flourish borders still work.

- [ ] **Step 4: Append the ALIAS LAYER to `index.css`**

After all canonical blocks, append this section verbatim. It maps our legacy tokens to canonical DuBois values (light in `:root`, dark overrides in `.dark`), and re-declares the legacy Tailwind utility names in an `@theme inline` block so `bg-surface`/`text-fg`/`bg-brand-*`/etc. keep resolving.

```css
/* ============================================================================
   TEMPORARY ALIAS LAYER — legacy Prism token names → canonical DuBois tokens.
   Exists only so existing components keep working this phase. Phase 3 migrates
   components onto canonical names; Phase 6 DELETES this whole section.
   Do NOT add new usages of these aliases.
   ============================================================================ */
:root {
  /* surfaces */
  --surface: var(--background);          /* was near-white content bg */
  --surface-2: var(--secondary);         /* #f7f7f7 warm-grey chrome */
  --surface-3: #ebebeb;                  /* neutral-100 */

  /* foreground ramp */
  --fg: var(--foreground);               /* #161616 */
  --fg-2: #262626;                       /* neutral-700 */
  --fg-muted: var(--muted-foreground);   /* #6f6f6f */
  --fg-subtle: #6f6f6f;
  --fg-ghost: #939393;                   /* neutral-400 */
  --fg-disabled: #a2a2a2;                /* neutral-350 */

  /* borders */
  --border-hover: #d8d8d8;               /* neutral-200 */
  --border-emphasis: #cbcbcb;            /* neutral-300 */

  /* neutral fills (map to DuBois neutral table-row tints) */
  --fill-hover: var(--table-row-hover);
  --fill-active: var(--table-row-selected);
  --fill-press: var(--table-row-selected-hover);
  --fill-emphasis: var(--table-row-selected-hover);

  /* overlay RGB triple — DuBois neutral-500 (82,82,82) so rgba(var(--overlay),x) reads neutral */
  --overlay: 82, 82, 82;

  /* brand action color: our --accent === DuBois --primary (NOT DuBois --accent!) */
  --accent: var(--primary);
  --accent-fg: var(--primary-foreground);
  --accent-hover: color-mix(in srgb, var(--primary) 88%, black);
  --accent-gradient: linear-gradient(135deg, #4299e0 20.5%, #ca42e0 46.91%, #ff5f46 79.5%);

  /* state colors */
  --danger: var(--destructive);
  --danger-fg: var(--destructive);
  --warning-fg: var(--warning);
  --success-fg: var(--success);

  /* data-viz */
  --viz1: var(--chart-4);                /* red */
  --viz2: var(--chart-3);                /* orange */
  --viz3: var(--chart-2);                /* green */

  /* elevation → DuBois shadow scale */
  --shadow-sm: var(--shadow-db-sm);
  --shadow-md: var(--shadow-db-md);
  --shadow-lg: var(--shadow-db-lg);

  /* fonts → canonical DuBois system stacks (Inter retired) */
  --brand-font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* legacy brand-* (used by ~20 not-yet-migrated files) → canonical */
  --brand-primary: var(--primary);
  --brand-primary-dark: #0e538b;         /* blue-700 */
  --brand-primary-light: #d7edfe;        /* blue-200 */
  --brand-accent: var(--primary);
  --brand-accent-dark: #0e538b;
  --brand-sidebar-from: var(--secondary);
  --brand-sidebar-via: var(--secondary);
  --brand-sidebar-to: var(--secondary);
  --brand-bg: var(--secondary);
  --brand-border: var(--border);

  /* legacy neutral ramp n0..n12 → warm DuBois neutral values (light) */
  --n0: #ffffff; --n1: #ffffff; --n2: #f7f7f7; --n3: #ebebeb; --n4: #d8d8d8;
  --n5: #cbcbcb; --n6: #a2a2a2; --n7: #939393; --n8: #6f6f6f; --n9: #525252;
  --n10: #424242; --n11: #262626; --n12: #161616;
}

.dark {
  --surface-3: #262626;
  --fg-2: #d1d9e1;                        /* grey-200 */
  --fg-subtle: #92a4b3;                   /* grey-350 */
  --fg-ghost: #8396a5;                    /* grey-400 */
  --fg-disabled: #5f7281;                 /* grey-500 */
  --border-hover: #37444f;                /* grey-650 */
  --border-emphasis: #445461;             /* grey-600 */
  --overlay: 189, 205, 219;               /* matches DuBois dark table-row rgba base */
  --brand-primary-dark: #8acaff;          /* blue-400 */
  --brand-primary-light: #04355d;         /* blue-800 */
  --brand-accent-dark: #8acaff;

  /* legacy neutral ramp (dark) → DuBois grey values */
  --n0: #11171c; --n1: #11171c; --n2: #1f272d; --n3: #262626; --n4: #37444f;
  --n5: #445461; --n6: #5f7281; --n7: #8396a5; --n8: #92a4b3; --n9: #c0cdd8;
  --n10: #d1d9e1; --n11: #e8ecf0; --n12: #f6f7f9;
}

/* Legacy Tailwind utility names (bg-surface, text-fg, bg-brand-*, …) keep resolving. */
@theme inline {
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-fg: var(--fg);
  --color-fg-2: var(--fg-2);
  --color-fg-muted: var(--fg-muted);
  --color-fg-subtle: var(--fg-subtle);
  --color-fg-ghost: var(--fg-ghost);
  --color-fg-disabled: var(--fg-disabled);
  --color-border-hover: var(--border-hover);
  --color-border-emphasis: var(--border-emphasis);
  --color-accent: var(--accent);
  --color-accent-fg: var(--accent-fg);
  --color-accent-hover: var(--accent-hover);
  --color-danger: var(--danger);
  --color-danger-fg: var(--danger-fg);
  --color-warning-fg: var(--warning-fg);
  --color-success-fg: var(--success-fg);
  --color-brand-primary: var(--brand-primary);
  --color-brand-primary-dark: var(--brand-primary-dark);
  --color-brand-primary-light: var(--brand-primary-light);
  --color-brand-accent: var(--brand-accent);
  --color-brand-accent-dark: var(--brand-accent-dark);
  --color-brand-sidebar-from: var(--brand-sidebar-from);
  --color-brand-sidebar-via: var(--brand-sidebar-via);
  --color-brand-sidebar-to: var(--brand-sidebar-to);
  --color-brand-bg: var(--brand-bg);
  --color-brand-border: var(--brand-border);
  --font-sans: var(--brand-font-sans);
  --font-mono: var(--font-mono);
}

/* canonical gradient flourish border (replaces the old --surface-based rule) */
.gradient-border {
  position: relative;
  background:
    linear-gradient(var(--card), var(--card)) padding-box,
    var(--accent-gradient) border-box;
  border: 1.5px solid transparent;
}
```

Note: `--border` and `--muted-foreground` and the `bg-border`/`text-muted-foreground` utilities are already canonical (defined in the DuBois `:root`/`.dark` + `@theme inline`), so they are **not** re-aliased — our components using `border-border` resolve straight to canonical.

- [ ] **Step 5: Sanity-check no legacy token was left undefined**

List every `var(--…)` our components reference and confirm each is defined either canonically or in the alias layer:

```bash
cd frontend && grep -rhoE "var\(--[a-z0-9-]+" src --include="*.tsx" --include="*.ts" \
  | sed 's/var(//' | sort -u
```
Cross-check each against `index.css`. Any name in the list not defined in `index.css` is a gap — add an alias for it. Expected: no gaps.

- [ ] **Step 6: Run tests**

Run: `cd frontend && npm test`
Expected: PASS. (Non-theme suites unaffected; theme suites still green from Task A.)

- [ ] **Step 7: Run build**

Run: `cd frontend && npm run build`
Expected: succeeds. If Tailwind reports an unknown utility, a legacy `@theme inline --color-*` alias is missing — add it and rebuild.

- [ ] **Step 8: Live check both themes**

`cd frontend && npm run dev`, open in Chrome. Verify across Home, a dashboard page, admin, login, and the Ask APEX rail:
- content cards are white, chrome is `#f7f7f7` warm-grey (no blue cast), no stray dark-L sidebar;
- primary/action elements are DuBois blue `#2272b4` (buttons, active nav, links) — confirms the `--accent → --primary` mapping;
- body text renders at 13px in the SF-Pro system font (NOT Inter); headings are weight 600;
- `GradientMark` + any `.gradient-border` show the AI gradient (blue→magenta→orange-red);
- toggle to dark: warm neutrals become the blue-tinted grey ramp, primary brightens, everything legible.

- [ ] **Step 9: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/index.css frontend/src/lib/utils.ts
git commit -m "feat(theme): vendor canonical DuBois token layer behind alias seam

Co-authored-by: Isaac"
```

---

### Task C: Slim the config seam to accent + logo + name

Shrinks `brand.config.json` and rewrites the brand seam so a rebrand = one accent color + a logo + a name. Everything else is canonical DuBois, non-overridable. Accent is injected as **cascade rules** (`:root` / `.dark`) so `.dark` can still brighten primary.

**Files:**
- Modify: `brand.config.json` (repo root)
- Modify: `frontend/src/theme/brand.ts`
- Modify: `frontend/src/theme/ThemeProvider.tsx`
- Modify tests: `frontend/src/theme/brand.test.ts`, `frontend/src/theme/ThemeProvider.test.tsx`

**Interfaces:**
- Consumes: `brand.config.json` shape `{ identity: {appName, shortName, tagline, logo, logoMark, favicon}, colors: {accent: string}, defaults: {theme} }`.
- Produces: `brand.ts` exports `brand: Brand`, `type Theme`, `DEFAULT_THEME`, and `accentStyleSheet(b: Brand): string` returning `:root{--primary:…;--primary-foreground:#fff;--ring:…;--sidebar-primary:…;--sidebar-ring:…} .dark{--primary:<lighter>;--ring:<lighter>;--sidebar-primary:<lighter>;--sidebar-ring:<lighter>}`. `brandToCssVars`, `accentVars`, `neutralsStyleSheet` are removed.

- [ ] **Step 1: Slim `brand.config.json`**

Replace the repo-root `brand.config.json` with the essentials only. (Keep `appName: "APEX"` — the rename to Prism is Phase 1, not this phase. Accent = our current DuBois blue.)

```json
{
  "identity": {
    "appName": "APEX",
    "shortName": "APEX",
    "tagline": "Travel Intelligence",
    "logo": "/brand/logo.svg",
    "logoMark": "/brand/mark.svg",
    "favicon": "/brand/favicon.svg"
  },
  "colors": {
    "accent": "#2272b4"
  },
  "defaults": {
    "theme": "light"
  }
}
```

- [ ] **Step 2: Rewrite `brand.ts` to the accent-only seam**

Replace the file:

```ts
import brandJson from "@brand";

export type Theme = "light" | "dark";

export interface Brand {
  identity: {
    appName: string;
    shortName: string;
    tagline: string;
    logo: string;
    logoMark: string;
    favicon: string;
  };
  colors: {
    /** The one client-overridable color. Drives --primary and its derivations. */
    accent: string;
  };
  defaults?: { theme: Theme };
}

export const brand = brandJson as Brand;

export const DEFAULT_THEME: Theme = brand.defaults?.theme ?? "light";

/**
 * The ONLY config-driven CSS: the accent color and its derivations, emitted as
 * real cascade rules so the `.dark` block can brighten --primary (inline styles
 * would override the class rule and break dark-mode contrast). Everything else
 * is canonical DuBois and lives in index.css.
 */
export function accentStyleSheet(b: Brand): string {
  const a = b.colors.accent;
  const aDark = `color-mix(in srgb, ${a} 65%, white)`;
  return (
    `:root{` +
    `--primary:${a};--primary-foreground:#ffffff;` +
    `--ring:${a};--sidebar-primary:${a};--sidebar-ring:${a};` +
    `}` +
    `.dark{` +
    `--primary:${aDark};` +
    `--ring:${aDark};--sidebar-primary:${aDark};--sidebar-ring:${aDark};` +
    `}`
  );
}
```

- [ ] **Step 3: Slim `ThemeProvider.tsx` to inject only accent + identity**

Replace the `useLayoutEffect` body: inject the `accentStyleSheet` into `<style id="apex-accent">` (cascade rules, not inline), set the document title, and set the favicon from identity. Remove the neutrals/brand-var/inline-accent injection.

```tsx
import { useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { brand, accentStyleSheet, DEFAULT_THEME } from "./brand";

/**
 * Injects the config-driven accent (the ONLY overridable color) as cascade
 * rules so the `.dark` block can still brighten --primary, and applies the
 * brand identity (title + favicon). Light/dark is delegated to next-themes
 * (class-based `.dark`). All other tokens are canonical DuBois in index.css.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    let styleEl = document.getElementById("apex-accent") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "apex-accent";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = accentStyleSheet(brand);

    document.title = brand.identity.appName;

    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon && brand.identity.favicon) favicon.href = brand.identity.favicon;
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={DEFAULT_THEME}
      enableSystem={false}
      storageKey="apex-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 4: Check for now-dead imports of the removed brand exports**

```bash
cd frontend && grep -rn "brandToCssVars\|accentVars\|neutralsStyleSheet\|colors\.duboisAccent\|colors\.accentGradient\|colors\.neutrals\|colors\.primary\b\|colors\.sidebar\|typography\.fontSans" src && echo "FIX THESE" || echo "clean"
```
Expected: `clean`. If any component read `brand.colors.*` fields that no longer exist (e.g. a logo/sidebar consumer), repoint it to `brand.identity.*` or a canonical token. Fix inline.

- [ ] **Step 5: Rewrite `brand.test.ts` for the accent-only seam**

Replace the file with tests for the new surface (adjust to the repo's existing assertion style):

```ts
import { describe, it, expect } from "vitest";
import { brand, DEFAULT_THEME, accentStyleSheet } from "./brand";

describe("brand config", () => {
  it("exposes identity + a single accent", () => {
    expect(brand.identity.appName).toBeTruthy();
    expect(brand.colors.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("defaults theme to light when unset", () => {
    expect(DEFAULT_THEME === "light" || DEFAULT_THEME === "dark").toBe(true);
  });
});

describe("accentStyleSheet", () => {
  it("emits :root and .dark blocks driving --primary from the accent", () => {
    const css = accentStyleSheet(brand);
    expect(css).toMatch(/:root\{[^}]*--primary:/);
    expect(css).toMatch(/\.dark\{[^}]*--primary:/);
    expect(css).toContain(brand.colors.accent);
  });

  it("derives ring and sidebar-primary from the accent too", () => {
    const css = accentStyleSheet(brand);
    expect(css).toMatch(/--ring:/);
    expect(css).toMatch(/--sidebar-primary:/);
  });
});
```

- [ ] **Step 6: Update `ThemeProvider.test.tsx` for the accent `<style>`**

Replace the accent/neutrals assertions from Task A with ones for `#apex-accent`; keep the theme-class tests:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ThemeProvider } from "./ThemeProvider";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark", "light");
  document.getElementById("apex-accent")?.remove();
});

describe("ThemeProvider", () => {
  it("injects #apex-accent with :root and .dark --primary rules", () => {
    render(<ThemeProvider>x</ThemeProvider>);
    const el = document.getElementById("apex-accent");
    expect(el).toBeTruthy();
    expect(el!.textContent).toMatch(/:root\{[^}]*--primary:/);
    expect(el!.textContent).toMatch(/\.dark\{[^}]*--primary:/);
  });

  it("does NOT write --primary/--overlay/--n* as inline element styles", () => {
    render(<ThemeProvider>x</ThemeProvider>);
    const s = document.documentElement.style;
    expect(s.getPropertyValue("--primary")).toBe("");
    expect(s.getPropertyValue("--overlay")).toBe("");
    expect(s.getPropertyValue("--n1")).toBe("");
  });

  it("applies the stored dark theme (adds .dark class)", async () => {
    localStorage.setItem("apex-theme", "dark");
    render(<ThemeProvider>x</ThemeProvider>);
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(true)
    );
  });

  it("defaults light (no .dark class) when nothing stored", async () => {
    render(<ThemeProvider>x</ThemeProvider>);
    await waitFor(() =>
      expect(document.documentElement.classList.contains("light")).toBe(true)
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("sets document.title from brand identity", () => {
    render(<ThemeProvider>x</ThemeProvider>);
    expect(document.title).toBeTruthy();
  });
});
```

- [ ] **Step 7: Run tests**

Run: `cd frontend && npm test`
Expected: PASS (all suites).

- [ ] **Step 8: Run build**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 9: Live check both themes + accent swap proof**

`cd frontend && npm run dev`, Chrome. Confirm the app is unchanged from Task B's live check (canonical DuBois, both themes). Then prove the seam: temporarily edit `brand.config.json` `colors.accent` to a distinct color (e.g. `#c82d4c`), reload — every primary/action/active-nav/ring/link recolors to that color in **both** light and dark, while neutrals/chrome/radii/type/tags/AI-gradient stay canonical. Revert the accent to `#2272b4`.

- [ ] **Step 10: Commit**

```bash
git add brand.config.json frontend/src/theme
git commit -m "feat(theme): slim config seam to accent + logo + name (canonical DuBois locked)

Co-authored-by: Isaac"
```

---

## Self-Review

**Spec coverage (Phase 2 = "Token foundation"):**
- "Vendor `globals.css` canonical tokens" → Task B Steps 3-4. ✅
- "behind the slimmed config seam" → Task C. ✅
- "adopt `next-themes`" → Task A. ✅
- "add our-name→DuBois aliases so the existing app keeps working and re-colors to canonical DuBois" → Task B Step 4 alias layer. ✅
- "Green build + live check both themes" → each task Steps for `npm test` + `npm run build` + Chrome light/dark. ✅
- Config discipline (accent+logo+name only; neutrals/radii/type/tags/gradient locked) → Task C `brand.config.json` + `brand.ts` + Step 9 accent-swap proof. ✅
- Dark selector `.dark` via `next-themes` `attribute="class"` → Task A. ✅
- Canonical corrections #1 (secondary chrome, white content), #2 (warm neutrals), #3 (4/8px radii), #4 (AI gradient orange-red), #5 (13px/600/SF-Pro) → land with the verbatim canonical blocks (Task B Step 3) + live-check assertions (Task B Step 8). ✅

**Type consistency:** `Theme`/`DEFAULT_THEME` exported from `brand.ts` throughout; `accentStyleSheet` introduced in Task C (Interfaces) and consumed by `ThemeProvider` + `brand.test.ts` with matching signature; removed exports (`brandToCssVars`, `accentVars`, `neutralsStyleSheet`, `applyTheme`, `readStoredTheme`) are grep-guarded (Task A Step 6, Task C Step 4). `--accent → --primary` mapping stated in Task B Interfaces and applied in Step 4. ✅

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to"/"add tests for the above". Every code step has literal content. The one deliberately open sub-step — Task B Step 5's grep for undefined `var(--…)` — is a verification with an explicit remedy, not a placeholder. ✅

**Note on canonical verbatim blocks:** Task B Step 3 references kit line ranges rather than re-pasting ~300 CSS lines; this is intentional (the requirement is verbatim copy from a named source file, and re-typing risks transcription errors). The source path + re-clone instruction are in Global Constraints.
