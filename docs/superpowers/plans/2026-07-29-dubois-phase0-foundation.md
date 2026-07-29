# DuBois Adoption — Phase 0 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the DuBois token foundation in APEX's existing `brand.config.json` → `brand.ts` → `ThemeProvider` → Tailwind v4 seam, add a persisted light/dark theme toggle, and load JetBrains Mono — so every later phase re-skins components against a stable, customizable token layer while the app keeps rendering.

**Architecture:** Approach A from the spec — port DuBois into the *existing* token seam, no `@databricks/design-system` dep and no foreign CSS import. `frontend/src/index.css` gains three layers: (1) DuBois primitives — neutral ramp `--n0…--n12`, `--overlay`, state colors, viz, radii, fonts, durations — with `:root` holding DuBois's **light** values and `[data-theme="dark"]` holding its **dark** values (inverting DuBois's dark-first convention); (2) semantic aliases (`--surface*`, `--fg*`, `--border*`, `--fill-*`); (3) the customizable seam (`--accent*`) written at runtime by `ThemeProvider` from `brand.config.json`. The neutral ramp and `--overlay` stay **CSS-only** (theme-variant, must flip via the cascade); `ThemeProvider` writes only theme-*invariant* brand/accent vars inline so it never clobbers the `[data-theme]` flip.

**Tech Stack:** React 19 + TypeScript, Vite 7, Tailwind CSS v4 (`@tailwindcss/vite`, `@theme inline`), Vitest 3 + Testing Library + jsdom, lucide-react icons.

## Global Constraints

- **No new runtime dependency** and **no foreign CSS import** — DuBois is re-implemented in the existing seam, not imported. (spec: Non-goals, Architecture)
- **Never hardcode brand values in components** — all customization flows through `brand.config.json` → CSS vars → Tailwind. (AGENTS.md invariant)
- **Light is the default theme.** `:root` = DuBois *light* values; `[data-theme="dark"]` = DuBois *dark* values. This inverts DuBois's own shipping order. (spec Decision 3)
- **Accent replaces DuBois's monochrome `n12` primary-fill role ONLY** (primary buttons, active nav, focus rings, key highlights). All other chrome stays monochrome. (spec Decision 1, "Key departure")
- **`--overlay` and the neutral ramp are CSS-only / theme-variant** — do not write them as inline styles from JS (an inline value would override the `[data-theme="dark"]` rule and break the flip). Ship `--overlay` as a var, default fixed. (spec Open Question 2)
- **Back-compat:** retain the existing `--brand-*` vars and `brandToCssVars` color keys through the transition so the ~33 already-migrated `brand-*` Tailwind utilities keep resolving. Phase 4 removes the dead ones.
- Type: body 12px/18px, titles 14–16px, weights never above 500; radii derive from one `--radius` base. (spec Reference)
- `cd frontend && npm run build` (`tsc -b && vite build`) and `npm test` (`vitest run`) must be green after every task.
- Commits end with a `Co-authored-by: Isaac` trailer; never `--no-verify`.

**DuBois values (verbatim, from Design project `78fa3cd3-…` `colors_and_type.css`) — the plan below is the source of truth; reproduced here so tasks are self-contained.**

