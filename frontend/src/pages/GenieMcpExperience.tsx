import { useState, useRef, useEffect } from "react";
import {
  Send,
  Plus,
  Sparkles,
  Zap,
  Cpu,
  Database,
  Terminal,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  Radio,
  Loader2,
} from "lucide-react";
import MarkdownContent from "@/components/MarkdownContent";
import {
  useGenieMcpChat,
  type GenieMcpMessage,
  type McpStatus,
  type GenieTable,
} from "@/hooks/useGenieMcpChat";
import { useUser } from "@/hooks/useUser";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const SUGGESTIONS = [
  "What are the top 5 spend categories in 2025?",
  "Show the monthly air travel emissions trend",
  "Which destinations had the highest spend last year?",
  "Compare hotel spend by region",
];

export default function GenieMcpExperience() {
  const { messages, isLoading, mcpStatus, checkHealth, sendMessage, clearChat } = useGenieMcpChat();
  const { user } = useUser();
  const [input, setInput] = useState("");
  const [openSql, setOpenSql] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  const toggleSql = (id: string) => setOpenSql((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50 min-w-0">
      {/* Header / hero */}
      <div className="shrink-0 bg-gradient-to-r from-violet-700 to-indigo-700 text-white px-6 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="bg-white/15 rounded-xl p-2.5">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Genie MCP</h1>
              <p className="text-sm text-white/80 max-w-2xl mt-0.5">
                A real MCP client talking to the Databricks{" "}
                <span className="font-semibold">managed Genie MCP server</span> — grounded answers
                with live reasoning, generated SQL, result tables, and a deep link back to Databricks.
              </p>
            </div>
          </div>
          <McpStatusChip status={mcpStatus} onRetry={checkHealth} />
        </div>
      </div>

      {/* Contrast banner: Multi-Agent vs Genie MCP */}
      <ContrastBanner />

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
        {messages.length === 0 ? (
          <EmptyState onPick={(q) => !isLoading && sendMessage(q)} />
        ) : (
          <div className="max-w-4xl mx-auto space-y-5">
            {messages.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id} message={m} initials={user?.initials || "U"} />
              ) : (
                <AssistantBubble
                  key={m.id}
                  message={m}
                  showSql={!!openSql[m.id]}
                  onToggleSql={() => toggleSql(m.id)}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={clearChat}
            title="New conversation"
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-violet-700 border border-violet-200 rounded-xl hover:bg-violet-50 transition-colors shrink-0"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New</span>
          </button>
          <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Genie a question about your travel data..."
              disabled={isLoading}
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none disabled:cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 bg-violet-600 rounded-full flex items-center justify-center hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send size={18} className="text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}

/* ───────────────────────────── Subcomponents ──────────────────────────────── */

function McpStatusChip({ status, onRetry }: { status: McpStatus; onRetry: () => void }) {
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

function ContrastBanner() {
  return (
    <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-3">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex items-start gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <Cpu className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-gray-700">Multi-Agent System (Model Serving)</p>
            <p className="text-xs text-gray-500">Streams a free-text answer. No native SQL, table, or deep link.</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
          <Zap className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-violet-700">Genie MCP (this page)</p>
            <p className="text-xs text-gray-600">
              Grounded answer + live reasoning + generated SQL + result table + deep link, governed by Unity Catalog.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-12 max-w-3xl mx-auto">
      <div className="bg-violet-100 rounded-2xl p-4 mb-5">
        <Sparkles className="w-9 h-9 text-violet-600" />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-2">Ask Genie anything</h3>
      <p className="text-gray-600 mb-8 max-w-xl">
        Watch Genie reason step-by-step, generate SQL, run it against your governed data, and answer
        — all through the Model Context Protocol.
      </p>
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="text-left px-4 py-3.5 bg-white border border-gray-200 rounded-xl hover:border-violet-300 hover:shadow-sm transition-all text-sm text-gray-700"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ message, initials }: { message: GenieMcpMessage; initials: string }) {
  return (
    <div className="flex items-start justify-end gap-2">
      <div className="bg-violet-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm max-w-[80%]">
        <p className="text-sm">{message.content}</p>
      </div>
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarFallback className="bg-violet-100 text-violet-700 text-[10px] font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

function ReasoningTimeline({ steps, isStreaming }: { steps: string[]; isStreaming: boolean }) {
  if (!steps || steps.length === 0) {
    return isStreaming ? (
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        <span className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-violet-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 bg-violet-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 bg-violet-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </span>
        <span>Genie is thinking…</span>
      </div>
    ) : null;
  }
  return (
    <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 mb-2 flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5" /> Genie reasoning
      </p>
      <ol className="space-y-1.5">
        {steps.map((step, idx) => {
          const pending = isStreaming && idx === steps.length - 1;
          return (
            <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
              {pending ? (
                <span className="w-3.5 h-3.5 mt-0.5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-600 shrink-0" />
              )}
              <span>{step}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ResultTable({ table }: { table: GenieTable }) {
  const columns = (table.columns || []).map((c) => (typeof c === "string" ? c : c.name));
  const rows = table.rows || [];
  if (columns.length === 0 || rows.length === 0) return null;

  return (
    <div className="mt-3 overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 text-xs">
        <thead className="bg-gray-100">
          <tr>
            {columns.map((c, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="px-3 py-2 text-gray-600 whitespace-nowrap border-t border-gray-100">
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
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-xs">
          <Sparkles size={15} />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 bg-white rounded-2xl rounded-tl-md px-5 py-4 shadow-sm border border-gray-200">
        <ReasoningTimeline steps={message.steps} isStreaming={message.isStreaming} />

        {message.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {message.error}
          </div>
        )}

        {message.content && <MarkdownContent content={message.content} />}

        {/* Generated SQL (collapsible) */}
        {message.sql.length > 0 && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <button onClick={onToggleSql} className="flex items-center justify-between w-full text-left">
              <span className="flex items-center gap-2 text-xs font-semibold text-violet-700 uppercase tracking-wide">
                <Terminal className="w-4 h-4" />
                <span>Generated SQL{message.sql.length > 1 ? ` (${message.sql.length})` : ""}</span>
              </span>
              {showSql ? (
                <ChevronUp className="w-4 h-4 text-violet-700" />
              ) : (
                <ChevronDown className="w-4 h-4 text-violet-700" />
              )}
            </button>
            {showSql &&
              message.sql.map((block, i) => (
                <pre
                  key={i}
                  className="mt-2 bg-gray-900 text-green-300 p-3 rounded-lg text-[11px] font-mono overflow-x-auto"
                >
                  {block.sql}
                </pre>
              ))}
          </div>
        )}

        {/* Result table */}
        {message.table && <ResultTable table={message.table} />}

        {/* Deep link back to Databricks Genie */}
        {message.deepLink && (
          <a
            href={message.deepLink.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>{message.deepLink.label || "Open in Genie"}</span>
          </a>
        )}

        {/* Footer meta */}
        {!message.isStreaming && (message.content || message.error) && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-400">
            <Database className="w-3.5 h-3.5" />
            <span>Answered via Genie MCP (genie_ask → genie_poll_response)</span>
            {message.status && message.status !== "completed" && (
              <span className="text-amber-600">· {message.status}</span>
            )}
          </div>
        )}

        {/* Initial spinner before any step arrives */}
        {message.isStreaming && message.steps.length === 0 && !message.content && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Connecting…
          </div>
        )}
      </div>
    </div>
  );
}
