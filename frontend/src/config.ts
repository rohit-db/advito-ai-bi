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
  multiPage: "01f11c0671df190d96063a4632a3611a",
  singlePage: "01f1169e4b5810418541b22a792aa916",
} as const;

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
    dashboardId: DASHBOARDS.multiPage,
  },
  {
    path: "/spend-custom",
    label: "Spend Custom",
    icon: "DollarSign",
    section: "insights",
    mode: "custom",
    dashboardId: DASHBOARDS.multiPage,
    pages: [
      { label: "Summary", pageId: "5a35864d" },
      { label: "Global Filters", pageId: "ceb09eeb" },
      { label: "Detail", pageId: "75ecdc14" },
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
    dashboardId: DASHBOARDS.multiPage,
    pages: [
      { label: "Summary", pageId: "5a35864d" },
      { label: "Comparative", pageId: "ceb09eeb" },
      { label: "Carbon Budgets", pageId: "75ecdc14" },
      { label: "Forecasting", pageId: "TODO" },
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
