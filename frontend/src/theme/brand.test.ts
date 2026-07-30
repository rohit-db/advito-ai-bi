import { describe, it, expect } from "vitest";
import { brand, brandToCssVars, accentVars, DEFAULT_THEME, neutralsStyleSheet } from "./brand";

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

  it("produces a var per string color plus one font var", () => {
    const vars = brandToCssVars(brand);
    const stringColorCount = Object.values(brand.colors).filter(v => typeof v === "string").length;
    expect(Object.keys(vars).length).toBe(stringColorCount + 1);
  });
});

describe("accentVars", () => {
  it("emits exactly the four accent vars from config", () => {
    const vars = accentVars(brand);
    expect(vars["--accent"]).toBe(brand.colors.duboisAccent);
    expect(vars["--accent-fg"]).toBe(brand.colors.accentFg);
    expect(vars["--accent-hover"]).toBe(brand.colors.accentHover);
    expect(Object.keys(vars).sort()).toEqual(["--accent", "--accent-fg", "--accent-gradient", "--accent-hover"]);
  });

  it("does NOT emit the neutral ramp or overlay (CSS-only, theme-variant)", () => {
    const vars = accentVars(brand);
    expect(vars["--n1"]).toBeUndefined();
    expect(vars["--overlay"]).toBeUndefined();
  });
});

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

describe("DEFAULT_THEME", () => {
  it("is light by default", () => {
    expect(DEFAULT_THEME).toBe("light");
  });
});
