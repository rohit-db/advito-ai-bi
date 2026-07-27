# PR1 — Theming Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all brand identity (colors, app name, logo, fonts) into a single repo-root `brand.config.json`, consumed by both the React app (runtime CSS vars via a ThemeProvider + Tailwind v4 `@theme inline`) and the Python login page, so rebranding is one file edit + a logo swap + rebuild.

**Architecture:** Two-layer token indirection. Raw `--brand-*` CSS custom properties carry real default values on `:root` (branded first paint, no FOUC); a `ThemeProvider` overwrites them at runtime from `brand.config.json` (making theming runtime-swappable for future per-tenant branding); a `@theme inline` block maps Tailwind's `--color-brand-*` namespace onto the raw vars so utilities like `bg-brand-primary` resolve at the element. The Python side reads the same JSON through a small fail-soft loader. All ~34 frontend files migrate off hardcoded `indigo`/`violet`/hex literals onto semantic `brand-*` utilities; structural `slate/white/black` grays stay.

**Tech Stack:** React 19 + Vite 7 + Tailwind CSS v4.1 (CSS-first, no config file) + FastAPI + pytest 8.4.

## Global Constraints

- **Add Vitest as a dev dependency.** The repo currently has no JS test runner; a flagship reference repo should model good practice, so we add **Vitest** (Vite-native, minimal config) and unit-test the *pure logic* (`brandToCssVars`, `BrandLogo` fallback). The bulk color-migration sweep (Tasks 9–11) is verified by `tsc -b && vite build` clean + grep-clean assertions + a manual rebrand-swap check — unit tests don't fit a find-and-replace. (Reasonable dependency addition, per user guidance; spec Section E's "no new deps" is not treated as dogma.)
- **Fail soft, always.** The Python brand loader must return built-in defaults if `brand.config.json` is missing/unreadable — never raise. (AGENTS.md invariant.)
- **Branded first paint.** Raw `--brand-*` vars in `:root` must hold real default hex values so first paint is correct before JS runs. `color-mix()` opacity utilities and `from-*`-only gradients silently drop if a brand var is unset — always ship defaults. (Research R3 gotcha.)
- **`@theme inline` (not plain `@theme`).** Required so utilities resolve the var at the element, enabling future scoped/per-tenant overrides. (Research R3.)
- **Default brand = "APEX", Advito neutralized.** Ship `appName: "APEX"`; remove customer-specific strings ("Advito Practice Exchange", "Advito (All)"). Keep "APEX" as the generic product name. (Spec decision.)
- **Semantic token names only** in config (describe role, not color): `primary`, `sidebarFrom`, etc. — never `indigo`.
- **Structural grays stay.** Do NOT migrate `slate-*`, `white`, `black`, `emerald`/`rose`/`amber` status colors, or the genie `fuchsia` accent-as-data to brand tokens. Only migrate brand `indigo`/`violet`/`purple` and the brand hex literals.
- **Commit after each task.** Conventional-commit messages, end with the repo's `Co-authored-by: Isaac` trailer.

### Canonical color mapping (used by all migration tasks)

Every migration task applies exactly this table. `N` = any Tailwind shade step.

| Current (hardcoded) | Replace with (semantic) |
|---|---|
| `indigo-600`, `indigo-700` (solid brand action) | `brand-primary` |
| `indigo-800`, `indigo-900` (darker brand) | `brand-primary-dark` |
| `indigo-50`, `indigo-100`, `indigo-200` (light brand tint) | `brand-primary-light` |
| `indigo-400`, `indigo-500` (accent) | `brand-accent` |
| `violet-500`, `violet-600` (gradient partner) | `brand-accent` |
| `bg-gradient-to-*` | `bg-linear-to-*` (v4 rename) |
| `from-[#211d52]` | `from-brand-sidebar-from` |
| `via-[#2d2a6e]`, `via-apex-sidebar` | `via-brand-sidebar-via` |
| `to-[#16142e]`, `to-[#4f46e5]` (hero) | `to-brand-sidebar-to` / `to-brand-primary` |
| `from-indigo-500 to-violet-600` (avatar) | `from-brand-primary to-brand-accent` |
| `accent="#6366f1"` (SVG/inline hex) | `accent="var(--brand-accent)"` |
| opacity forms `indigo-500/40`, `indigo-200/80` | `brand-primary/40`, `brand-primary-light/80` (keep the `/NN`) |
| `shadow-indigo-900/20` | `shadow-brand-primary-dark/20` |

Keep as-is (do NOT change): `slate-*`, `white`, `black`, `emerald-*`, `rose-*`, `amber-*`, `sky-*`, `teal-*`, `cyan-*`, `pink-*`, and `fuchsia-*` where it encodes a data/feature accent in the genie components (leave genie fuchsia unless it is part of a brand gradient paired with indigo — then map the indigo half only).

---

## File structure

