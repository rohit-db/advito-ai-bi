import { KeyRound, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./shared";

export interface SecretItem {
  label: string;
  value: string;
}

export interface SecretAlertData {
  kind: "onboard" | "rotate";
  tenantId: string;
  items: SecretItem[];
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
        "relative rounded-xl border p-4 shadow-sm",
        isOnboard
          ? "border-emerald-200 bg-emerald-50"
          : "border-indigo-200 bg-indigo-50"
      )}
    >
      <button
        onClick={onDismiss}
        title="Dismiss"
        className={cn(
          "absolute top-3 right-3 p-1 rounded-md transition-colors",
          isOnboard
            ? "text-emerald-500 hover:bg-emerald-100"
            : "text-indigo-500 hover:bg-indigo-100"
        )}
      >
        <X size={15} />
      </button>

      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center",
            isOnboard ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-600"
          )}
        >
          {isOnboard ? <ShieldCheck size={15} /> : <KeyRound size={15} />}
        </div>
        <div className={cn("text-sm font-semibold", isOnboard ? "text-emerald-800" : "text-indigo-800")}>
          {isOnboard
            ? `Service Principal created for ${data.tenantId}`
            : `New secret issued for ${data.tenantId}`}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {data.items.map((item) => (
          <div key={item.label} className="rounded-lg bg-white/70 border border-white px-3 py-2">
            <div
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide mb-1",
                isOnboard ? "text-emerald-600" : "text-indigo-600"
              )}
            >
              {item.label}
            </div>
            <div className="flex items-center justify-between gap-2">
              <code className="font-mono text-xs text-slate-800 break-all">{item.value}</code>
              <CopyButton value={item.value} label="Copy" className="shrink-0" />
            </div>
          </div>
        ))}
      </div>

      <p
        className={cn(
          "mt-3 text-[11px] font-medium",
          isOnboard ? "text-emerald-700" : "text-indigo-700"
        )}
      >
        Shown once — stored encrypted in Lakebase, not retrievable again.
      </p>
    </div>
  );
}
