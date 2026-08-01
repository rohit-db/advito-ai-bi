import { KeyRound, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CopyButton } from "./shared";

export interface SecretItem {
  label: string;
  value: string;
}

export interface SecretAlertData {
  kind: "onboard" | "rotate";
  tenantId: string;
  items: SecretItem[];
  /** Shown after onboard — opens Manage access for the new tenant. */
  onManageAccess?: () => void;
}

/**
 * Ephemeral credential panel. Onboard renders green (client_id + client_secret);
 * rotate/reactivate render indigo (new_client_secret only). The secret is shown
 * once — it's stored encrypted in Lakebase and cannot be retrieved again.
 */
export default function SecretAlert({
  data,
  onDismiss,
}: {
  data: SecretAlertData;
  onDismiss: () => void;
}) {
  const isOnboard = data.kind === "onboard";

  return (
    <div
      className={cn(
        "relative rounded-md border p-4 shadow-[var(--shadow-db-sm)]",
        isOnboard
          ? "border-[var(--border-success)] bg-[var(--background-success)]"
          : "border-primary/30 bg-primary/10"
      )}
    >
      <button
        onClick={onDismiss}
        title="Dismiss"
        className={cn(
          "absolute top-3 right-3 p-1 rounded transition-colors",
          isOnboard
            ? "text-[var(--success)] hover:bg-[var(--background-success)]"
            : "text-primary hover:bg-primary/10"
        )}
      >
        <X size={15} />
      </button>

      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-7 h-7 rounded flex items-center justify-center",
            isOnboard ? "bg-[var(--background-success)] text-[var(--success)]" : "bg-primary/10 text-primary"
          )}
        >
          {isOnboard ? <ShieldCheck size={15} /> : <KeyRound size={15} />}
        </div>
        <div className={cn("text-sm font-semibold", isOnboard ? "text-[var(--success)]" : "text-blue-700")}>
          {isOnboard
            ? `Service Principal created for ${data.tenantId}`
            : `New secret issued for ${data.tenantId}`}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {data.items.map((item) => (
          <div key={item.label} className="rounded bg-background/70 border border-border px-3 py-2">
            <div
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide mb-1",
                isOnboard ? "text-[var(--success)]" : "text-primary"
              )}
            >
              {item.label}
            </div>
            <div className="flex items-center justify-between gap-2">
              <code className="font-mono text-xs text-foreground break-all">{item.value}</code>
              <CopyButton value={item.value} label="Copy" className="shrink-0" />
            </div>
          </div>
        ))}
      </div>

      <p
        className={cn(
          "mt-3 text-[11px] font-medium",
          isOnboard ? "text-[var(--success)]" : "text-primary"
        )}
      >
        Shown once — stored encrypted in Lakebase, not retrievable again.
      </p>

      {isOnboard && data.onManageAccess && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border-success)] pt-4">
          <p className="text-xs text-[var(--success)]">
            Next: grant this tenant access to dashboards and Genie so embeds and Ask APEX work.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={data.onManageAccess}
            className="gap-1.5 bg-[var(--success)] text-white hover:bg-green-700"
          >
            <KeyRound size={13} />
            Manage access
          </Button>
        </div>
      )}
    </div>
  );
}
