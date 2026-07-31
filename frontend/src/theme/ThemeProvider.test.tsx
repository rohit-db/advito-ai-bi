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