**Create:**
- `brand.config.json` (repo root) — single source of truth.
- `frontend/src/theme/brand.ts` — imports the JSON, exports typed `Brand` + a `brandToCssVars(brand)` flattener.
- `frontend/src/theme/ThemeProvider.tsx` — applies CSS vars at runtime; renders children.
- `frontend/src/components/BrandLogo.tsx` — `<img>` with `shortName` monogram fallback.
- `server/brand.py` — fail-soft loader returning a brand dict for the Python side.
- `frontend/public/brand/README.md` — documents swap-in-place asset filenames.
- `docs/customizing.md` — the "Change X → edit Y" rebrand guide.
- `tests/test_brand.py` — pytest for the Python loader.

**Modify:**
- `frontend/src/index.css` — two-layer `@theme inline` + `:root` defaults.
- `frontend/src/main.tsx` — wrap `<App/>` in `<ThemeProvider>`.
- `frontend/vite.config.ts` — `@brand` alias + `server.fs.allow` for repo root.
- `frontend/index.html` — title/favicon (build-time from brand).
- `app.py:6` — `FastAPI(title=...)` from brand.
- `server/auth/login.py` — read shared brand; drop duplicated palette/strings.
- `frontend/src/components/Sidebar.tsx` — use `BrandLogo`, brand tokens, brand text.
- ~33 frontend `.tsx`/`.ts` files — color-literal + brand-string sweep (batched by tier).
- `AGENTS.md` — add the "Change X → edit Y" map.

---

## Task 1: Create `brand.config.json` (single source of truth)

**Files:**
- Create: `brand.config.json` (repo root)

**Interfaces:**
- Produces: the canonical brand document. Shape consumed by Task 2 (`Brand` type), Task 5 (`server/brand.py`), Task 6 (`login.py`).

- [ ] **Step 1: Write the file**

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
    "primary": "#4f46e5",
    "primaryDark": "#3730a3",
    "primaryLight": "#e0e7ff",
    "accent": "#6366f1",
    "sidebarFrom": "#211d52",
    "sidebarVia": "#2d2a6e",
    "sidebarTo": "#16142e",
    "bg": "#f8fafc",
    "border": "#e2e8f0"
  },
  "typography": {
    "fontSans": "Inter, system-ui, -apple-system, sans-serif"
  }
}
```

- [ ] **Step 2: Validate JSON**

Run: `python -c "import json; json.load(open('brand.config.json')); print('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add brand.config.json
git commit -m "feat(theming): add brand.config.json single source of truth

Co-authored-by: Isaac"
```

---

## Task 1.5: Set up Vitest (frontend test runner)

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Create: `frontend/vitest.setup.ts`

**Interfaces:**
- Produces: a working `npm test` (Vitest, jsdom env, RTL) that later tasks add `*.test.ts(x)` files to.

- [ ] **Step 1: Install dev dependencies**

Run: `cd frontend && npm install -D vitest@^2 jsdom @testing-library/react @testing-library/jest-dom @testing-library/dom`
Expected: installs succeed; `package.json` devDependencies updated.

- [ ] **Step 2: Add the `test` script**

In `frontend/package.json` `scripts`, add: `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 3: Configure Vitest in `vite.config.ts`**

Add a `test` block to the Vite config (Vitest reads the same file). Add `/// <reference types="vitest/config" />` at the top, and:

```ts
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: true,
  },
```

- [ ] **Step 4: Create the setup file**

`frontend/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Add a smoke test to verify the runner works**

Create `frontend/src/theme/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run tests**

Run: `cd frontend && npm test`
Expected: 1 passed. Then delete the smoke test (`rm frontend/src/theme/smoke.test.ts`) — Task 2 adds the real one.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/vitest.setup.ts
git commit -m "test(frontend): add Vitest runner (jsdom + RTL)

Co-authored-by: Isaac"
```

---

## Task 2: Frontend brand module (typed import + CSS-var flattener)

**Files:**
- Create: `frontend/src/theme/brand.ts`
- Create: `frontend/src/theme/brand.test.ts`
- Modify: `frontend/vite.config.ts`

**Interfaces:**
- Consumes: `brand.config.json` (Task 1).
- Produces:
  - `export interface Brand { identity: {...}; colors: {...}; typography: {...} }`
  - `export const brand: Brand`
  - `export function brandToCssVars(b: Brand): Record<string, string>` — returns `{ "--brand-primary": "#4f46e5", "--brand-sidebar-from": "#211d52", "--brand-font-sans": "Inter, …", … }` (kebab-cased keys, one per color + font).

- [ ] **Step 1: Add the Vite alias + fs.allow**

In `frontend/vite.config.ts`, add to `resolve.alias`: `"@brand": path.resolve(__dirname, "../brand.config.json")`. Add a `server.fs` block so the dev server may read the repo-root file:

```ts
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@brand": path.resolve(__dirname, "../brand.config.json"),
    },
  },
  server: {
    fs: { allow: [path.resolve(__dirname, ".."), path.resolve(__dirname, ".")] },
    proxy: { "/api": "http://localhost:8000" },
  },
```

- [ ] **Step 2: Write `frontend/src/theme/brand.ts`**

```ts
import brandJson from "@brand";

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
    primary: string;
    primaryDark: string;
    primaryLight: string;
    accent: string;
    sidebarFrom: string;
    sidebarVia: string;
    sidebarTo: string;
    bg: string;
    border: string;
  };
  typography: { fontSans: string };
}

export const brand = brandJson as Brand;

