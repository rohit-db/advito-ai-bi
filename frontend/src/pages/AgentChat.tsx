import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Trash2, Wrench, Sparkles, Zap } from "lucide-react";
import MarkdownContent from "@/components/MarkdownContent";
import { useAgentChat, type AgentMessage } from "@/hooks/useAgentChat";
import { useUser } from "@/hooks/useUser";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Give me an executive summary for 2025",
  "Total emissions by category, 2025 vs 2024",
  "Top 5 destinations by spend and emissions",
  "How is our Air travel carbon intensity trending?",
];

export default function AgentChat() {
  const { messages, isLoading, streamingContent, sendMessage, clearChat } = useAgentChat();
  const { user } = useUser();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  const renderMessage = (msg: AgentMessage, idx: number) => {
    // Tool call
    if (msg.toolCall) {
      return (
        <div key={idx} className="flex justify-center">
          <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700 gap-1.5 py-1 px-3 text-xs font-normal max-w-[80%]">
            <Wrench size={12} className="shrink-0" />
            <span className="truncate">{msg.toolCall.arguments}</span>
          </Badge>
        </div>
      );
    }

    // Status message
    if (msg.role === "system") {
      return (
        <div key={idx} className="flex justify-center">
          <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-600 gap-1.5 py-1 px-3 text-xs font-normal">
            <Zap size={12} />
            {msg.content}
          </Badge>
        </div>
      );
    }

    // User
    if (msg.role === "user") {
      return (
        <div key={idx} className="flex justify-end gap-2">
          <div className="bg-white border border-gray-200 rounded-2xl rounded-br-md px-4 py-2.5 max-w-[70%] shadow-sm">
            <p className="text-sm text-gray-900">{msg.content}</p>
          </div>
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-indigo-100 text-indigo-600 text-[10px] font-semibold">
              {user?.initials || "U"}
            </AvatarFallback>
          </Avatar>
        </div>
      );
    }

    // Assistant
    return (
      <div key={idx} className="flex gap-2">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-[10px]">
            &#10022;
          </AvatarFallback>
        </Avatar>
        <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[70%] shadow-sm">
          <MarkdownContent content={msg.content} />
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50/50">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm">
            &#10022;
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">APEX Agent</h2>
            <p className="text-[11px] text-gray-500">Claude + Parallel Genie &middot; Custom Agent</p>
          </div>
          <button
            onClick={clearChat}
            className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-6 px-6 space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl">
                &#10022;
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">APEX Agent</h3>
              <p className="text-sm text-gray-500 mb-6">
                Powered by Claude + parallel Genie queries for fast, data-rich answers.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => { if (!isLoading) sendMessage(q); }}
                    className="px-4 py-2 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-full transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(renderMessage)}

          {streamingContent && (
            <div className="flex gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-[10px]">
                  &#10022;
                </AvatarFallback>
              </Avatar>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[70%] shadow-sm">
                <MarkdownContent content={streamingContent} />
                <span className="inline-block w-1.5 h-4 bg-emerald-500 animate-pulse ml-0.5 align-middle rounded-sm" />
              </div>
            </div>
          )}

          {isLoading && !streamingContent && (
            <div className="flex items-center gap-2 text-sm text-gray-400 justify-center py-2">
              <Loader2 size={14} className="animate-spin" /> Thinking...
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 bg-white border-t border-gray-200 px-6 py-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500/40 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask APEX Agent..."
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-8 w-8 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
