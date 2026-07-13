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
  SlidersHorizontal,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

// =============================================================================
// APEX app configuration
//
// This file is the single place to WIRE the app:
//   1. DASHBOARDS  — register an AI/BI dashboard + how its filters are wired
//   2. FILTERS     — declare the logical filters the app knows about (UI + URL)
//   3. ROUTES      — map nav entries to dashboards, pages, and Genie wiring
//
// Adding a dashboard or changing which filters apply to a page should only
// require editing the declarative blocks below — not the components.
// =============================================================================

// ─── Workspace constants ───────────────────────────────────────────────────────
// Global defaults. Build-time overridable via Vite env (frontend/.env):
//   VITE_WORKSPACE_URL, VITE_WORKSPACE_ORG
// The literals below are the demo fallback so local dev works with no env set.
// A dashboard may also override these per-entry (see DashboardSpec).

export const WORKSPACE =
  import.meta.env.VITE_WORKSPACE_URL ?? "https://dbc-1e27e56a-90cd.cloud.databricks.com";
export const ORG = import.meta.env.VITE_WORKSPACE_ORG ?? "1048934788948873";

// Genie space backing the global "Ask APEX" experience.
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
  SlidersHorizontal,
  LayoutDashboard,
};

// ─── Filter state ───────────────────────────────────────────────────────────
// The app's filter model. Date ranges are always present (defaulted); field
// filters are optional. Dashboards opt into the subset they support (below).

export interface FilterState {
  currentPeriodFrom: string;   // "2025-01-01"
  currentPeriodTo: string;     // "2025-12-31"
  previousPeriodFrom: string;  // "2024-01-01"
  previousPeriodTo: string;    // "2024-12-31"
  travelSector?: string;       // "Inter Continental", "Intra Country", …
  destinationRegion?: string;  // "Europe", "Asia", …
}

export const DEFAULT_FILTERS: FilterState = {
  currentPeriodFrom: "2025-01-01",
  currentPeriodTo: "2025-12-31",
  previousPeriodFrom: "2024-01-01",
  previousPeriodTo: "2024-12-31",
};

// ─── Filter catalog ───────────────────────────────────────────────────────────
// Each logical filter declared ONCE: how it renders (FilterBar) and how it maps
// onto a FilterState field. A dashboard binds these keys to its own widget ids.

export type FilterKey =
  | "currentPeriod"
  | "previousPeriod"
  | "travelSector"
  | "destinationRegion";

interface DateRangeFilterDef {
  key: FilterKey;
  kind: "dateRange";
  label: string;
  fromField: keyof FilterState;
  toField: keyof FilterState;
}

interface FieldFilterDef {
  key: FilterKey;
  kind: "field";
  label: string;
  field: keyof FilterState;
  allLabel: string;
  options: string[];
}

export type FilterDef = DateRangeFilterDef | FieldFilterDef;

export const FILTERS: Record<FilterKey, FilterDef> = {
  currentPeriod: {
    key: "currentPeriod",
    kind: "dateRange",
    label: "Period",
    fromField: "currentPeriodFrom",
    toField: "currentPeriodTo",
  },
  previousPeriod: {
    key: "previousPeriod",
    kind: "dateRange",
    label: "vs",
    fromField: "previousPeriodFrom",
    toField: "previousPeriodTo",
  },
  travelSector: {
    key: "travelSector",
    kind: "field",
    label: "Sector",
    field: "travelSector",
    allLabel: "All Sectors",
    options: [
      "Domestic",
      "Regional",
      "Intra Country",
      "Intra Continental",
      "Inter Continental",
      "Intercontinental",
    ],
  },
  destinationRegion: {
    key: "destinationRegion",
    kind: "field",
    label: "Region",
    field: "destinationRegion",
    allLabel: "All Regions",
    options: [
      "Africa",
      "Asia",
      "Europe",
      "Latin America",
      "Middle East",
      "North America",
      "Southwestern Pacific",
      "Unknown",
    ],
  },
};

// ─── Dashboard registry ───────────────────────────────────────────────────────
// Register each AI/BI dashboard and WIRE its filters. `globalFilterPage` is the
// dashboard's "Global Filters" page id; `filters` maps a logical FilterKey to
// the widget id that drives it on THIS dashboard. Only listed filters are pushed
// into the embed URL and shown in the FilterBar — so different dashboards can
// expose different filter sets.

