import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PreferencesPage from "./PreferencesPage";
import * as config from "@/config";

vi.mock("@/config", async (orig) => ({ ...(await orig<typeof config>()) }));

afterEach(() => vi.restoreAllMocks());

function renderPage() {
  vi.spyOn(config, "fetchFilterPrefs").mockResolvedValue(null);
  return render(<PreferencesPage />);
}

describe("PreferencesPage (DuBois tokens)", () => {
  it("renders without crashing and shows the My Filters heading", async () => {
    renderPage();
    // heading is present
    expect(screen.getByRole("heading", { name: /my filters/i })).toBeInTheDocument();
  });

  it("page wrapper has no legacy slate/white tokens", () => {
    const { container } = renderPage();
    // outermost div is the scroll wrapper
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.className).not.toMatch(/\bslate-/);
    expect(wrapper.className).not.toMatch(/\bbg-white\b/);
    expect(wrapper.className).not.toMatch(/\bfrom-brand\b/);
    expect(wrapper.className).not.toMatch(/\bto-brand\b/);
    expect(wrapper.className).not.toMatch(/\bemerald-/);
  });

  it("page wrapper uses DuBois surface token", () => {
    const { container } = renderPage();
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toMatch(/\bbg-surface\b/);
  });

  it("date input carries DuBois input tokens and no slate/white", async () => {
    const { container } = renderPage();
    // wait for loading to finish so filter rows render
    await waitFor(() => expect(container.querySelector("input[type=date]")).toBeInTheDocument());
    const input = container.querySelector("input[type=date]") as HTMLInputElement;
    expect(input.className).toMatch(/border-border/);
    expect(input.className).not.toMatch(/slate-\d/);
    expect(input.className).not.toMatch(/\bbg-white\b/);
  });

  it("select control carries DuBois input tokens and no slate/white", async () => {
    const { container } = renderPage();
    await waitFor(() => expect(container.querySelector("select")).toBeInTheDocument());
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select.className).toMatch(/border-border/);
    expect(select.className).not.toMatch(/slate-\d/);
    expect(select.className).not.toMatch(/\bbg-white\b/);
  });

  it("save button uses solid accent tokens and no legacy brand gradient", async () => {
    const { container } = renderPage();
    // Button renders as a <button> element; "Save defaults" text appears after loading
    // but the button is present even during loading (disabled)
    await waitFor(() => expect(screen.getByRole("button", { name: /save defaults/i })).toBeInTheDocument());
    const btn = screen.getByRole("button", { name: /save defaults/i });
    expect(btn.className).toMatch(/\bbg-accent\b/);
    expect(btn.className).not.toMatch(/from-brand/);
    expect(btn.className).not.toMatch(/bg-linear/);
  });
});
