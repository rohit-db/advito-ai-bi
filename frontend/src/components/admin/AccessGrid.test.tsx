import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AccessGrid from "./AccessGrid";
import * as adminApi from "@/lib/adminApi";

vi.mock("@/lib/adminApi", async (orig) => ({ ...(await orig<typeof adminApi>()) }));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApi, "resources").mockResolvedValue({
    dashboards: [{ id: "dash-1", name: "Spend" }],
    genie_spaces: [],
  });
  vi.spyOn(adminApi, "listTenants").mockResolvedValue({
    tenants: [{ tenant_id: "acme", display_name: "Acme", sp_app_id: "sp-acme", sp_display_name: "sp", status: "active", created_at: "", updated_at: "" }],
  });
  vi.spyOn(adminApi, "accessMatrix").mockResolvedValue({
    tenants: { acme: { sp_app_id: "sp-acme", access: { dashboards: { "dash-1": false }, genie_spaces: {} } } },
  });
});

describe("AccessGrid", () => {
  it("renders a tenant row × resource column and grants on toggle", async () => {
    const setAccess = vi.spyOn(adminApi, "setAccess").mockResolvedValue({ ok: true, tenant_id: "acme" });
    render(<AccessGrid />);
    await waitFor(() => expect(screen.getByText("Acme")).toBeInTheDocument());

    const cell = screen.getByRole("switch", { name: /acme.*dash-1|grant/i });
    expect(cell).toHaveAttribute("aria-checked", "false");
    fireEvent.click(cell);

    await waitFor(() => expect(setAccess).toHaveBeenCalledWith("acme", {
      resource_type: "dashboard", resource_id: "dash-1", grant: true,
    }));
    await waitFor(() => expect(cell).toHaveAttribute("aria-checked", "true"));
  });

  it("reverts the optimistic toggle when setAccess fails", async () => {
    vi.spyOn(adminApi, "setAccess").mockRejectedValue(new Error("boom"));
    render(<AccessGrid />);
    await waitFor(() => expect(screen.getByText("Acme")).toBeInTheDocument());
    const cell = screen.getByRole("switch", { name: /acme.*dash-1|grant/i });
    fireEvent.click(cell);
    // optimistic on, then reverts to off
    await waitFor(() => expect(cell).toHaveAttribute("aria-checked", "false"));
  });

  it("shows the error (not the empty-state note) when the initial fetch fails", async () => {
    vi.spyOn(adminApi, "resources").mockRejectedValue(new Error("boom-500"));
    // listTenants/accessMatrix are already stubbed in beforeEach; Promise.all rejects on the first rejection.
    const onAccessError = vi.fn();
    render(<AccessGrid onAccessError={onAccessError} />);
    await waitFor(() => expect(screen.getByText(/boom-500/i)).toBeInTheDocument());
    expect(screen.queryByText(/no grantable resources/i)).not.toBeInTheDocument();
    expect(onAccessError).toHaveBeenCalled();
  });
});
