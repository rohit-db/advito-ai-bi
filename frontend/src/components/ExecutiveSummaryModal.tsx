import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  X,
  Terminal,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Loader2,
} from "lucide-react";
import MarkdownContent from "@/components/MarkdownContent";
import { Badge } from "@/components/ui/badge";
import { useGenieMcpChat, type GenieTable } from "@/hooks/useGenieMcpChat";
import { buildExecSummaryPrompt } from "@/config";

export interface ExecutiveSummaryModalProps {
  pageLabel: string;
  pageContext: string;
  summaryPrompt: string;
  onClose: () => void;
}

export default function ExecutiveSummaryModal({
  pageLabel,
  pageContext,
  summaryPrompt,
  onClose,
}: ExecutiveSummaryModalProps) {
  // Executive Summary runs against the workspace-wide Genie MCP ("multi"),
  // which returns a narrative markdown answer well-suited to a board-ready brief.
  const { messages, isLoading, sendMessage, clearChat } = useGenieMcpChat("multi");
  const [showSql, setShowSql] = useState(false);
  const sentRef = useRef(false);

  const fire = () => {
    sendMessage(buildExecSummaryPrompt(summaryPrompt), pageContext);
  };

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    fire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleRegenerate = () => {
    if (isLoading) return;
    clearChat();
    setShowSql(false);
    fire();
  };

  const assistant = messages.find((m) => m.role === "assistant");
  const streaming = assistant?.isStreaming ?? isLoading;
  const lastStep = assistant?.steps[assistant.steps.length - 1];
  const hasContent = !!assistant?.content;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Executive Summary</h2>
              <div className="mt-1 flex items-center gap-2">
                <Badge className="bg-white/20 text-white border-white/20 text-[11px] px-2 py-0.5">
                  {pageLabel}
                </Badge>
                <span className="text-[11px] text-indigo-100">via Genie MCP</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              title="Regenerate"
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 bg-gray-50">
          {/* Awaiting state */}
          {streaming && !hasContent && (
            <AwaitingState step={lastStep} />
          )}

          {assistant?.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              {assistant.error}
            </div>
          )}

          {hasContent && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
              {/* While more is still streaming after first content, a subtle ribbon */}
              {streaming && (
                <div className="mb-3 flex items-center gap-2 text-[11px] text-indigo-600">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Refining…</span>
                </div>
              )}
              <MarkdownContent content={assistant!.content} />

              {/* Result table */}
              {assistant!.table &&
                assistant!.table.columns.length > 0 &&
                assistant!.table.rows.length > 0 && (
                  <SummaryTable table={assistant!.table} />
                )}

              {/* Generated SQL */}
              {assistant!.sql.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => setShowSql((s) => !s)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">
                      <Terminal className="w-3.5 h-3.5" />
                      <span>SQL{assistant!.sql.length > 1 ? ` (${assistant!.sql.length})` : ""}</span>
                    </span>
                    {showSql ? (
                      <ChevronUp className="w-3.5 h-3.5 text-indigo-700" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-indigo-700" />
                    )}
                  </button>
                  {showSql &&
                    assistant!.sql.map((block, i) => (
                      <pre
                        key={i}
                        className="mt-2 bg-gray-900 text-green-300 p-3 rounded-lg text-[11px] font-mono overflow-x-auto"
                      >
                        {block.sql}
                      </pre>
                    ))}
                </div>
              )}

              {/* Deep link */}
              {assistant!.deepLink && (
                <a
                  href={assistant!.deepLink.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{assistant!.deepLink.label || "Open in Genie"}</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-200 bg-white px-5 py-2.5 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            Generated by the managed Genie MCP server · figures may take a moment
          </span>
          <button
            onClick={onClose}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Subcomponents ──────────────────────────────── */

function AwaitingState({ step }: { step?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-indigo-500 animate-pulse" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">Preparing your executive summary…</p>
          <p className="text-[11px] text-gray-500 mt-0.5 min-h-[14px]">
            {step || "Connecting to Genie and querying your data"}
          </p>
        </div>
      </div>

      {/* Shimmer skeleton mimicking the three sections */}
      <div className="mt-5 space-y-4">
        {["Overview", "KPIs", "Strategic Insights"].map((section) => (
          <div key={section}>
            <div className="h-3 w-28 rounded bg-indigo-100 mb-2" />
            <div className="space-y-1.5">
              <div className="h-2.5 w-full rounded bg-gray-100 animate-pulse" />
              <div className="h-2.5 w-[88%] rounded bg-gray-100 animate-pulse" />
              <div className="h-2.5 w-[72%] rounded bg-gray-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryTable({ table }: { table: GenieTable }) {
  const columns = (table.columns || []).map((c) => (typeof c === "string" ? c : c.name));
  const rows = table.rows || [];
  return (
    <div className="mt-4 overflow-auto max-h-60 border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 text-[11px]">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            {columns.map((c, i) => (
              <th key={i} className="px-2.5 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="px-2.5 py-1.5 text-gray-600 whitespace-nowrap border-t border-gray-100">
                  {cell == null ? "" : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
