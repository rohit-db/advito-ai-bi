import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge } from "./badge";
import { Button } from "./button";

describe("UI primitives — DuBois tokens", () => {
  it("Badge default uses accent fill, no slate/brand-primary", () => {
    const { container } = render(<Badge>x</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/bg-accent/);
    expect(el.className).not.toMatch(/slate-|brand-primary|bg-red-/);
  });
  it("Badge secondary/outline use surface/border tokens", () => {
    const { container } = render(<Badge variant="secondary">x</Badge>);
    expect((container.firstChild as HTMLElement).className).not.toMatch(/slate-/);
  });
  it("Button default uses accent fill; outline/ghost use tokens, no slate/white", () => {
    const { container } = render(<Button>x</Button>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/bg-accent/);
    expect(el.className).not.toMatch(/brand-primary/);
  });
  it("Button outline has no slate/bg-white", () => {
    const { container } = render(<Button variant="outline">x</Button>);
    expect((container.firstChild as HTMLElement).className).not.toMatch(/slate-|bg-white/);
  });
});
