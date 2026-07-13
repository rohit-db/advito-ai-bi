import { useEffect, useMemo, useState } from "react";
import { ChevronDown, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppUserCreateBody, AppUserOut, AppUserUpdateBody, TenantOut } from "@/lib/adminApi";
import { Modal, Spinner } from "./shared";

const OPERATOR_TENANT = "*";

export default function UserDialog({
  tenants,
  user,
  onSubmit,
  onClose,
}: {
  tenants: TenantOut[];
  user?: AppUserOut | null;
  onSubmit: (body: AppUserCreateBody | AppUserUpdateBody, isCreate: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const isCreate = !user;
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [tenantLabel, setTenantLabel] = useState(user?.tenant ?? "");
  const [tenantId, setTenantId] = useState(user?.tenant_id ?? "");
  const [role, setRole] = useState(user?.role ?? "user");
  const [picker, setPicker] = useState(user?.tenant_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTenants = useMemo(
    () => tenants.filter((t) => t.status === "active"),
    [tenants]
  );

  useEffect(() => {
    if (!picker) return;
    if (picker === OPERATOR_TENANT) {
      setTenantId(OPERATOR_TENANT);
      setTenantLabel("All tenants (operator)");
      setRole("operator");
      return;
    }
    const t = tenants.find((x) => x.tenant_id === picker);
    if (t) {
      setTenantId(t.tenant_id);
      setTenantLabel(t.display_name || t.tenant_id);
    }
  }, [picker, tenants]);

  const canSubmit =
    !!displayName.trim() &&
    !!tenantId.trim() &&
    !!tenantLabel.trim() &&
    (isCreate ? !!email.trim() && !!password.trim() : true) &&
    !busy;

  const labelCls = "block text-xs font-semibold text-slate-700 mb-1.5";
  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
    "placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
    "focus:border-indigo-500 transition-colors";

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (isCreate) {
        await onSubmit(
          {
            email: email.trim().toLowerCase(),
            password,
            display_name: displayName.trim(),
            tenant: tenantLabel.trim(),
            tenant_id: tenantId.trim(),
            role: role.trim() || "user",
          },
          true
        );
      } else {
        await onSubmit(
          {
            display_name: displayName.trim(),
            tenant: tenantLabel.trim(),
            tenant_id: tenantId.trim(),
            role: role.trim() || "user",
            ...(password.trim() ? { password } : {}),
          },
          false
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isCreate ? "Add login user" : "Edit login user"}
      subtitle="Maps the user to a tenant — the tenant's Service Principal is used at runtime"
      icon={<UserPlus size={18} />}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!canSubmit}>
            {busy && <Spinner size={14} className="text-white" />}
            {isCreate ? "Create user" : "Save changes"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {isCreate && (
          <div>
            <label className={labelCls}>
              Email <span className="text-rose-500">*</span>
            </label>
            <input
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              spellCheck={false}
              autoCapitalize="none"
            />
          </div>
        )}

        <div>
          <label className={labelCls}>
            Password {isCreate ? <span className="text-rose-500">*</span> : "(leave blank to keep)"}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            autoComplete={isCreate ? "new-password" : "off"}
          />
        </div>

        <div>
          <label className={labelCls}>
            Display name <span className="text-rose-500">*</span>
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>
            Tenant <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <select
              value={picker}
              onChange={(e) => setPicker(e.target.value)}
              className={`${inputCls} appearance-none pr-9 cursor-pointer`}
            >
              <option value="">Select onboarded tenant…</option>
              <option value={OPERATOR_TENANT}>Operator — all tenants (*)</option>
              {activeTenants.map((t) => (
                <option key={t.tenant_id} value={t.tenant_id}>
                  {t.display_name || t.tenant_id} — tenant_id {t.tenant_id}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            This sets <code className="font-mono">tenant_id</code> on the session. It must match an
            onboarded tenant (same as <code className="font-mono">client_id</code> in your data).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Tenant ID</label>
            <input
              value={tenantId}
              readOnly
              className={`${inputCls} font-mono text-xs bg-slate-50 text-slate-600`}
            />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={`${inputCls} appearance-none pr-9 cursor-pointer`}
              >
                <option value="user">user</option>
                <option value="operator">operator</option>
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
