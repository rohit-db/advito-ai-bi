import { Radio } from "lucide-react";
import type { McpStatus } from "@/hooks/useGenieMcpChat";

// Compact status pill for a LIGHT header (the Ask APEX page).
export function McpStatusPill({ status, onRetry }: { status: McpStatus; onRetry: () => void }) {
  if (status.state === "connecting") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-fg-muted bg-surface-2"
        style={{ borderColor: "var(--border)" }}
      >
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
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
        style={{
          background: "rgba(196,64,64,0.12)",
          borderColor: "rgba(196,64,64,0.30)",
          color: "var(--danger-fg)",
        }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--danger)" }} />
        MCP offline — retry
      </button>
    );
  }
  const toolNames = (status.tools || []).map((t) => t.name).join(", ");
  return (
    <span
      title={toolNames ? `Tools: ${toolNames}` : undefined}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{
        background: "rgba(48,160,80,0.12)",
        borderColor: "rgba(48,160,80,0.30)",
        color: "var(--success-fg)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} />
      Live MCP
      <span style={{ color: "var(--success-fg)", opacity: 0.7 }}>
        · {status.auth === "obo" ? "on-behalf-of user" : "service principal"}
      </span>
    </span>
  );
}

// Tiny status dot for compact surfaces (the dashboard rail header).
export function McpStatusDot({ state }: { state: McpStatus["state"] }) {
  const dotStyle =
    state === "connected"
      ? { background: "var(--success)" }
      : state === "connecting"
        ? { background: "var(--warning)" }
        : { background: "var(--danger)" };
  const animateClass = state === "connecting" ? "animate-pulse" : "";
  const title =
    state === "connected"
      ? "MCP connected"
      : state === "connecting"
        ? "Connecting to MCP…"
        : "MCP unavailable";
  return <span className={`w-1.5 h-1.5 rounded-full ${animateClass}`} style={dotStyle} title={title} />;
}
