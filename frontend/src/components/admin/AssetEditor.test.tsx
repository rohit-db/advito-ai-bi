import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AssetEditor from "./AssetEditor";
import type { AssetRow } from "@/lib/adminApi";

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
});
