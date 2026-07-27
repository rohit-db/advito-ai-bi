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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-brand-accent" />
          <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          {refreshing && <Spinner size={12} />}
          <span>auto-refreshing</span>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {loading && rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
            <Spinner size={22} />
            <span className="text-xs font-medium">Loading activity…</span>
          </div>
        ) : error && rows.length === 0 ? (
          <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">No activity recorded yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/70">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-primary-light" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-slate-800">{row.action}</span>
                      {row.tenant_id && (
                        <code className="font-mono text-[11px] text-slate-400 truncate">
                          {row.tenant_id}
                        </code>
                      )}
                    </div>
                    <AuditStatusBadge status={row.status} />
                  </div>
                  <div
                    className="mt-0.5 text-[11px] text-slate-400"
                    title={formatAbsolute(row.created_at)}
                  >
                    {relativeTime(row.created_at)}
                    {row.actor ? ` · ${row.actor}` : ""}
                  </div>
                  {row.detail && (
                    <p className="mt-1 text-xs text-slate-500 break-words line-clamp-2">{row.detail}</p>
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
