import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import AccessPage from "./AccessPage";
import * as adminApi from "@/lib/adminApi";
import type { AdminOutletContext } from "@/components/admin/adminContext";

const ctx: AdminOutletContext = {
  audit: [], auditLoading: false, auditError: null, auditRefreshing: false,
  reportAccessError: () => {}, refreshAll: () => {},
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApi, "resources").mockResolvedValue({ dashboards: [{ id: "d1", name: "Travel" }], genie_spaces: [] });
  vi.spyOn(adminApi, "listTenants").mockResolvedValue({ tenants: [] });
  vi.spyOn(adminApi, "accessMatrix").mockResolvedValue({ tenants: {} });
});

it("renders the tenant access grid heading", async () => {
  render(
    <MemoryRouter initialEntries={["/admin/access"]}>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="/admin/access" element={<AccessPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText(/tenant access/i)).toBeInTheDocument());
});
