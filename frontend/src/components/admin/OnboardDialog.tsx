import { useState } from "react";
import { UserPlus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OnboardBody } from "@/lib/adminApi";
import { Modal, Spinner } from "./shared";

export interface OnboardDialogProps {
  onSubmit: (body: OnboardBody) => Promise<void>;
  onClose: () => void;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export default function OnboardDialog({ onSubmit, onClose }: OnboardDialogProps) {
  const [tenantId, setTenantId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [genieSpaceId, setGenieSpaceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugValid = tenantId === "" || SLUG_RE.test(tenantId);
  const canSubmit = !!tenantId.trim() && !!displayName.trim() && slugValid && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        tenant_id: tenantId.trim(),
        display_name: displayName.trim(),
        ...(genieSpaceId.trim() ? { genie_space_id: genieSpaceId.trim() } : {}),
      });
      // Parent closes on success (so the ephemeral secret panel can render).
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed");
      setBusy(false);
    }
  };

  const labelCls = "block text-xs font-semibold text-slate-700 mb-1.5";
  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
    "placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
    "focus:border-indigo-500 transition-colors";

  return (
    <Modal
      title="Onboard tenant"
      subtitle="Provision a dedicated Service Principal for a new tenant"
      icon={<UserPlus size={18} />}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!canSubmit}>
            {busy && <Spinner size={14} className="text-white" />}
            Create Service Principal
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
        <div>
          <label className={labelCls}>
            Tenant ID <span className="text-rose-500">*</span>
          </label>
          <input
            autoFocus
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="acme-corp"
            className={inputCls}
            spellCheck={false}
            autoCapitalize="none"
          />
          <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-500">
            <Info size={13} className="mt-px shrink-0 text-indigo-400" />
            <span>
              Must exactly match the tenant's <code className="font-mono">external_value</code> used
              at login — this is the key the UC row filter uses to enforce isolation. Use a lowercase
              slug (letters, numbers, hyphens).
            </span>
          </div>
          {!slugValid && (
            <p className="mt-1 text-[11px] font-medium text-rose-600">
              Use only lowercase letters, numbers, and hyphens (must start alphanumeric).
            </p>
          )}
        </div>

        <div>
          <label className={labelCls}>
            Display name <span className="text-rose-500">*</span>
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Acme Corporation"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Genie space ID (optional)</label>
          <input
            value={genieSpaceId}
            onChange={(e) => setGenieSpaceId(e.target.value)}
            placeholder="01f1…"
            className={`${inputCls} font-mono text-xs`}
            spellCheck={false}
          />
          <p className="mt-1.5 text-[11px] text-slate-500">
            Overrides the default Genie space for this tenant's Ask APEX experience.
          </p>
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
