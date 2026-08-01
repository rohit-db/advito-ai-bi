import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { LockKeyhole, ShieldX } from "lucide-react";
import * as adminApi from "@/lib/adminApi";
import type { AuditRow } from "@/lib/adminApi";
import { isAdminApiError } from "@/lib/adminApi";
import type { AdminOutletContext } from "@/components/admin/adminContext";

const AUDIT_POLL_MS = 8000;

export default function AdminLayout() {
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditRefreshing, setAuditRefreshing] = useState(false);
  const [accessError, setAccessError] = useState<{ status: number; detail: string } | null>(null);
  const gatedRef = useRef(false);

  const reportAccessError = useCallback((err: unknown) => {
    if (isAdminApiError(err) && (err.status === 401 || err.status === 403) && !gatedRef.current) {
      gatedRef.current = true;
      setAccessError({ status: err.status, detail: err.detail });
    }
  }, []);

  const loadAudit = useCallback(async (background = false) => {
    if (background) setAuditRefreshing(true);
    try {
      const res = await adminApi.audit(20);
      setAudit(res.rows ?? []);
      setAuditError(null);
    } catch (err) {
      reportAccessError(err);
      setAuditError(err instanceof Error ? err.message : "Could not load activity");
    } finally {
      setAuditLoading(false);
      if (background) setAuditRefreshing(false);
    }
  }, [reportAccessError]);

  const refreshAll = useCallback(() => {
    loadAudit(true);
  }, [loadAudit]);

  useEffect(() => { loadAudit(); }, [loadAudit]);
  useEffect(() => {
    if (accessError) return;
    const id = window.setInterval(() => { if (!gatedRef.current) loadAudit(true); }, AUDIT_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadAudit, accessError]);

  if (accessError) return <AccessGate status={accessError.status} detail={accessError.detail} />;

  const ctx: AdminOutletContext = { audit, auditLoading, auditError, auditRefreshing, reportAccessError, refreshAll };

  return (
    <div className="h-full overflow-y-auto bg-secondary">
      {/* The bare /admin path is handled by the router `index` route (App.tsx),
          which renders AssetsPage — no redirect needed here. */}
      <Outlet context={ctx} />
    </div>
  );
}

function AccessGate({ status, detail }: { status: number; detail: string }) {
  const notLoggedIn = status === 401;
  return (
    <div className="flex h-full items-center justify-center bg-secondary p-6">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-md border border-border bg-background p-8 text-center shadow-[var(--shadow-db-sm)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-primary/10">
          {notLoggedIn ? <LockKeyhole size={28} className="text-primary" /> : <ShieldX size={28} className="text-destructive" />}
        </div>
        <div>
          <h2 className="mb-1 text-base font-semibold text-foreground">{notLoggedIn ? "Sign in required" : "Operator access required"}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {notLoggedIn ? "You need to be signed in to manage this workspace." : "This area is limited to operators."}
          </p>
          {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
        </div>
        {notLoggedIn && (
          <a href="/login" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[var(--shadow-db-sm)] hover:bg-blue-700">Sign in</a>
        )}
      </div>
    </div>
  );
}
