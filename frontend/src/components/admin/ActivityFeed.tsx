import { Activity } from "lucide-react";
import type { AuditRow } from "@/lib/adminApi";
import { AuditStatusBadge, Spinner, formatAbsolute, relativeTime } from "./shared";

export interface ActivityFeedProps {
  rows: AuditRow[];
  loading: boolean;
  error: string | null;
  refreshing?: boolean;
}

export default function ActivityFeed({ rows, loading, error, refreshing }: ActivityFeedProps) {
  return (
    <div className="rounded-md border border-border bg-background shadow-[var(--shadow-db-sm)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {refreshing && <Spinner size={12} />}
          <span>auto-refreshing</span>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {loading && rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <Spinner size={22} />
            <span className="text-xs font-medium">Loading activity…</span>
          </div>
        ) : error && rows.length === 0 ? (
          <div className="m-4 rounded border border-[var(--border-danger)] bg-[var(--background-danger)] px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No activity recorded yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-5 py-3 hover:bg-[var(--action-default-bg-hover)]">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/10" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-foreground">{row.action}</span>
                      {row.tenant_id && (
                        <code className="font-mono text-[11px] text-muted-foreground truncate">
                          {row.tenant_id}
                        </code>
                      )}
                    </div>
                    <AuditStatusBadge status={row.status} />
                  </div>
                  <div
                    className="mt-0.5 text-[11px] text-muted-foreground"
                    title={formatAbsolute(row.created_at)}
                  >
                    {relativeTime(row.created_at)}
                    {row.actor ? ` · ${row.actor}` : ""}
                  </div>
                  {row.detail && (
                    <p className="mt-1 text-xs text-muted-foreground break-words line-clamp-2">{row.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
