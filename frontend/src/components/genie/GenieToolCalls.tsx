import { Wrench, ChevronDown, ChevronUp } from "lucide-react";
import type { GenieToolCall } from "@/hooks/useGenieMcpChat";

export function summarizeToolResult(result?: GenieToolCall["result"]): string {
  if (!result) return "";
  const parts: string[] = [];
  if (result.status) parts.push(result.status);
  if (result.sql) parts.push(`${result.sql} sql`);
  if (result.tables) parts.push(`${result.tables} table${result.tables > 1 ? "s" : ""}`);
  if (result.hasText) parts.push("answer");
  return parts.join(" · ");
}

// "Under the hood" panel exposing the real MCP tool calls (ask + collapsed poll
// status transitions) — proof this talks to a live managed Genie MCP server.
export default function GenieToolCalls({
  toolCalls,
  open,
  onToggle,
}: {
  toolCalls: GenieToolCall[];
  open: boolean;
  onToggle: () => void;
}) {
  if (!toolCalls || toolCalls.length === 0) return null;

  const asks = toolCalls.filter((t) => t.phase === "ask");
  const polls = toolCalls.filter((t) => t.phase === "poll");

  // Collapse the many poll calls into the ordered, distinct status transitions.
  const pollStatuses: string[] = [];
  for (const p of polls) {
    const s = p.result?.status;
    if (s && pollStatuses[pollStatuses.length - 1] !== s) pollStatuses.push(s);
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <button onClick={onToggle} className="flex items-center justify-between w-full text-left">
        <span className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
          <Wrench className="w-4 h-4" />
          <span>
            Under the hood · {toolCalls.length} MCP call{toolCalls.length > 1 ? "s" : ""}
          </span>
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {asks.map((t, i) => (
            <div key={`ask-${i}`} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
              <div className="flex items-center gap-2 text-[11px] font-mono text-violet-700">
                <span className="px-1.5 py-0.5 bg-violet-100 rounded uppercase">ask</span>
                <span className="truncate">{t.tool}</span>
              </div>
              <pre className="mt-1.5 text-[10px] text-gray-600 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(t.args ?? {}, null, 2)}
              </pre>
              {summarizeToolResult(t.result) && (
                <div className="mt-1 text-[10px] text-gray-500">→ {summarizeToolResult(t.result)}</div>
              )}
            </div>
          ))}

          {polls.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
              <div className="flex items-center gap-2 text-[11px] font-mono text-indigo-700">
                <span className="px-1.5 py-0.5 bg-indigo-100 rounded uppercase">poll</span>
                <span className="truncate">{polls[0].tool}</span>
                <span className="text-gray-400">· {polls.length}×</span>
              </div>
              {pollStatuses.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {pollStatuses.map((s, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-gray-300 text-[10px]">→</span>}
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-600">
                        {s}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
