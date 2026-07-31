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
