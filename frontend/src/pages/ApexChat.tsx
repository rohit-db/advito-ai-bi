import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Trash2, Wrench, ArrowRightLeft, Sparkles } from "lucide-react";
import MarkdownContent from "@/components/MarkdownContent";
import { useMasChat, type MasMessage } from "@/hooks/useMasChat";
import { useUser } from "@/hooks/useUser";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "What are the top routes by emissions?",
  "Show total spend by category for 2025",
  "Compare hotel costs across regions",
  "Which travelers have the highest carbon footprint?",
];

function ApexAvatar({ size = "sm" }: { size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "w-14 h-14" : "w-8 h-8";
  const iconSize = size === "lg" ? 28 : 16;
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600",
        dim
      )}
    >
      <Sparkles size={iconSize} className="text-white" />
    </div>
  );
}

function UserAvatar({ initials }: { initials: string }) {
  return (
    <Avatar className="w-8 h-8 shrink-0">
      <AvatarFallback className="bg-slate-200 text-slate-700 text-xs font-semibold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

function MessageBubble({
  msg,
  userInitials,
}: {
  msg: MasMessage;
  userInitials: string;
}) {
  // Tool call event
  if (msg.toolCall) {
    return (
      <div className="flex justify-center my-1">
        <Badge
          className="flex items-center gap-1.5 px-3 py-1 text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full font-medium"
          variant="outline"
        >
          <Wrench size={11} />
          {msg.toolCall.name}
        </Badge>
      </div>
    );
  }

  // Agent handoff event
  if (msg.agentHandoff) {
    return (
      <div className="flex justify-center my-1">
        <Badge
          className="flex items-center gap-1.5 px-3 py-1 text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full font-medium"
          variant="outline"
        >
          <ArrowRightLeft size={11} />
          {msg.agentHandoff}
        </Badge>
      </div>
    );
  }

  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-3 max-w-2xl ml-auto">
        <div className="bg-white border border-gray-200 rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm max-w-[80%]">
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {msg.content}
          </p>
        </div>
        <UserAvatar initials={userInitials} />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 max-w-2xl">
      <ApexAvatar size="sm" />
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm flex-1 min-w-0">
        <MarkdownContent content={msg.content} />
      </div>
    </div>
  );
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-3 max-w-2xl">
      <ApexAvatar size="sm" />
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm flex-1 min-w-0">
        {content ? (
          <div>
            <MarkdownContent content={content} />
            <span className="inline-block w-1.5 h-4 bg-indigo-500 animate-pulse ml-0.5 align-middle rounded-sm" />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApexChat() {
  const { messages, isLoading, streamingContent, sendMessage, clearChat } =
    useMasChat();
  const { user } = useUser();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const userInitials = user?.initials ?? "U";

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleSuggestion = (q: string) => {
    if (isLoading) return;
    sendMessage(q);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ApexAvatar size="sm" />
            <div>
              <h1 className="text-base font-semibold text-gray-900">
                APEX Intelligence
              </h1>
              <p className="text-xs text-gray-400">
                Multi-agent supervisor · Genie-powered
              </p>
            </div>
          </div>
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ApexAvatar size="lg" />
              <h2 className="mt-5 text-xl font-semibold text-gray-900">
                Ask APEX anything
              </h2>
              <p className="mt-2 text-sm text-gray-500 max-w-sm">
                Your multi-agent AI assistant, powered by Databricks Genie.
                Ask about travel spend, sustainability, routes, and more.
              </p>
              <div className="mt-8 flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestion(q)}
                    className="px-4 py-2 text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-full transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} userInitials={userInitials} />
          ))}

          {/* Streaming bubble */}
          {isLoading && <StreamingBubble content={streamingContent} />}
        </div>
      </div>

      {/* Input bar */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about leakage, sustainability, spend, or anything else..."
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none py-0.5"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-8 h-8 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full transition-colors shrink-0"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
