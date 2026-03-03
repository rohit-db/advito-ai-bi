import { useState, useRef, useEffect } from "react";
import { Send, Loader2, X, Code } from "lucide-react";
import { useChat, type ChatMessage } from "../hooks/useChat";

interface ChatSectionProps {
  onClose: () => void;
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

export default function ChatSection({ onClose }: ChatSectionProps) {
  const { messages, isLoading, sendMessage } = useChat();
  const [input, setInput] = useState("");
  const [showSql, setShowSql] = useState<number | null>(null);
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

  return (
    <aside className="w-[350px] border-l border-apex-border bg-white flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-apex-border flex items-center justify-between">
        <h2 className="text-sm font-semibold">Ask APEX</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-sm text-gray-400 text-center mt-8">
            Ask a question about your data
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-apex-purple text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.sql && (
                <button
                  onClick={() => setShowSql(showSql === i ? null : i)}
                  className="flex items-center gap-1 mt-1 text-xs text-gray-500 hover:text-gray-700"
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
            placeholder="Ask a question..."
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
