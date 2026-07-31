import { useMemo } from "react";
import { Mail, Pencil, Trash2, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppUserOut, TenantOut } from "@/lib/adminApi";
import { Spinner } from "./shared";

export interface UsersTableProps {
  users: AppUserOut[];
  tenants: TenantOut[];
  loading: boolean;
  error: string | null;
  writable: boolean;
  busyEmail?: string | null;
  onAdd: () => void;
  onEdit: (u: AppUserOut) => void;
  onDelete: (u: AppUserOut) => void;
}

export default function UsersTable({
  users,
  tenants,
  loading,
  error,
  writable,
  busyEmail,
  onAdd,
  onEdit,
  onDelete,
}: UsersTableProps) {
  const tenantById = useMemo(() => {
    const m = new Map<string, TenantOut>();
    for (const t of tenants) m.set(t.tenant_id, t);
    return m;
  }, [tenants]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <UserCircle2 size={16} className="text-brand-accent" />
          <h2 className="text-sm font-semibold text-slate-900">Login users</h2>
          {!loading && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {users.length}
            </span>
          )}
        </div>
        <Button size="sm" onClick={onAdd} disabled={!writable} className="gap-1.5">
          <Mail size={13} />
          Add user
        </Button>
      </div>

      <p className="border-b border-slate-100 px-5 py-2.5 text-[11px] leading-relaxed text-slate-500">
        Each user&apos;s <code className="font-mono">tenant_id</code> selects which onboarded
        tenant they run as at login — the app resolves that to the tenant&apos;s Service Principal.
        There is no separate user→SP mapping.
      </p>

      {!writable && !loading && !error && (
        <div className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          User edits require Lakebase (<code className="font-mono">LAKEBASE_ENABLED</code>,{" "}
          <code className="font-mono">PGHOST</code>, <code className="font-mono">PGUSER</code>).
          Listing is read-only from the JSON fallback.
        </div>
      )}

      {loading && users.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
          <Spinner size={26} />
          <span className="text-xs font-medium">Loading users…</span>
        </div>
      ) : error && users.length === 0 ? (
        <div className="m-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : users.length === 0 ? (
        <div className="px-6 py-14 text-center text-sm text-slate-500">No login users yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5">User</th>
                <th className="px-4 py-2.5">Tenant ID</th>
                <th className="px-4 py-2.5">Maps to SP</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((u) => {
                const mapped = u.tenant_id === "*" ? null : tenantById.get(u.tenant_id);
                const busy = busyEmail === u.email;
                return (
                  <tr key={u.email} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 align-top">
                      <div className="font-medium text-slate-900">{u.display_name}</div>
                      <code className="font-mono text-[11px] text-slate-400">{u.email}</code>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <code className="font-mono text-xs text-slate-700">{u.tenant_id}</code>
                      <div className="text-[11px] text-slate-400">{u.tenant}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-600">
                      {u.tenant_id === "*" ? (
                        <span className="text-slate-400">App SP (operator)</span>
                      ) : mapped ? (
                        <span title={mapped.sp_app_id}>{mapped.sp_display_name || mapped.sp_app_id}</span>
                      ) : (
                        <span className="font-medium text-amber-700">No tenant onboarded</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={
                          u.role === "operator"
                            ? "rounded-full bg-brand-primary-light px-2 py-0.5 text-[11px] font-medium text-brand-accent"
                            : "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                        }
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 align-top text-right">
                      <div className="flex items-center justify-end gap-1">
                        {busy && <Spinner size={14} />}
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          disabled={!writable || busy}
                          onClick={() => onEdit(u)}
                          className="h-8 gap-1"
                        >
                          <Pencil size={12} />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          disabled={!writable || busy}
                          onClick={() => onDelete(u)}
                          className="h-8 gap-1 text-rose-700 border-rose-200 hover:bg-rose-50"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
