import { useCallback, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import * as adminApi from "@/lib/adminApi";
import type { ResourceCatalog, TenantOut, ResourceType } from "@/lib/adminApi";
import { Spinner } from "./shared";

type Access = { dashboards: Record<string, boolean>; genie_spaces: Record<string, boolean> };

/**
 * Tenant × asset access matrix. Rows = tenants, columns = grantable dashboards +
 * Genie spaces. Each cell is a CAN_RUN toggle wired to the unchanged
 * POST /api/tenants/{id}/access (optimistic, reverted on error) — the same
 * grant/revoke path the old per-row AccessDialog used, now scannable at a glance.
 */
export default function AccessGrid({ onAccessError }: { onAccessError?: (err: unknown) => void }) {
  const [catalog, setCatalog] = useState<ResourceCatalog | null>(null);
  const [tenants, setTenants] = useState<TenantOut[]>([]);
  const [access, setAccess] = useState<Record<string, Access>>({}); // tenant_id -> Access
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCell, setBusyCell] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([adminApi.resources(), adminApi.listTenants(), adminApi.accessMatrix()])
      .then(([cat, t, matrix]) => {
        if (cancelled) return;
        setCatalog(cat);
        setTenants(t.tenants ?? []);
        const acc: Record<string, Access> = {};
        for (const [tid, entry] of Object.entries(matrix.tenants ?? {})) acc[tid] = entry.access;
        setAccess(acc);
      })
      .catch((err) => {
        if (cancelled) return;
        onAccessError?.(err);
        setError(err instanceof Error ? err.message : "Could not load access matrix");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [onAccessError]);

  const toggle = useCallback(
    async (tenantId: string, type: ResourceType, id: string, next: boolean) => {
      const bucket = type === "dashboard" ? "dashboards" : "genie_spaces";
      const cellKey = `${tenantId}:${type}:${id}`;
      setBusyCell(cellKey);
      setError(null);
      setAccess((a) => ({ ...a, [tenantId]: { ...a[tenantId], [bucket]: { ...a[tenantId]?.[bucket], [id]: next } } }));
      try {
        await adminApi.setAccess(tenantId, { resource_type: type, resource_id: id, grant: next });
      } catch (err) {
        setAccess((a) => ({ ...a, [tenantId]: { ...a[tenantId], [bucket]: { ...a[tenantId]?.[bucket], [id]: !next } } }));
        onAccessError?.(err);
        setError(err instanceof Error ? err.message : "Could not update access");
      } finally {
        setBusyCell(null);
      }
    },
    [onAccessError]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
        <Spinner size={20} /> <span className="text-xs">Loading access…</span>
      </div>
    );
  }

  if (error && !catalog) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  const cols: { type: ResourceType; id: string; name: string }[] = [
    ...(catalog?.dashboards ?? []).map((d) => ({ type: "dashboard" as const, id: d.id, name: d.name })),
    ...(catalog?.genie_spaces ?? []).map((s) => ({ type: "genie_space" as const, id: s.id, name: s.name })),
  ];

  if (cols.length === 0 || tenants.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-brand-border px-3 py-4 text-xs text-slate-400">
        {cols.length === 0 ? "No grantable resources configured." : "No tenants onboarded yet."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-brand-border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border bg-slate-50">
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tenant</th>
              {cols.map((c) => (
                <th key={`${c.type}:${c.id}`} className="px-3 py-2 text-center text-[11px] font-medium text-slate-600" title={c.id}>
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map((t) => {
              const deactivated = t.status !== "active";
              return (
                <tr key={t.tenant_id} className={deactivated ? "opacity-50" : ""}>
                  <td className="px-3 py-2 font-medium text-slate-800">{t.display_name || t.tenant_id}</td>
                  {cols.map((c) => {
                    const bucket = c.type === "dashboard" ? "dashboards" : "genie_spaces";
                    const on = !!access[t.tenant_id]?.[bucket]?.[c.id];
                    const cellKey = `${t.tenant_id}:${c.type}:${c.id}`;
                    return (
                      <td key={cellKey} className="px-3 py-2 text-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={`${t.display_name || t.tenant_id} access to ${c.name} (${c.id})`}
                          disabled={busyCell === cellKey || deactivated}
                          onClick={() => toggle(t.tenant_id, c.type, c.id, !on)}
                          className={[
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                            on ? "bg-brand-primary" : "bg-slate-300",
                            busyCell === cellKey ? "opacity-60" : "hover:opacity-90",
                          ].join(" ")}
                        >
                          <span className={["inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-relaxed text-slate-400">
        <KeyRound size={11} className="mr-1 inline" />
        Each toggle grants the tenant's Service Principal CAN_RUN on that resource. A Unity Catalog row filter still scopes the data.
      </p>
    </div>
  );
}
