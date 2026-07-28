import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import AssetsPage from "./AssetsPage";
import * as adminApi from "@/lib/adminApi";
import type { AdminOutletContext } from "@/components/admin/adminContext";

vi.mock("@/lib/adminApi", async (orig) => ({ ...(await orig<typeof adminApi>()) }));
// AccessGrid does its own fetching; stub its data deps so the page renders.
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApi, "resources").mockResolvedValue({ dashboards: [], genie_spaces: [] });
  vi.spyOn(adminApi, "listTenants").mockResolvedValue({ tenants: [] });
  vi.spyOn(adminApi, "accessMatrix").mockResolvedValue({ tenants: {} });
});

const ctx: AdminOutletContext = {
  audit: [], auditLoading: false, auditError: null, auditRefreshing: false,
  reportAccessError: () => {}, refreshAll: () => {},
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/assets"]}>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="/admin/assets" element={<AssetsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AssetsPage", () => {
  it("lists resolved assets from the registry", async () => {
    vi.spyOn(adminApi, "listAdminAssets").mockResolvedValue({
      writable: true,
      assets: [{ asset_key: "spend", sort_order: 0, active: true, spec: { label: "Spend", dashboardId: "d", globalFilterPage: "", filters: {}, pages: [] } }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Spend")).toBeInTheDocument());
    // Editable when writable
    expect(screen.getByRole("button", { name: /add asset/i })).toBeEnabled();
  });

  it("renders read-only with a seed note when the registry is not writable", async () => {
    vi.spyOn(adminApi, "listAdminAssets").mockResolvedValue({
      writable: false,
      assets: [{ asset_key: "spend", sort_order: 0, active: true, spec: { label: "Spend", dashboardId: "d", globalFilterPage: "", filters: {}, pages: [] } }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/requires lakebase/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /add asset/i })).toBeDisabled();
  });
});
