import { describe, it, expect } from "vitest";
import { bundledRegistry } from "./seed";

describe("bundled registry seed", () => {
  it("carries the spend + sustainability assets", () => {
    expect(bundledRegistry.assets.spend).toBeDefined();
    expect(bundledRegistry.assets.sustainability).toBeDefined();
    expect(bundledRegistry.assets.spend.dashboardId).toBe(
      "01f1271698161d42b3c66528415775e8"
    );
  });

  it("carries per-page Genie prompts", () => {
    const summary = bundledRegistry.assets.spend.pages.find(
      (p) => p.pageId === "summary"
    );
    expect(summary?.summaryPrompt.toUpperCase()).toContain("SPEND");
    expect(summary?.suggestions).toHaveLength(3);
  });
});
