import { useCallback, useEffect, useState } from "react";
import { KeyRound, LayoutDashboard, Sparkles } from "lucide-react";
import * as adminApi from "@/lib/adminApi";
import type { ResourceCatalog, ResourceItem, ResourceType, TenantOut } from "@/lib/adminApi";
import { Modal, Spinner } from "./shared";

const ACCESS_TIMEOUT_MS = 30_000;

/**
 * Operator dialog to grant/revoke a tenant Service Principal's access to
 * individual AI/BI dashboards and Genie spaces. Each toggle maps to a
 * CAN_RUN grant on the underlying Databricks object; changes are applied
 * immediately (optimistic, reverted on error).
 */
export default function AccessDialog({
  tenant,
  onClose,
}: {
  tenant: TenantOut;
  onClose: () => void;
}) {
  const [catalog, setCatalog] = useState<ResourceCatalog | null>(null);
  const [granted, setGranted] = useState<{
    dashboards: Record<string, boolean>;
    genie_spaces: Record<string, boolean>;
  }>({ dashboards: {}, genie_spaces: {} });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setAccessLoading(true);
    setError(null);

    adminApi
      .resources()
      .then((cat) => {
        if (!cancelled) setCatalog(cat);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load resources");
        }
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });

    const timer = window.setTimeout(() => {
      if (!cancelled) {
        setAccessLoading(false);
        setError((prev) => prev ?? "Loading access timed out — try closing and reopening.");
      }
    }, ACCESS_TIMEOUT_MS);

    adminApi
      .access(tenant.tenant_id)
      .then((acc) => {
        if (!cancelled) setGranted(acc.access);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load access");
        }
      })
      .finally(() => {
        if (!cancelled) {
          window.clearTimeout(timer);
          setAccessLoading(false);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tenant.tenant_id]);

  const toggle = useCallback(
    async (type: ResourceType, id: string, next: boolean) => {
      const bucket = type === "dashboard" ? "dashboards" : "genie_spaces";
      const key = `${type}:${id}`;
      setBusyKey(key);
      setError(null);
      // optimistic
      setGranted((g) => ({ ...g, [bucket]: { ...g[bucket], [id]: next } }));
      try {
        await adminApi.setAccess(tenant.tenant_id, {
          resource_type: type,
          resource_id: id,
          grant: next,
        });
      } catch (err) {
        // revert
        setGranted((g) => ({ ...g, [bucket]: { ...g[bucket], [id]: !next } }));
        setError(err instanceof Error ? err.message : "Could not update access");
      } finally {
        setBusyKey(null);
      }
    },
    [tenant.tenant_id]
  );

  const loading = catalogLoading && !catalog;

  return (
    <Modal
      title="Manage access"
      subtitle={`${tenant.display_name || tenant.tenant_id} · runs as its Service Principal`}
      icon={<KeyRound size={18} />}
      onClose={onClose}
      maxWidthClass="max-w-xl"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
          <Spinner size={24} />
          <span className="text-xs font-medium">Loading resources…</span>
        </div>
      ) : (
        <div className="space-y-6">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <ResourceGroup
            label="Dashboards"
            icon={<LayoutDashboard size={15} className="text-indigo-500" />}
            items={catalog?.dashboards ?? []}
            granted={granted.dashboards}
            busyKey={busyKey}
            loading={accessLoading}
            type="dashboard"
            onToggle={toggle}
          />

          <ResourceGroup
            label="Genie spaces"
            icon={<Sparkles size={15} className="text-indigo-500" />}
            items={catalog?.genie_spaces ?? []}
            granted={granted.genie_spaces}
            busyKey={busyKey}
            loading={accessLoading}
            type="genie_space"
            onToggle={toggle}
          />

          <p className="text-xs leading-relaxed text-slate-400">
            Granting a dashboard is required for the tenant's white-label embed token to load it.
            Genie access powers the in-app Ask APEX experience. Both run as this tenant's Service
            Principal, so a Unity Catalog row filter still scopes the data.
          </p>
        </div>
      )}
    </Modal>
  );
}

function ResourceGroup({
  label,
  icon,
  items,
  granted,
  busyKey,
  loading,
  type,
  onToggle,
}: {
  label: string;
  icon: React.ReactNode;
  items: ResourceItem[];
  granted: Record<string, boolean>;
  busyKey: string | null;
  loading: boolean;
  type: ResourceType;
  onToggle: (type: ResourceType, id: string, next: boolean) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h3>
        {loading && <Spinner size={12} />}
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-400">
          None configured.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {items.map((it) => {
            const on = !!granted[it.id];
            const busy = busyKey === `${type}:${it.id}`;
            return (
              <div key={it.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-800">{it.name}</div>
                  <code className="font-mono text-[10px] text-slate-400">{it.id}</code>
                </div>
                <Toggle
                  on={on}
                  busy={busy || loading}
                  onChange={(v) => onToggle(type, it.id, v)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Toggle({
  on,
  busy,
  onChange,
}: {
  on: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={busy}
      onClick={() => onChange(!on)}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        on ? "bg-indigo-600" : "bg-slate-300",
        busy ? "opacity-60" : "hover:opacity-90",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          on ? "translate-x-4" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}
