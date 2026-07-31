import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Avatar, AvatarFallback } from "./avatar";

describe("UI primitives — canonical DuBois", () => {
  it("Button default variant (primary) is filled with primary token", () => {
    const { container } = render(<Button>x</Button>);
    const el = container.querySelector("button")!;
    expect(el.className).toMatch(/bg-primary/);
    expect(el.className).not.toMatch(/slate-|brand-primary/);
  });

  it("Button default (bordered, formerly outline) uses input border, not a fill", () => {
    const { container } = render(<Button variant="default">x</Button>);
    const el = container.querySelector("button")!;
    expect(el.className).toMatch(/border-input/);
    expect(el.className).not.toMatch(/bg-primary\b/);
  });

  it("Badge default is filled primary; secondary uses secondary token", () => {
    const { container: a } = render(<Badge>x</Badge>);
    expect((a.querySelector("span")!).className).toMatch(/bg-primary/);
    const { container: b } = render(<Badge variant="secondary">x</Badge>);
    expect((b.querySelector("span")!).className).toMatch(/bg-secondary/);
  });

  it("TabsList/Trigger render with the muted list bg and semibold triggers", () => {
    const { container } = render(
      <Tabs value="a"><TabsList><TabsTrigger value="a">A</TabsTrigger></TabsList></Tabs>
    );
    expect(container.innerHTML).not.toMatch(/slate-/);
    expect(container.querySelector('[data-slot="tabs-list"]')!.className).toMatch(/bg-muted/);
    expect(container.querySelector('[data-slot="tabs-trigger"]')!.className).toMatch(/font-semibold/);
  });

  it("PopoverContent uses popover token surface (theme-aware), no slate/white", () => {
    const { container } = render(
      <Popover open><PopoverTrigger>t</PopoverTrigger><PopoverContent>menu</PopoverContent></Popover>
    );
    const content = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
    expect(content).toBeTruthy();
    expect(content.className).toMatch(/bg-popover/);
    expect(content.className).not.toMatch(/slate-\d|bg-white/);
  });

  it("AvatarFallback uses the muted token, not slate", () => {
    const { container } = render(<Avatar><AvatarFallback>AB</AvatarFallback></Avatar>);
    const fb = container.querySelector('[data-slot="avatar-fallback"]') as HTMLElement;
    expect(fb.className).toMatch(/bg-muted/);
    expect(fb.className).not.toMatch(/slate-/);
  });
});
