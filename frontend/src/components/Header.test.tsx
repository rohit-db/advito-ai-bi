import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Header from "./Header";
import { RegistryContext } from "@/registry/useRegistry";
import type { Registry } from "@/registry/types";

const registry: Registry = { assets: {} };

function renderHeader(path = "/") {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true, status: 200,
    json: async () => ({ email: "u@x.com", role: "user", tenant: "*", authenticated: true, displayName: "Test User" }),
  })));
  return render(
    <RegistryContext.Provider value={registry}>
      <MemoryRouter initialEntries={[path]}>
        <Header />
      </MemoryRouter>
    </RegistryContext.Provider>
  );
}

describe("Header (DuBois top bar)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders the top bar with the DuBois 48px height + surface token, no slate", () => {
    const { container } = renderHeader();
    const header = container.querySelector("header")!;
    expect(header).toBeInTheDocument();
    expect(header.className).toMatch(/\bh-12\b/);
    expect(header.className).toMatch(/bg-surface-2/);
    // Header's own chrome uses no legacy slate/white (avatar primitive defaults are out of scope)
    expect(header.className).not.toMatch(/slate-/);
    expect(header.className).not.toMatch(/bg-white/);
    // breadcrumb title uses fg token, not slate
    const title = screen.getByText(/APEX|Home/i);
    expect(title.className).not.toMatch(/slate-/);
  });

  it("mounts the theme toggle", () => {
    renderHeader();
    expect(screen.getByRole("button", { name: /switch to (dark|light) theme/i })).toBeInTheDocument();
  });
});
