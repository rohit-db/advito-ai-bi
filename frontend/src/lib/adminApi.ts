// =============================================================================
// Admin API client — Service Principals / Tenants
//
// Typed wrapper around the operator-only `/api/tenants` endpoints that back
// per-tenant Service Principal isolation. Every call uses the session cookie
// (`credentials: "include"`) and centralises error handling: a non-2xx response
// throws an `AdminApiError` that carries the HTTP status (so the page can render
// dedicated 401 "not logged in" / 403 "operator access required" states) plus a
// parsed `detail` message when the backend provides one.
// =============================================================================

import type { AssetSpec } from "@/registry/types";

// ─── Types (mirror the backend contract) ─────────────────────────────────────

export interface TenantOut {
  tenant_id: string;
  display_name: string;
  sp_app_id: string;
  sp_display_name: string;
  status: "active" | "deactivated" | string;
  genie_space_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditRow {
  id: number;
  tenant_id?: string | null;
  actor?: string | null;
  action: string;
  sp_app_id?: string | null;
  status: string;
  detail?: string | null;
  latency_ms?: number | null;
  created_at: string;
}

export interface VerifyRow {
  tenant_id: string;
  display_name: string;
  passed: boolean;
  distinct_tenant_ids: string[];
  session_user?: string;
  visible_row_count?: number;
  error?: string;
}

export interface OnboardBody {
  tenant_id: string;
  display_name: string;
  genie_space_id?: string;
}

export interface OnboardResult {
  tenant: TenantOut;
  client_id: string;
  client_secret: string;
}

export interface RotateResult {
  tenant_id: string;
  new_client_secret: string;
}

export interface ReactivateResult {
  tenant_id: string;
  new_client_secret: string;
}

export interface OkResult {
  ok: boolean;
  tenant_id: string;
}

// ─── Resource access (dashboards + Genie spaces) ─────────────────────────────

export interface ResourceItem {
  id: string;
  name: string;
}

export interface ResourceCatalog {
  dashboards: ResourceItem[];
  genie_spaces: ResourceItem[];
}

export type ResourceType = "dashboard" | "genie_space";

export interface SetAccessBody {
  resource_type: ResourceType;
  resource_id: string;
  grant: boolean;
}

export interface AvailableClient {
  tenant_id: string;
  display_name: string;
  onboarded: boolean;
}

export interface AvailableClientsResult {
  configured: boolean;
  source_table?: string | null;
  clients: AvailableClient[];
  error?: string;
}

// ─── Error handling ──────────────────────────────────────────────────────────

/**
 * Error thrown for any non-2xx response. `status` is the HTTP status code so the
 * page can special-case 401 (not logged in) and 403 (not an operator); `detail`
 * is the human-readable message parsed from the response body when available.
 */
export class AdminApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "AdminApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function isAdminApiError(err: unknown): err is AdminApiError {
  return err instanceof AdminApiError;
}

