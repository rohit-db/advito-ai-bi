import type { FilterKey } from "@/config";

/** One page within a dashboard asset (its id, label, and Genie wiring). */
export interface AssetPage {
  pageId: string;
  label: string;
  summaryPrompt: string;
  suggestions: string[];
}

/**
 * A dashboard asset: the full spec the app renders + wires. Structural superset
 * of config.ts DashboardSpec (adds `label`, `pages`; the physical Lakeview id is
 * `dashboardId`). Filter render vocabulary (FilterKey) lives in config.ts FILTERS;
 * `filters` only references those keys.
 */
export interface AssetSpec {
  label: string;
  dashboardId: string;
  globalFilterPage: string;
  filters: Partial<Record<FilterKey, string>>;
  workspace?: string;
  org?: string;
  pages: AssetPage[];
}

export interface Registry {
  assets: Record<string, AssetSpec>;
}
