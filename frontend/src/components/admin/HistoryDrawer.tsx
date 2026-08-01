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
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Spinner size={24} />
          <span className="text-xs font-medium">Loading history…</span>
        </div>
      ) : error ? (
        <div className="rounded border border-[var(--border-danger)] bg-[var(--background-danger)] px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">No audit entries yet.</div>
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-5">
          {rows.map((row) => (
            <li key={row.id} className="relative">
              <span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{row.action}</span>
                <AuditStatusBadge status={row.status} />
              </div>
              <div
                className="mt-0.5 text-[11px] text-muted-foreground"
                title={formatAbsolute(row.created_at)}
              >
                {relativeTime(row.created_at)}
                {row.actor ? ` · ${row.actor}` : ""}
                {typeof row.latency_ms === "number" ? ` · ${row.latency_ms}ms` : ""}
              </div>
              {row.detail && (
                <p className="mt-1 rounded bg-secondary px-2.5 py-1.5 text-xs text-muted-foreground break-words">
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
