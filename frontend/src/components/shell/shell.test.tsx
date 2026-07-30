import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Breadcrumb from "./Breadcrumb";
import ClientBadge from "./ClientBadge";

describe("shell — Breadcrumb", () => {
  it("renders the page title with fg token, no slate", () => {
    const { container } = render(<Breadcrumb page="Spend" />);
    const title = screen.getByText("Spend");
    expect(title.className).toMatch(/text-fg\b/);
    expect(container.innerHTML).not.toMatch(/slate-\d/);
  });
  it("renders the section label when provided", () => {
    render(<Breadcrumb section="Insights & Analytics" page="Spend" />);
    expect(screen.getByText("Insights & Analytics")).toBeInTheDocument();
    expect(screen.getByText("Spend")).toBeInTheDocument();
  });
});

describe("shell — ClientBadge", () => {
  it("renders the tenant with light tokens, no slate/emerald", () => {
    const { container } = render(<ClientBadge tenant="Acme Corp" />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText(/client/i)).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/slate-\d|emerald-\d/);
  });
});
