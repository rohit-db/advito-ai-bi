import { vi, describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";
import ClientBadge from "./ClientBadge";
import UserMenu from "./UserMenu";
import TopBar from "./TopBar";
import { RegistryContext } from "@/registry/useRegistry";
import type { Registry } from "@/registry/types";
import { brand } from "@/theme/brand";

describe("shell — Breadcrumb", () => {
  it("renders the page title with fg token, no slate", () => {
    const { container } = render(<Breadcrumb page="Spend" />);
    const title = screen.getByText("Spend");
    expect(title.className).toMatch(/text-foreground\b/);
    expect(container.innerHTML).not.toMatch(/slate-\d/);
  });
  it("renders the section label when provided", () => {
    render(<Breadcrumb section="Insights & Analytics" page="Spend" />);
    expect(screen.getByText("Insights & Analytics")).toBeInTheDocument();
    expect(screen.getByText("Spend")).toBeInTheDocument();
  });
});

describe("shell — ClientBadge", () => {
  it("renders the tenant with light tokens, no slate/emerald", () => {
    const { container } = render(<ClientBadge tenant="Acme Corp" />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText(/client/i)).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/slate-\d|emerald-\d/);
  });
});

describe("shell — UserMenu", () => {
  it("renders display name + initials, keeps the gradient avatar, no slate chrome", () => {
    const { container } = render(
      <UserMenu user={{ displayName: "Dana Lee", email: "dana@x.com", initials: "DL" }} />
    );
    expect(screen.getAllByText("DL").length).toBeGreaterThan(0);
    // bg-primary avatar fallback (canonical token)
    expect(container.innerHTML).toMatch(/bg-primary/);
    // no legacy slate chrome
    expect(container.innerHTML).not.toMatch(/slate-\d/);
  });
  it("falls back to 'User' / '?' when user is null", () => {
    render(<UserMenu user={null} />);
    expect(screen.getByText("User")).toBeInTheDocument();
  });
});

function renderTopBar(collapsed = false) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));
  const registry: Registry = { assets: {} };
  return render(
    <RegistryContext.Provider value={registry}>
      <MemoryRouter initialEntries={["/"]}>
        <TopBar collapsed={collapsed} onToggle={() => {}} />
      </MemoryRouter>
    </RegistryContext.Provider>
  );
}

describe("shell — TopBar", () => {
  afterEach(() => vi.restoreAllMocks());
  it("renders a full-width h-12 bar with bg-secondary, no slate", () => {
    const { container } = renderTopBar();
    const header = container.querySelector("header")!;
    expect(header.className).toMatch(/\bh-12\b/);
    expect(header.className).toMatch(/bg-secondary/);
    expect(header.className).not.toMatch(/slate-/);
  });
  it("mounts the theme toggle and the collapse toggle", () => {
    renderTopBar(false);
    expect(screen.getByRole("button", { name: /switch to (dark|light) theme/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeInTheDocument();
  });
  it("renders the app name", () => {
    renderTopBar();
    expect(screen.getAllByText(brand.identity.appName).length).toBeGreaterThan(0);
  });
  it("fires onToggle when the collapse toggle is clicked", () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));
    const registry: Registry = { assets: {} };
    render(
      <RegistryContext.Provider value={registry}>
        <MemoryRouter initialEntries={["/"]}>
          <TopBar collapsed={false} onToggle={() => { n++; }} />
        </MemoryRouter>
      </RegistryContext.Provider>
    );
    screen.getByRole("button", { name: /collapse sidebar/i }).click();
    expect(n).toBe(1);
  });
});
