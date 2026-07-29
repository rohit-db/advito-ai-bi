import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";
import { RegistryContext } from "@/registry/useRegistry";
import type { Registry } from "@/registry/types";
import { ADMIN_ASSETS_PATH } from "@/components/admin/adminContext";

function renderSidebar(registry: Registry) {
  return render(
    <RegistryContext.Provider value={registry}>
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>
    </RegistryContext.Provider>
  );
}

function renderSidebarAt(registry: Registry, path: string, role: "operator" | "user" = "operator") {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true, status: 200,
    json: async () => ({ email: "dana@advito.com", role, tenant: "*", authenticated: true }),
  })));
  return render(
    <RegistryContext.Provider value={registry}>
      <MemoryRouter initialEntries={[path]}>
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

  it("shows admin sections and Back to APEX when under /admin (operator)", async () => {
    renderSidebarAt({ assets: {} }, ADMIN_ASSETS_PATH, "operator");
    expect(await screen.findByText(/back to apex/i)).toBeInTheDocument();
    expect(screen.getByText("Assets")).toBeInTheDocument();
    expect(screen.getByText("Tenant access")).toBeInTheDocument();
    expect(screen.getByText("Users & SPs")).toBeInTheDocument();
  });

  it("does NOT show an Administration block on the analytics view", () => {
    renderSidebarAt({ assets: { spend: asset("Spend", "/spend-custom", 1) } }, "/", "operator");
    expect(screen.queryByText(/administration/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/back to apex/i)).not.toBeInTheDocument();
  });
});
