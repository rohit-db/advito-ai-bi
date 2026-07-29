import { describe, it, expect } from "vitest";
import { brand, brandToCssVars, accentVars, DEFAULT_THEME } from "./brand";

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
