import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ConversationRail from "./ConversationRail";

const convos = [
  { id: "a", title: "Spend Q1", mode: "genie", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), message_count: 1 },
  { id: "b", title: "Emissions", mode: "genie", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), message_count: 0 },
];

describe("ConversationRail (DuBois)", () => {
  it("marks the active row with the accent marker + fill, no gradient/fuchsia", () => {
    const { container } = render(
      <ConversationRail conversations={convos} activeId="a" onSelect={() => {}} onNew={() => {}} onDelete={() => {}} />
    );
    const html = container.innerHTML;
    expect(html).not.toMatch(/fuchsia|from-brand-|bg-linear-to/);
    // active row carries an accent marker
    const activeRow = screen.getByText("Spend Q1").closest("div")!;
    expect(activeRow.parentElement!.innerHTML).toMatch(/bg-accent/);
  });
});
