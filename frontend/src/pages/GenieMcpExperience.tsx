import { useState, useRef, useEffect } from "react";
import { Send, Plus, Sparkles, Zap, Cpu } from "lucide-react";
import {
  useGenieMcpChat,
  type GenieMcpMessage,
  type GenieMode,
} from "@/hooks/useGenieMcpChat";
import { useUser } from "@/hooks/useUser";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MODE_META, SUGGESTIONS_BY_MODE } from "@/components/genie/genieModes";
import { McpStatusChip } from "@/components/genie/GenieMcpStatus";
import GenieAssistantMessage from "@/components/genie/GenieAssistantMessage";

export default function GenieMcpExperience() {
  const { messages, isLoading, mcpStatus, mode, setMode, checkHealth, sendMessage, clearChat } =
    useGenieMcpChat();
  const { user } = useUser();
  const [input, setInput] = useState("");
  const [openSql, setOpenSql] = useState<Record<string, boolean>>({});
  const [openTools, setOpenTools] = useState<Record<string, boolean>>({});
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
  const toggleTools = (id: string) => setOpenTools((prev) => ({ ...prev, [id]: !prev[id] }));

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
        <ModeToggle mode={mode} onChange={setMode} disabled={isLoading} />
      </div>

      {/* Contrast banner: Multi-Agent vs Genie MCP */}
      <ContrastBanner />

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
        {messages.length === 0 ? (
          <EmptyState mode={mode} onPick={(q) => !isLoading && sendMessage(q)} />
        ) : (
          <div className="max-w-4xl mx-auto space-y-5">
            {messages.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id} message={m} initials={user?.initials || "U"} />
              ) : (
                <GenieAssistantMessage
                  key={m.id}
                  message={m}
                  variant="full"
                  sqlOpen={!!openSql[m.id]}
                  onToggleSql={() => toggleSql(m.id)}
                  toolsOpen={!!openTools[m.id]}
                  onToggleTools={() => toggleTools(m.id)}
                  collapsibleAnswer
                  showFooter
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

/* ───────────────────────────── Page chrome ─────────────────────────────────── */

function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: GenieMode;
  onChange: (m: GenieMode) => void;
  disabled?: boolean;
}) {
  const modes: GenieMode[] = ["space", "multi"];
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <div className="inline-flex items-center gap-1 bg-white/10 rounded-xl p-1 w-fit">
        {modes.map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onClick={() => onChange(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                active ? "bg-white text-violet-700 shadow-sm" : "text-white/80 hover:text-white"
              }`}
            >
              {MODE_META[m].label}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-white/70">
        {MODE_META[mode].blurb}{" "}
        <span className="font-mono text-white/55">{MODE_META[mode].path}</span>
      </p>
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

function EmptyState({ mode, onPick }: { mode: GenieMode; onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-12 max-w-3xl mx-auto">
      <div className="bg-violet-100 rounded-2xl p-4 mb-5">
        <Sparkles className="w-9 h-9 text-violet-600" />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-2">Ask Genie anything</h3>
      <p className="text-gray-600 mb-2 max-w-xl">
        Watch Genie reason step-by-step, generate SQL, run it against your governed data, and answer
        — all through the Model Context Protocol.
      </p>
      <p className="text-xs text-gray-500 mb-8">
        Querying the <span className="font-semibold text-violet-700">{MODE_META[mode].label}</span> —{" "}
        {MODE_META[mode].blurb}
      </p>
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SUGGESTIONS_BY_MODE[mode].map((q) => (
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
