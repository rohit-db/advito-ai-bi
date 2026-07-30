import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
