import { Radio } from "lucide-react";
import type { McpStatus } from "@/hooks/useGenieMcpChat";

// Full MCP session chip for the Genie MCP page hero (shows auth + tool list).
export function McpStatusChip({ status, onRetry }: { status: McpStatus; onRetry: () => void }) {
  if (status.state === "connecting") {
    return (
      <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 text-sm">
        <Radio className="w-4 h-4 animate-pulse" />
        <span>Connecting to Genie MCP…</span>
      </div>
    );
  }
  if (status.state === "error") {
    return (
      <button
        onClick={onRetry}
        title={status.message}
        className="flex items-center gap-2 bg-red-500/20 border border-red-300/40 rounded-xl px-3 py-2 text-sm text-left hover:bg-red-500/30"
      >
        <span className="w-2 h-2 rounded-full bg-red-300" />
        <span>MCP unavailable — retry</span>
      </button>
    );
  }
  return (
    <div className="bg-white/10 rounded-xl px-3 py-2 text-xs space-y-1 max-w-sm">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="font-semibold">Live MCP session</span>
        <span className="text-white/70">
          · {status.auth === "obo" ? "on-behalf-of user" : "service principal"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {(status.tools || []).map((t) => (
          <span key={t.name} className="bg-white/15 rounded px-1.5 py-0.5 font-mono">
            {t.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// Compact status pill for a LIGHT header (the Ask APEX page).
export function McpStatusPill({ status, onRetry }: { status: McpStatus; onRetry: () => void }) {
  if (status.state === "connecting") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        <Radio className="h-3 w-3 animate-pulse" />
        Connecting…
      </span>
    );
  }
  if (status.state === "error") {
    return (
      <button
        onClick={onRetry}
        title={status.message}
        className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        MCP offline — retry
      </button>
    );
  }
  const toolNames = (status.tools || []).map((t) => t.name).join(", ");
  return (
    <span
      title={toolNames ? `Tools: ${toolNames}` : undefined}
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Live MCP
      <span className="text-emerald-600/70">
        · {status.auth === "obo" ? "on-behalf-of user" : "service principal"}
      </span>
    </span>
  );
}

// Tiny status dot for compact surfaces (the dashboard rail header).
export function McpStatusDot({ state }: { state: McpStatus["state"] }) {
  const color =
    state === "connected"
      ? "bg-emerald-400"
      : state === "connecting"
        ? "bg-amber-300 animate-pulse"
        : "bg-red-400";
  const title =
    state === "connected"
      ? "MCP connected"
      : state === "connecting"
        ? "Connecting to MCP…"
        : "MCP unavailable";
  return <span className={`w-1.5 h-1.5 rounded-full ${color}`} title={title} />;
}