Light (→ our `:root`):
```
--n0:#FFFFFF; --n1:#F8F7F6; --n2:#F0EFEE; --n3:#E6E5E3; --n4:#D9D8D6;
--n5:#C5C4C2; --n6:#A1A09E; --n7:#797876; --n8:#5D5C5A; --n9:#47464A;
--n10:#313034; --n11:#1F1E22; --n12:#0F0E12;
--danger:#D04040; --warning:#B8892E; --success:#28A745;
--danger-fg:#C03020; --warning-fg:#9A6D00; --success-fg:#1A9035;
--overlay: 14,14,18;
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.08);
--shadow-md: 0 2px 6px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.10);
--shadow-lg: 0 4px 12px rgba(0,0,0,0.06), 0 12px 40px rgba(0,0,0,0.14);
```
Dark (→ our `[data-theme="dark"]`):
```
--n0:#0A0A0B; --n1:#121214; --n2:#1A1A1C; --n3:#222224; --n4:#2C2C2E;
--n5:#393939; --n6:#4B4B4D; --n7:#69696B; --n8:#8A8A8C; --n9:#ABABAE;
--n10:#C7C7CA; --n11:#E0E0E3; --n12:#F1F1F4;
--danger:#C44040; --warning:#B8892E; --success:#30A050;
--danger-fg:#EB6B6B; --warning-fg:#E8B84A; --success-fg:#4CD964;
--overlay: 228,228,232;
--shadow-sm: 0 1px 3px rgba(0,0,0,0.20);
--shadow-md: 0 4px 12px rgba(0,0,0,0.30);
--shadow-lg: 0 8px 32px rgba(0,0,0,0.50);
```
Theme-invariant (both):
```
--viz1:#C44040; --viz2:#B8892E; --viz3:#358B57;  (light uses #358B57 for viz3; dark uses #358B57 too — keep #358B57)
--radius:0.5rem; --radius-sm:calc(var(--radius)*0.5); --radius-md:calc(var(--radius)*0.75);
--radius-lg:var(--radius); --radius-xl:calc(var(--radius)*1.5); --radius-full:9999px;
--font-mono:'JetBrains Mono','Fira Code',monospace;
--dur-instant:50ms; --dur-fast:100ms; --dur-normal:150ms;
```
Semantic aliases (both themes — reference the ramp, so defined once in `:root`):
```
--surface:var(--n1); --surface-2:var(--n2); --surface-3:var(--n3);
--fg:var(--n11); --fg-2:var(--n10); --fg-muted:var(--n9); --fg-subtle:var(--n8);
--fg-ghost:var(--n7); --fg-disabled:var(--n6);
--border:rgba(var(--overlay),0.08); --border-hover:rgba(var(--overlay),0.10); --border-emphasis:rgba(var(--overlay),0.12);
--fill-hover:rgba(var(--overlay),0.04); --fill-active:rgba(var(--overlay),0.08); --fill-press:rgba(var(--overlay),0.10); --fill-emphasis:rgba(var(--overlay),0.12);
```

---

## File Structure

**Modified:**
- `brand.config.json` (repo root) — add `colors.accent`/`accentFg`/`accentHover`; add `defaults.theme`. Keep all existing keys.
- `frontend/src/theme/brand.ts` — extend `Brand` interface; add `accentVars(b)` (theme-invariant accent vars only) alongside existing `brandToCssVars`; export `DEFAULT_THEME`.
- `frontend/src/theme/ThemeProvider.tsx` — write accent vars (not the ramp/overlay); apply persisted `data-theme` on mount.
- `frontend/src/index.css` — rewrite into the three-layer token model; extend `@theme inline` for `surface-*`/`fg-*`/`accent*`/mono; set base body type + bg from tokens.
- `frontend/index.html` — add JetBrains Mono to the Google Fonts link.

**Created:**
- `frontend/src/theme/useTheme.ts` — `useTheme()` hook: `{ theme, setTheme, toggleTheme }`, localStorage-persisted, applies `data-theme`.
- `frontend/src/theme/ThemeToggle.tsx` — the top-bar toggle control (lucide Sun/Moon), uses `useTheme`.
- `frontend/src/theme/useTheme.test.ts` — hook behavior tests.
- `frontend/src/theme/ThemeToggle.test.tsx` — toggle render/interaction tests.
- (extend) `frontend/src/theme/brand.test.ts` — cover the new accent vars.

**Placement of the toggle:** `frontend/src/components/Header.tsx` renders it in the top bar, left of the user Popover.

---

### Task 1: Extend `brand.config.json` + `brand.ts` with accent + theme default

**Files:**
- Modify: `brand.config.json`
- Modify: `frontend/src/theme/brand.ts`
- Test: `frontend/src/theme/brand.test.ts`

**Interfaces:**
- Consumes: existing `brand` (`@brand` alias → repo-root `brand.config.json`), `brandToCssVars(b: Brand)`.
- Produces:
  - `Brand.colors` gains `accent: string; accentFg: string; accentHover: string;`
  - `Brand.defaults?: { theme: "light" | "dark" }`
  - `export type Theme = "light" | "dark"`
  - `export const DEFAULT_THEME: Theme` (from `brand.defaults?.theme ?? "light"`)
  - `export function accentVars(b: Brand): Record<string,string>` → `{ "--accent", "--accent-fg", "--accent-hover" }` only.
  - `brandToCssVars` UNCHANGED in signature/behavior (still emits all `--brand-*` + `--brand-font-sans`).

