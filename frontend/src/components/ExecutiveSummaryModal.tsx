import { useEffect, useRef, useState } from "react";
import { Sparkles, X, RefreshCw, Loader2 } from "lucide-react";
import MarkdownContent from "@/components/MarkdownContent";
import { Badge } from "@/components/ui/badge";
import { useGenieMcpChat } from "@/hooks/useGenieMcpChat";
import { buildExecSummaryPrompt } from "@/config";
import GenieResultTable from "@/components/genie/GenieResultTable";
import GenieSqlBlock from "@/components/genie/GenieSqlBlock";
import GenieDeepLink from "@/components/genie/GenieDeepLink";

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
        <div className="shrink-0 bg-linear-to-r from-brand-primary to-brand-accent px-5 py-4 flex items-start justify-between">
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
                <span className="text-[11px] text-brand-primary-light">via Genie MCP</span>
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
        <div className="flex-1 overflow-y-auto px-5 py-5 bg-slate-50">
          {/* Awaiting state */}
          {streaming && !hasContent && <AwaitingState step={lastStep} />}

          {assistant?.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              {assistant.error}
            </div>
          )}

          {hasContent && (
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm">
              {/* While more is still streaming after first content, a subtle ribbon */}
              {streaming && (
                <div className="mb-3 flex items-center gap-2 text-[11px] text-brand-primary">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Refining…</span>
                </div>
              )}
              <MarkdownContent content={assistant!.content} />

              {assistant!.table && <GenieResultTable table={assistant!.table} size="sm" />}

              <GenieSqlBlock
                blocks={assistant!.sql}
                open={showSql}
                onToggle={() => setShowSql((s) => !s)}
                variant="compact"
              />

              <GenieDeepLink deepLink={assistant!.deepLink} variant="compact" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-2.5 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Generated by the managed Genie MCP server · figures may take a moment
          </span>
          <button
            onClick={onClose}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AwaitingState({ step }: { step?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-brand-primary to-brand-accent flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-brand-accent animate-pulse" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-800">Preparing your executive summary…</p>
          <p className="text-[11px] text-slate-500 mt-0.5 min-h-[14px]">
            {step || "Connecting to Genie and querying your data"}
          </p>
        </div>
      </div>

      {/* Shimmer skeleton mimicking the three sections */}
      <div className="mt-5 space-y-4">
        {["Overview", "KPIs", "Strategic Insights"].map((section) => (
          <div key={section}>
            <div className="h-3 w-28 rounded bg-brand-primary-light mb-2" />
            <div className="space-y-1.5">
              <div className="h-2.5 w-full rounded bg-slate-100 animate-pulse" />
              <div className="h-2.5 w-[88%] rounded bg-slate-100 animate-pulse" />
              <div className="h-2.5 w-[72%] rounded bg-slate-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
