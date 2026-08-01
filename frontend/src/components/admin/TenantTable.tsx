import { useEffect, useRef, useState } from "react";
import {
  MoreHorizontal,
  History,
  RefreshCw,
  Ban,
  Play,
  Trash2,
  ServerCog,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { TenantOut } from "@/lib/adminApi";
import { CopyButton, Spinner, TenantStatusBadge, formatAbsolute, relativeTime } from "./shared";

export interface TenantTableProps {
  tenants: TenantOut[];
  loading: boolean;
  error: string | null;
  busyTenantId?: string | null;
  onOnboard: () => void;
  onVerify: () => void;
  onManageAccess: (t: TenantOut) => void;
  onHistory: (t: TenantOut) => void;
  onRotate: (t: TenantOut) => void;
  onDeactivate: (t: TenantOut) => void;
  onReactivate: (t: TenantOut) => void;
  onDelete: (t: TenantOut) => void;
}

export default function TenantTable(props: TenantTableProps) {
  const { tenants, loading, error, busyTenantId } = props;

  return (
    <div className="rounded-md border border-border bg-background shadow-[var(--shadow-db-sm)]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <ServerCog size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Tenant Service Principals</h2>
          {!loading && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {tenants.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={props.onVerify}
            className="gap-1.5 text-primary border-primary/30 hover:bg-primary/10 hover:text-blue-700"
          >
            <RefreshCw size={13} />
            Verify isolation
          </Button>
          <Button size="sm" onClick={props.onOnboard} className="gap-1.5">
            <ServerCog size={13} />
            Onboard tenant
          </Button>
        </div>
      </div>

      {loading && tenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Spinner size={26} />
          <span className="text-xs font-medium">Loading tenants…</span>
        </div>
      ) : error && tenants.length === 0 ? (
        <div className="m-5 rounded border border-[var(--border-danger)] bg-[var(--background-danger)] px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : tenants.length === 0 ? (
        <EmptyState onOnboard={props.onOnboard} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2.5 font-semibold">Tenant</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Service Principal</th>
                <th className="px-4 py-2.5 font-semibold">Updated</th>
                <th className="px-4 py-2.5 font-semibold">Access</th>
                <th className="px-5 py-2.5 font-semibold text-right">More</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((t) => (
                <TenantRow key={t.tenant_id} tenant={t} busy={busyTenantId === t.tenant_id} {...props} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TenantRow({
  tenant,
  busy,
  onManageAccess,
  onHistory,
  onRotate,
  onDeactivate,
  onReactivate,
  onDelete,
}: { tenant: TenantOut; busy: boolean } & Pick<
  TenantTableProps,
  "onManageAccess" | "onHistory" | "onRotate" | "onDeactivate" | "onReactivate" | "onDelete"
>) {
  const active = tenant.status === "active";
  return (
    <tr className="group hover:bg-[var(--action-default-bg-hover)]">
      <td className="px-5 py-3 align-top">
        <div className="font-medium text-foreground">{tenant.display_name || tenant.tenant_id}</div>
        <code className="font-mono text-[11px] text-muted-foreground">{tenant.tenant_id}</code>
      </td>
      <td className="px-4 py-3 align-top">
        <TenantStatusBadge status={tenant.status} />
      </td>
      <td className="px-4 py-3 align-top">
        <div className="text-foreground">{tenant.sp_display_name || "—"}</div>
        <div className="flex items-center gap-1">
          <code
            className="font-mono text-[11px] text-muted-foreground truncate max-w-[150px]"
            title={tenant.sp_app_id}
          >
            {tenant.sp_app_id}
          </code>
          {tenant.sp_app_id && <CopyButton value={tenant.sp_app_id} />}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <span className="text-muted-foreground text-xs" title={formatAbsolute(tenant.updated_at)}>
          {relativeTime(tenant.updated_at)}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        {active ? (
          <Button
            type="button"
            size="sm"
            variant="default"
            disabled={busy}
            onClick={() => onManageAccess(tenant)}
            className="h-8 gap-1.5 border-primary/30 bg-primary/5 text-blue-700 hover:bg-primary/10 hover:text-blue-700"
            aria-label={`Manage dashboard and Genie access for ${tenant.display_name || tenant.tenant_id}`}
          >
            <KeyRound size={13} />
            Manage access
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Reactivate to edit</span>
        )}
      </td>
      <td className="px-5 py-3 align-top text-right">
        <div className="flex items-center justify-end gap-1">
          {busy && <Spinner size={14} />}
          <RowActions
            active={active}
            disabled={busy}
            onHistory={() => onHistory(tenant)}
            onRotate={() => onRotate(tenant)}
            onDeactivate={() => onDeactivate(tenant)}
            onReactivate={() => onReactivate(tenant)}
            onDelete={() => onDelete(tenant)}
          />
        </div>
      </td>
    </tr>
  );
}

function RowActions({
  active,
  disabled,
  onHistory,
  onRotate,
  onDeactivate,
  onReactivate,
  onDelete,
}: {
  active: boolean;
  disabled: boolean;
  onHistory: () => void;
  onRotate: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors";

  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title="Actions"
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground",
          "hover:bg-[var(--action-default-bg-hover)] hover:text-foreground transition-colors disabled:opacity-40",
          open && "bg-[var(--action-default-bg-hover)] text-foreground"
        )}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-md border border-border bg-background py-1 shadow-[var(--shadow-db-lg)]">
          <button className={cn(item, "text-foreground hover:bg-[var(--action-default-bg-hover)]")} onClick={pick(onHistory)}>
            <History size={15} className="text-muted-foreground" />
            View history
          </button>
          {active && (
            <button
              className={cn(item, "text-foreground hover:bg-[var(--action-default-bg-hover)]")}
              onClick={pick(onRotate)}
            >
              <RefreshCw size={15} className="text-muted-foreground" />
              Rotate secret
            </button>
          )}
          {active ? (
            <button
              className={cn(item, "text-[var(--warning)] hover:bg-[var(--background-warning)]")}
              onClick={pick(onDeactivate)}
            >
              <Ban size={15} className="text-[var(--warning)]" />
              Deactivate
            </button>
          ) : (
            <button
              className={cn(item, "text-[var(--success)] hover:bg-[var(--background-success)]")}
              onClick={pick(onReactivate)}
            >
              <Play size={15} className="text-[var(--success)]" />
              Reactivate
            </button>
          )}
          <div className="my-1 h-px bg-border" />
          <button className={cn(item, "text-destructive hover:bg-[var(--background-danger)]")} onClick={pick(onDelete)}>
            <Trash2 size={15} className="text-destructive" />
            Delete tenant
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onOnboard }: { onOnboard: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-primary/10">
        <ServerCog size={26} className="text-primary" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground">No tenants onboarded yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Onboard a tenant to provision a dedicated Service Principal that backs its per-tenant data
          isolation.
        </p>
      </div>
      <Button size="sm" onClick={onOnboard} className="gap-1.5">
        <ServerCog size={13} />
        Onboard tenant
      </Button>
    </div>
  );
}
