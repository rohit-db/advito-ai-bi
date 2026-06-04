import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  MessageCircle,
  Send,
  Trash2,
  X,
  Terminal,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import MarkdownContent from "@/components/MarkdownContent";
import ExecutiveSummaryModal from "@/components/ExecutiveSummaryModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  useGenieMcpChat,
  type GenieMcpMessage,
  type GenieTable,
} from "@/hooks/useGenieMcpChat";

export interface DashboardWorkspaceProps {
  pageKey: string;
  pageLabel: string;
  pageContext: string;
  summaryPrompt: string;
  suggestions: string[];
  children: React.ReactNode;
}

export default function DashboardWorkspace({
  pageKey,
  pageLabel,
  pageContext,
  summaryPrompt,
  suggestions,
  children,
}: DashboardWorkspaceProps) {
  const { messages, isLoading, mcpStatus, sendMessage, clearChat } = useGenieMcpChat();
  const [railOpen, setRailOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [input, setInput] = useState("");
  const [openSql, setOpenSql] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset the conversation whenever the page changes.
  useEffect(() => {
    clearChat();
    setInput("");
    setOpenSql({});
    setSummaryOpen(false);
  }, [pageKey, clearChat]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim(), pageContext);
    setInput("");
  };

  const handleSuggestion = (q: string) => {
    if (isLoading) return;
    sendMessage(q, pageContext);
  };

  const toggleSql = (id: string) => setOpenSql((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="flex h-full min-w-0">
      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSummaryOpen(true)}
            className="gap-1.5 text-indigo-700 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800"
          >
            <Sparkles size={14} />
            <span>Executive Summary</span>
          </Button>
          <Button
            size="sm"
            variant={railOpen ? "default" : "outline"}
            onClick={() => setRailOpen((o) => !o)}
            className="gap-1.5"
          >
            <MessageCircle size={14} />
            <span>Ask APEX</span>
          </Button>
        </div>

        {/* Dashboard content */}
        <div className="flex-1 min-h-0">{children}</div>
      </div>

      {/* Right rail */}
      {railOpen && (
        <aside className="w-[400px] shrink-0 border-l border-gray-200 bg-white flex flex-col h-full">
          {/* Gradient header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 pt-4 pb-3 shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    Ask APEX
                    <McpStatusDot state={mcpStatus.state} />
                  </h2>
                  <p className="text-[11px] text-indigo-200">AI-powered travel intelligence</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={clearChat}
                  className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={() => setRailOpen(false)}
                  className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                  title="Close panel"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Context badge */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge className="bg-indigo-500/40 text-indigo-100 border-indigo-400/30 text-[11px] px-2 py-0.5">
                {pageLabel}
              </Badge>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
            {messages.length === 0 && !isLoading ? (
              <div className="space-y-4 pt-2">
                <p className="text-xs text-gray-400 text-center">Ask about what you're viewing</p>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-1">
                    Suggested
                  </p>
                  {suggestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSuggestion(q)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-600 bg-white hover:bg-indigo-50 hover:text-indigo-700 rounded-lg border border-gray-200 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) =>
                m.role === "user" ? (
                  <UserBubble key={m.id} message={m} />
                ) : (
                  <AssistantBubble
                    key={m.id}
                    message={m}
                    showSql={!!openSql[m.id]}
                    onToggleSql={() => toggleSql(m.id)}
                  />
                )
              )
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-200 bg-white px-3 py-3 shrink-0">
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your data..."
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none py-0.5"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="w-7 h-7 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full transition-colors shrink-0"
              >
                <Send size={12} />
              </button>
            </form>
          </div>
        </aside>
      )}

      {summaryOpen && (
        <ExecutiveSummaryModal
          pageLabel={pageLabel}
          pageContext={pageContext}
          summaryPrompt={summaryPrompt}
          onClose={() => setSummaryOpen(false)}
        />
      )}
    </div>
  );
}

/* ───────────────────────────── Subcomponents ──────────────────────────────── */

function McpStatusDot({ state }: { state: "connecting" | "error" | "connected" }) {
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

function UserBubble({ message }: { message: GenieMcpMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] bg-indigo-600 text-white rounded-2xl rounded-br-sm px-3 py-2.5 text-sm shadow-sm">
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}

function CompactReasoning({ steps, isStreaming }: { steps: string[]; isStreaming: boolean }) {
  if (!steps || steps.length === 0) {
    return isStreaming ? (
      <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1.5">
        <span className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </span>
        <span>Thinking…</span>
      </div>
    ) : null;
  }

  if (isStreaming) {
    return (
      <div className="mb-2 flex items-start gap-1.5 text-[11px] text-gray-600">
        <span className="w-3 h-3 mt-0.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
        <span className="break-words">{steps[steps.length - 1]}</span>
      </div>
    );
  }

  return (
    <div className="mb-2 flex items-start gap-1.5 text-[11px] text-gray-500">
      <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-600 shrink-0" />
      <span className="break-words">
        {steps.length} reasoning step{steps.length > 1 ? "s" : ""} · {steps[steps.length - 1]}
      </span>
    </div>
  );
}

function CompactTable({ table }: { table: GenieTable }) {
  const columns = (table.columns || []).map((c) => (typeof c === "string" ? c : c.name));
  const rows = table.rows || [];
  if (columns.length === 0 || rows.length === 0) return null;

  return (
    <div className="mt-2 overflow-auto max-h-48 border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 text-[11px]">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            {columns.map((c, i) => (
              <th key={i} className="px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="px-2 py-1 text-gray-600 whitespace-nowrap border-t border-gray-100">
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

function AssistantBubble({
  message,
  showSql,
  onToggleSql,
}: {
  message: GenieMcpMessage;
  showSql: boolean;
  onToggleSql: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs">
          <Sparkles size={13} />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 bg-white rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm border border-gray-200">
        <CompactReasoning steps={message.steps} isStreaming={message.isStreaming} />

        {message.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-2 text-xs text-red-700">
            {message.error}
          </div>
        )}

        {message.content && <MarkdownContent content={message.content} compact />}

        {/* Generated SQL (collapsible) */}
        {message.sql.length > 0 && (
          <div className="mt-2 border-t border-gray-100 pt-2">
            <button onClick={onToggleSql} className="flex items-center justify-between w-full text-left">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">
                <Terminal className="w-3.5 h-3.5" />
                <span>SQL{message.sql.length > 1 ? ` (${message.sql.length})` : ""}</span>
              </span>
              {showSql ? (
                <ChevronUp className="w-3.5 h-3.5 text-indigo-700" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-indigo-700" />
              )}
            </button>
            {showSql &&
              message.sql.map((block, i) => (
                <pre
                  key={i}
                  className="mt-2 bg-gray-900 text-green-300 p-2.5 rounded-lg text-[10px] font-mono overflow-x-auto"
                >
                  {block.sql}
                </pre>
              ))}
          </div>
        )}

        {/* Result table */}
        {message.table && <CompactTable table={message.table} />}

        {/* Deep link */}
        {message.deepLink && (
          <a
            href={message.deepLink.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{message.deepLink.label || "Open in Genie"}</span>
          </a>
        )}

        {/* Initial spinner before any step or content arrives */}
        {message.isStreaming && message.steps.length === 0 && !message.content && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 size={12} className="animate-spin" /> Connecting…
          </div>
        )}
      </div>
    </div>
  );
}