const camelToKebab = (s: string) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

/** Flatten the brand doc into the raw `--brand-*` CSS custom properties. */
export function brandToCssVars(b: Brand): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(b.colors)) {
    vars[`--brand-${camelToKebab(key)}`] = value;
  }
  vars["--brand-font-sans"] = b.typography.fontSans;
  return vars;
}
```

- [ ] **Step 3: Add a JSON module ambient type if needed**

If `tsc` errors on `import brandJson from "@brand"`, add to `frontend/src/vite-env.d.ts`:

```ts
declare module "@brand" {
  const value: import("./theme/brand").Brand;
  export default value;
}
```

- [ ] **Step 4: Write the test for `brandToCssVars`**

Create `frontend/src/theme/brand.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { brand, brandToCssVars } from "./brand";

describe("brandToCssVars", () => {
  it("emits kebab-cased --brand-* keys for every color", () => {
    const vars = brandToCssVars(brand);
    expect(vars["--brand-primary"]).toBe(brand.colors.primary);
    expect(vars["--brand-sidebar-from"]).toBe(brand.colors.sidebarFrom);
    expect(vars["--brand-primary-dark"]).toBe(brand.colors.primaryDark);
  });

  it("includes the font token", () => {
    expect(brandToCssVars(brand)["--brand-font-sans"]).toBe(brand.typography.fontSans);
  });

  it("produces a var per color plus one font var", () => {
    const vars = brandToCssVars(brand);
    expect(Object.keys(vars).length).toBe(Object.keys(brand.colors).length + 1);
  });
});
```

- [ ] **Step 5: Run the test**

Run: `cd frontend && npm test`
Expected: `brand.test.ts` PASS (3 tests).

- [ ] **Step 6: Verify it type-checks and builds**

Run: `cd frontend && npm run build`
Expected: build succeeds (no TS errors about `@brand` or `brandToCssVars`).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/theme/brand.ts frontend/src/theme/brand.test.ts frontend/vite.config.ts frontend/src/vite-env.d.ts
git commit -m "feat(theming): typed brand module + CSS-var flattener

Co-authored-by: Isaac"
```

---

## Task 3: Refactor `index.css` to the two-layer `@theme inline` pattern

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:**
- Produces: raw `--brand-*` vars on `:root` (defaults) + `--color-brand-*` semantic tokens (via `@theme inline`) usable as `bg-brand-primary`, `from-brand-sidebar-from`, `font-sans`, etc.

- [ ] **Step 1: Replace the file contents**

```css
@import "tailwindcss";

/* Layer 1 — raw brand vars with DEFAULT values (branded first paint, no FOUC).
   ThemeProvider overwrites these on :root at runtime from brand.config.json. */
:root {
  --brand-primary: #4f46e5;
  --brand-primary-dark: #3730a3;
  --brand-primary-light: #e0e7ff;
  --brand-accent: #6366f1;
  --brand-sidebar-from: #211d52;
  --brand-sidebar-via: #2d2a6e;
  --brand-sidebar-to: #16142e;
  --brand-bg: #f8fafc;
  --brand-border: #e2e8f0;
  --brand-font-sans: "Inter", system-ui, -apple-system, sans-serif;
}

/* Layer 2 — map Tailwind's color/font namespace onto the raw vars.
   `inline` = utilities carry `var(--brand-*)` directly (resolve at the element),
   enabling future scoped / per-tenant overrides. Fallbacks guard color-mix. */
@theme inline {
  --color-brand-primary: var(--brand-primary, #4f46e5);
  --color-brand-primary-dark: var(--brand-primary-dark, #3730a3);
  --color-brand-primary-light: var(--brand-primary-light, #e0e7ff);
  --color-brand-accent: var(--brand-accent, #6366f1);
  --color-brand-sidebar-from: var(--brand-sidebar-from, #211d52);
  --color-brand-sidebar-via: var(--brand-sidebar-via, #2d2a6e);
  --color-brand-sidebar-to: var(--brand-sidebar-to, #16142e);
  --color-brand-bg: var(--brand-bg, #f8fafc);
  --color-brand-border: var(--brand-border, #e2e8f0);
  --font-sans: var(--brand-font-sans, "Inter", system-ui, sans-serif);
}

html, body, #root {
  height: 100%;
  margin: 0;
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: build succeeds. (Utilities `bg-brand-primary` etc. are now generated.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(theming): two-layer @theme inline brand tokens

Co-authored-by: Isaac"
```

---

## Task 4: ThemeProvider (runtime CSS-var application)

**Files:**
- Create: `frontend/src/theme/ThemeProvider.tsx`
- Modify: `frontend/src/main.tsx`

**Interfaces:**
- Consumes: `brand`, `brandToCssVars` (Task 2).
- Produces: `export function ThemeProvider({ children }: { children: React.ReactNode })` — sets `--brand-*` on `document.documentElement` before paint and sets `document.title`.

- [ ] **Step 1: Write `ThemeProvider.tsx`**

