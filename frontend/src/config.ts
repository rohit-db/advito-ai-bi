import {
  DollarSign,
  Users,
  Briefcase,
  ShieldCheck,
  Heart,
  Leaf,
  Zap,
  FileText,
  Database,
  MessageCircle,
  UsersRound,
  Bot,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// ─── Workspace constants ───────────────────────────────────────────────────────

export const WORKSPACE = "https://dbc-1e27e56a-90cd.cloud.databricks.com";
export const ORG = "1048934788948873";

// ─── Dashboard IDs ────────────────────────────────────────────────────────────

export const DASHBOARDS = {
  // Old NYC Taxi dashboards (legacy scaffolding)
  legacyMultiPage: "01f11c0671df190d96063a4632a3611a",
  legacySinglePage: "01f1169e4b5810418541b22a792aa916",
  // APEX Travel Analytics dashboard (new, powered by apex.travel_metrics)
  apex: "01f1271698161d42b3c66528415775e8",
} as const;

export const GENIE_SPACE_ID = "01f127092d2219f3be10180d79b2ee5d";

// ─── Icon map ─────────────────────────────────────────────────────────────────

export const ICON_MAP: Record<string, LucideIcon> = {
  DollarSign,
  Users,
  Briefcase,
  ShieldCheck,
  Heart,
  Leaf,
  Zap,
  FileText,
  Database,
  MessageCircle,
  UsersRound,
  Bot,
  Sparkles,
};

// ─── TypeScript interfaces ────────────────────────────────────────────────────

export interface PageConfig {
  label: string;
  pageId: string;
}

export type RouteMode = "native" | "custom" | "placeholder" | "react";

export interface RouteConfig {
  path: string;
  label: string;
  icon: string; // key into ICON_MAP
  section: "insights" | "exploration";
  mode: RouteMode;
  dashboardId?: string;
  pages?: PageConfig[];
}

export interface FilterState {
  currentPeriodFrom: string;   // "2025-01-01"
  currentPeriodTo: string;     // "2025-12-31"
  previousPeriodFrom: string;  // "2024-01-01"
  previousPeriodTo: string;    // "2024-12-31"
  travelSector?: string;       // "Inter-Continental", "Intra-Continental", "Intra-Country"
  destinationRegion?: string;  // "Europe", "Asia", etc.
}

export const DEFAULT_FILTERS: FilterState = {
  currentPeriodFrom: "2025-01-01",
  currentPeriodTo: "2025-12-31",
  previousPeriodFrom: "2024-01-01",
  previousPeriodTo: "2024-12-31",
};

// ─── Dashboard filter widget IDs ─────────────────────────────────────────────
// Global Filters page ID: 54194f59
const GLOBAL_PAGE = "54194f59";
const FILTER_WIDGETS = {
  period: "period",                    // date-range-picker → current_period param
  previousPeriod: "previous_period",   // date-range-picker → previous_period param
  travelSector: "tsector",             // single-select → travel_sector field
  destinationRegion: "dest_region",    // single-select → destination_region field
};

// ─── URL helpers ─────────────────────────────────────────────────────────────

function buildFilterParams(filters: FilterState): string {
  const params: string[] = [];

  // Date range filters: f_{globalPage}~{widget}={from}~{to}
  params.push(
    `f_${GLOBAL_PAGE}~${FILTER_WIDGETS.period}=${encodeURIComponent(filters.currentPeriodFrom + "T00:00:00.000")}~${encodeURIComponent(filters.currentPeriodTo + "T00:00:00.000")}`
  );
  params.push(
    `f_${GLOBAL_PAGE}~${FILTER_WIDGETS.previousPeriod}=${encodeURIComponent(filters.previousPeriodFrom + "T00:00:00.000")}~${encodeURIComponent(filters.previousPeriodTo + "T00:00:00.000")}`
  );

  // Field filters: f_{globalPage}~{widget}={value}
  if (filters.travelSector) {
    params.push(
      `f_${GLOBAL_PAGE}~${FILTER_WIDGETS.travelSector}=${encodeURIComponent(filters.travelSector)}`
    );
  }
  if (filters.destinationRegion) {
    params.push(
      `f_${GLOBAL_PAGE}~${FILTER_WIDGETS.destinationRegion}=${encodeURIComponent(filters.destinationRegion)}`
    );
  }

  return params.join("&");
}

export function buildNativeEmbedUrl(dashboardId: string, filters?: FilterState): string {
  let url = `${WORKSPACE}/embed/dashboardsv3/${dashboardId}?o=${ORG}`;
  if (filters) url += `&${buildFilterParams(filters)}`;
  return url;
}

export function buildPageEmbedUrl(dashboardId: string, pageId: string, filters?: FilterState): string {
  let url = `${WORKSPACE}/embed/dashboardsv3/${dashboardId}/pages/${pageId}?o=${ORG}`;
  if (filters) url += `&${buildFilterParams(filters)}`;
  return url;
}

/**
 * External (token) embedding: same /embed/ URL as basic embedding (so the
 * `f_…` filter params still apply), but with a scoped SP token in the `#token=`
 * hash instead of relying on a Databricks session cookie. This is what removes
 * the Databricks login screen for no-login / white-label viewers.
 */
export function buildTokenEmbedUrl(
  dashboardId: string,
  pageId: string,
  token: string,
  filters?: FilterState
): string {
  return `${buildPageEmbedUrl(dashboardId, pageId, filters)}#token=${token}`;
}

export interface EmbedTokenResponse {
  ok: boolean;
  token?: string;
  expires_in?: number;
  error?: string;
}

export async function fetchEmbedToken(dashboardId: string): Promise<EmbedTokenResponse> {
  const res = await fetch(`/api/embed/token?dashboard_id=${encodeURIComponent(dashboardId)}`);
  return (await res.json()) as EmbedTokenResponse;
}

/**
 * Converts FilterState to a context string for Genie chat.
 */
export function filtersToContext(filters: FilterState): string {
  const parts: string[] = [];
  parts.push(`Current period: ${filters.currentPeriodFrom} to ${filters.currentPeriodTo}`);
  parts.push(`Previous period: ${filters.previousPeriodFrom} to ${filters.previousPeriodTo}`);
  if (filters.travelSector) parts.push(`Travel sector: ${filters.travelSector}`);
  if (filters.destinationRegion) parts.push(`Destination region: ${filters.destinationRegion}`);
  return parts.join(". ");
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export const ROUTES: RouteConfig[] = [
  {
    path: "/spend-custom",
    label: "Spend",
    icon: "DollarSign",
    section: "insights",
    mode: "custom",
    dashboardId: DASHBOARDS.apex,
    pages: [
      { label: "Summary", pageId: "summary" },
      { label: "Carbon Forecasting", pageId: "carbon_forecasting" },
    ],
  },
  {
    path: "/sustainability",
    label: "Sustainability",
    icon: "Leaf",
    section: "insights",
    mode: "custom",
    dashboardId: DASHBOARDS.apex,
    pages: [
      { label: "Summary", pageId: "summary" },
      { label: "Carbon Forecasting", pageId: "carbon_forecasting" },
    ],
  },
  {
    path: "/genie-mcp",
    label: "Genie MCP",
    icon: "Sparkles",
    section: "exploration",
    mode: "react",
  },
];

// ─── Per-dashboard Genie config (executive summary + page Q&A) ────────────────
// Each dashboard page maps to a tailored executive-summary prompt and a set of
// suggested questions. The in-dashboard Ask APEX rail and the Executive Summary
// button both call the managed Genie MCP server (per-space) with these.

export interface DashboardGenieConfig {
  summaryPrompt: string;
  suggestions: string[];
}

const SPEND_GENIE: DashboardGenieConfig = {
  summaryPrompt:
    "Write a concise executive summary of corporate travel SPEND for the current period. " +
    "Cover total spend, the top spend categories, the top destinations, and the most " +
    "significant year-over-year changes. Use specific numbers and keep it to a few short paragraphs.",
  suggestions: [
    "Total spend by category for 2025?",
    "Top 10 destinations by gross spend USD?",
    "Compare spend 2025 vs 2024 by travel sector?",
  ],
};

const SUSTAINABILITY_GENIE: DashboardGenieConfig = {
  summaryPrompt:
    "Write a concise executive summary of travel SUSTAINABILITY for the current period. " +
    "Cover total CO2 emissions, emissions by travel category, the most carbon-intensive " +
    "categories or destinations, and notable year-over-year changes. Use specific numbers " +
    "and keep it to a few short paragraphs.",
  suggestions: [
    "Total emissions by category for 2025?",
    "Top 5 countries by CO2 emissions?",
    "What is the emissions per km for Air travel?",
  ],
};

const CARBON_FORECAST_GENIE: DashboardGenieConfig = {
  summaryPrompt:
    "Summarize the carbon emissions forecast: the projected CO2 emissions trend, the key " +
    "drivers behind it, and how the trajectory compares to the current period. Use specific numbers.",
  suggestions: [
    "What is the projected CO2 emissions trend?",
    "Which categories drive future emissions most?",
    "How do forecasted emissions compare to last year?",
  ],
};

// Keyed by route path, or `${path}:${pageId}` for custom multi-page dashboards.
export const DASHBOARD_GENIE: Record<string, DashboardGenieConfig> = {
  "/spend": SPEND_GENIE,
  "/spend-custom:summary": SPEND_GENIE,
  "/spend-custom:carbon_forecasting": CARBON_FORECAST_GENIE,
  "/sustainability:summary": SUSTAINABILITY_GENIE,
  "/sustainability:carbon_forecasting": CARBON_FORECAST_GENIE,
};

export function getDashboardGenie(path: string, pageId?: string): DashboardGenieConfig {
  if (pageId && DASHBOARD_GENIE[`${path}:${pageId}`]) {
    return DASHBOARD_GENIE[`${path}:${pageId}`];
  }
  return DASHBOARD_GENIE[path] ?? SPEND_GENIE;
}

// ─── Executive summary prompt formatting ──────────────────────────────────────
// The Executive Summary modal calls the workspace-wide Genie MCP ("multi" mode)
// and asks for a fixed three-section markdown layout so every page renders a
// consistent, board-ready brief.

export function buildExecSummaryPrompt(summaryPrompt: string): string {
  return (
    `${summaryPrompt}\n\n` +
    "Format the response as markdown with EXACTLY these three sections, each as a `## ` heading and in this order:\n" +
    "## Overview\n" +
    "A 2-3 sentence narrative of the headline story for this view.\n" +
    "## KPIs\n" +
    "A bullet list of the most important metrics with specific numbers, including year-over-year change where available.\n" +
    "## Strategic Insights\n" +
    "3-4 concise, actionable bullet points calling out notable risks, opportunities, or recommended actions.\n\n" +
    "Be specific and quantitative. Do not add any sections beyond these three."
  );
}
