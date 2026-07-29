import { useOutletContext } from "react-router-dom";
import type { AuditRow } from "@/lib/adminApi";

/** Admin route paths — single source (replaces AdminPage's ADMIN_ROUTE_PATH). */
export const ADMIN_BASE = "/admin";
export const ADMIN_ASSETS_PATH = "/admin/assets";
export const ADMIN_TENANTS_PATH = "/admin/tenants";
export const ADMIN_ACCESS_PATH = "/admin/access";

/** Sections shown in the context-aware admin sidebar. icon is an ICON_MAP key. */
export const ADMIN_SECTIONS = [
  { path: ADMIN_ASSETS_PATH, label: "Assets", icon: "LayoutDashboard" },
  { path: ADMIN_ACCESS_PATH, label: "Tenant access", icon: "ShieldCheck" },
  { path: ADMIN_TENANTS_PATH, label: "Users & SPs", icon: "Users" },
] as const;

/** Shared state AdminLayout provides to its sub-pages via <Outlet context>. */
export interface AdminOutletContext {
  audit: AuditRow[];
  auditLoading: boolean;
  auditError: string | null;
  auditRefreshing: boolean;
  /** Flip the layout's 401/403 gate when a call reveals an access problem. */
  reportAccessError: (err: unknown) => void;
  /** Re-fetch tenants/users/audit (used after a mutation). */
  refreshAll: () => void;
}

export function useAdminOutlet(): AdminOutletContext {
  return useOutletContext<AdminOutletContext>();
}
