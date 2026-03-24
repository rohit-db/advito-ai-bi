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
export const MAS_ENDPOINT_NAME = "mas-d4bc5d36-endpoint";

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
  let url = `${WORKSPACE}/embed/dashboardsv3/${dashboardId}/published/pages/${pageId}?o=${ORG}`;
  if (filters) url += `&${buildFilterParams(filters)}`;
  return url;
}

/**
 * Converts FilterState to a context string for Genie/MAS chat.
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
    path: "/spend",
    label: "Spend",
    icon: "DollarSign",
    section: "insights",
    mode: "native",
    dashboardId: DASHBOARDS.apex,
  },
  {
    path: "/spend-custom",
    label: "Spend Custom",
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
    path: "/suppliers",
    label: "Suppliers",
    icon: "Users",
    section: "insights",
    mode: "placeholder",
  },
  {
    path: "/general-mgt",
    label: "General MGT",
    icon: "Briefcase",
    section: "insights",
    mode: "placeholder",
  },
  {
    path: "/compliance",
    label: "Compliance",
    icon: "ShieldCheck",
    section: "insights",
    mode: "placeholder",
  },
  {
    path: "/well-being",
    label: "Well-Being",
    icon: "Heart",
    section: "insights",
    mode: "placeholder",
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
    path: "/engage",
    label: "Engage",
    icon: "Zap",
    section: "insights",
    mode: "placeholder",
  },
  {
    path: "/reports",
    label: "Reports",
    icon: "FileText",
    section: "exploration",
    mode: "placeholder",
  },
  {
    path: "/data-store",
    label: "Data Store",
    icon: "Database",
    section: "exploration",
    mode: "placeholder",
  },
  {
    path: "/apex-qa",
    label: "APEX Q&A",
    icon: "MessageCircle",
    section: "exploration",
    mode: "react",
  },
  {
    path: "/community",
    label: "Community",
    icon: "UsersRound",
    section: "exploration",
    mode: "placeholder",
  },
];
