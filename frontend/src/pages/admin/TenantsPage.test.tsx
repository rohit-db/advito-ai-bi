import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import TenantsPage from "./TenantsPage";
import * as adminApi from "@/lib/adminApi";
import type { AdminOutletContext } from "@/components/admin/adminContext";

vi.mock("@/lib/adminApi", async (orig) => ({ ...(await orig<typeof adminApi>()) }));
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApi, "listTenants").mockResolvedValue({
    tenants: [{ tenant_id: "acme", display_name: "Acme", sp_app_id: "sp", sp_display_name: "sp", status: "active", created_at: "", updated_at: "" }],
  });
  vi.spyOn(adminApi, "listAppUsers").mockResolvedValue({ users: [], writable: true });
});

const ctx: AdminOutletContext = {
  audit: [{ id: 1, action: "onboard", status: "ok", created_at: new Date().toISOString() }],
  auditLoading: false, auditError: null, auditRefreshing: false,
  reportAccessError: () => {}, refreshAll: () => {},
};

it("renders the relocated tenant table + audit feed from context", async () => {
  render(
    <MemoryRouter initialEntries={["/admin/tenants"]}>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="/admin/tenants" element={<TenantsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText("Acme")).toBeInTheDocument());
});
