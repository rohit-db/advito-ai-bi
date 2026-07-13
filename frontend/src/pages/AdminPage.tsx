import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ShieldCheck, LockKeyhole, Users, Clock, ShieldX, RefreshCw } from "lucide-react";
import * as adminApi from "@/lib/adminApi";
import type { AuditRow, TenantOut, OnboardBody } from "@/lib/adminApi";
import { isAdminApiError } from "@/lib/adminApi";
import StatCard from "@/components/admin/StatCard";
import SecretAlert, { type SecretAlertData } from "@/components/admin/SecretAlert";
import TenantTable from "@/components/admin/TenantTable";
import OnboardDialog from "@/components/admin/OnboardDialog";
import AccessDialog from "@/components/admin/AccessDialog";
import VerifyModal from "@/components/admin/VerifyModal";
import HistoryDrawer from "@/components/admin/HistoryDrawer";
import ActivityFeed from "@/components/admin/ActivityFeed";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { relativeTime } from "@/components/admin/shared";

/** Route path the parent should register this page at (operator-gated). */
export const ADMIN_ROUTE_PATH = "/admin";

const AUDIT_POLL_MS = 8000;

interface AccessError {
  status: number;
  detail: string;
}

interface ConfirmState {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone: "danger" | "default";
  action: () => Promise<void>;
  tenantId?: string;
}

