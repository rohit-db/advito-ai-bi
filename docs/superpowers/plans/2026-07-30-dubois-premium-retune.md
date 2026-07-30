# DuBois Premium Re-tune Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the flat-DuBois APEX into a *premium*, Lakewatch-caliber experience — Databricks-blue accent, crisp cool neutrals, and rationed gradient flourishes — while keeping everything **config-driven** through `brand.config.json`, and finish converting the surfaces that still clash (chat empty states, `AskApexLive`, `DashboardWorkspace`, and the Home page).

**Background:** Flat monochrome DuBois read as "not premium" and the indigo accent as "weird" in live review. Reference: Databricks **Lakewatch** — monochrome chrome, **Databricks-blue** accent (links/active/actions), purple ONLY in a gradient brand mark, crisp cool-white light theme, and a signature gradient-bordered hero composer. A committed spike (`93fee61`) already swapped the accent to blue (`#2272B4`, via `brand.config.duboisAccent`) and re-tuned the light neutral ramp cooler/crisper directly in `index.css`. This plan makes that flexible + complete.

**Architecture:**
- **Accent** already flows `brand.config.json.colors.duboisAccent → accentVars() → --accent` (runtime, theme-invariant). Keep.
- **Neutrals are theme-VARIANT** → cannot be written as inline element styles (breaks the `[data-theme="dark"]` cascade — the Phase-0 invariant). To make them config-driven, `ThemeProvider` injects a generated `<style id="apex-neutrals">` element containing real `:root{…}` + `[data-theme="dark"]{…}` rules built from `brand.config.json.neutrals`. `index.css` keeps its current ramp as the no-JS fallback default.
- **Gradient flourish** is a config toggle: `brand.config.json.colors.accentGradient = { enabled, stops[] }` → `--accent-gradient` CSS var (written by `accentVars`) → a small reusable `GradientMark` component + a gradient-border composer utility, used only where Lakewatch uses color (brand mark, hero composer).
- All surface conversions use the Phase-0 semantic token utilities.

**Tech Stack:** React 19 + TS, Vite 7, Tailwind v4, Vitest 3 + Testing Library + jsdom, lucide-react.

## Global Constraints