- [ ] **Step 1: Add keys to `brand.config.json`.** Under `colors`, add after `border`:
```json
    "accent": "#4f46e5",
    "accentFg": "#ffffff",
    "accentHover": "#4338ca"
```
And add a sibling top-level block after `typography`:
```json
  "defaults": { "theme": "light" }
```
(Accent defaults to the current indigo primary so nothing visibly changes yet. Note: the existing `colors.accent`/`accentDark` keys are the *legacy sidebar* accent — leave them; the NEW `accent`/`accentFg`/`accentHover` are the DuBois primary-fill role. They coexist through the transition; Phase 4 reconciles.)

- [ ] **Step 2: Write the failing test** — append to `frontend/src/theme/brand.test.ts`:
```ts
import { accentVars, DEFAULT_THEME } from "./brand";

describe("accentVars", () => {
  it("emits exactly the three accent vars from config", () => {
    const vars = accentVars(brand);
    expect(vars["--accent"]).toBe(brand.colors.accent);
    expect(vars["--accent-fg"]).toBe(brand.colors.accentFg);
    expect(vars["--accent-hover"]).toBe(brand.colors.accentHover);
    expect(Object.keys(vars).sort()).toEqual(["--accent", "--accent-fg", "--accent-hover"]);
  });

  it("does NOT emit the neutral ramp or overlay (CSS-only, theme-variant)", () => {
    const vars = accentVars(brand);
    expect(vars["--n1"]).toBeUndefined();
    expect(vars["--overlay"]).toBeUndefined();
  });
});

describe("DEFAULT_THEME", () => {
  it("is light by default", () => {
    expect(DEFAULT_THEME).toBe("light");
  });
});
```

- [ ] **Step 3: Run test to verify it fails.** Run: `cd frontend && npx vitest run src/theme/brand.test.ts`
Expected: FAIL — `accentVars`/`DEFAULT_THEME` not exported.

- [ ] **Step 4: Implement in `frontend/src/theme/brand.ts`.** Extend the `Brand` interface `colors` block with the three new fields and add `defaults`:
```ts
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    accent: string;        // now the DuBois primary-fill role
    accentDark: string;
    accentFg: string;
    accentHover: string;
    sidebarFrom: string;
    sidebarVia: string;
    sidebarTo: string;
    bg: string;
    border: string;
  };
  typography: { fontSans: string };
  defaults?: { theme: Theme };
```
Add above `export const brand`:
```ts
export type Theme = "light" | "dark";
```
Add after `brand`:
```ts
export const DEFAULT_THEME: Theme = brand.defaults?.theme ?? "light";

/** Theme-INVARIANT accent vars written at runtime by ThemeProvider.
 *  The neutral ramp + --overlay are theme-variant and stay CSS-only. */
export function accentVars(b: Brand): Record<string, string> {
  return {
    "--accent": b.colors.accent,
    "--accent-fg": b.colors.accentFg,
    "--accent-hover": b.colors.accentHover,
  };
}
```
(Leave `brandToCssVars` exactly as-is. Its `Object.entries(b.colors)` loop now also emits `--brand-accent-fg`/`--brand-accent-hover` harmlessly — the count assertion in the existing test uses `Object.keys(brand.colors).length` so it self-adjusts.)

- [ ] **Step 5: Run tests to verify pass.** Run: `cd frontend && npx vitest run src/theme/brand.test.ts`
Expected: PASS (all brand tests, old + new).

- [ ] **Step 6: Commit.**
```bash
git add brand.config.json frontend/src/theme/brand.ts frontend/src/theme/brand.test.ts
git commit -m "feat(theme): add accent role + theme default to brand config

Co-authored-by: Isaac"
```

---

