import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import * as adminApi from "@/lib/adminApi";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApi, "audit").mockResolvedValue({ rows: [] });
});

it("renders child content without a top tab bar", async () => {
  render(
    <MemoryRouter initialEntries={["/admin/assets"]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="assets" element={<div>ASSETS CHILD</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText("ASSETS CHILD")).toBeInTheDocument());
  // The old tab bar rendered these NavLinks; they must be gone.
  expect(screen.queryByRole("link", { name: /manage assets/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /manage users & sps/i })).not.toBeInTheDocument();
});