```tsx
import { useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { brand, brandToCssVars } from "./brand";

/**
 * Applies brand.config.json to the document at runtime as CSS custom
 * properties. Defaults already live in index.css :root (branded first paint);
 * this overwrites them, which is the seam a future per-tenant payload uses.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(brandToCssVars(brand))) {
      root.style.setProperty(key, value);
    }
    document.title = brand.identity.appName;
  }, []);

  return <>{children}</>;
}
```

- [ ] **Step 2: Wrap `<App/>` in `main.tsx`**

Modify `frontend/src/main.tsx` — import and nest the provider inside `BrowserRouter`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { ThemeProvider } from "./theme/ThemeProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke check**

Run backend (`python -m uvicorn app:app --port 8000`) + `cd frontend && npm run dev`; open the app. Confirm it renders unchanged (defaults match old colors). In DevTools, `document.documentElement.style.getPropertyValue('--brand-primary')` returns `#4f46e5`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/theme/ThemeProvider.tsx frontend/src/main.tsx
git commit -m "feat(theming): ThemeProvider applies brand vars at runtime

Co-authored-by: Isaac"
```

---

## Task 5: Python brand loader (fail-soft) + pytest

**Files:**
- Create: `server/brand.py`
- Create: `tests/test_brand.py`

**Interfaces:**
- Consumes: `brand.config.json` (Task 1).
- Produces:
  - `def load_brand() -> dict` — returns the parsed config, or `DEFAULT_BRAND` if missing/unreadable. Never raises.
  - `DEFAULT_BRAND: dict` — built-in fallback matching Task 1's values.
  - `def brand_color(name: str) -> str` — convenience: `brand_color("primary")` → hex, falling back to default.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_brand.py
import json
from server import brand


def test_load_brand_returns_config_values():
    b = brand.load_brand()
    assert b["identity"]["appName"] == "APEX"
    assert b["colors"]["primary"].startswith("#")


def test_load_brand_failsoft_on_missing_file(monkeypatch, tmp_path):
    # Point the loader at a nonexistent path -> must return defaults, not raise.
    monkeypatch.setattr(brand, "_BRAND_PATH", tmp_path / "nope.json")
    b = brand.load_brand()
    assert b == brand.DEFAULT_BRAND


def test_load_brand_failsoft_on_bad_json(monkeypatch, tmp_path):
    bad = tmp_path / "brand.config.json"
    bad.write_text("{ not valid json")
    monkeypatch.setattr(brand, "_BRAND_PATH", bad)
    assert brand.load_brand() == brand.DEFAULT_BRAND


def test_brand_color_helper():
    assert brand.brand_color("primary").startswith("#")
    assert brand.brand_color("nonexistent") == brand.DEFAULT_BRAND["colors"].get(
        "nonexistent", "#4f46e5"
    )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_brand.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'server.brand'`.

- [ ] **Step 3: Write `server/brand.py`**

```python
"""Fail-soft loader for the shared brand.config.json.

The SAME brand.config.json the React app consumes drives the server-rendered
login page (server/auth/login.py) and the FastAPI app title, so the login screen
always matches the app. Missing/unreadable config falls back to built-in
defaults — never raises (AGENTS.md fail-soft invariant).
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger("server.brand")

# Repo root = parent of the server/ package dir.
_BRAND_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "brand.config.json")

DEFAULT_BRAND: dict[str, Any] = {
    "identity": {
        "appName": "APEX",
        "shortName": "APEX",
        "tagline": "Travel Intelligence",
        "logo": "/brand/logo.svg",
        "logoMark": "/brand/mark.svg",
        "favicon": "/brand/favicon.svg",
    },
    "colors": {
        "primary": "#4f46e5",
        "primaryDark": "#3730a3",
        "primaryLight": "#e0e7ff",
        "accent": "#6366f1",
        "sidebarFrom": "#211d52",
        "sidebarVia": "#2d2a6e",
        "sidebarTo": "#16142e",
        "bg": "#f8fafc",
        "border": "#e2e8f0",
    },
    "typography": {"fontSans": "Inter, system-ui, -apple-system, sans-serif"},
}


def load_brand() -> dict[str, Any]:
    """Return the parsed brand config, or DEFAULT_BRAND if unreadable."""
    try:
        with open(_BRAND_PATH, encoding="utf-8") as fh:
            data = json.load(fh)
        # Shallow-merge over defaults so a partial config still works.
        merged = {**DEFAULT_BRAND, **data}
        for key in ("identity", "colors", "typography"):
            merged[key] = {**DEFAULT_BRAND[key], **(data.get(key) or {})}
        return merged
    except Exception as exc:  # noqa: BLE001 — fail soft
        logger.warning("brand.config.json unreadable (%s); using defaults", exc)
        return DEFAULT_BRAND


def brand_color(name: str) -> str:
    """One brand color hex by semantic name, falling back to the default."""
    return load_brand()["colors"].get(name, DEFAULT_BRAND["colors"].get(name, "#4f46e5"))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_brand.py -v`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/brand.py tests/test_brand.py
git commit -m "feat(theming): fail-soft Python brand loader + tests

