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
  it("emits :root and .dark rules with all 13 ramp values + overlay", () => {
    const css = neutralsStyleSheet(brand);
    expect(css).toMatch(/:root\s*\{/);
    expect(css).toMatch(/\.dark\s*\{/);
    expect(css).toMatch(/--n0:\s*#FFFFFF/);
    expect(css).toMatch(/--n12:\s*#0A0C10/);      // light n12
    expect(css).toMatch(/--n1:\s*#121214/);        // dark n1
    expect(css).toMatch(/--overlay:\s*17,24,39/);  // light overlay
    expect(css).toMatch(/--overlay:\s*228,228,232/); // dark overlay
  });

  it("places light values in :root block and dark values in .dark block (block containment)", () => {
    const css = neutralsStyleSheet(brand);
    const darkIdx = css.indexOf(".dark");
    const rootBlock = css.slice(0, darkIdx);
    const darkBlock = css.slice(darkIdx);
    expect(rootBlock).toMatch(/--n1:#FCFCFD/);       // light n1 in :root
    expect(rootBlock).toMatch(/--overlay:17,24,39/); // light overlay in :root
    expect(darkBlock).toMatch(/--n1:#121214/);        // dark n1 in dark block
    expect(darkBlock).toMatch(/--overlay:228,228,232/);
    expect(rootBlock).not.toMatch(/--n1:#121214/);    // dark value NOT in :root
  });

  it("returns empty string when neutrals is absent", () => {
    const css = neutralsStyleSheet({ ...brand, colors: { ...brand.colors, neutrals: undefined } });
    expect(css).toBe("");
  });
});

describe("accentVars gradient", () => {
  it("emits a linear-gradient --accent-gradient from the configured stops when enabled", () => {
    const v = accentVars(brand);
    expect(v["--accent-gradient"]).toMatch(/linear-gradient/);
    expect(v["--accent-gradient"]).toMatch(/#2272B4/);
    expect(v["--accent-gradient"]).toMatch(/#F0652F/);
  });

  it("falls back to var(--accent) when accentGradient is disabled", () => {
    const v = accentVars({
      ...brand,
      colors: { ...brand.colors, accentGradient: { enabled: false, stops: ["#2272B4", "#7C3AED"] } },
    });
    expect(v["--accent-gradient"]).toBe("var(--accent)");
  });

  it("falls back to var(--accent) when stops has fewer than 2 entries", () => {
    const v = accentVars({
      ...brand,
      colors: { ...brand.colors, accentGradient: { enabled: true, stops: ["#2272B4"] } },
    });
    expect(v["--accent-gradient"]).toBe("var(--accent)");
  });
});

describe("DEFAULT_THEME", () => {
  it("is light by default", () => {
    expect(DEFAULT_THEME).toBe("light");
  });
});
