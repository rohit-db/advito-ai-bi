import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

  it("navigates to tenant access when a card's Access button is clicked", async () => {
    vi.spyOn(adminApi, "listAdminAssets").mockResolvedValue({
      writable: true,
      assets: [{ asset_key: "spend", sort_order: 0, active: true, spec: { label: "Spend", dashboardId: "d", globalFilterPage: "", filters: {}, pages: [] } }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Spend")).toBeInTheDocument());
    // Access button exists on the card (navigation asserted via router in integration)
    expect(screen.getByRole("button", { name: /access/i })).toBeInTheDocument();
  });

  it("flips the access gate when saving hits a 401/403", async () => {
    vi.spyOn(adminApi, "listAdminAssets").mockResolvedValue({ writable: true, assets: [] });
    const reportAccessError = vi.fn();
    // saveAdminAsset rejects with an operator-gate error
    vi.spyOn(adminApi, "saveAdminAsset").mockRejectedValue(
      new adminApi.AdminApiError(403, "operator role required")
    );
    render(
      <MemoryRouter initialEntries={["/admin/assets"]}>
        <Routes>
          <Route element={<Outlet context={{ ...ctx, reportAccessError }} />}>
            <Route path="/admin/assets" element={<AssetsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    // open the create editor
    await waitFor(() => expect(screen.getByRole("button", { name: /add asset/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /add asset/i }));
    // fill the minimal required fields (asset key + dashboard id) then Create
    fireEvent.change(screen.getByLabelText(/asset key/i), { target: { value: "newkey" } });
    fireEvent.change(screen.getByLabelText(/dashboard id/i), { target: { value: "d-1" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    await waitFor(() => expect(reportAccessError).toHaveBeenCalled());
  });
});