Co-authored-by: Isaac"
```

---

## Task 6: Rebrand the Python login page from shared brand

**Files:**
- Modify: `server/auth/login.py:42-117` (the `_render_login_page` function)

**Interfaces:**
- Consumes: `load_brand` (Task 5).

- [ ] **Step 1: Import the loader**

At the top of `server/auth/login.py`, add: `from ..brand import load_brand`.

- [ ] **Step 2: Interpolate brand tokens into the login HTML**

In `_render_login_page`, read the brand once and replace the hardcoded palette + strings. Replace the `:root` CSS declaration and the brand block:

```python
def _render_login_page(error: str | None = None, next_url: str = "/") -> str:
    b = load_brand()
    ident = b["identity"]
    colors = b["colors"]
    app_name = html.escape(ident["appName"])
    tagline = html.escape(ident.get("tagline", ""))
    mark = html.escape(ident["shortName"][:1].upper())
    # ... existing chips/error_html code unchanged ...
```

In the `<style>` block, replace `:root { --indigo:#4f46e5; --purple:#7c3aed; }` with brand-driven values and the body gradient with sidebar colors:

```python
  :root {{ --brand:{colors['primary']}; --brand-dark:{colors['primaryDark']};
           --brand-accent:{colors['accent']}; }}
  body {{ /* … */ background:linear-gradient(135deg,{colors['sidebarFrom']} 0%,{colors['primaryDark']} 50%,{colors['primary']} 100%); /* … */ }}
```

Update every `var(--indigo)` → `var(--brand)`, `var(--purple)` → `var(--brand-accent)`, and the two brand strings: `<title>Sign in · {app_name} …` and the heading `<h1>{app_name}</h1>`, the logo box `>{mark}<`, and the tagline line. Remove the hardcoded `#eef2ff` chip-hover / `#6d28d9` — derive from `--brand`.

- [ ] **Step 3: Verify the login renders**

Run backend; open `/login` (set `AUTH_ENABLED=true`). Confirm the page renders with brand colors and `appName`, no `Advito`-specific text.

- [ ] **Step 4: Grep-clean check**

Run: `grep -nE "#4f46e5|#7c3aed|#6d28d9|Advito" server/auth/login.py`
Expected: no matches (all colors/strings now come from brand).

- [ ] **Step 5: Commit**

```bash
git add server/auth/login.py
git commit -m "feat(theming): login page reads shared brand.config.json

Co-authored-by: Isaac"
```

---

## Task 7: App title + HTML shell + favicon from brand

**Files:**
- Modify: `app.py:6`
- Modify: `frontend/index.html`
- Create: `frontend/public/brand/README.md`

**Interfaces:**
- Consumes: `load_brand` (Task 5), `brand` (Task 2).

- [ ] **Step 1: FastAPI title from brand**

In `app.py`, replace line 6:

```python
from server.brand import load_brand
app = FastAPI(title=f"{load_brand()['identity']['appName']} API")
```

- [ ] **Step 2: Neutralize the static HTML title + add favicon link**

In `frontend/index.html`, change `<title>APEX - Advito Practice Exchange</title>` to `<title>APEX</title>` (ThemeProvider updates it at runtime from `appName`; this is the pre-hydration fallback). Add in `<head>`: `<link rel="icon" href="/brand/favicon.svg" />`.

- [ ] **Step 3: Document the brand asset folder**

Create `frontend/public/brand/README.md`:

```markdown
# Brand assets

Swap these files in place to rebrand (keep the filenames):

- `logo.svg` — full logo (sidebar expanded, login). ~140×32.
- `mark.svg` — compact square mark (collapsed sidebar, favicon source). ~32×32.
- `favicon.svg` — browser tab icon.

Paths are referenced from `brand.config.json` (`identity.logo` / `logoMark` /
`favicon`). If a file is absent, the UI falls back to a monogram generated from
`identity.shortName`.
```

- [ ] **Step 4: Verify build + backend import**

Run: `cd frontend && npm run build` (expect success) and `python -c "import app; print(app.app.title)"` (expect `APEX API`).

- [ ] **Step 5: Commit**

```bash
git add app.py frontend/index.html frontend/public/brand/README.md
git commit -m "feat(theming): app title + favicon from brand config

Co-authored-by: Isaac"
```

---

## Task 8: BrandLogo component + Sidebar migration

**Files:**
- Create: `frontend/src/components/BrandLogo.tsx`
- Create: `frontend/src/components/BrandLogo.test.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `brand` (Task 2).
- Produces: `export function BrandLogo({ variant, className }: { variant: "full" | "mark"; className?: string })` — renders the logo `<img>` (from `brand.identity.logo`/`logoMark`); on image error falls back to a monogram `<span>` of `brand.identity.shortName[0]`.

- [ ] **Step 1: Write `BrandLogo.tsx`**

```tsx
import { useState } from "react";
import { brand } from "@/theme/brand";
import { cn } from "@/lib/utils";

export function BrandLogo({
  variant,
  className,
}: {
  variant: "full" | "mark";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = variant === "full" ? brand.identity.logo : brand.identity.logoMark;
  const mono = brand.identity.shortName.slice(0, 1).toUpperCase();

  if (failed || !src) {
    return (
      <span
        className={cn(
          "grid place-items-center rounded-xl bg-linear-to-br from-brand-primary to-brand-accent text-white font-bold shadow-lg",
          className
        )}
      >
        {mono}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={brand.identity.appName}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
```

- [ ] **Step 1b: Write the monogram-fallback test**

Create `frontend/src/components/BrandLogo.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrandLogo } from "./BrandLogo";
import { brand } from "@/theme/brand";

describe("BrandLogo", () => {
  it("renders an img with the brand logo by default", () => {
    render(<BrandLogo variant="full" />);
    const img = screen.getByRole("img", { name: brand.identity.appName });
    expect(img).toHaveAttribute("src", brand.identity.logo);
  });

  it("falls back to a shortName monogram when the image fails to load", () => {
    render(<BrandLogo variant="mark" />);
    fireEvent.error(screen.getByRole("img"));
    // After error, the img is replaced by the monogram span (first letter).
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(brand.identity.shortName.slice(0, 1).toUpperCase())).toBeInTheDocument();
  });
});
```

- [ ] **Step 1c: Run the test**

Run: `cd frontend && npm test`
Expected: `BrandLogo.test.tsx` PASS (2 tests).

- [ ] **Step 2: Migrate Sidebar**

In `frontend/src/components/Sidebar.tsx`: replace the two literal `✦` glyph boxes (lines ~84, ~97) with `<BrandLogo variant="mark" className="w-8 h-8 text-base" />`; replace the `APEX` text with `{brand.identity.appName}` and the "Advito Practice Exchange" tagline with `{brand.identity.tagline}`; apply the color mapping table to this file's gradient (`from-[#211d52] via-apex-sidebar to-[#16142e]` → `from-brand-sidebar-from via-brand-sidebar-via to-brand-sidebar-to`, and `bg-gradient-to-b` → `bg-linear-to-b`) and the `from-indigo-400 to-violet-500` logo boxes (now inside BrandLogo) . Add `import { brand } from "@/theme/brand"` and `import { BrandLogo } from "@/components/BrandLogo"`.

- [ ] **Step 3: Verify build + visual**

Run: `cd frontend && npm run build`; run dev and confirm the sidebar shows the monogram (no logo file yet) and "APEX" / tagline from config, gradient unchanged.

- [ ] **Step 4: Grep-clean this file**

Run: `grep -nE "✦|Advito|#211d52|#16142e|indigo-400|violet-500|bg-gradient" frontend/src/components/Sidebar.tsx`
Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BrandLogo.tsx frontend/src/components/BrandLogo.test.tsx frontend/src/components/Sidebar.tsx
git commit -m "feat(theming): BrandLogo with monogram fallback + Sidebar migration

Co-authored-by: Isaac"
```

---

## Task 9: Color migration — Tier 1 (highest-churn chat/home surfaces)

**Files (apply the canonical color mapping table):**
- Modify: `frontend/src/pages/GenieMcpExperience.tsx`
- Modify: `frontend/src/pages/AskApexLive.tsx`
- Modify: `frontend/src/components/genie/ConversationRail.tsx`
- Modify: `frontend/src/pages/HomePage.tsx`

**Interfaces:** consumes brand tokens from Task 3 (`bg-brand-*`, gradient tokens). `HomePage` chart `accent="#6366f1"` → `accent="var(--brand-accent)"`.

- [ ] **Step 1: Apply the mapping to all four files**

Work one file at a time. Apply every row of the canonical mapping table. Specifics:
- `HomePage.tsx:139` hero: `bg-gradient-to-br from-[#211d52] via-[#2d2a6e] to-[#4f46e5]` → `bg-linear-to-br from-brand-sidebar-from via-brand-sidebar-via to-brand-primary`.
- `HomePage.tsx:230` `accent="#6366f1"` → `accent="var(--brand-accent)"` (and the emissions `accent="#10b981"` stays — it's a data color, not brand).
- Genie fuchsia that pairs with indigo in a gradient (`from-fuchsia-600 to-indigo-500`): map only the indigo half → `from-fuchsia-600 to-brand-primary` (leave fuchsia as the data accent).
- All `indigo-*`/`violet-*` per the table; keep `slate/white/emerald/rose` etc.

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: success.

- [ ] **Step 3: Grep-clean the four files**

Run: `grep -nE "indigo-|violet-|#4f46e5|#211d52|#2d2a6e|#6366f1|bg-gradient" frontend/src/pages/GenieMcpExperience.tsx frontend/src/pages/AskApexLive.tsx frontend/src/components/genie/ConversationRail.tsx frontend/src/pages/HomePage.tsx`
Expected: no matches (fuchsia data-accents may remain and are allowed).

- [ ] **Step 4: Visual check** — run dev; open Home, Ask APEX, Ask APEX MCP View; confirm identical appearance.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/GenieMcpExperience.tsx frontend/src/pages/AskApexLive.tsx frontend/src/components/genie/ConversationRail.tsx frontend/src/pages/HomePage.tsx
git commit -m "refactor(theming): migrate Tier-1 surfaces to brand tokens

Co-authored-by: Isaac"
```

---

## Task 10: Color migration — Tier 2 (workspace, admin, genie sub-components)

**Files (apply the canonical color mapping table):**
- Modify: `frontend/src/components/DashboardWorkspace.tsx` (also brand strings: `Ask APEX` line 84 stays as feature name; tagline line 87 "AI-powered travel intelligence" → keep or `{brand.identity.tagline}` — use literal, it's a feature descriptor)
- Modify: `frontend/src/components/admin/TenantTable.tsx`
- Modify: `frontend/src/components/genie/GenieReasoning.tsx`
- Modify: `frontend/src/components/FilterBar.tsx`
- Modify: `frontend/src/components/admin/SecretAlert.tsx`
- Modify: `frontend/src/components/ExecutiveSummaryModal.tsx`
- Modify: `frontend/src/components/genie/GenieToolCalls.tsx`
- Modify: `frontend/src/components/genie/GenieSqlBlock.tsx`

- [ ] **Step 1: Apply the mapping table to each file** (indigo/violet → brand tokens; `bg-gradient-*` → `bg-linear-*`; keep structural + data colors).

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: success.

- [ ] **Step 3: Grep-clean**

Run: `grep -rnE "indigo-|violet-|bg-gradient" frontend/src/components/DashboardWorkspace.tsx frontend/src/components/admin/TenantTable.tsx frontend/src/components/genie/GenieReasoning.tsx frontend/src/components/FilterBar.tsx frontend/src/components/admin/SecretAlert.tsx frontend/src/components/ExecutiveSummaryModal.tsx frontend/src/components/genie/GenieToolCalls.tsx frontend/src/components/genie/GenieSqlBlock.tsx`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/DashboardWorkspace.tsx frontend/src/components/admin/TenantTable.tsx frontend/src/components/genie/GenieReasoning.tsx frontend/src/components/FilterBar.tsx frontend/src/components/admin/SecretAlert.tsx frontend/src/components/ExecutiveSummaryModal.tsx frontend/src/components/genie/GenieToolCalls.tsx frontend/src/components/genie/GenieSqlBlock.tsx
git commit -m "refactor(theming): migrate Tier-2 components to brand tokens

Co-authored-by: Isaac"
```

---

## Task 11: Color migration — Tier 3/4 (remaining files) + full sweep

**Files (apply the canonical color mapping table):** all remaining files with brand color literals:
- `frontend/src/App.tsx`, `frontend/src/components/Header.tsx`, `frontend/src/pages/AdminPage.tsx`, `frontend/src/pages/PreferencesPage.tsx`, `frontend/src/pages/Placeholder.tsx`, `frontend/src/pages/CustomDashboard.tsx`, `frontend/src/components/MarkdownContent.tsx`, `frontend/src/components/admin/shared.tsx`, `frontend/src/components/admin/OnboardDialog.tsx`, `frontend/src/components/admin/AccessDialog.tsx`, `frontend/src/components/admin/UsersTable.tsx`, `frontend/src/components/admin/UserDialog.tsx`, `frontend/src/components/admin/StatCard.tsx`, `frontend/src/components/admin/ActivityFeed.tsx`, `frontend/src/components/admin/HistoryDrawer.tsx`, `frontend/src/components/admin/ConfirmDialog.tsx`, `frontend/src/components/genie/GenieAssistantMessage.tsx`, `frontend/src/components/genie/GenieDeepLink.tsx`, `frontend/src/components/genie/GenieMcpStatus.tsx`, `frontend/src/components/ui/button.tsx`, `frontend/src/components/ui/badge.tsx`, `frontend/src/components/ui/tabs.tsx`

- [ ] **Step 1: Apply the mapping table to each file.**

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: success.

- [ ] **Step 3: Full-repo grep-clean assertion**

Run: `grep -rnE "indigo-|violet-|purple-|#4f46e5|#3730a3|#211d52|#2d2a6e|#16142e|#6366f1|#7c3aed|#6d28d9|bg-gradient-" frontend/src/ | grep -vE "fuchsia|// |/\*"`
Expected: **no matches** except any deliberately-kept genie fuchsia data-accents. If a line remains, migrate it.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "refactor(theming): migrate remaining components to brand tokens

Co-authored-by: Isaac"
```

---

## Task 12: Brand-string neutralization sweep (remove Advito specifics)

**Files:**
- Modify: `server/routes/apex.py:37` (`"Advito (All)"` demo tenant name → `"All Clients"`)
- Modify: `server/auth/users.seed.json` (the operator user `tenant: "Advito (All)"` → `"All Clients"`; keep `tenant_id: "*"`)
- Verify: no remaining "Advito" in shipped UI/strings (README historical context may stay).

- [ ] **Step 1: Replace the two Advito tenant labels** as above.

- [ ] **Step 2: Grep for stragglers**

Run: `grep -rnE "Advito" frontend/src server *.py app.py --include=*.tsx --include=*.ts --include=*.py --include=*.json`
Expected: no matches in shipped code/strings (docs/README references to the origin story are acceptable; do not touch docs in this task).

- [ ] **Step 3: Verify build + backend import**

Run: `cd frontend && npm run build` and `python -c "import app"`.
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add server/routes/apex.py server/auth/users.seed.json
git commit -m "refactor(theming): neutralize Advito-specific default strings

Co-authored-by: Isaac"
```

---

## Task 13: Rebrand docs (`docs/customizing.md` + AGENTS.md map) + final verification

**Files:**
- Create: `docs/customizing.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Write `docs/customizing.md`**

```markdown
# Customizing / rebranding APEX

This app is a white-label reference. Rebrand it in **3 steps**:

1. **Edit `brand.config.json`** (repo root) — app name, tagline, colors, font.
   Colors are semantic (`primary`, `accent`, `sidebarFrom`…), applied at runtime
   as CSS variables and mapped to Tailwind `brand-*` utilities.
2. **Swap logo assets** in `frontend/public/brand/` (`logo.svg`, `mark.svg`,
   `favicon.svg`). Absent files fall back to a monogram from `shortName`.
3. **Rebuild** — `cd frontend && npm run build`. The login page (server-rendered)
   reads the same `brand.config.json`, so it rebrands too.

## Change X → edit Y

| To change… | Edit… |
|------------|-------|
| Colors, app name, tagline, font | `brand.config.json` |
| Logo / favicon | `frontend/public/brand/` |
| Dashboards & Genie spaces | `server/assets/dashboards.seed.json` *(added in PR3)* |
| Which filters exist / how they render | `frontend/src/config.ts` (`FILTERS`) |
| Nav order, labels, icons, pages | `frontend/src/config.ts` (`ROUTES`) |
| Server data assets / SP / Lakebase / RLS | `.env` |

## How theming works (for agents)

- **Single source:** `brand.config.json`. Never hardcode a hex or brand string
  in a component — add/emit a semantic token instead.
- **Frontend:** `frontend/src/theme/brand.ts` types the config and flattens it to
  `--brand-*` CSS vars; `ThemeProvider` sets them on `:root` at runtime;
  `index.css` maps them to Tailwind `brand-*` utilities via `@theme inline`.
- **Server:** `server/brand.py` (`load_brand()`) reads the same file, fail-soft.
- **Rule:** components use `brand-primary`, `brand-accent`,
  `brand-sidebar-from/via/to`, `brand-primary-light`, `brand-primary-dark`.
  Structural grays (`slate`, `white`) and data/status colors
  (`emerald`, `rose`, `fuchsia`) are intentionally NOT brand tokens.
```

- [ ] **Step 2: Add the map to AGENTS.md**

Under a new `## Customizing` heading in `AGENTS.md`, add a one-line pointer + the "Change X → edit Y" table (same as above), and note the theming rule: "Never hardcode brand colors/strings — edit `brand.config.json`; see `docs/customizing.md`."

- [ ] **Step 3: Final full verification (the PR gate)**

Run all of:
```bash
cd frontend && npm test               # Vitest: brand + BrandLogo tests pass
cd frontend && npm run build          # TS + Vite build clean
cd .. && python -m pytest tests/ -v   # brand loader tests pass
python -c "import app; print(app.app.title)"   # -> APEX API
grep -rnE "indigo-|violet-|purple-|#4f46e5|#211d52|#7c3aed|bg-gradient-" frontend/src/ | grep -vi fuchsia   # -> empty
grep -rnE "Advito" frontend/src server app.py --include=*.tsx --include=*.ts --include=*.py --include=*.json   # -> empty
```
Expected: Vitest passes, build clean, pytest passes, title `APEX API`, both greps empty.

- [ ] **Step 4: Manual rebrand-swap acceptance test**

Temporarily edit `brand.config.json`: set `appName` to `"NOVA"` and `colors.primary` to `"#0ea5e9"`. Run dev. Confirm: sidebar shows "NOVA" monogram, primary buttons/accents turn sky-blue, `/login` shows NOVA + blue. **Revert the edit** (`git checkout brand.config.json`) before finishing.

- [ ] **Step 5: Commit**

```bash
git add docs/customizing.md AGENTS.md
git commit -m "docs(theming): rebrand guide + agent-ready Change-X-edit-Y map

Co-authored-by: Isaac"
```

---

## Self-review notes

- **Spec coverage (Section A):** single `brand.config.json` ✓ (T1); React ThemeProvider + CSS vars ✓ (T2–4); Tailwind `@theme inline` ✓ (T3); Python login consumer ✓ (T6); HTML shell title/favicon ✓ (T7); logo image + monogram fallback ✓ (T8); color migration all files ✓ (T9–11); Advito neutralized / APEX kept ✓ (T12); rebrand doc ✓ (T13); acceptance grep-clean + swap test ✓ (T13).
- **Vitest added** (T1.5) and used to unit-test pure logic: `brandToCssVars` (T2) + `BrandLogo` monogram fallback (T8); Python loader gets pytest (T5). The bulk color-migration sweep (T9–11) is verified by build + grep-clean + manual swap — unit tests don't fit a find-and-replace. Per user guidance, "no new deps" is not treated as dogma for a flagship repo that should model testing.
- **Type consistency:** `brand`, `brandToCssVars`, `Brand` (T2) used identically in T4/T8; `load_brand`/`DEFAULT_BRAND`/`brand_color` (T5) used in T6/T7. `BrandLogo({variant})` (T8) — the only consumer is Sidebar in the same task.
- **Out of scope (later PRs):** `dashboards.seed.json` is referenced in docs as "added in PR3" — not created here. Non-dashboard nav polish is PR5.
```