export interface DashboardSpec {
  id: string;                                   // Lakeview dashboard id
  globalFilterPage: string;                     // "Global Filters" page id
  filters: Partial<Record<FilterKey, string>>;  // FilterKey → widget id
  workspace?: string;                           // optional per-dashboard workspace
  org?: string;                                 // optional per-dashboard org id
}

export const DASHBOARDS: Record<string, DashboardSpec> = {
  apex: {
    id: "01f1271698161d42b3c66528415775e8",
    globalFilterPage: "54194f59",
    filters: {
      currentPeriod: "period",
      previousPeriod: "previous_period",
      travelSector: "tsector",
      destinationRegion: "dest_region",
    },
  },
};

export function getDashboardById(id: string): DashboardSpec | undefined {
  return Object.values(DASHBOARDS).find((d) => d.id === id);
}

export function getSupportedFilterKeys(spec?: DashboardSpec): FilterKey[] {
  if (!spec) return [];
  return (Object.keys(spec.filters) as FilterKey[]).filter((k) => !!spec.filters[k]);
}

// ─── Embed URL helpers ─────────────────────────────────────────────────────────
// Build /embed/ URLs with the dashboard's `f_…` filter params. Token embedding
// appends the scoped SP token in the `#token=` hash (white-label, no-login).

function serializeFilter(page: string, def: FilterDef, widget: string, f: FilterState): string | null {
  if (def.kind === "dateRange") {
    const from = f[def.fromField] as string | undefined;
    const to = f[def.toField] as string | undefined;
    if (!from || !to) return null;
    return `f_${page}~${widget}=${encodeURIComponent(from + "T00:00:00.000")}~${encodeURIComponent(to + "T00:00:00.000")}`;
  }
  const value = f[def.field] as string | undefined;
  if (!value) return null;
  return `f_${page}~${widget}=${encodeURIComponent(value)}`;
}

function buildFilterParams(spec: DashboardSpec, filters: FilterState): string {
  const params: string[] = [];
  for (const key of getSupportedFilterKeys(spec)) {
    const widget = spec.filters[key]!;
    const part = serializeFilter(spec.globalFilterPage, FILTERS[key], widget, filters);
    if (part) params.push(part);
  }
  return params.join("&");
}

function embedRoot(spec: DashboardSpec): string {
  return `${spec.workspace ?? WORKSPACE}/embed/dashboardsv3/${spec.id}`;
}

function embedOrgParam(spec: DashboardSpec): string {
  return `o=${spec.org ?? ORG}`;
}

export function buildPageEmbedUrl(spec: DashboardSpec, pageId: string, filters?: FilterState): string {
  let url = `${embedRoot(spec)}/pages/${pageId}?${embedOrgParam(spec)}`;
  if (filters) {
    const fp = buildFilterParams(spec, filters);
    if (fp) url += `&${fp}`;
  }
  return url;
}

/** True when any supported filter differs from the app default (dates included). */
export function shouldPassEmbedFilters(spec: DashboardSpec, filters: FilterState): boolean {
  for (const key of getSupportedFilterKeys(spec)) {
    const def = FILTERS[key];
    if (def.kind === "dateRange") {
      const from = filters[def.fromField] as string | undefined;
      const to = filters[def.toField] as string | undefined;
      if (
        from !== DEFAULT_FILTERS[def.fromField] ||
        to !== DEFAULT_FILTERS[def.toField]
      ) {
        return true;
      }
    } else if (filters[def.field]) {
      return true;
    }
  }
  return false;
}

/**
 * External (token) embedding: same /embed/ URL as basic embedding (so the
 * `f_…` filter params still apply), but with a scoped SP token in the `#token=`
 * hash instead of relying on a Databricks session cookie. This is what removes
 * the Databricks login screen for no-login / white-label viewers.
 */
