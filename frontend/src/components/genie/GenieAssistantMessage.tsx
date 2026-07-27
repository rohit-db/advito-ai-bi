import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp, Database, Loader2 } from "lucide-react";
import MarkdownContent from "@/components/MarkdownContent";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { GenieMcpMessage } from "@/hooks/useGenieMcpChat";
import GenieReasoning from "./GenieReasoning";
import GenieResultTable from "./GenieResultTable";
import GenieSqlBlock from "./GenieSqlBlock";
import GenieDeepLink from "./GenieDeepLink";
import GenieToolCalls from "./GenieToolCalls";

const LONG_ANSWER_CHARS = 600;

// The single assistant-message renderer shared by the full Genie MCP page and
// the compact dashboard rail. Reasoning -> error -> answer -> SQL -> table ->
// tool calls -> deep link -> footer. Tool calls/footer/answer-collapse are
// opt-in so each surface keeps its existing affordances.
export default function GenieAssistantMessage({
  message,
  variant = "full",
  sqlOpen,
  onToggleSql,
  toolsOpen,
  onToggleTools,
  collapsibleAnswer = false,
  showFooter = false,
}: {
  message: GenieMcpMessage;
  variant?: "full" | "compact";
  sqlOpen: boolean;
  onToggleSql: () => void;
  toolsOpen?: boolean;
  onToggleTools?: () => void;
  collapsibleAnswer?: boolean;
  showFooter?: boolean;
}) {
  const compact = variant === "compact";
  const [answerOpen, setAnswerOpen] = useState(false);
  const longAnswer = collapsibleAnswer && (message.content?.length || 0) > LONG_ANSWER_CHARS;
  const collapsed = longAnswer && !answerOpen;
  const showTools = onToggleTools !== undefined && toolsOpen !== undefined;

  const avatarSize = compact ? "h-7 w-7" : "h-8 w-8";
  const iconSize = compact ? 13 : 15;
  const bubble = compact
    ? "flex-1 min-w-0 bg-white rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm border border-slate-200"
    : "flex-1 min-w-0 bg-white rounded-2xl rounded-tl-md px-5 py-4 shadow-sm border border-slate-200";

  return (
    <div className="flex items-start gap-2">
      <Avatar className={`${avatarSize} shrink-0`}>
        <AvatarFallback className="bg-linear-to-br from-brand-accent to-brand-primary text-white text-xs">
          <Sparkles size={iconSize} />
        </AvatarFallback>
      </Avatar>
      <div className={bubble}>
        <GenieReasoning steps={message.steps} isStreaming={message.isStreaming} variant={variant} />

        {message.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {message.error}
          </div>
        )}

        {message.content &&
          (longAnswer ? (
            <div>
              <div className={`relative ${collapsed ? "max-h-48 overflow-hidden" : ""}`}>
                <MarkdownContent content={message.content} />
                {collapsed && (
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-white to-transparent pointer-events-none" />
                )}
              </div>
              <button
                onClick={() => setAnswerOpen((o) => !o)}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-accent hover:text-brand-accent-dark"
              >
                {answerOpen ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" /> Show full answer
                  </>
                )}
              </button>
            </div>
          ) : (
            <MarkdownContent content={message.content} compact={compact} />
          ))}

        <GenieSqlBlock
          blocks={message.sql}
          open={sqlOpen}
          onToggle={onToggleSql}
          variant={variant}
        />

        {message.table && <GenieResultTable table={message.table} size={compact ? "sm" : "md"} />}

        {showTools && (
          <GenieToolCalls toolCalls={message.toolCalls} open={toolsOpen!} onToggle={onToggleTools!} />
        )}

        <GenieDeepLink deepLink={message.deepLink} variant={variant} />

        {showFooter && !message.isStreaming && (message.content || message.error) && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <Database className="w-3.5 h-3.5" />
            <span>Answered via the managed Genie MCP server</span>
            {message.status && message.status !== "completed" && (
              <span className="text-amber-600">· {message.status}</span>
            )}
          </div>
        )}

        {message.isStreaming && message.steps.length === 0 && !message.content && (
          <div className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"} text-slate-400`}>
            <Loader2 size={compact ? 12 : 14} className="animate-spin" /> Connecting…
          </div>
        )}
      </div>
    </div>
  );
}