### Task 2: Rewrite `index.css` into the three-layer DuBois token model

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: nothing new (pure CSS).
- Produces: CSS custom properties available app-wide — the neutral ramp `--n0…--n12`, `--overlay`, state colors, `--viz1/2/3`, `--radius*`, `--font-sans`/`--font-mono`, `--dur-*`, semantic aliases `--surface*`/`--fg*`/`--border*`/`--fill-*`, and Layer-3 `--accent*` (with fallbacks). Tailwind utilities: existing `brand-*` (unchanged) PLUS new `surface`/`surface-2`/`surface-3`, `fg`/`fg-2`/`fg-muted`/`fg-subtle`/`fg-ghost`/`fg-disabled`, `accent`/`accent-fg`/`accent-hover`, `border`/`border-hover`/`border-emphasis`, and `font-mono`.

- [ ] **Step 1: Rewrite `frontend/src/index.css`.** Replace the whole file with:
```css
@import "tailwindcss";

/* ============================================================================
   APEX tokens — DuBois design system ported into the existing brand seam.
   LIGHT IS DEFAULT: :root = DuBois light values, [data-theme="dark"] = dark.
   (Inverts DuBois's own dark-first order — see the adoption spec.)
   Layer 1: DuBois primitives · Layer 2: semantic aliases · Layer 3: accent seam.
   ============================================================================ */

/* ── Layer 1 — DuBois primitives (LIGHT default) ─────────────────────────── */
:root {
  /* Neutral ramp */
  --n0:#FFFFFF; --n1:#F8F7F6; --n2:#F0EFEE; --n3:#E6E5E3; --n4:#D9D8D6;
  --n5:#C5C4C2; --n6:#A1A09E; --n7:#797876; --n8:#5D5C5A; --n9:#47464A;
  --n10:#313034; --n11:#1F1E22; --n12:#0F0E12;

  /* State (the only chrome color) */
  --danger:#D04040; --warning:#B8892E; --success:#28A745;
  --danger-fg:#C03020; --warning-fg:#9A6D00; --success-fg:#1A9035;

  /* Data-viz (charts only) */
  --viz1:#C44040; --viz2:#B8892E; --viz3:#358B57;

  /* Overlay system — RGB triple, flips per theme; 4 opacities only. THEME-VARIANT. */
  --overlay: 14,14,18;

  /* Elevation */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 2px 6px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.10);
  --shadow-lg: 0 4px 12px rgba(0,0,0,0.06), 0 12px 40px rgba(0,0,0,0.14);

  /* Radius — one base, derive via calc() */
  --radius:0.5rem;
  --radius-sm:calc(var(--radius)*0.5);
  --radius-md:calc(var(--radius)*0.75);
  --radius-lg:var(--radius);
  --radius-xl:calc(var(--radius)*1.5);
  --radius-full:9999px;

  /* Motion */
  --dur-instant:50ms; --dur-fast:100ms; --dur-normal:150ms;

  /* Fonts — sans still driven by brand.config.json via --brand-font-sans */
  --brand-font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", ui-monospace, monospace;

  /* ── Layer 2 — semantic aliases (reference the ramp; theme-invariant defs) ── */
  --surface:var(--n1); --surface-2:var(--n2); --surface-3:var(--n3);
  --fg:var(--n11); --fg-2:var(--n10); --fg-muted:var(--n9); --fg-subtle:var(--n8);
  --fg-ghost:var(--n7); --fg-disabled:var(--n6);
  --border:rgba(var(--overlay),0.08);
  --border-hover:rgba(var(--overlay),0.10);
  --border-emphasis:rgba(var(--overlay),0.12);
  --fill-hover:rgba(var(--overlay),0.04);
  --fill-active:rgba(var(--overlay),0.08);
  --fill-press:rgba(var(--overlay),0.10);
  --fill-emphasis:rgba(var(--overlay),0.12);

  /* ── Layer 3 — customizable accent seam (ThemeProvider overwrites at runtime) ── */
  --accent:#4f46e5;
  --accent-fg:#ffffff;
  --accent-hover:#4338ca;

  /* ── Legacy brand vars (retained for the ~33 already-migrated utilities;
        Phase 4 reconciles). ThemeProvider still overwrites these too. ────────── */
  --brand-primary:#4f46e5;
  --brand-primary-dark:#3730a3;
  --brand-primary-light:#e0e7ff;
  --brand-accent:#6366f1;
  --brand-accent-dark:#4f46e5;
  --brand-sidebar-from:#211d52;
  --brand-sidebar-via:#2d2a6e;
  --brand-sidebar-to:#16142e;
  --brand-bg:#f8fafc;
  --brand-border:#e2e8f0;
}

/* ── Layer 1 — DuBois primitives (DARK override) ─────────────────────────── */
[data-theme="dark"] {
  --n0:#0A0A0B; --n1:#121214; --n2:#1A1A1C; --n3:#222224; --n4:#2C2C2E;
  --n5:#393939; --n6:#4B4B4D; --n7:#69696B; --n8:#8A8A8C; --n9:#ABABAE;
  --n10:#C7C7CA; --n11:#E0E0E3; --n12:#F1F1F4;

  --danger:#C44040; --warning:#B8892E; --success:#30A050;
  --danger-fg:#EB6B6B; --warning-fg:#E8B84A; --success-fg:#4CD964;

  --overlay: 228,228,232;

  --shadow-sm: 0 1px 3px rgba(0,0,0,0.20);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.30);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.50);
}

/* ── Tailwind namespace mapping — existing brand-* PLUS new token utilities.
   `inline` = utilities carry var() so they resolve at the element (per-tenant
   scoping stays possible). Fallbacks guard color-mix. ─────────────────────── */
@theme inline {
  /* existing brand-* (unchanged) */
  --color-brand-primary: var(--brand-primary, #4f46e5);
  --color-brand-primary-dark: var(--brand-primary-dark, #3730a3);
  --color-brand-primary-light: var(--brand-primary-light, #e0e7ff);
  --color-brand-accent: var(--brand-accent, #6366f1);
  --color-brand-accent-dark: var(--brand-accent-dark, #4f46e5);
  --color-brand-sidebar-from: var(--brand-sidebar-from, #211d52);
  --color-brand-sidebar-via: var(--brand-sidebar-via, #2d2a6e);
  --color-brand-sidebar-to: var(--brand-sidebar-to, #16142e);
  --color-brand-bg: var(--brand-bg, #f8fafc);
  --color-brand-border: var(--brand-border, #e2e8f0);

  /* new DuBois surface/fg/border tokens */
  --color-surface: var(--surface, #F8F7F6);
  --color-surface-2: var(--surface-2, #F0EFEE);
  --color-surface-3: var(--surface-3, #E6E5E3);
  --color-fg: var(--fg, #1F1E22);
  --color-fg-2: var(--fg-2, #313034);
  --color-fg-muted: var(--fg-muted, #47464A);
  --color-fg-subtle: var(--fg-subtle, #5D5C5A);
  --color-fg-ghost: var(--fg-ghost, #797876);
  --color-fg-disabled: var(--fg-disabled, #A1A09E);
  --color-border: var(--border, rgba(14,14,18,0.08));
  --color-border-hover: var(--border-hover, rgba(14,14,18,0.10));
  --color-border-emphasis: var(--border-emphasis, rgba(14,14,18,0.12));

  /* accent seam */
  --color-accent: var(--accent, #4f46e5);
  --color-accent-fg: var(--accent-fg, #ffffff);
  --color-accent-hover: var(--accent-hover, #4338ca);

  /* radii + fonts */
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-xl: var(--radius-xl);
  --font-sans: var(--brand-font-sans, "Inter", system-ui, sans-serif);
  --font-mono: var(--font-mono, "JetBrains Mono", monospace);
}

html, body, #root {
  height: 100%;
  margin: 0;
}

/* DuBois root defaults — 12/18 body on the page surface. Existing components
   still set their own colors; this only affects unstyled/base text. */
body {
  font-family: var(--brand-font-sans);
  font-size: 12px;
  line-height: 18px;
  color: var(--fg);
  background: var(--surface);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 2: Verify the build compiles the CSS.** Run: `cd frontend && npm run build`
Expected: PASS — `tsc -b` clean, `vite build` emits `../static` with no Tailwind/CSS errors.

- [ ] **Step 3: Verify existing tests still pass** (CSS-affecting component tests must not regress). Run: `cd frontend && npm test`
Expected: PASS — full suite green (Sidebar, AccessGrid, AssetEditor, etc. unaffected because `brand-*` utilities still resolve).

- [ ] **Step 4: Commit.**
```bash
git add frontend/src/index.css
git commit -m "feat(theme): three-layer DuBois token model in index.css

