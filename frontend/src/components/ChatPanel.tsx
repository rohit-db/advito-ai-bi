import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Trash2, Code, Sparkles, X } from "lucide-react";
import MarkdownContent from "@/components/MarkdownContent";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  "/spend": [
    "Total spend by category for 2025?",
    "Top 10 destinations by gross spend USD?",
    "Compare spend 2025 vs 2024 by travel sector?",
  ],
  "/spend-custom": [
    "Show spend breakdown by travel class",
    "Which vendors have the highest spend?",
    "Average advance booking days by category?",
  ],
  "/sustainability": [
    "Total emissions by category for 2025?",
    "Top 5 countries by CO2 emissions?",
    "What is the emissions per km for Air travel?",
  ],
};

const DEFAULT_SUGGESTIONS = [
  "Total emissions by category for 2025?",
  "Top destinations by spend USD?",
  "How many unique travelers this year?",
];

export interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activePath: string;
  activePageLabel: string;
  filterContext: string;
}

function DataTable({ data }: { data: NonNullable<ChatMessage["data"]> }) {
  return (
    <div className="overflow-auto max-h-48 mt-2 rounded border border-gray-200 text-xs">
      <table className="w-full">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {data.columns.map((col) => (
              <th key={col.name} className="px-2 py-1 text-left font-medium text-gray-600 whitespace-nowrap">
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="border-t border-gray-100">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ChatPanel({
  isOpen,
  onClose,
  activePath,
  activePageLabel,
  filterContext,
}: ChatPanelProps) {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const [input, setInput] = useState("");
  const [showSql, setShowSql] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevPathRef = useRef<string>(activePath);

  const hasFilters = !!filterContext && filterContext !== "No filters applied" && filterContext !== "";
  const suggestions = PAGE_SUGGESTIONS[activePath] ?? DEFAULT_SUGGESTIONS;

  const fullContext = [`Dashboard: ${activePageLabel}`, filterContext].filter(Boolean).join(". ");

  useEffect(() => {
    if (prevPathRef.current !== activePath) {
      prevPathRef.current = activePath;
      clearChat();
      setInput("");
      setShowSql(null);
    }
  }, [activePath, clearChat]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim(), fullContext);
    setInput("");
  };

  const handleSuggestion = (q: string) => {
    if (isLoading) return;
    sendMessage(q, fullContext);
  };

  if (!isOpen) return null;

  return (
    <aside className="w-[380px] border-l border-gray-200 bg-white flex flex-col shrink-0 h-full">
      {/* Gradient header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Ask APEX</h2>
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
              onClick={onClose}
              className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              title="Close panel"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Context pills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge className="bg-indigo-500/40 text-indigo-100 border-indigo-400/30 text-[11px] px-2 py-0.5">
            {activePageLabel}
          </Badge>
          {hasFilters && (
            <Badge className="bg-amber-400/20 text-amber-100 border-amber-300/30 text-[11px] px-2 py-0.5">
              {filterContext}
            </Badge>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
        {messages.length === 0 && !isLoading && (
          <div className="space-y-4 pt-2">
            <p className="text-xs text-gray-400 text-center">Ask about what you're viewing</p>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-1">Suggested</p>
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
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[88%] rounded-2xl px-3 py-2.5 text-sm",
              msg.role === "user"
                ? "bg-indigo-600 text-white rounded-br-sm"
                : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
            )}>
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              ) : (
                <MarkdownContent content={msg.content} compact />
              )}
              {msg.sql && (
                <button
                  onClick={() => setShowSql(showSql === i ? null : i)}
                  className={cn(
                    "flex items-center gap-1 mt-1.5 text-xs transition-colors",
                    msg.role === "user" ? "text-indigo-200 hover:text-white" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Code size={11} /> {showSql === i ? "Hide SQL" : "Show SQL"}
                </button>
              )}
              {showSql === i && msg.sql && (
                <pre className="mt-1.5 p-2 bg-gray-900 text-green-300 rounded text-[11px] overflow-auto max-h-32">{msg.sql}</pre>
              )}
              {msg.data && <DataTable data={msg.data} />}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2.5 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 size={12} className="animate-spin" /> Thinking...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
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
  );
}
