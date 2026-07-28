import { useOutletContext } from "react-router-dom";
import type { AuditRow } from "@/lib/adminApi";

/** Admin route paths — single source (replaces AdminPage's ADMIN_ROUTE_PATH). */
export const ADMIN_BASE = "/admin";
export const ADMIN_ASSETS_PATH = "/admin/assets";
export const ADMIN_TENANTS_PATH = "/admin/tenants";

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