Light-default :root + dark override, neutral ramp, semantic aliases,
accent seam, and Tailwind surface/fg/accent utilities. Legacy brand-*
vars retained for the transition.

Co-authored-by: Isaac"
```

---

### Task 3: `useTheme` hook (localStorage-persisted, applies `data-theme`)

**Files:**
- Create: `frontend/src/theme/useTheme.ts`
- Test: `frontend/src/theme/useTheme.test.ts`

**Interfaces:**
- Consumes: `Theme`, `DEFAULT_THEME` from `./brand`.
- Produces:
  - `const THEME_STORAGE_KEY = "apex-theme"` (exported).
  - `function applyTheme(theme: Theme): void` (exported) — sets/removes `data-theme` on `document.documentElement` (light = attribute ABSENT, since `:root` IS light; dark = `data-theme="dark"`).
  - `function readStoredTheme(): Theme` (exported) — localStorage value if valid, else `DEFAULT_THEME`.
  - `function useTheme(): { theme: Theme; setTheme(t: Theme): void; toggleTheme(): void }` (default-relevant export).

- [ ] **Step 1: Write the failing test** — `frontend/src/theme/useTheme.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme, applyTheme, readStoredTheme, THEME_STORAGE_KEY } from "./useTheme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("applyTheme", () => {
  it("sets data-theme=dark for dark", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
  it("removes the attribute for light (root IS light)", () => {
    applyTheme("dark");
    applyTheme("light");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});

describe("readStoredTheme", () => {
  it("defaults to light when nothing stored", () => {
    expect(readStoredTheme()).toBe("light");
  });
  it("returns a valid stored value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(readStoredTheme()).toBe("dark");
  });
  it("ignores a garbage stored value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "banana");
    expect(readStoredTheme()).toBe("light");
  });
});

