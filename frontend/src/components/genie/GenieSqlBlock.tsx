import { Terminal, ChevronDown, ChevronUp } from "lucide-react";
import type { GenieSqlBlock as SqlBlock } from "@/hooks/useGenieMcpChat";

// Collapsible "Generated SQL" panel. `variant="full"` uses the violet page
// styling and the full label; `variant="compact"` uses the indigo rail/modal
// styling and a terse label.
export default function GenieSqlBlock({
  blocks,
  open,
  onToggle,
  variant = "full",
}: {
  blocks: SqlBlock[];
  open: boolean;
  onToggle: () => void;
  variant?: "full" | "compact";
}) {
  if (!blocks || blocks.length === 0) return null;
  const compact = variant === "compact";
  const accent = compact ? "text-brand-primary" : "text-brand-primary";
  const label = compact ? "SQL" : "Generated SQL";
  const icon = compact ? "w-3.5 h-3.5" : "w-4 h-4";
  const labelText = compact ? "text-[11px]" : "text-xs";
  const pre = compact
    ? "mt-2 bg-slate-900 text-green-300 p-2.5 rounded-lg text-[10px] font-mono overflow-x-auto"
    : "mt-2 bg-slate-900 text-green-300 p-3 rounded-lg text-[11px] font-mono overflow-x-auto";

  return (
    <div className={`border-t border-slate-100 ${compact ? "mt-2 pt-2" : "mt-3 pt-3"}`}>
      <button onClick={onToggle} className="flex items-center justify-between w-full text-left">
        <span className={`flex items-center gap-1.5 ${labelText} font-semibold ${accent} uppercase tracking-wide`}>
          <Terminal className={icon} />
          <span>
            {label}
            {blocks.length > 1 ? ` (${blocks.length})` : ""}
          </span>
        </span>
        {open ? <ChevronUp className={`${icon} ${accent}`} /> : <ChevronDown className={`${icon} ${accent}`} />}
      </button>
      {open &&
        blocks.map((block, i) => (
          <pre key={i} className={pre}>
            {block.sql}
          </pre>
        ))}
    </div>
  );
}