async function parseDetail(res: Response): Promise<string> {
  try {
    const data = await res.json();
    // FastAPI-style { detail }, plus a few common fallbacks.
    const detail =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.detail?.message === "string" && data.detail.message) ||
      (typeof data?.error === "string" && data.error) ||
      (typeof data?.message === "string" && data.message) ||
      "";
    if (detail) return detail;
  } catch {
    /* body was not JSON */
  }
  return res.statusText || `Request failed (${res.status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch (err) {
    // Network / CORS failure — surface as a status-0 error.
    throw new AdminApiError(0, err instanceof Error ? err.message : "Network error");
  }

  if (!res.ok) {
    throw new AdminApiError(res.status, await parseDetail(res));
  }

  // 204 / empty body → return undefined cast to T.
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new AdminApiError(
      res.status,
      "Unexpected response from server — restart the app to pick up new API routes."
    );
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new AdminApiError(res.status, "Invalid JSON response from server");
  }
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export function listTenants(): Promise<{ tenants: TenantOut[] }> {
  return request<{ tenants: TenantOut[] }>("/api/tenants");
}

export function onboard(body: OnboardBody): Promise<OnboardResult> {
  return request<OnboardResult>("/api/tenants/onboard", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function rotate(tenantId: string): Promise<RotateResult> {
  return request<RotateResult>(`/api/tenants/${encodeURIComponent(tenantId)}/rotate`, {
    method: "POST",
  });
}

export function deactivate(tenantId: string): Promise<OkResult> {
  return request<OkResult>(`/api/tenants/${encodeURIComponent(tenantId)}/deactivate`, {
    method: "POST",
  });
}

export function reactivate(tenantId: string): Promise<ReactivateResult> {
  return request<ReactivateResult>(`/api/tenants/${encodeURIComponent(tenantId)}/reactivate`, {
    method: "POST",
  });
}

export function remove(tenantId: string): Promise<OkResult> {
  return request<OkResult>(`/api/tenants/${encodeURIComponent(tenantId)}`, {
    method: "DELETE",
  });
}

export function history(tenantId: string, limit = 50): Promise<{ rows: AuditRow[] }> {
  return request<{ rows: AuditRow[] }>(
    `/api/tenants/${encodeURIComponent(tenantId)}/history?limit=${encodeURIComponent(limit)}`
  );
}

export function verify(): Promise<{ results: VerifyRow[] }> {
  return request<{ results: VerifyRow[] }>("/api/tenants/verify", {
    method: "POST",
  });
}

export function audit(limit = 20): Promise<{ rows: AuditRow[] }> {
  return request<{ rows: AuditRow[] }>(`/api/tenants/audit?limit=${encodeURIComponent(limit)}`);
}

export function resources(): Promise<ResourceCatalog> {
  return request<ResourceCatalog>("/api/tenants/resources");
}

export function availableClients(): Promise<AvailableClientsResult> {
  return request<AvailableClientsResult>("/api/tenants/available-clients");
}

export function setAccess(tenantId: string, body: SetAccessBody): Promise<OkResult> {
  return request<OkResult>(`/api/tenants/${encodeURIComponent(tenantId)}/access`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Login users (white-label directory) ─────────────────────────────────────

export interface AppUserOut {
  email: string;
  display_name: string;
  tenant: string;
  tenant_id: string;
  role: string;
}

export interface AppUsersResult {
  users: AppUserOut[];
  writable: boolean;
}

export interface AppUserCreateBody {
  email: string;
  password: string;
  display_name: string;
  tenant: string;
  tenant_id: string;
  role?: string;
}

export interface AppUserUpdateBody {
  display_name?: string;
  tenant?: string;
  tenant_id?: string;
  role?: string;
  password?: string;
}

export function listAppUsers(): Promise<AppUsersResult> {
  return request<AppUsersResult>("/api/users");
}

export function createAppUser(body: AppUserCreateBody): Promise<{ user: AppUserOut }> {
  return request<{ user: AppUserOut }>("/api/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateAppUser(
  email: string,
  body: AppUserUpdateBody
): Promise<{ user: AppUserOut }> {
  return request<{ user: AppUserOut }>(`/api/users/${encodeURIComponent(email)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteAppUser(email: string): Promise<{ ok: boolean; email: string }> {
  return request<{ ok: boolean; email: string }>(`/api/users/${encodeURIComponent(email)}`, {
    method: "DELETE",
  });
}

// ─── Dashboard asset registry (operator write-surface) ───────────────────────

export interface AssetRow {
  asset_key: string;
  spec: AssetSpec;
  sort_order: number;
  active: boolean;
}

export interface AdminAssetsResult {
  assets: AssetRow[];
  writable: boolean;
}

export interface SaveAssetBody {
  asset_key: string;
  spec: AssetSpec;
  sort_order?: number;
  active?: boolean;
}

export function listAdminAssets(): Promise<AdminAssetsResult> {
  return request<AdminAssetsResult>("/api/admin/assets");
}

export function saveAdminAsset(body: SaveAssetBody): Promise<{ asset: AssetRow }> {
  return request<{ asset: AssetRow }>("/api/admin/assets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteAdminAsset(assetKey: string): Promise<{ ok: boolean; asset_key: string }> {
  return request<{ ok: boolean; asset_key: string }>(
    `/api/admin/assets/${encodeURIComponent(assetKey)}`,
    { method: "DELETE" }
  );
}

// ─── Tenant × asset access matrix (grid aggregate) ───────────────────────────

export interface AccessMatrixResult {
  tenants: Record<
    string,
    {
      sp_app_id: string;
      access: {
        dashboards: Record<string, boolean>;
        genie_spaces: Record<string, boolean>;
      };
    }
  >;
}

export function accessMatrix(): Promise<AccessMatrixResult> {
  return request<AccessMatrixResult>("/api/tenants/access-matrix");
}
