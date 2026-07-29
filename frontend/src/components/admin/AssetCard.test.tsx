import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AssetCard from "./AssetCard";
import type { AssetRow } from "@/lib/adminApi";

const asset: AssetRow = {
  asset_key: "spend", sort_order: 0, active: true,
  spec: { label: "Spend Analytics", dashboardId: "d1", globalFilterPage: "", filters: { client: "w1" }, pages: [{ pageId: "p1", label: "P1", summaryPrompt: "", suggestions: [] }] },
};

it("renders label, key, meta, and status; fires Edit and Access", () => {
  const onEdit = vi.fn(), onAccess = vi.fn();
  render(<AssetCard asset={asset} writable busy={false} onEdit={onEdit} onAccess={onAccess} onToggleActive={() => {}} onDelete={() => {}} />);
  expect(screen.getByText("Spend Analytics")).toBeInTheDocument();
  expect(screen.getByText(/spend/)).toBeInTheDocument();       // key in meta line
  expect(screen.getByText(/1 page/)).toBeInTheDocument();
  expect(screen.getByText("Active")).toBeInTheDocument();       // exact status badge text (avoids aria-label ambiguity)
  fireEvent.click(screen.getByRole("button", { name: /edit/i }));
  fireEvent.click(screen.getByRole("button", { name: /access/i }));
  expect(onEdit).toHaveBeenCalled();
  expect(onAccess).toHaveBeenCalled();
});

it("disables Edit/Delete when not writable", () => {
  render(<AssetCard asset={asset} writable={false} busy={false} onEdit={() => {}} onAccess={() => {}} onToggleActive={() => {}} onDelete={() => {}} />);
  expect(screen.getByRole("button", { name: /edit/i })).toBeDisabled();
  expect(screen.getByRole("button", { name: /delete asset/i })).toBeDisabled();
});
