import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import GradientMark from "./GradientMark";

describe("GradientMark", () => {
  it("renders a mark whose background uses the accent-gradient var", () => {
    const { container } = render(<GradientMark size={56} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.background).toMatch(/--accent-gradient/);
    expect(container.querySelector("svg")).toBeTruthy(); // icon
  });
});
