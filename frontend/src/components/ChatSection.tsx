import { useState, useRef, useEffect } from "react";
import { Send, Loader2, X, Code, Trash2, Eye, Filter } from "lucide-react";
import MarkdownContent from "./MarkdownContent";
import { useChat, type ChatMessage } from "../hooks/useChat";

// Map sidebar paths to page label + suggested questions
const PAGE_INFO: Record<string, { label: string; suggestions: string[] }> = {
  "/": {
    label: "Multi-Page Dashboard",
    suggestions: [
      "What are the top 5 routes by revenue?",
      "How many trips happened last week?",
      "What is the average fare by day of week?",
    ],
  },
  "/single": {
    label: "Single-Page Dashboard",
    suggestions: [
      "Show me the top pickup locations",
      "What is the average trip distance?",
      "Which payment type is most common?",
    ],
  },
  "/tabbed": {
    label: "Custom Tabs Dashboard",
    suggestions: [
      "Compare revenue across routes",
      "What are the busiest pickup zones?",
      "Show fare distribution by trip distance",
    ],
  },
};

const DEFAULT_INFO = {
  label: "APEX",
  suggestions: [
    "Show me total trips",
    "What are the top routes by revenue?",
    "Average fare by day of week?",
  ],
};

interface ChatSectionProps {
  activePath: string;
  filterContext: string;
  onClose: () => void;
}

function DataTable({ data }: { data: NonNullable<ChatMessage["data"]> }) {
  return (
    <div className="overflow-auto max-h-48 mt-2 rounded border border-gray-200 text-xs">
      <table className="w-full">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {data.columns.map((col) => (
              <th
                key={col.name}
                className="px-2 py-1 text-left font-medium text-gray-600 whitespace-nowrap"
              >
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="border-t border-gray-100">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ChatSection({
  activePath,
  filterContext,
  onClose,
}: ChatSectionProps) {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const [input, setInput] = useState("");
  const [showSql, setShowSql] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pageInfo = PAGE_INFO[activePath] || DEFAULT_INFO;
  const hasFilters = filterContext !== "No filters applied";

  // Build the full context string sent to Genie
  const fullContext = [
    `Dashboard: ${pageInfo.label}`,
    filterContext,
  ].join(". ");

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

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

  return (
    <aside className="w-[380px] border-l border-apex-border bg-white flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-apex-border flex items-center justify-between">
        <h2 className="text-sm font-semibold">Ask APEX</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="Clear chat"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Context badges */}
      <div className="px-4 py-2 border-b border-apex-border bg-gray-50 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-indigo-600">
          <Eye size={12} />
          <span className="font-medium">Viewing:</span>
          <span className="text-indigo-500">{pageInfo.label}</span>
        </div>
        {hasFilters && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <Filter size={12} />
            <span>{filterContext}</span>
          </div>
        )}
        <div className="text-[10px] text-gray-400">
          Genie receives this context with every question
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-400 text-center mt-4">
              Ask a question about your data
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-1">
                Suggested
              </div>
              {pageInfo.suggestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggestion(q)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-600 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-lg px-3 py-2 ${
                msg.role === "user"
                  ? "bg-apex-purple text-white text-sm"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {msg.role === "user" ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <MarkdownContent content={msg.content} compact />
              )}
              {msg.sql && (
                <button
                  onClick={() => setShowSql(showSql === i ? null : i)}
                  className={`flex items-center gap-1 mt-1 text-xs ${
                    msg.role === "user"
                      ? "text-white/70 hover:text-white"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Code size={12} /> {showSql === i ? "Hide SQL" : "Show SQL"}
                </button>
              )}
              {showSql === i && msg.sql && (
                <pre className="mt-1 p-2 bg-gray-800 text-green-300 rounded text-xs overflow-auto max-h-32">
                  {msg.sql}
                </pre>
              )}
              {msg.data && <DataTable data={msg.data} />}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-apex-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about what you're viewing..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-apex-purple/30 focus:border-apex-purple"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 bg-apex-purple text-white rounded-lg hover:bg-apex-purple-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </aside>
  );
}