describe("useTheme", () => {
  it("toggles light <-> dark, persists, and applies the attribute", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("setTheme sets a specific theme", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("dark"));
    expect(result.current.theme).toBe("dark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails.** Run: `cd frontend && npx vitest run src/theme/useTheme.test.ts`
Expected: FAIL — module `./useTheme` not found.

- [ ] **Step 3: Implement `frontend/src/theme/useTheme.ts`:**
```ts
import { useCallback, useState } from "react";
import { DEFAULT_THEME, type Theme } from "./brand";

export const THEME_STORAGE_KEY = "apex-theme";

/** Root :root IS the light theme, so light = no attribute, dark = data-theme="dark". */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
}

export function readStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : DEFAULT_THEME;
}

export function useTheme(): {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
} {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(THEME_STORAGE_KEY, t);
    applyTheme(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
```

- [ ] **Step 4: Run test to verify it passes.** Run: `cd frontend && npx vitest run src/theme/useTheme.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add frontend/src/theme/useTheme.ts frontend/src/theme/useTheme.test.ts
git commit -m "feat(theme): useTheme hook with localStorage persistence

Co-authored-by: Isaac"
```

---

### Task 4: `ThemeProvider` writes accent vars + applies persisted theme on mount

**Files:**
- Modify: `frontend/src/theme/ThemeProvider.tsx`
- Test: (covered indirectly by useTheme + a focused assertion below; add to `frontend/src/theme/brand.test.ts` is not appropriate — write a small ThemeProvider test)
- Test: Create `frontend/src/theme/ThemeProvider.test.tsx`

**Interfaces:**
- Consumes: `brand`, `brandToCssVars`, `accentVars` from `./brand`; `readStoredTheme`, `applyTheme` from `./useTheme`.
- Produces: same `ThemeProvider` component (children passthrough). On mount it (a) writes all `brandToCssVars(brand)` + `accentVars(brand)` onto `document.documentElement` inline, and (b) calls `applyTheme(readStoredTheme())`. It MUST NOT write `--overlay` or any `--n*` (those are theme-variant, CSS-only).

- [ ] **Step 1: Write the failing test** — `frontend/src/theme/ThemeProvider.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { ThemeProvider } from "./ThemeProvider";

beforeEach(() => {
  localStorage.clear();
  const root = document.documentElement;
  root.removeAttribute("data-theme");
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

  it("applies the stored dark theme on mount", () => {
    localStorage.setItem("apex-theme", "dark");
    render(<ThemeProvider>x</ThemeProvider>);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("defaults to light (no data-theme attribute) when nothing stored", () => {
    render(<ThemeProvider>x</ThemeProvider>);
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.** Run: `cd frontend && npx vitest run src/theme/ThemeProvider.test.tsx`
Expected: FAIL — provider doesn't write `--accent` / apply stored theme yet.

- [ ] **Step 3: Update `frontend/src/theme/ThemeProvider.tsx`:**
```tsx
import { useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { brand, brandToCssVars, accentVars } from "./brand";
import { readStoredTheme, applyTheme } from "./useTheme";

/**
 * Applies brand.config.json to the document at runtime as CSS custom
 * properties, and applies the persisted light/dark theme.
 *
 * IMPORTANT: only THEME-INVARIANT vars are written inline here (brand-* +
 * accent). The neutral ramp and --overlay are theme-variant and live in
 * index.css so the [data-theme="dark"] cascade can flip them; writing them
 * inline would override that rule and break dark mode.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const vars = { ...brandToCssVars(brand), ...accentVars(brand) };
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    applyTheme(readStoredTheme());
    document.title = brand.identity.appName;
  }, []);

  return <>{children}</>;
}
```

- [ ] **Step 4: Run test to verify it passes.** Run: `cd frontend && npx vitest run src/theme/ThemeProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + build.** Run: `cd frontend && npm test && npm run build`
Expected: PASS both.

- [ ] **Step 6: Commit.**
```bash
git add frontend/src/theme/ThemeProvider.tsx frontend/src/theme/ThemeProvider.test.tsx
git commit -m "feat(theme): ThemeProvider writes accent vars + applies persisted theme

Co-authored-by: Isaac"
```

---

### Task 5: `ThemeToggle` control + mount in Header

**Files:**
- Create: `frontend/src/theme/ThemeToggle.tsx`
- Modify: `frontend/src/components/Header.tsx`
- Test: `frontend/src/theme/ThemeToggle.test.tsx`

**Interfaces:**
- Consumes: `useTheme` from `./useTheme`; lucide `Sun`, `Moon`.
- Produces: `export default function ThemeToggle()` — a 24px icon button. Shows `Moon` when light (click → dark), `Sun` when dark (click → light). `aria-label` reflects the action ("Switch to dark theme" / "Switch to light theme"). `title` mirrors it.

- [ ] **Step 1: Write the failing test** — `frontend/src/theme/ThemeToggle.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ThemeToggle from "./ThemeToggle";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  it("renders a light-mode button that switches to dark", async () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /switch to dark theme/i });
    await userEvent.click(btn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    // label now offers the reverse action
    expect(screen.getByRole("button", { name: /switch to light theme/i })).toBeInTheDocument();
  });
});
```
(If `@testing-library/user-event` is not already a dep, use `fireEvent.click` from `@testing-library/react` instead — check `package.json` first; the repo already uses Testing Library. Prefer whichever is present.)

- [ ] **Step 2: Run test to verify it fails.** Run: `cd frontend && npx vitest run src/theme/ThemeToggle.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `frontend/src/theme/ThemeToggle.tsx`:**
```tsx
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./useTheme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const toDark = theme === "light";
  const label = toDark ? "Switch to dark theme" : "Switch to light theme";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="grid place-items-center h-6 w-6 rounded-sm text-fg-ghost hover:bg-[var(--fill-hover)] hover:text-fg-muted transition-colors"
    >
      {toDark ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes.** Run: `cd frontend && npx vitest run src/theme/ThemeToggle.test.tsx`
Expected: PASS.

- [ ] **Step 5: Mount in `frontend/src/components/Header.tsx`.** Add the import at the top:
```tsx
import ThemeToggle from "@/theme/ThemeToggle";
```
Wrap the user Popover so the toggle sits to its left. Replace the `{/* User menu */}` line and its `<Popover>` opening by grouping them:
```tsx
      {/* Right cluster: theme toggle + user menu */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Popover>
```
and add the matching closing `</div>` immediately after the `</Popover>` that closes the user menu. (The existing Popover block is unchanged in content — only wrapped.)

- [ ] **Step 6: Full suite + build.** Run: `cd frontend && npm test && npm run build`
Expected: PASS both.

- [ ] **Step 7: Commit.**
```bash
git add frontend/src/theme/ThemeToggle.tsx frontend/src/theme/ThemeToggle.test.tsx frontend/src/components/Header.tsx
git commit -m "feat(theme): light/dark toggle in the top bar

Co-authored-by: Isaac"
```

---

### Task 6: Load JetBrains Mono

**Files:**
- Modify: `frontend/index.html`

**Interfaces:**
- Consumes: nothing. Produces: `JetBrains Mono` available to `--font-mono` (the token added in Task 2 references it; this makes the webfont actually load).

- [ ] **Step 1: Update the Google Fonts link in `frontend/index.html`.** Replace line 10 with a combined request:
```html
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Verify build.** Run: `cd frontend && npm run build`
Expected: PASS (index.html is copied; no compile step, but confirm no breakage).

- [ ] **Step 3: Commit.**
```bash
git add frontend/index.html
git commit -m "feat(theme): load JetBrains Mono webfont for --font-mono

Co-authored-by: Isaac"
```

---

### Task 7: Phase-0 verification checkpoint (no code — gate before Phase 1)

**Files:** none (verification only).

- [ ] **Step 1: Full green.** Run: `cd frontend && npm test && npm run build`
Expected: entire Vitest suite PASS; build PASS.

- [ ] **Step 2: Grep for accidental hardcoding / leakage.** Run:
```bash
cd frontend && grep -rn "data-theme" src/ | grep -v ".test." ; echo "--- overlay inline writes (should be NONE in TS) ---" ; grep -rn "setProperty(\"--overlay\"\|setProperty('--overlay'\|setProperty(\"--n" src/
```
Expected: `data-theme` referenced only in `useTheme.ts` (and its test); ZERO inline `--overlay`/`--n*` writes.

- [ ] **Step 3: Manual visual check (controller, Chrome MCP).** Start dev server, load the app as a normal user in BOTH themes:
  - Light default renders (indistinguishable from today — accent = current indigo, chrome now neutral-ramp-backed).
  - Click the top-bar toggle → dark: page bg → `--n1` dark, text legible (`--fg`), no white flashes on the shell, no console errors.
  - Reload in dark → persists (localStorage). Toggle back → light persists.
  - Capture screenshots (light + dark) to `/tmp/apex-phase0-{light,dark}.png`.

- [ ] **Step 4: Update the SDD ledger / memory** with Phase 0 outcome and any deferrals; do NOT push (Rohit's standing preference: push to branch on his say-so).

---

## Self-Review

**Spec coverage:**
- Decision 1 (accent + tunable neutrals) → Tasks 1, 2, 4 (accent seam; `--overlay` shipped-but-fixed per Open Q2). ✅
- Decision 2 (whole-app phased) → this is Phase 0; later phases are separate plans. ✅
- Decision 3 (light default, dark toggle, inverted `:root`) → Task 2 (`:root`=light), Tasks 3–5 (toggle). ✅
- Approach A (existing seam, no dep/import) → all tasks; Global Constraints enforce. ✅
- Three-layer token model → Task 2. ✅
- `brand.config.json`/`brand.ts` changes → Task 1. ✅
- `ThemeProvider` gains accent write + `data-theme` apply → Task 4. ✅
- `useTheme` + toggle in top bar → Tasks 3, 5. ✅
- JetBrains Mono → Task 6. ✅
- "app still renders, utilities resolve to DuBois defaults" → Task 2 keeps legacy `brand-*`, Task 7 verifies. ✅
- Verification: build + Jest(Vitest) green each phase → every task ends with test/build; Task 7 checkpoint. ✅

**Placeholder scan:** No TBD/TODO; every code step has full content. The only conditional is Task 5 Step 1's user-event-vs-fireEvent note, which gives a concrete fallback. ✅

**Type consistency:** `Theme`, `DEFAULT_THEME`, `accentVars`, `applyTheme`/`readStoredTheme`/`THEME_STORAGE_KEY`, `useTheme` return shape are defined in Tasks 1/3 and consumed consistently in Tasks 3/4/5. `brandToCssVars` signature unchanged. ✅

## Execution Handoff

(see chat)
