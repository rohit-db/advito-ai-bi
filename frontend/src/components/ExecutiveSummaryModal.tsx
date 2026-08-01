import { useEffect, useRef, useState } from "react";
import { X, RefreshCw, Loader2 } from "lucide-react";
import MarkdownContent from "@/components/MarkdownContent";
import { Badge } from "@/components/ui/badge";
import { useGenieMcpChat } from "@/hooks/useGenieMcpChat";
import { buildExecSummaryPrompt } from "@/config";
import GenieResultTable from "@/components/genie/GenieResultTable";
import GenieSqlBlock from "@/components/genie/GenieSqlBlock";
import GenieDeepLink from "@/components/genie/GenieDeepLink";
import GradientMark from "@/theme/GradientMark";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-secondary rounded-md border border-border shadow-db-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 bg-muted px-5 py-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <GradientMark size={36} />
            <div>
              <h2 className="text-base font-semibold text-foreground">Executive Summary</h2>
              <div className="mt-1 flex items-center gap-2">
                <Badge className="bg-background text-muted-foreground border-border text-[11px] px-2 py-0.5">
                  {pageLabel}
                </Badge>
                <span className="text-[11px] text-muted-foreground">via Genie MCP</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              title="Regenerate"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-[var(--action-default-bg-hover)] rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-[var(--action-default-bg-hover)] rounded transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 bg-background">
          {/* Awaiting state */}
          {streaming && !hasContent && <AwaitingState step={lastStep} />}

          {assistant?.error && (
            <div className="rounded-md bg-[var(--background-danger)] border border-[color:var(--border-danger)] px-3 py-2.5 text-sm text-[var(--destructive)]">
              {assistant.error}
            </div>
          )}

          {hasContent && (
            <div className="bg-secondary rounded-md border border-border px-5 py-4 shadow-db-xs">
              {/* While more is still streaming after first content, a subtle ribbon */}
              {streaming && (
                <div className="mb-3 flex items-center gap-2 text-[11px] text-primary">
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
        <div className="shrink-0 border-t border-border bg-secondary px-5 py-2.5 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Generated by the managed Genie MCP server · figures may take a moment
          </span>
          <button
            onClick={onClose}
            className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded hover:bg-[var(--action-default-bg-hover)] transition-colors"
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
    <div className="bg-secondary rounded-md border border-border px-5 py-6 shadow-db-xs">
      <div className="flex items-center gap-3">
        <div className="relative">
          <GradientMark size={36} />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-secondary bg-primary animate-pulse" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Preparing your executive summary…</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 min-h-[14px]">
            {step || "Connecting to Genie and querying your data"}
          </p>
        </div>
      </div>

      {/* Shimmer skeleton mimicking the three sections */}
      <div className="mt-5 space-y-4">
        {["Overview", "KPIs", "Strategic Insights"].map((section) => (
          <div key={section}>
            <div className="h-3 w-28 rounded bg-muted mb-2" />
            <div className="space-y-1.5">
              <div className="h-2.5 w-full rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-[88%] rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-[72%] rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
