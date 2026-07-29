import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";
import { RegistryContext } from "@/registry/useRegistry";
import type { Registry } from "@/registry/types";

function renderSidebar(registry: Registry) {
  return render(
    <RegistryContext.Provider value={registry}>
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>
    </RegistryContext.Provider>
  );
}

const asset = (label: string, path: string, order: number) => ({
  label,
  dashboardId: "d",
  globalFilterPage: "g",
  filters: {},
  pages: [],
  nav: { path, icon: "DollarSign", section: "insights" as const, order },
});

describe("Sidebar", () => {
  beforeEach(() => {
    // useUser fetches identity on mount; stub it to a benign non-operator.
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders a nav item for a registry asset carrying nav metadata", () => {
    renderSidebar({ assets: { spend: asset("Spend", "/spend-custom", 1) } });
    expect(screen.getByText("Spend")).toBeInTheDocument();
    // fixed react routes still render
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Ask APEX")).toBeInTheDocument();
  });

  it("does NOT render a nav item for an asset the tenant is not entitled to (absent from registry)", () => {
    // The server filters ungranted assets out of /api/assets, so an ungranted
    // asset simply is not in the registry the Sidebar receives.
    renderSidebar({ assets: { spend: asset("Spend", "/spend-custom", 1) } });
    expect(screen.queryByText("Sustainability")).not.toBeInTheDocument();
  });
});
