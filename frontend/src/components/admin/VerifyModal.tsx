import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { VerifyRow } from "@/lib/adminApi";
import { Modal, Spinner } from "./shared";

export interface VerifyModalProps {
  run: () => Promise<{ results: VerifyRow[] }>;
  onClose: () => void;
}

/**
 * Runs POST /api/tenants/verify and shows per-tenant pass/fail. A "pass" means
 * the tenant SP saw only its own tenant_id in the UC-filtered data (i.e. the row
 * filter correctly isolates it).
 */
export default function VerifyModal({ run, onClose }: VerifyModalProps) {
  const [rows, setRows] = useState<VerifyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await run();
      setRows(res.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    execute();
  }, [execute]);

  const passCount = rows.filter((r) => r.passed).length;
  const allPass = rows.length > 0 && passCount === rows.length;

  return (
    <Modal
      title="Verify isolation"
      subtitle="Confirms each tenant SP only sees its own rows via the UC row filter"
      icon={<ShieldCheck size={18} />}
      onClose={onClose}
      maxWidthClass="max-w-2xl"
      footer={
        <>
          {rows.length > 0 && !loading && (
            <span
              className={cn(
                "mr-auto text-xs font-medium",
                allPass ? "text-[var(--success)]" : "text-destructive"
              )}
            >
              {passCount}/{rows.length} tenants isolated
            </span>
          )}
          <Button variant="default" size="sm" onClick={execute} disabled={loading} className="gap-1.5">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Re-run
          </Button>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {loading && rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
          <Spinner size={26} />
          <span className="text-xs font-medium">Running isolation checks across all tenants…</span>
        </div>
      ) : error ? (
        <div className="rounded border border-[var(--border-danger)] bg-[var(--background-danger)] px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">No tenants to verify.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.tenant_id}
              className={cn(
                "rounded-md border p-4",
                r.passed ? "border-[var(--border-success)] bg-[var(--background-success)]" : "border-[var(--border-danger)] bg-[var(--background-danger)]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {r.display_name || r.tenant_id}
                    </span>
                    <code className="font-mono text-[11px] text-muted-foreground">{r.tenant_id}</code>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0",
                    r.passed
                      ? "bg-[var(--background-success)] text-[var(--success)]"
                      : "bg-[var(--background-danger)] text-destructive"
                  )}
                >
                  {r.passed ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {r.passed ? "Isolated" : "Leak detected"}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Distinct tenant_ids</dt>
                  <dd className="font-mono text-foreground break-all">
                    {r.distinct_tenant_ids?.length ? r.distinct_tenant_ids.join(", ") : "—"}
                  </dd>
                </div>
                {r.session_user !== undefined && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Session user</dt>
                    <dd className="font-mono text-foreground break-all">{r.session_user || "—"}</dd>
                  </div>
                )}
                {r.visible_row_count !== undefined && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground">Visible rows</dt>
                    <dd className="text-foreground">{r.visible_row_count.toLocaleString()}</dd>
                  </div>
                )}
              </dl>

              {r.error && (
                <div className="mt-2 rounded-md bg-[var(--background-danger)] px-2.5 py-1.5 font-mono text-[11px] text-destructive break-all">
                  {r.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
