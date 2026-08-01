import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ShieldCheck, Users, Clock, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as adminApi from "@/lib/adminApi";
import type {
  AppUserCreateBody,
  AppUserOut,
  AppUserUpdateBody,
  TenantOut,
  OnboardBody,
} from "@/lib/adminApi";
import StatCard from "@/components/admin/StatCard";
import SecretAlert, { type SecretAlertData } from "@/components/admin/SecretAlert";
import TenantTable from "@/components/admin/TenantTable";
import OnboardDialog from "@/components/admin/OnboardDialog";
import VerifyModal from "@/components/admin/VerifyModal";
import HistoryDrawer from "@/components/admin/HistoryDrawer";
import ActivityFeed from "@/components/admin/ActivityFeed";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import UsersTable from "@/components/admin/UsersTable";
import UserDialog from "@/components/admin/UserDialog";
import { relativeTime } from "@/components/admin/shared";
import { useAdminOutlet, ADMIN_ASSETS_PATH } from "@/components/admin/adminContext";

interface ConfirmState {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone: "danger" | "default";
  action: () => Promise<void>;
  tenantId?: string;
}

export default function TenantsPage() {
  const navigate = useNavigate();
  // Audit state + access gate live in AdminLayout; read them from context.
  const { audit, auditLoading, auditError, auditRefreshing, reportAccessError, refreshAll } =
    useAdminOutlet();

  // ─── Data ──────────────────────────────────────────────────────────────────
  const [tenants, setTenants] = useState<TenantOut[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantsError, setTenantsError] = useState<string | null>(null);

  const [appUsers, setAppUsers] = useState<AppUserOut[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersWritable, setUsersWritable] = useState(false);
  const [userDialog, setUserDialog] = useState<AppUserOut | null | "create">(null);
  const [busyUserEmail, setBusyUserEmail] = useState<string | null>(null);

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [secret, setSecret] = useState<SecretAlertData | null>(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [historyTenant, setHistoryTenant] = useState<TenantOut | null>(null);
  const [busyTenantId, setBusyTenantId] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // ─── Fetchers ────────────────────────────────────────────────────────────────
  const loadTenants = useCallback(async () => {
    try {
      const res = await adminApi.listTenants();
      setTenants(res.tenants ?? []);
      setTenantsError(null);
    } catch (err) {
      reportAccessError(err);
      setTenantsError(err instanceof Error ? err.message : "Could not load tenants");
    } finally {
      setTenantsLoading(false);
    }
  }, [reportAccessError]);

  const loadAppUsers = useCallback(async () => {
    try {
      const res = await adminApi.listAppUsers();
      setAppUsers(res?.users ?? []);
      setUsersWritable(!!res?.writable);
      setUsersError(null);
    } catch (err) {
      reportAccessError(err);
      setUsersError(err instanceof Error ? err.message : "Could not load users");
      setUsersWritable(false);
    } finally {
      setUsersLoading(false);
    }
  }, [reportAccessError]);

  // Page-level refresh: re-fetch local data AND trigger the context audit refresh.
  const refresh = useCallback(() => {
    loadTenants();
    loadAppUsers();
    refreshAll();
  }, [loadTenants, loadAppUsers, refreshAll]);

  // Initial load.
  useEffect(() => {
    loadTenants();
    loadAppUsers();
  }, [loadTenants, loadAppUsers]);

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
        onManageAccess: () => navigate(ADMIN_ASSETS_PATH),
      });
      refresh();
    },
    [refresh, navigate]
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
      refresh();
    } catch (err) {
      reportAccessError(err);
      setConfirmError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setConfirmBusy(false);
      setBusyTenantId(null);
    }
  }, [confirm, refresh, reportAccessError]);

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

  const saveAppUser = useCallback(
    async (body: AppUserCreateBody | AppUserUpdateBody, isCreate: boolean) => {
      if (isCreate) {
        await adminApi.createAppUser(body as AppUserCreateBody);
      } else if (userDialog && userDialog !== "create") {
        await adminApi.updateAppUser(userDialog.email, body as AppUserUpdateBody);
      }
      setUserDialog(null);
      await loadAppUsers();
    },
    [loadAppUsers, userDialog]
  );

  const onDeleteUser = useCallback(
    (u: AppUserOut) =>
      openConfirm({
        title: "Delete login user",
        tone: "danger",
        confirmLabel: "Delete user",
        message: (
          <>
            Remove <strong>{u.display_name}</strong> ({u.email})? They will no longer be able to
            sign in.
          </>
        ),
        action: async () => {
          setBusyUserEmail(u.email);
          try {
            await adminApi.deleteAppUser(u.email);
            await loadAppUsers();
          } finally {
            setBusyUserEmail(null);
          }
        },
      }),
    [openConfirm, loadAppUsers]
  );

  // ─── Derived stats ───────────────────────────────────────────────────────────
  const activeCount = tenants.filter((t) => t.status === "active").length;
  const lastActivityIso =
    audit[0]?.created_at ??
    tenants.map((t) => t.updated_at).sort().slice(-1)[0] ??
    null;

  // AdminLayout provides the scroll container; no outer wrapper needed here.
  return (
    <>
      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[var(--shadow-db-sm)]">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Service Principals
              </h1>
              <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
                Each tenant is backed by a dedicated Service Principal. Genie and dashboards run{" "}
                <em>as</em> the tenant SP, and a Unity Catalog row filter enforces isolation so a
                tenant only ever sees its own data.
              </p>
            </div>
          </div>
          <button
            onClick={refresh}
            title="Refresh"
            className="mt-1 hidden items-center gap-1.5 rounded border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-[var(--shadow-db-sm)] hover:bg-[var(--action-default-bg-hover)] sm:inline-flex"
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
            onManageAccess={() => navigate(ADMIN_ASSETS_PATH)}
            onHistory={(t) => setHistoryTenant(t)}
            onRotate={onRotate}
            onDeactivate={onDeactivate}
            onReactivate={onReactivate}
            onDelete={onDelete}
          />
        </div>

        {/* Login users */}
        <div className="mb-5">
          <UsersTable
            users={appUsers}
            tenants={tenants}
            loading={usersLoading}
            error={usersError}
            writable={usersWritable}
            busyEmail={busyUserEmail}
            onAdd={() => setUserDialog("create")}
            onEdit={(u) => setUserDialog(u)}
            onDelete={onDeleteUser}
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
      {historyTenant && (
        <HistoryDrawer
          tenant={historyTenant}
          run={(id) => adminApi.history(id, 50)}
          onClose={() => setHistoryTenant(null)}
        />
      )}
      {userDialog && (
        <UserDialog
          tenants={tenants}
          user={userDialog === "create" ? null : userDialog}
          onSubmit={saveAppUser}
          onClose={() => setUserDialog(null)}
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
    </>
  );
}
