import { useEffect, useRef, useState } from "react";
import { History } from "lucide-react";
import type { AuditRow, TenantOut } from "@/lib/adminApi";
import { AuditStatusBadge, Drawer, Spinner, formatAbsolute, relativeTime } from "./shared";

export interface HistoryDrawerProps {
  tenant: TenantOut;
  run: (tenantId: string) => Promise<{ rows: AuditRow[] }>;
  onClose: () => void;
}

export default function HistoryDrawer({ tenant, run, onClose }: HistoryDrawerProps) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await run(tenant.tenant_id);
        setRows(res.rows ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load history");
      } finally {
        setLoading(false);
      }
    })();
  }, [run, tenant.tenant_id]);

  return (
    <Drawer
      title={tenant.display_name || tenant.tenant_id}
      subtitle={`Audit history · ${tenant.tenant_id}`}
      icon={<History size={18} />}
      onClose={onClose}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
          <Spinner size={24} />
          <span className="text-xs font-medium">Loading history…</span>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-400">No audit entries yet.</div>
      ) : (
        <ol className="relative space-y-4 border-l border-slate-200 pl-5">
          {rows.map((row) => (
            <li key={row.id} className="relative">
              <span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-400" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">{row.action}</span>
                <AuditStatusBadge status={row.status} />
              </div>
              <div
                className="mt-0.5 text-[11px] text-slate-400"
                title={formatAbsolute(row.created_at)}
              >
                {relativeTime(row.created_at)}
                {row.actor ? ` · ${row.actor}` : ""}
                {typeof row.latency_ms === "number" ? ` · ${row.latency_ms}ms` : ""}
              </div>
              {row.detail && (
                <p className="mt-1 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 break-words">
                  {row.detail}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}
