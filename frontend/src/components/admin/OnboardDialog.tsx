import { useEffect, useMemo, useState } from "react";
import { ChevronDown, UserPlus, Info, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as adminApi from "@/lib/adminApi";
import type { AvailableClient, OnboardBody } from "@/lib/adminApi";
import { Modal, Spinner } from "./shared";

export interface OnboardDialogProps {
  onSubmit: (body: OnboardBody) => Promise<void>;
  onClose: () => void;
}

const TENANT_ID_RE = /^[a-z0-9][a-z0-9-]*$/i;

export default function OnboardDialog({ onSubmit, onClose }: OnboardDialogProps) {
  const [tenantId, setTenantId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [genieSpaceId, setGenieSpaceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);

  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsConfigured, setClientsConfigured] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [clients, setClients] = useState<AvailableClient[]>([]);
  const [pickerValue, setPickerValue] = useState("");

  useEffect(() => {
    let cancelled = false;
    setClientsLoading(true);
    adminApi
      .availableClients()
      .then((res) => {
        if (cancelled) return;
        setClientsConfigured(res.configured);
        setClients(res.clients ?? []);
        setClientsError(res.error ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setClientsError(err instanceof Error ? err.message : "Could not load clients");
        }
      })
      .finally(() => {
        if (!cancelled) setClientsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const available = useMemo(
    () => clients.filter((c) => !c.onboarded),
    [clients]
  );
  const onboardedCount = clients.length - available.length;
  const selectedClient = clients.find((c) => c.tenant_id === pickerValue) ?? null;
  const pickedFromCatalog = !!selectedClient;

  const idValid = tenantId === "" || TENANT_ID_RE.test(tenantId);
  const canSubmit = !!tenantId.trim() && !!displayName.trim() && idValid && !busy;

  const pickClient = (id: string) => {
    setPickerValue(id);
    setManualEntry(false);
    const client = clients.find((c) => c.tenant_id === id);
    if (!client) {
      setTenantId("");
      setDisplayName("");
      return;
    }
    setTenantId(client.tenant_id);
    setDisplayName(client.display_name);
  };

  const clearPick = () => {
    setPickerValue("");
    setTenantId("");
    setDisplayName("");
  };

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed");
      setBusy(false);
    }
  };

  const labelCls = "block text-xs font-semibold text-foreground mb-1.5";
  const inputCls =
    "w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground " +
    "placeholder:text-muted-foreground shadow-[var(--shadow-db-xs)] focus:outline-none focus:ring-2 focus:ring-ring " +
    "focus:border-ring transition-colors";

  const showManualFields = !clientsConfigured || manualEntry || (!pickedFromCatalog && available.length === 0);

  return (
    <Modal
      title="Onboard tenant"
      subtitle="Provision a dedicated Service Principal for a new tenant"
      icon={<UserPlus size={18} />}
      onClose={onClose}
      footer={
        <>
          <Button variant="default" size="sm" onClick={onClose} disabled={busy}>
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
        {clientsConfigured && (
          <div>
            <label className={labelCls}>
              Client <span className="text-destructive">*</span>
            </label>
            {clientsLoading ? (
              <div className="flex items-center gap-2 rounded border border-border bg-secondary px-3 py-2.5 text-xs text-muted-foreground">
                <Spinner size={14} />
                Loading clients from governed data…
              </div>
            ) : (
              <div className="relative">
                <select
                  value={pickerValue}
                  onChange={(e) => pickClient(e.target.value)}
                  className={`${inputCls} appearance-none pr-9 cursor-pointer`}
                >
                  <option value="">
                    {available.length
                      ? "Choose a client to onboard…"
                      : "No un-onboarded clients in data"}
                  </option>
                  {available.map((c) => (
                    <option key={c.tenant_id} value={c.tenant_id}>
                      {c.display_name !== c.tenant_id
                        ? `${c.display_name} — client_id ${c.tenant_id}`
                        : `client_id ${c.tenant_id}`}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
              </div>
            )}
            {!clientsLoading && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Picking a client fills <strong>tenant ID</strong> automatically — it is the{" "}
                <code className="font-mono">client_id</code> from your data (the number after
                the name).
                {onboardedCount > 0 ? ` ${onboardedCount} already onboarded.` : ""}
                {clientsError ? ` ${clientsError}` : ""}
              </p>
            )}
          </div>
        )}

        {pickedFromCatalog && selectedClient && (
          <div className="rounded border border-[var(--border-success)] bg-[var(--background-success)] px-3.5 py-3 text-sm">
            <div className="mb-2 flex items-center gap-1.5 font-medium text-[var(--success)]">
              <CheckCircle2 size={15} />
              Ready to onboard
            </div>
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-semibold uppercase tracking-wide text-[var(--success)]">
                  Tenant ID (client_id)
                </dt>
                <dd className="mt-0.5 font-mono text-base font-semibold text-foreground">
                  {selectedClient.tenant_id}
                </dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-[var(--success)]">
                  Display name
                </dt>
                <dd className="mt-0.5 text-foreground">{selectedClient.display_name}</dd>
              </div>
            </dl>
            <p className="mt-2 text-[11px] text-[var(--success)]">
              Use this same tenant ID when you create the white-label login user for this client.
            </p>
            <button
              type="button"
              onClick={clearPick}
              className="mt-2 text-[11px] font-medium text-[var(--success)] underline hover:text-green-700"
            >
              Choose a different client
            </button>
          </div>
        )}

        {!clientsConfigured && !clientsLoading && (
          <div className="rounded border border-[var(--border-warning)] bg-[var(--background-warning)] px-3 py-2 text-[11px] text-[var(--warning)]">
            Set <code className="font-mono">VERIFY_TABLE</code> and{" "}
            <code className="font-mono">TENANT_COLUMN</code> in the server env to load clients
            from your data.
          </div>
        )}

        {clientsConfigured && !pickedFromCatalog && available.length > 0 && !manualEntry && (
          <button
            type="button"
            onClick={() => setManualEntry(true)}
            className="text-[11px] font-medium text-primary hover:text-blue-700"
          >
            Enter tenant ID manually instead
          </button>
        )}

        {showManualFields && !pickedFromCatalog && (
          <>
            <div>
              <label className={labelCls}>
                Tenant ID <span className="text-destructive">*</span>
              </label>
              <input
                autoFocus={!clientsConfigured}
                value={tenantId}
                onChange={(e) => {
                  setTenantId(e.target.value);
                  setPickerValue("");
                }}
                placeholder="447"
                className={`${inputCls} font-mono text-xs`}
                spellCheck={false}
                autoCapitalize="none"
              />
              <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <Info size={13} className="mt-px shrink-0 text-primary" />
                <span>
                  The <code className="font-mono">client_id</code> in your governed data — must
                  match the login user's <code className="font-mono">tenant_id</code> exactly.
                </span>
              </div>
              {!idValid && (
                <p className="mt-1 text-[11px] font-medium text-destructive">
                  Use letters, numbers, and hyphens only (must start alphanumeric).
                </p>
              )}
            </div>

            <div>
              <label className={labelCls}>
                Display name <span className="text-destructive">*</span>
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Cloud Venture"
                className={inputCls}
              />
            </div>
          </>
        )}

        <div>
          <label className={labelCls}>Genie space ID (optional)</label>
          <input
            value={genieSpaceId}
            onChange={(e) => setGenieSpaceId(e.target.value)}
            placeholder="01f1…"
            className={`${inputCls} font-mono text-xs`}
            spellCheck={false}
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Overrides the default Genie space for this tenant's Ask Prism experience.
          </p>
        </div>

        {error && (
          <div className="rounded border border-[var(--border-danger)] bg-[var(--background-danger)] px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