- **Everything stays config-driven** (Rohit's hard requirement). A rebrand = edit `brand.config.json` only: accent, neutral ramps (both themes), and the gradient flourish (on/off + stops) all live there. No hardcoded palette in components.
- **Neutral ramp is theme-variant → never written as inline element style.** Only via the injected `<style>` block (real cascade rules) or the `index.css` fallback. Writing `--n*`/`--overlay` with `element.style.setProperty` is forbidden (Phase-0 invariant — breaks dark mode).
- **Accent in-role only:** `--accent` (Databricks blue) for links, active nav, primary/send buttons, focus rings, trend-chart strokes/fills. NOT general chrome.
- **Gradient is rationed:** the `accentGradient` appears ONLY on (a) the brand/empty-state mark and (b) the hero-composer border — matching Lakewatch. Never on card fills, nav, or body chrome. When `enabled:false`, those fall back to solid `--accent`.
- **No new runtime dependency; no foreign CSS import.**
- Type weights ≤ 600 for display headings (Lakewatch uses bold numerals; keep existing weights where already set). Tight radii from the `--radius` scale.
- `cd frontend && npm test` and `npm run build` green after every task.
- Commits end with a `Co-authored-by: Isaac` trailer; never `--no-verify`.

**Locked values (from live review + spike):**
- Accent: `#2272B4` (Databricks blue), hover `#1B5A8F`, fg `#ffffff` — already in `brand.config`.
- Light ramp (spike, to be moved to config): `--n0:#FFFFFF --n1:#FCFCFD --n2:#F1F4F8 --n3:#E7EBF0 --n4:#DBE0E7 --n5:#C7CDD6 --n6:#98A0AC --n7:#6B7280 --n8:#545B66 --n9:#3F4650 --n10:#292E37 --n11:#191D24 --n12:#0A0C10`, overlay `17,24,39`.
- Dark ramp (current index.css, to be moved to config): `--n0:#0A0A0B … --n12:#F1F1F4`, overlay `228,228,232`.
- Gradient stops default: `["#2272B4", "#7C3AED", "#F0652F"]` (blue→purple→coral, Lakewatch-style), `enabled: true`.

---

## File Structure

**Modified:**
- `brand.config.json` — add `colors.neutrals` (light+dark ramps + overlay) and `colors.accentGradient` (`enabled`, `stops`).
- `frontend/src/theme/brand.ts` — extend `Brand` type; add `neutralsStyleSheet(b)` (returns the CSS text for the injected `<style>`), extend `accentVars(b)` to also emit `--accent-gradient`.
- `frontend/src/theme/ThemeProvider.tsx` — inject/update the `<style id="apex-neutrals">` from config on mount.
- `frontend/src/index.css` — keep the current ramps as documented fallback defaults; add a `.gradient-border` composer utility + `--accent-gradient` fallback.
- `frontend/src/pages/GenieMcpExperience.tsx`, `frontend/src/pages/AskApexLive.tsx` — empty-state gradient mark + gradient-border composer; finish AskApexLive's blue/gradient conversion (it was paused pre-pivot).
- `frontend/src/components/DashboardWorkspace.tsx` — assistant-rail host → tokens + blue/gradient (paused pre-pivot).
- `frontend/src/pages/HomePage.tsx` — hero, KPI cards, trend charts, quick cards → cool neutrals + blue accent + gradient hero mark/border; kill the indigo hero gradient + multicolor icon chips.

**Created:**
- `frontend/src/theme/GradientMark.tsx` — reusable gradient brand mark (config-driven; solid `--accent` when `accentGradient.enabled:false`).
- `frontend/src/theme/brand.test.ts` additions + `GradientMark.test.tsx` + `ThemeProvider` neutrals-injection test.

---

### Task 1: Config schema — neutrals + accentGradient in `brand.config.json` + `brand.ts`

**Files:**
- Modify: `brand.config.json`, `frontend/src/theme/brand.ts`
- Test: `frontend/src/theme/brand.test.ts`

**Interfaces:**
- Produces:
  - `brand.config.json.colors.neutrals = { light: { ramp: string[13], overlay: string }, dark: { ramp: string[13], overlay: string } }`
  - `brand.config.json.colors.accentGradient = { enabled: boolean, stops: string[] }`
  - `Brand.colors.neutrals?` and `Brand.colors.accentGradient?` (optional for back-compat).
  - `export function neutralsStyleSheet(b: Brand): string` — returns CSS text: `:root{--n0:…;…--n12:…;--overlay:…;} [data-theme="dark"]{…}`. Returns `""` if `b.colors.neutrals` absent (fallback to index.css).
  - `accentVars(b)` extended: adds `"--accent-gradient": linear-gradient(...) from stops` when `accentGradient?.enabled`, else `"--accent-gradient": "var(--accent)"` (solid fallback).

- [ ] **Step 1: Add to `brand.config.json`** under `colors` (after `accentHover`):
```json
    "neutrals": {
      "light": {
        "ramp": ["#FFFFFF","#FCFCFD","#F1F4F8","#E7EBF0","#DBE0E7","#C7CDD6","#98A0AC","#6B7280","#545B66","#3F4650","#292E37","#191D24","#0A0C10"],
        "overlay": "17,24,39"
      },
      "dark": {
        "ramp": ["#0A0A0B","#121214","#1A1A1C","#222224","#2C2C2E","#393939","#4B4B4D","#69696B","#8A8A8C","#ABABAE","#C7C7CA","#E0E0E3","#F1F1F4"],
        "overlay": "228,228,232"
      }
    },
    "accentGradient": {
      "enabled": true,
      "stops": ["#2272B4","#7C3AED","#F0652F"]
    }
```

- [ ] **Step 2: Write the failing test** — append to `frontend/src/theme/brand.test.ts`:
```ts
import { neutralsStyleSheet, accentVars } from "./brand";

describe("neutralsStyleSheet", () => {
  it("emits :root and [data-theme=dark] rules with all 13 ramp values + overlay", () => {
    const css = neutralsStyleSheet(brand);
    expect(css).toMatch(/:root\s*\{/);
    expect(css).toMatch(/\[data-theme="dark"\]\s*\{/);
    expect(css).toMatch(/--n0:\s*#FFFFFF/);
    expect(css).toMatch(/--n12:\s*#0A0C10/);      // light n12
    expect(css).toMatch(/--n1:\s*#121214/);        // dark n1
    expect(css).toMatch(/--overlay:\s*17,24,39/);  // light overlay
    expect(css).toMatch(/--overlay:\s*228,228,232/); // dark overlay
  });
});

describe("accentVars gradient", () => {
  it("emits a linear-gradient --accent-gradient from the configured stops when enabled", () => {
    const v = accentVars(brand);
    expect(v["--accent-gradient"]).toMatch(/linear-gradient/);
    expect(v["--accent-gradient"]).toMatch(/#2272B4/);
    expect(v["--accent-gradient"]).toMatch(/#F0652F/);
  });
});
```

- [ ] **Step 3: Run test → fails.** `cd frontend && npx vitest run src/theme/brand.test.ts` → FAIL (functions not present / not extended).

- [ ] **Step 4: Implement in `brand.ts`.** Extend `Brand.colors`:
```ts
    accentHover: string;
    neutrals?: {
      light: { ramp: string[]; overlay: string };
      dark: { ramp: string[]; overlay: string };
    };
    accentGradient?: { enabled: boolean; stops: string[] };
```
Add:
```ts
function rampBlock(sel: string, ramp: string[], overlay: string): string {
  const vars = ramp.map((c, i) => `--n${i}:${c};`).join("");
  return `${sel}{${vars}--overlay:${overlay};}`;
}

/** CSS text for the injected <style> — real cascade rules so the
 *  [data-theme="dark"] flip keeps working (ramp is theme-variant). "" if unset. */
export function neutralsStyleSheet(b: Brand): string {
  const n = b.colors.neutrals;
  if (!n) return "";
  return rampBlock(":root", n.light.ramp, n.light.overlay) +
         rampBlock('[data-theme="dark"]', n.dark.ramp, n.dark.overlay);
}
```
Extend `accentVars`:
```ts
export function accentVars(b: Brand): Record<string, string> {
  const g = b.colors.accentGradient;
  const gradient = g?.enabled && g.stops.length >= 2
    ? `linear-gradient(135deg, ${g.stops.join(", ")})`
    : "var(--accent)";
  return {
    "--accent": b.colors.duboisAccent,
    "--accent-fg": b.colors.accentFg,
    "--accent-hover": b.colors.accentHover,
    "--accent-gradient": gradient,
  };
}
```
(NOTE: `brandToCssVars` iterates `Object.entries(colors)` — `neutrals`/`accentGradient` are objects, not strings. Guard it: skip non-string values so it doesn't emit `--brand-neutrals:[object Object]`. Add `if (typeof value !== "string") continue;` in the loop.)

- [ ] **Step 5: Run test → passes.** `cd frontend && npx vitest run src/theme/brand.test.ts`.
- [ ] **Step 6: Full suite + build.** `cd frontend && npm test && npm run build`.
- [ ] **Step 7: Commit.**
```bash
git add brand.config.json frontend/src/theme/brand.ts frontend/src/theme/brand.test.ts
git commit -m "feat(theme): config-driven neutral ramps + accentGradient in brand config

Co-authored-by: Isaac"
```

---

### Task 2: `ThemeProvider` injects the config neutral ramp as a `<style>` block

**Files:**
- Modify: `frontend/src/theme/ThemeProvider.tsx`
- Test: `frontend/src/theme/ThemeProvider.test.tsx` (extend)

**Interfaces:**
- Consumes: `neutralsStyleSheet`, `accentVars`, `brandToCssVars`, `brand`, `readStoredTheme`, `applyTheme`.
- Produces: on mount, ThemeProvider ensures a `<style id="apex-neutrals">` in `<head>` whose textContent is `neutralsStyleSheet(brand)` (idempotent — reuse if present). Still writes accent vars inline (now incl. `--accent-gradient`). Still applies persisted theme. Ramp/overlay remain OUT of inline element styles.

- [ ] **Step 1: Write the failing test** — add to `ThemeProvider.test.tsx`:
```tsx
it("injects a <style id=apex-neutrals> with :root and dark ramp rules", () => {
  render(<ThemeProvider>x</ThemeProvider>);
  const el = document.getElementById("apex-neutrals");
  expect(el).toBeTruthy();
  expect(el!.textContent).toMatch(/:root\{[^}]*--n1:#FCFCFD/);
  expect(el!.textContent).toMatch(/\[data-theme="dark"\]\{[^}]*--n1:#121214/);
});
it("writes --accent-gradient inline (gradient flourish var)", () => {
  render(<ThemeProvider>x</ThemeProvider>);
  expect(document.documentElement.style.getPropertyValue("--accent-gradient")).toMatch(/linear-gradient/);
});
it("still does NOT write --overlay/--n* as inline element styles", () => {
  render(<ThemeProvider>x</ThemeProvider>);
  const s = document.documentElement.style;
  expect(s.getPropertyValue("--overlay")).toBe("");
  expect(s.getPropertyValue("--n1")).toBe("");
});
```

- [ ] **Step 2: Run test → fails.** `cd frontend && npx vitest run src/theme/ThemeProvider.test.tsx`.

- [ ] **Step 3: Update `ThemeProvider.tsx`** — inside the existing `useLayoutEffect`, before applying theme:
```tsx
import { brand, brandToCssVars, accentVars, neutralsStyleSheet } from "./brand";
// …
    // Inject the config-driven neutral ramp as real cascade rules (theme-variant;
    // must NOT be inline element styles or the dark cascade breaks).
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
```
(The accent-vars inline write already exists; `accentVars` now also carries `--accent-gradient`, so no extra code — just confirm the merged `{...brandToCssVars, ...accentVars}` loop runs.)

- [ ] **Step 4: Run test → passes.** Then full suite + build. `cd frontend && npm test && npm run build`.
- [ ] **Step 5: Commit.**
```bash
git add frontend/src/theme/ThemeProvider.tsx frontend/src/theme/ThemeProvider.test.tsx
git commit -m "feat(theme): inject config neutral ramp as cascade-safe <style> block

Co-authored-by: Isaac"
```

---

### Task 3: Point `index.css` at the config values as documented fallback

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:** none new. Ensures the no-JS fallback ramp MATCHES `brand.config` (so first paint == injected), and adds the `--accent-gradient` fallback + a `.gradient-border` utility for the composer.

- [ ] **Step 1:** Confirm the `:root` light ramp + `[data-theme="dark"]` dark ramp in `index.css` already equal the spike/config values (they do, post-`93fee61` for light; dark unchanged). Add a comment above each ramp: `/* Fallback default — authoritative palette lives in brand.config.json colors.neutrals; ThemeProvider injects #apex-neutrals at runtime. */`
- [ ] **Step 2:** In Layer 3, add a fallback for the gradient var (so pre-JS / no-config still resolves):
```css
  --accent-gradient: var(--accent);
```
- [ ] **Step 3:** Add a reusable gradient-border utility (used by the hero composer) after the `@theme inline` block:
```css
/* Gradient flourish border (Lakewatch-style). Falls back to a solid accent
   ring when --accent-gradient resolves to var(--accent). */
.gradient-border {
  position: relative;
  background:
    linear-gradient(var(--surface), var(--surface)) padding-box,
    var(--accent-gradient) border-box;
  border: 1.5px solid transparent;
}
```
- [ ] **Step 4: Build + suite.** `cd frontend && npm run build && npm test` (green; no test asserts these, behavior unchanged).
- [ ] **Step 5: Commit.**
```bash
git add frontend/src/index.css
git commit -m "feat(theme): index.css fallback matches config palette + gradient-border utility

Co-authored-by: Isaac"
```

---

### Task 4: `GradientMark` component (config-driven brand mark)

**Files:**
- Create: `frontend/src/theme/GradientMark.tsx`, `frontend/src/theme/GradientMark.test.tsx`

**Interfaces:**
- Produces: `export default function GradientMark({ size?, className?, icon?: LucideIcon })` — a rounded square filled with `var(--accent-gradient)` (which is solid `--accent` when the flourish is disabled), containing a white icon (default `Sparkles`). One reusable premium mark for empty states + hero.

- [ ] **Step 1: Write the failing test** — `GradientMark.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import GradientMark from "./GradientMark";

describe("GradientMark", () => {
  it("renders a mark whose background uses the accent-gradient var", () => {
    const { container } = render(<GradientMark size={56} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.background).toMatch(/--accent-gradient/);
    expect(container.querySelector("svg")).toBeTruthy(); // icon
  });
});
```
- [ ] **Step 2: Run → fails.** `cd frontend && npx vitest run src/theme/GradientMark.test.tsx`.
- [ ] **Step 3: Implement `GradientMark.tsx`:**
```tsx
import { Sparkles, type LucideIcon } from "lucide-react";

export default function GradientMark({
  size = 56,
  className = "",
  icon: Icon = Sparkles,
}: {
  size?: number;
  className?: string;
  icon?: LucideIcon;
}) {
  return (
    <div
      className={`grid place-items-center rounded-2xl text-white shadow-sm ${className}`}
      style={{ width: size, height: size, background: "var(--accent-gradient)" }}
    >
      <Icon size={Math.round(size * 0.45)} strokeWidth={1.75} />
    </div>
  );
}
```
- [ ] **Step 4: Run → passes.** Full suite + build.
- [ ] **Step 5: Commit.**
```bash
git add frontend/src/theme/GradientMark.tsx frontend/src/theme/GradientMark.test.tsx
git commit -m "feat(theme): reusable config-driven GradientMark

Co-authored-by: Isaac"
```

---

### Task 5: Chat empty states → GradientMark + gradient-border composer

**Files:**
- Modify: `frontend/src/pages/GenieMcpExperience.tsx`

**Interfaces:** unchanged. Swap the flat monochrome empty-state mark for `<GradientMark>` and give the `HeroComposer` the `.gradient-border` treatment.

- [ ] **Step 1:** In `GenieMcpExperience.tsx`, import `GradientMark`. Replace the empty-hero monochrome mark (`bg-surface-3` square) with `<GradientMark size={56} className="mx-auto mb-5" />`. Keep the header's small mark monochrome (chrome, not hero).
- [ ] **Step 2:** On `HeroComposer`'s `<form>`, add `gradient-border` to the className and drop the plain `border border-border` (the gradient utility supplies the border). Keep the focus ring. FooterComposer stays flat (follow-up composer, not hero).
- [ ] **Step 3: Build + suite + grep** (no slate/purple regressions): `cd frontend && npm run build && npm test && grep -nE "slate-|from-brand|from-fuchsia" src/pages/GenieMcpExperience.tsx` → expect empty.
- [ ] **Step 4: Commit.**
```bash
git add frontend/src/pages/GenieMcpExperience.tsx
git commit -m "feat(chat): gradient brand mark + gradient-border hero composer

Co-authored-by: Isaac"
```

---

### Task 6: EARLY CHECKPOINT — controller + Rohit look (no code)

- [ ] **Step 1:** `cd frontend && npm test && npm run build`.
- [ ] **Step 2:** Live Chrome check of `/genie-mcp` (light + dark): gradient mark + gradient composer border render; blue accent; toggle `accentGradient.enabled:false` in `brand.config` and rebuild to confirm it falls back to solid blue (config-driven proof); 0 console errors. Screenshots `/tmp/apex-retune-chat-{light,dark}.png` + `/tmp/apex-retune-chat-flat.png`.
- [ ] **Step 3: PAUSE for Rohit.** Confirm the premium chat lands before converting AskApexLive + DashboardWorkspace + Home. Adjust stops/treatment if needed.

---

### Task 7: `AskApexLive` → blue + gradient (finish paused conversion)

**Files:** Modify `frontend/src/pages/AskApexLive.tsx`.
- [ ] **Step 1:** Apply the same treatment as GenieMcpExperience: this page still has the OLD fuchsia look from before the pivot. Convert per the Phase-2 flat mapping (slate→fg/surface tokens, remove orbs/grad* bubbles, monochrome header mark) BUT use the new premium finish: empty-state `<GradientMark>` + `.gradient-border` HeroComposer + accent send button (`bg-accent`). Remove all `fuchsia-*`. The `AppRenderer`/sandbox wiring stays untouched.
- [ ] **Step 2: Build + suite + grep:** `grep -nE "slate-|fuchsia|from-brand|blur-3xl" src/pages/AskApexLive.tsx` → empty.
- [ ] **Step 3: Commit** (`feat(chat): AskApexLive premium blue+gradient conversion`).

---

### Task 8: `DashboardWorkspace` rail host → tokens + blue

**Files:** Modify `frontend/src/components/DashboardWorkspace.tsx`.
- [ ] **Step 1:** Read the file; convert its assistant-rail chrome to tokens (surface/fg/border), accent links/actions → `--accent`, any composer → DuBois `.input` + accent send. Remove gradient/shadow bubbles. Leave iframe + Exec Summary modal logic intact.
- [ ] **Step 2: Build + suite + grep** (`slate-|from-brand|from-fuchsia`) → empty.
- [ ] **Step 3: Commit** (`feat(chat): tokenize dashboard assistant-rail host`).

---

### Task 9: Home page → cool neutrals + blue + gradient hero (kill the clash)

**Files:** Modify `frontend/src/pages/HomePage.tsx`.

This is the biggest single visual win — the indigo hero + multicolor icon chips are the loudest remaining clash.

- [ ] **Step 1: Hero.** Replace the `from-brand-sidebar-from via-brand-sidebar-via to-brand-primary` hero gradient + blur orbs with a clean treatment: a light surface hero (`bg-surface-2` or a subtle `--accent-gradient` top-border strip), OR keep a dark hero but recolored to neutral `--n1` dark with a `<GradientMark>` — pick the Lakewatch-closer option: **light hero** with the "What do you want to investigate" centered composer using `.gradient-border` (matches Lakewatch Overview image #2/#3 exactly). Title in `text-fg`, subtitle `text-fg-muted`. Send button `bg-accent`.
- [ ] **Step 2: KPI cards.** Icon chips: replace the four multicolor gradients (`from-brand-primary…`, `from-emerald-500…`, `from-sky-500…`, `from-fuchsia-500…`) with a single restrained treatment — monochrome `bg-surface-3 text-fg-muted` chips OR solid `bg-accent/10 text-accent`. Card = `bg-surface border-border` hairline, big `text-fg` numerals (keep bold). DeltaChip: keep green/red semantics but via `--success`/`--danger` tokens (Lakewatch uses colored trend arrows — blue for neutral movement, so neutral tone → `text-accent`).
- [ ] **Step 3: Trend charts.** `accent="var(--brand-accent)"` → `var(--accent)` (blue); emissions chart `#10b981` → keep green as a data color (charts may carry hue per DuBois viz rule) OR `var(--success)`. Card chrome → tokens.
- [ ] **Step 4: Quick cards.** Icon chips → monochrome or `bg-accent/10 text-accent` (drop the 3 multicolor gradients); card → `bg-surface border-border`, hover `border-border-hover`; the `ArrowRight` hover `text-brand-accent` → `text-accent`.
- [ ] **Step 5: Page bg** `from-slate-50 to-white` → `bg-surface` (flat, the cool neutral).
- [ ] **Step 6: Build + suite + grep:** `grep -nE "slate-|from-brand-sidebar|from-emerald|from-sky|from-fuchsia|blur-3xl" src/pages/HomePage.tsx` → empty (chart data-hue greens excepted + noted).
- [ ] **Step 7: Commit** (`feat(home): cool-neutral + blue + gradient hero; retire multicolor chips`).

---

### Task 10: Final verification checkpoint (no code)

- [ ] **Step 1:** `cd frontend && npm test && npm run build`.
- [ ] **Step 2:** Live Chrome check of Home, both chat pages, a dashboard route, in BOTH themes: coherent blue+neutral+gradient system, no indigo/fuchsia clash, gradient flourish only on marks/hero composer, legible dark, 0 console errors. Screenshots `/tmp/apex-retune-{home,chat,live,dashboard}-{light,dark}.png`.
- [ ] **Step 3:** Config-driven proof: flip `accentGradient.enabled:false` AND change `duboisAccent` to a test hue → rebuild → confirm the whole app re-skins from config alone. Revert.
- [ ] **Step 4:** Update ledger/memory; do NOT push (await Rohit).

---

## Self-Review

**Coverage of the pivot decisions:**
- Blue accent (config) → already done (spike); carried by `accentVars`. ✅
- Cool/crisp neutrals, config-driven → Tasks 1–3 (config block + `<style>` injection + fallback). ✅
- Gradient flourish as config toggle → Tasks 1 (`accentGradient`), 4 (`GradientMark`), 3 (`.gradient-border`), 5/7/9 (applied only to marks + hero composers). ✅
- Finish paused chat surfaces in the new look → Tasks 7 (AskApexLive), 8 (DashboardWorkspace). ✅
- Kill the Home clash → Task 9. ✅
- Everything config-driven → Tasks 1–4 put accent, neutrals, and gradient in `brand.config`; Task 10 proves re-skin from config alone. ✅
- Neutral-ramp theme-variant invariant respected → Task 2 uses `<style>` injection, never inline element styles; test asserts `--n*`/`--overlay` stay out of inline styles. ✅

**Placeholder scan:** Tasks 1–5 carry exact code/values. Tasks 7–9 are conversions with explicit mapping + named grep guards; Task 9 Step 1 offers a decision (light vs dark hero) with a concrete recommendation (light, matches the Lakewatch reference) — resolve to light unless Rohit says otherwise at the Task 6 checkpoint.

**Type consistency:** `neutralsStyleSheet`, `accentVars` (extended, same name), `GradientMark` default export + props are defined in Tasks 1/4 and consumed in 2/5/7/9. `Brand.colors.neutrals`/`accentGradient` optional (back-compat). ✅

## Execution Handoff

(see chat)