export function buildTokenEmbedUrl(
  spec: DashboardSpec,
  pageId: string,
  token: string,
  filters?: FilterState
): string {
  return `${buildPageEmbedUrl(spec, pageId, filters)}#token=${token}`;
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

// ─── Landing-page KPIs (live, per-tenant, row-scoped) ─────────────────────────
// Headline metrics for the Home page. The backend runs a MEASURE() query on the
// travel_metrics metric view AS the logged-in tenant's Service Principal, so the
// numbers respect the same row-level isolation as the dashboards. Fails soft.

export interface KpiValues {
  spend: number | null;
  emissions: number | null;
  travelers: number | null;
  trips: number | null;
}

export interface KpiResponse {
  ok: boolean;
  current?: KpiValues;
  previous?: KpiValues;
  error?: string;
}

export async function fetchKpis(filters?: FilterState): Promise<KpiResponse> {
  try {
    const f = filters ?? DEFAULT_FILTERS;
    const qs = new URLSearchParams({
      current_from: f.currentPeriodFrom,
      current_to: f.currentPeriodTo,
      previous_from: f.previousPeriodFrom,
      previous_to: f.previousPeriodTo,
    });
    const res = await fetch(`/api/kpis?${qs.toString()}`);
    if (!res.ok) return { ok: false };
    return (await res.json()) as KpiResponse;
  } catch {
    return { ok: false };
  }
}

export interface TrendPoint {
  month: string; // "yyyy-MM"
  spend: number | null;
  emissions: number | null;
}

export interface TrendResponse {
  ok: boolean;
  series?: TrendPoint[];
  error?: string;
}

export async function fetchKpiTrend(filters?: FilterState): Promise<TrendResponse> {
  try {
    const f = filters ?? DEFAULT_FILTERS;
    const qs = new URLSearchParams({
      date_from: f.currentPeriodFrom,
      date_to: f.currentPeriodTo,
    });
    const res = await fetch(`/api/kpis/trend?${qs.toString()}`);
    if (!res.ok) return { ok: false };
    return (await res.json()) as TrendResponse;
  } catch {
    return { ok: false };
  }
}

// ─── APEX persistence API (Lakebase-backed) ──────────────────────────────────
// Conversation history + per-user dashboard filter preferences. Every helper
// fails soft (returns empty/null) so the UI still works when Lakebase is off.

export interface ConversationMeta {
  id: string;
  title: string;
  mode: string;
  created_at: string | null;
  updated_at: string | null;
  message_count: number;
}

export async function listConversations(): Promise<ConversationMeta[]> {
  try {
    const res = await fetch("/api/apex/conversations");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.conversations ?? []) as ConversationMeta[];
  } catch {
    return [];
  }
}

