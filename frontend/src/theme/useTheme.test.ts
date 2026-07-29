import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme, applyTheme, readStoredTheme, THEME_STORAGE_KEY } from "./useTheme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("applyTheme", () => {
  it("sets data-theme=dark for dark", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
  it("removes the attribute for light (root IS light)", () => {
    applyTheme("dark");
    applyTheme("light");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});

describe("readStoredTheme", () => {
  it("defaults to light when nothing stored", () => {
    expect(readStoredTheme()).toBe("light");
  });
  it("returns a valid stored value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(readStoredTheme()).toBe("dark");
  });
  it("ignores a garbage stored value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "banana");
    expect(readStoredTheme()).toBe("light");
  });
});

describe("useTheme", () => {
  it("toggles light <-> dark, persists, and applies the attribute", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("setTheme sets a specific theme", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("dark"));
    expect(result.current.theme).toBe("dark");
  });
});
