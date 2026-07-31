import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("renders topBar, sidebar, and children slots on the secondary chrome", () => {
    const { container } = render(
      <AppShell topBar={<div>TOPBAR</div>} sidebar={<div>SIDEBAR</div>}>
        <div>CONTENT</div>
      </AppShell>
    );
    expect(screen.getByText("TOPBAR")).toBeInTheDocument();
    expect(screen.getByText("SIDEBAR")).toBeInTheDocument();
    expect(screen.getByText("CONTENT")).toBeInTheDocument();
    expect((container.firstChild as HTMLElement).className).toMatch(/bg-secondary/);
  });
});