export default function AdminPage() {
  // ─── Data ──────────────────────────────────────────────────────────────────
  const [tenants, setTenants] = useState<TenantOut[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantsError, setTenantsError] = useState<string | null>(null);

  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditRefreshing, setAuditRefreshing] = useState(false);

  // Access gate (401 not-logged-in / 403 not-operator).
  const [accessError, setAccessError] = useState<AccessError | null>(null);

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [secret, setSecret] = useState<SecretAlertData | null>(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [accessTenant, setAccessTenant] = useState<TenantOut | null>(null);
  const [historyTenant, setHistoryTenant] = useState<TenantOut | null>(null);
  const [busyTenantId, setBusyTenantId] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const gatedRef = useRef(false);

  // Any request may reveal an access problem; capture it once so the whole page
  // flips to the friendly gate state.
  const handleAccess = useCallback((err: unknown) => {
    if (isAdminApiError(err) && (err.status === 401 || err.status === 403) && !gatedRef.current) {
      gatedRef.current = true;
      setAccessError({ status: err.status, detail: err.detail });
    }
  }, []);

  // ─── Fetchers ────────────────────────────────────────────────────────────────
  const loadTenants = useCallback(async () => {
    try {
      const res = await adminApi.listTenants();
      setTenants(res.tenants ?? []);
      setTenantsError(null);
    } catch (err) {
      handleAccess(err);
      setTenantsError(err instanceof Error ? err.message : "Could not load tenants");
    } finally {
      setTenantsLoading(false);
    }
  }, [handleAccess]);

  const loadAudit = useCallback(
    async (background = false) => {
      if (background) setAuditRefreshing(true);
      try {
        const res = await adminApi.audit(20);
        setAudit(res.rows ?? []);
        setAuditError(null);
      } catch (err) {
        handleAccess(err);
        setAuditError(err instanceof Error ? err.message : "Could not load activity");
      } finally {
        setAuditLoading(false);
        if (background) setAuditRefreshing(false);
      }
    },
    [handleAccess]
  );

  const refreshAll = useCallback(() => {
    loadTenants();
    loadAudit(true);
  }, [loadTenants, loadAudit]);

  // Initial load.
  useEffect(() => {
    loadTenants();
    loadAudit();
  }, [loadTenants, loadAudit]);

  // Poll the global audit feed (paused once the page is gated).
  useEffect(() => {
    if (accessError) return;
    const id = window.setInterval(() => {
      if (!gatedRef.current) loadAudit(true);
    }, AUDIT_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadAudit, accessError]);

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const runOnboard = useCallback(
    async (body: OnboardBody) => {
      const res = await adminApi.onboard(body);
      setShowOnboard(false);
      setSecret({
        kind: "onboard",
        tenantId: res.tenant.tenant_id,
        items: [
          { label: "Client ID", value: res.client_id },
          { label: "Client secret", value: res.client_secret },
        ],
      });
      refreshAll();
    },
    [refreshAll]
  );

  // Wrap a row mutation in a confirm dialog. `run` performs the API call and any
  // follow-up (e.g. showing an ephemeral secret); refresh happens automatically.
  const openConfirm = useCallback((state: ConfirmState) => {
    setConfirmError(null);
    setConfirm(state);
  }, []);

  const executeConfirm = useCallback(async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    setConfirmError(null);
    if (confirm.tenantId) setBusyTenantId(confirm.tenantId);
    try {
      await confirm.action();
      setConfirm(null);
      refreshAll();
    } catch (err) {
      handleAccess(err);
      setConfirmError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setConfirmBusy(false);
      setBusyTenantId(null);
    }
  }, [confirm, refreshAll, handleAccess]);

  const onRotate = useCallback(
    (t: TenantOut) =>
      openConfirm({
        title: "Rotate secret",
        tone: "default",
        confirmLabel: "Rotate secret",
        tenantId: t.tenant_id,
        message: (
          <>
            Issue a new client secret for <strong>{t.display_name || t.tenant_id}</strong>? The
            current secret stops working immediately and the new one is shown only once.
          </>
        ),
        action: async () => {
          const res = await adminApi.rotate(t.tenant_id);
          setSecret({
            kind: "rotate",
            tenantId: res.tenant_id,
            items: [{ label: "New client secret", value: res.new_client_secret }],
          });
        },
      }),
    [openConfirm]
  );

  const onDeactivate = useCallback(
    (t: TenantOut) =>
      openConfirm({
        title: "Deactivate tenant",
        tone: "danger",
        confirmLabel: "Deactivate",
        tenantId: t.tenant_id,
        message: (
          <>
            Deactivate <strong>{t.display_name || t.tenant_id}</strong>? Its Service Principal will
            no longer be able to run dashboards or Genie until reactivated.
          </>
        ),
        action: async () => {
          await adminApi.deactivate(t.tenant_id);
        },
      }),
    [openConfirm]
  );

  const onReactivate = useCallback(
    (t: TenantOut) =>
      openConfirm({
        title: "Reactivate tenant",
        tone: "default",
        confirmLabel: "Reactivate",
        tenantId: t.tenant_id,
        message: (
          <>
            Reactivate <strong>{t.display_name || t.tenant_id}</strong>? A fresh client secret will
            be issued (shown only once).
          </>
        ),
        action: async () => {
          const res = await adminApi.reactivate(t.tenant_id);
          setSecret({
            kind: "rotate",
            tenantId: res.tenant_id,
            items: [{ label: "New client secret", value: res.new_client_secret }],
          });
        },
      }),
    [openConfirm]
  );

  const onDelete = useCallback(
    (t: TenantOut) =>
      openConfirm({
        title: "Delete tenant",
        tone: "danger",
        confirmLabel: "Delete permanently",
        tenantId: t.tenant_id,
        message: (
          <>
            Permanently delete <strong>{t.display_name || t.tenant_id}</strong> and its Service
            Principal? This cannot be undone.
          </>
        ),
        action: async () => {
          await adminApi.remove(t.tenant_id);
        },
      }),
    [openConfirm]
  );

  // ─── Derived stats ───────────────────────────────────────────────────────────
  const activeCount = tenants.filter((t) => t.status === "active").length;
  const lastActivityIso =
    audit[0]?.created_at ??
    tenants.map((t) => t.updated_at).sort().slice(-1)[0] ??
    null;

  // ─── Access gate ─────────────────────────────────────────────────────────────
  if (accessError) {
    return <AccessGate status={accessError.status} detail={accessError.detail} />;
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                Service Principals
              </h1>
              <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
                Each tenant is backed by a dedicated Service Principal. Genie and dashboards run{" "}
                <em>as</em> the tenant SP, and a Unity Catalog row filter enforces isolation so a
                tenant only ever sees its own data.
              </p>
            </div>
          </div>
          <button
            onClick={refreshAll}
            title="Refresh"
            className="mt-1 hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 sm:inline-flex"
          >
            <RefreshCw size={13} className={auditRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Stats strip */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Active tenants"
            value={tenantsLoading ? "—" : activeCount}
            icon={<ShieldCheck size={18} />}
            accent="emerald"
          />
          <StatCard
            label="Total tenants"
            value={tenantsLoading ? "—" : tenants.length}
            icon={<Users size={18} />}
            accent="indigo"
          />
          <StatCard
            label="Last activity"
            value={lastActivityIso ? relativeTime(lastActivityIso) : "—"}
            hint={audit[0]?.action}
            icon={<Clock size={18} />}
            accent="slate"
          />
        </div>

        {/* Ephemeral secret */}
        {secret && (
          <div className="mb-5">
            <SecretAlert data={secret} onDismiss={() => setSecret(null)} />
          </div>
        )}

        {/* Tenant table */}
        <div className="mb-5">
          <TenantTable
            tenants={tenants}
            loading={tenantsLoading}
            error={tenantsError}
            busyTenantId={busyTenantId}
            onOnboard={() => setShowOnboard(true)}
            onVerify={() => setShowVerify(true)}
            onManageAccess={(t) => setAccessTenant(t)}
            onHistory={(t) => setHistoryTenant(t)}
            onRotate={onRotate}
            onDeactivate={onDeactivate}
            onReactivate={onReactivate}
            onDelete={onDelete}
          />
        </div>

        {/* Activity feed */}
        <ActivityFeed
          rows={audit}
          loading={auditLoading}
          error={auditError}
          refreshing={auditRefreshing}
        />
      </div>

      {/* Modals / drawers */}
      {showOnboard && (
        <OnboardDialog onSubmit={runOnboard} onClose={() => setShowOnboard(false)} />
      )}
      {showVerify && (
        <VerifyModal run={() => adminApi.verify()} onClose={() => setShowVerify(false)} />
      )}
      {accessTenant && (
        <AccessDialog tenant={accessTenant} onClose={() => setAccessTenant(null)} />
      )}
      {historyTenant && (
        <HistoryDrawer
          tenant={historyTenant}
          run={(id) => adminApi.history(id, 50)}
          onClose={() => setHistoryTenant(null)}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          tone={confirm.tone}
          busy={confirmBusy}
          error={confirmError}
          onConfirm={executeConfirm}
          onClose={() => {
            if (!confirmBusy) setConfirm(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Access-required state ─────────────────────────────────────────────────────

function AccessGate({ status, detail }: { status: number; detail: string }) {
  const notLoggedIn = status === 401;
  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-6">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
          {notLoggedIn ? (
            <LockKeyhole size={28} className="text-indigo-500" />
          ) : (
            <ShieldX size={28} className="text-rose-500" />
          )}
        </div>
        <div>
          <h2 className="mb-1 text-base font-semibold text-slate-800">
            {notLoggedIn ? "Sign in required" : "Operator access required"}
          </h2>
          <p className="text-sm leading-relaxed text-slate-500">
            {notLoggedIn
              ? "You need to be signed in to manage tenant Service Principals."
              : "This area is limited to operators. Your account doesn't have the operator role required to manage tenant Service Principals."}
          </p>
          {detail && <p className="mt-2 text-xs text-slate-400">{detail}</p>}
        </div>
        {notLoggedIn && (
          <a
            href="/login"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            Sign in
          </a>
        )}
      </div>
    </div>
  );
}