export async function createConversation(mode: string): Promise<string | null> {
  try {
    const res = await fetch("/api/apex/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.persisted ? (data.id as string) : null;
  } catch {
    return null;
  }
}

export async function getConversation(
  id: string
): Promise<{ id: string; title: string; mode: string; messages: any[] } | null> {
  try {
    const res = await fetch(`/api/apex/conversations/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function saveConversationTurn(
  id: string,
  user: string,
  assistant: unknown
): Promise<{ title?: string } | null> {
  try {
    const res = await fetch(`/api/apex/conversations/${encodeURIComponent(id)}/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, assistant }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function deleteConversation(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/apex/conversations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Sentinel "dashboard id" under which a user's GLOBAL default filter selection
// is stored (set on the Preferences page). Applied to any dashboard the user
// hasn't saved a dashboard-specific selection for.
export const DEFAULT_PREFS_KEY = "__default__";

export async function fetchFilterPrefs(dashboardId: string): Promise<Partial<FilterState> | null> {
  try {
    const res = await fetch(`/api/apex/filters/${encodeURIComponent(dashboardId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.filters ?? null) as Partial<FilterState> | null;
  } catch {
    return null;
  }
}

export async function saveFilterPrefs(dashboardId: string, filters: FilterState): Promise<void> {
  try {
    await fetch(`/api/apex/filters/${encodeURIComponent(dashboardId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filters }),
    });
  } catch {
    /* fail soft */
  }
}

function hasSavedFilterPrefs(prefs: Partial<FilterState> | null): prefs is Partial<FilterState> {
  return !!prefs && Object.keys(prefs).length > 0;
}

/** Merge My Filters defaults with any per-dashboard overrides from the FilterBar. */
export async function loadEffectiveFilterPrefs(dashboardId: string): Promise<FilterState> {
  const globalDefault = await fetchFilterPrefs(DEFAULT_PREFS_KEY);
  const base = { ...DEFAULT_FILTERS, ...(globalDefault || {}) };
  const perDashboard = await fetchFilterPrefs(dashboardId);
  if (!hasSavedFilterPrefs(perDashboard)) return base;
  // Per-dashboard keys overlay the global default; omitted keys inherit from My Filters.
  return { ...base, ...perDashboard };
}

/**
 * Converts FilterState to a context string for Genie chat. Only includes the
 * filters supported by the given dashboard (defaults to all when omitted).
 */
export function filtersToContext(filters: FilterState, spec?: DashboardSpec): string {
  const keys = spec ? getSupportedFilterKeys(spec) : (Object.keys(FILTERS) as FilterKey[]);
  const parts: string[] = [];
  for (const key of keys) {
    const def = FILTERS[key];
    if (def.kind === "dateRange") {
      const from = filters[def.fromField] as string | undefined;
      const to = filters[def.toField] as string | undefined;
      if (from && to) parts.push(`${def.label === "vs" ? "Previous period" : def.label}: ${from} to ${to}`);
    } else {
      const value = filters[def.field] as string | undefined;
      if (value) parts.push(`${def.label}: ${value}`);
    }
  }
  return parts.join(". ");
}

// ─── Genie wiring (executive summary + page Q&A) ──────────────────────────────
// Each page can carry its own tailored executive-summary prompt + suggested
// questions. The in-dashboard Ask APEX rail and the Executive Summary button
// both call the managed Genie MCP server with these.

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

// ─── Routes ──────────────────────────────────────────────────────────────────
// `dashboard` is a key into DASHBOARDS. Each page can override Genie wiring;
// otherwise the route-level `genie` (then a safe fallback) is used.

export interface PageConfig {
  label: string;
  pageId: string;
  genie?: DashboardGenieConfig;
}

export type RouteMode = "custom" | "placeholder" | "react";

export interface RouteConfig {
  path: string;
  label: string;
  icon: string; // key into ICON_MAP
  section: "insights" | "exploration";
  mode: RouteMode;
  dashboard?: string;            // key into DASHBOARDS
  pages?: PageConfig[];
  genie?: DashboardGenieConfig;  // route-level default Genie wiring
}

export const ROUTES: RouteConfig[] = [
  {
    path: "/",
    label: "Home",
    icon: "LayoutDashboard",
    section: "insights",
    mode: "react",
  },
  {
    path: "/spend-custom",
    label: "Spend",
    icon: "DollarSign",
    section: "insights",
    mode: "custom",
    dashboard: "apex",
    genie: SPEND_GENIE,
    pages: [
      { label: "Summary", pageId: "summary", genie: SPEND_GENIE },
      { label: "Carbon Forecasting", pageId: "carbon_forecasting", genie: CARBON_FORECAST_GENIE },
    ],
  },
  {
    path: "/sustainability",
    label: "Sustainability",
    icon: "Leaf",
    section: "insights",
    mode: "custom",
    dashboard: "apex",
    genie: SUSTAINABILITY_GENIE,
    pages: [
      { label: "Summary", pageId: "summary", genie: SUSTAINABILITY_GENIE },
      { label: "Carbon Forecasting", pageId: "carbon_forecasting", genie: CARBON_FORECAST_GENIE },
    ],
  },
  {
    path: "/genie-mcp",
    label: "Ask APEX",
    icon: "Sparkles",
    section: "exploration",
    mode: "react",
  },
  {
    path: "/preferences",
    label: "My Filters",
    icon: "SlidersHorizontal",
    section: "exploration",
    mode: "react",
  },
];

export function getDashboard(route?: RouteConfig): DashboardSpec | undefined {
  return route?.dashboard ? DASHBOARDS[route.dashboard] : undefined;
}

export function getDashboardGenie(route?: RouteConfig, pageId?: string): DashboardGenieConfig {
  const page = route?.pages?.find((p) => p.pageId === pageId);
  return page?.genie ?? route?.genie ?? SPEND_GENIE;
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
