import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";
import ClientBadge from "./ClientBadge";
import UserMenu from "./UserMenu";
import BrandBlock from "./BrandBlock";
import TopBar from "./TopBar";
import { RegistryContext } from "@/registry/useRegistry";
import type { Registry } from "@/registry/types";

describe("shell — Breadcrumb", () => {
  it("renders the page title with fg token, no slate", () => {
    const { container } = render(<Breadcrumb page="Spend" />);
    const title = screen.getByText("Spend");
    expect(title.className).toMatch(/text-fg\b/);
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
    // gradient avatar (deliberate departure) preserved
    expect(container.innerHTML).toMatch(/from-brand-primary/);
    // no legacy slate chrome
    expect(container.innerHTML).not.toMatch(/slate-\d/);
  });
  it("falls back to 'User' / '?' when user is null", () => {
    render(<UserMenu user={null} />);
    expect(screen.getByText("User")).toBeInTheDocument();
  });
});

describe("shell — BrandBlock", () => {
  it("expanded: shows app name + a collapse toggle, dark rail background", () => {
    const { container } = render(<BrandBlock collapsed={false} onToggle={() => {}} />);
    // light brand block (dark rail retired) — no dark classes
    expect(container.innerHTML).not.toMatch(/bg-brand-sidebar-from|text-white|white\//);
    expect(container.innerHTML).toMatch(/w-\[224px\]/);
    expect(screen.getByTitle(/collapse sidebar/i)).toBeInTheDocument();
  });
  it("collapsed: shrinks to 60px and offers an expand affordance", () => {
    const { container } = render(<BrandBlock collapsed={true} onToggle={() => {}} />);
    expect(container.innerHTML).toMatch(/w-\[60px\]/);
    expect(screen.getByTitle(/expand sidebar/i)).toBeInTheDocument();
  });
  it("fires onToggle when the toggle is clicked", () => {
    let n = 0;
    render(<BrandBlock collapsed={false} onToggle={() => { n++; }} />);
    screen.getByTitle(/collapse sidebar/i).click();
    expect(n).toBe(1);
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
  it("renders a full-width h-12 bar with a light surface section, no slate", () => {
    const { container } = renderTopBar();
    const header = container.querySelector("header")!;
    expect(header.className).toMatch(/\bh-12\b/);
    expect(container.innerHTML).toMatch(/bg-surface-2/);
    expect(header.className).not.toMatch(/slate-/);
  });
  it("mounts the theme toggle and the collapse toggle", () => {
    renderTopBar(false);
    expect(screen.getByRole("button", { name: /switch to (dark|light) theme/i })).toBeInTheDocument();
    expect(screen.getByTitle(/collapse sidebar/i)).toBeInTheDocument();
  });
});
