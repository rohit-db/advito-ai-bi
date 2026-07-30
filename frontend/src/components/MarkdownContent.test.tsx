import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import MarkdownContent from "./MarkdownContent";

describe("MarkdownContent (DuBois tokens)", () => {
  it("renders markdown with no slate/hardcoded chrome classes", () => {
    const { container } = render(
      <MarkdownContent content={"# Title\n\nBody **bold** and `code` and [a link](https://x.com)."} />
    );
    expect(container.innerHTML).not.toMatch(/slate-\d|text-brand-primary|bg-white/);
    // links use the accent token
    const link = container.querySelector("a");
    if (link) expect(link.className).toMatch(/text-accent/);
    expect(container.textContent).toMatch(/Title/);
  });
});
