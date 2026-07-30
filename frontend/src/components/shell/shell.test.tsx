import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Breadcrumb from "./Breadcrumb";
import ClientBadge from "./ClientBadge";
import UserMenu from "./UserMenu";

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

describe("shell — UserMenu", () => {
  it("renders display name + initials, keeps the gradient avatar, no slate chrome", () => {
    const { container } = render(
      <UserMenu user={{ displayName: "Dana Lee", email: "dana@x.com", initials: "DL" }} />
    );
    expect(screen.getAllByText("DL").length).toBeGreaterThan(0);
    // gradient avatar (deliberate departure) preserved
    expect(container.innerHTML).toMatch(/from-brand-primary/);
    // no legacy slate chrome
    expect(container.innerHTML).not.toMatch(/slate-\d/);
  });
  it("falls back to 'User' / '?' when user is null", () => {
    render(<UserMenu user={null} />);
    expect(screen.getByText("User")).toBeInTheDocument();
  });
});
