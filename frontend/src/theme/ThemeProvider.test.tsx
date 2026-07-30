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
});
