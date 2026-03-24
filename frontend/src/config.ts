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
  dateRange?: { from: string; to: string };
  region?: string[];
  travelCategory?: string[];
  agency?: string[];
  [key: string]: unknown;
}

// ─── Default filters ──────────────────────────────────────────────────────────

export const DEFAULT_FILTERS: FilterState = {
  dateRange: undefined,
  region: [],
  travelCategory: [],
  agency: [],
};

// ─── URL helpers ─────────────────────────────────────────────────────────────

/**
 * Builds a native AI/BI embed URL (standard iframe embed).
 */
export function buildNativeEmbedUrl(dashboardId: string): string {
  return `${WORKSPACE}/embed/dashboardsv3/${dashboardId}?o=${ORG}`;
}

/**
 * Builds an embed URL for a specific page within a multi-page dashboard.
 */
export function buildPageEmbedUrl(dashboardId: string, pageId: string): string {
  return `${WORKSPACE}/embed/dashboardsv3/${dashboardId}?o=${ORG}&page=${pageId}`;
}

/**
 * Converts a FilterState to a plain string context for Genie chat prompts.
 */
export function filtersToContext(filters: FilterState): string {
  const parts: string[] = [];

  if (filters.dateRange?.from && filters.dateRange?.to) {
    parts.push(`Date range: ${filters.dateRange.from} to ${filters.dateRange.to}`);
  }
  if (filters.region && filters.region.length > 0) {
    parts.push(`Region: ${filters.region.join(", ")}`);
  }
  if (filters.travelCategory && filters.travelCategory.length > 0) {
    parts.push(`Travel category: ${filters.travelCategory.join(", ")}`);
  }
  if (filters.agency && filters.agency.length > 0) {
    parts.push(`Agency: ${filters.agency.join(", ")}`);
  }

  // Handle any additional keys
  for (const [key, value] of Object.entries(filters)) {
    if (["dateRange", "region", "travelCategory", "agency"].includes(key)) continue;
    if (value !== undefined && value !== null) {
      parts.push(`${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`);
    }
  }

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
      { label: "Summary", pageId: "139fe555" },
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
      { label: "Summary", pageId: "139fe555" },
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
