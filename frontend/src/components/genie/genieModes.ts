import type { GenieMode } from "@/hooks/useGenieMcpChat";

// Each mode targets a different managed Genie MCP server shape, so we offer a
// tailored example for each. Both are native Databricks endpoints — no external
// orchestration is needed to power this analytical experience.
export const MODE_META: Record<GenieMode, { label: string; path: string; blurb: string }> = {
  multi: {
    label: "Genie One MCP",
    path: "/api/2.0/mcp/genie",
    blurb: "Workspace-wide agent across every Genie space you can access.",
  },
  space: {
    label: "Genie Space",
    path: "/api/2.0/mcp/genie/{space_id}",
    blurb: "A single Genie space — the APEX Travel Intelligence space.",
  },
};

export const SUGGESTIONS_BY_MODE: Record<GenieMode, string[]> = {
  space: [
    "What are the top 5 spend categories in 2025?",
    "Show the monthly air travel emissions trend",
    "Which destinations had the highest spend last year?",
    "Compare hotel spend by region",
  ],
  multi: [
    "What was total travel spend in 2025?",
    "Summarize air vs. hotel vs. rail spend",
    "Which months had the highest booking volume?",
    "Top 10 vendors by spend",
  ],
};
