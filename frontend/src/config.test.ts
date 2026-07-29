import { describe, it, expect } from "vitest";
import { buildRoutes, FIXED_REACT_ROUTES } from "./config";
import type { Registry } from "./registry/types";

function reg(assets: Registry["assets"]): Registry {
  return { assets };
}

const baseAsset = {
  label: "X",
  dashboardId: "d",
  globalFilterPage: "g",
  filters: {},
  pages: [],
};

describe("buildRoutes", () => {
  it("keeps the fixed react routes even with an empty registry", () => {
    const routes = buildRoutes(reg({}));
    const paths = routes.map((r) => r.path);
    for (const fixed of FIXED_REACT_ROUTES) {
      expect(paths).toContain(fixed.path);
    }
    // no custom (dashboard) routes when nothing carries nav
    expect(routes.every((r) => r.mode !== "custom")).toBe(true);
  });

  it("derives a mode:custom route from an asset's nav metadata", () => {
    const routes = buildRoutes(
      reg({
        spend: {
          ...baseAsset,
          label: "Spend",
          nav: { path: "/spend-custom", icon: "DollarSign", section: "insights", order: 1 },
        },
      })
    );
    const spend = routes.find((r) => r.path === "/spend-custom");
    expect(spend).toMatchObject({
      label: "Spend",
      icon: "DollarSign",
      section: "insights",
      mode: "custom",
      dashboard: "spend",
    });
  });

  it("ignores assets without nav (embeddable but not auto-nav)", () => {
    const routes = buildRoutes(
      reg({ hidden: { ...baseAsset, label: "Hidden" } })
    );
    expect(routes.find((r) => r.dashboard === "hidden")).toBeUndefined();
  });

  it("sorts merged routes by order", () => {
    const routes = buildRoutes(
      reg({
        b: { ...baseAsset, nav: { path: "/b", icon: "Leaf", section: "insights", order: 5 } },
        a: { ...baseAsset, nav: { path: "/a", icon: "DollarSign", section: "insights", order: 2 } },
      })
    );
    const insightsPaths = routes
      .filter((r) => r.section === "insights")
      .map((r) => r.path);
    // Home (order 0) precedes /a (2) precedes /b (5)
    expect(insightsPaths.indexOf("/")).toBeLessThan(insightsPaths.indexOf("/a"));
    expect(insightsPaths.indexOf("/a")).toBeLessThan(insightsPaths.indexOf("/b"));
  });
});
