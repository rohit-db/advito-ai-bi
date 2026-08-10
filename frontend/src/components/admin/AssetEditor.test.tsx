import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AssetEditor from "./AssetEditor";
import * as adminApi from "@/lib/adminApi";
import type { AssetRow } from "@/lib/adminApi";

vi.mock("@/lib/adminApi", async (orig) => ({ ...(await orig<typeof adminApi>()) }));

const SPEND: AssetRow = {
  asset_key: "spend",
  sort_order: 0,
  active: true,
  spec: {
    label: "Spend",
    dashboardId: "dash-1",
    globalFilterPage: "pg1",
    filters: { currentPeriod: "period" },
    pages: [
      { pageId: "summary", label: "Summary", summaryPrompt: "P", suggestions: ["a"] },
    ],
  },
};

describe("AssetEditor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Default: no workspace dashboards → fields degrade to free-text (matches the
    // pre-picker behavior the scalar/page/duplicate tests below assume).
    vi.spyOn(adminApi, "listWorkspaceDashboards").mockResolvedValue({ dashboards: [] });
  });

  it("builds a save payload from edited scalar + filter + page fields", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AssetEditor initial={SPEND} existingKeys={["spend"]} onSave={onSave} onClose={() => {}} />);

    // Add a filter row, pick a key, set its widget id.
    fireEvent.click(screen.getByRole("button", { name: /add filter/i }));
    // The new row's key select + widget input are the last of their kind.
    const keySelects = screen.getAllByLabelText(/filter key/i);
    fireEvent.change(keySelects[keySelects.length - 1], { target: { value: "travelSector" } });
    const widgetInputs = screen.getAllByLabelText(/widget id/i);
    fireEvent.change(widgetInputs[widgetInputs.length - 1], { target: { value: "tsector" } });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const body = onSave.mock.calls[0][0];
    expect(body.asset_key).toBe("spend");
    expect(body.spec.filters).toMatchObject({ currentPeriod: "period", travelSector: "tsector" });
    expect(body.spec.pages).toHaveLength(1);
  });

  it("adds and removes a page", () => {
    render(<AssetEditor initial={SPEND} existingKeys={["spend"]} onSave={vi.fn()} onClose={() => {}} />);
    expect(screen.getAllByLabelText(/page id/i)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /add page/i }));
    expect(screen.getAllByLabelText(/page id/i)).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: /remove page/i })[1]);
    expect(screen.getAllByLabelText(/page id/i)).toHaveLength(1);
  });

  it("blocks save on a duplicate key when creating", () => {
    const onSave = vi.fn();
    render(<AssetEditor initial={null} existingKeys={["spend"]} onSave={onSave} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/asset key/i), { target: { value: "spend" } });
    fireEvent.change(screen.getByLabelText(/dashboard id/i), { target: { value: "d" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });

  it("preserves existing nav metadata on save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const withNav: AssetRow = {
      ...SPEND,
      spec: { ...SPEND.spec, nav: { path: "/spend-custom", icon: "DollarSign", section: "insights", order: 1 } },
    };
    render(<AssetEditor initial={withNav} existingKeys={["spend"]} onSave={onSave} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].spec.nav).toMatchObject({
      path: "/spend-custom", icon: "DollarSign", section: "insights", order: 1,
    });
  });

  it("adds nav via the toggle and validates the path", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AssetEditor initial={null} existingKeys={[]} onSave={onSave} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/asset key/i), { target: { value: "revenue" } });
    fireEvent.change(screen.getByLabelText(/dashboard id/i), { target: { value: "d" } });
    fireEvent.click(screen.getByLabelText(/show in navigation/i));

    // Bad path (no leading slash) blocks save.
    fireEvent.change(screen.getByLabelText(/nav path/i), { target: { value: "revenue" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/must start with/i)).toBeInTheDocument();

    // Fix path + set section/order → persists nav.
    fireEvent.change(screen.getByLabelText(/nav path/i), { target: { value: "/revenue" } });
    fireEvent.change(screen.getByLabelText(/nav section/i), { target: { value: "exploration" } });
    fireEvent.change(screen.getByLabelText(/nav order/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].spec.nav).toMatchObject({
      path: "/revenue", section: "exploration", order: 5,
    });
  });

  it("shows section headings and a jump-nav", () => {
    render(<AssetEditor initial={null} existingKeys={[]} onSave={async () => {}} onClose={() => {}} />);
    for (const s of ["Basics", "Data", "Navigation", "Filters", "Pages"]) {
      expect(screen.getAllByText(new RegExp(`^${s}$`, "i")).length).toBeGreaterThan(0);
    }
  });

  it("lets the operator pick a workspace dashboard by name (sets its id in the payload)", async () => {
    vi.spyOn(adminApi, "listWorkspaceDashboards").mockResolvedValue({
      dashboards: [
        { id: "01f-abc", name: "Prism Corporate Travel Analytics POC" },
        { id: "01f-xyz", name: "Travel CO2 Emissions Dashboard" },
      ],
    });
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AssetEditor initial={null} existingKeys={[]} onSave={onSave} onClose={() => {}} />);

    // The picker (a <select>) appears once the workspace dashboard list loads.
    const picker = (await screen.findByRole("combobox", { name: "Dashboard" })) as HTMLSelectElement;
    fireEvent.change(screen.getByLabelText(/asset key/i), { target: { value: "newasset" } });
    // Confirm the workspace dashboards are listed BY NAME as options.
    expect(screen.getByRole("option", { name: "Travel CO2 Emissions Dashboard" })).toBeInTheDocument();
    // Select the second dashboard by its id — its id must land in the save payload.
    fireEvent.change(picker, { target: { value: "01f-xyz" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].spec.dashboardId).toBe("01f-xyz");
  });
});
