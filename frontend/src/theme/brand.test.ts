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
