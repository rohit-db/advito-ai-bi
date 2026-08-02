import { describe, it, expect, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ThemeProvider } from "./ThemeProvider";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark", "light");
  document.getElementById("prism-accent")?.remove();
});

describe("ThemeProvider", () => {
  it("injects #prism-accent with :root and .dark --primary rules", () => {
    render(<ThemeProvider>x</ThemeProvider>);
    const el = document.getElementById("prism-accent");
    expect(el).toBeTruthy();
    expect(el!.textContent).toMatch(/:root\{[^}]*--primary:/);
    expect(el!.textContent).toMatch(/\.dark\{[^}]*--primary:/);
  });

  it("does NOT write --primary/--overlay/--n* as inline element styles", () => {
    render(<ThemeProvider>x</ThemeProvider>);
    const s = document.documentElement.style;
    expect(s.getPropertyValue("--primary")).toBe("");
    expect(s.getPropertyValue("--overlay")).toBe("");
    expect(s.getPropertyValue("--n1")).toBe("");
  });

  it("applies the stored dark theme (adds .dark class)", async () => {
    localStorage.setItem("prism-theme", "dark");
    render(<ThemeProvider>x</ThemeProvider>);
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(true)
    );
  });

  it("defaults light (no .dark class) when nothing stored", async () => {
    render(<ThemeProvider>x</ThemeProvider>);
    await waitFor(() =>
      expect(document.documentElement.classList.contains("light")).toBe(true)
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("sets document.title from brand identity", () => {
    render(<ThemeProvider>x</ThemeProvider>);
    expect(document.title).toBeTruthy();
  });
});
