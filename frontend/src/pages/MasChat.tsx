import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Trash2, Bot, User, Wrench, ArrowRight } from "lucide-react";
import MarkdownContent from "../components/MarkdownContent";
import { useMasChat, type MasMessage } from "../hooks/useMasChat";

function MessageBubble({ msg }: { msg: MasMessage }) {
  // Tool call event
  if (msg.toolCall) {
    let parsedArgs = msg.toolCall.arguments;
    try {
      const obj = JSON.parse(msg.toolCall.arguments);
      parsedArgs = JSON.stringify(obj, null, 2);
    } catch { /* keep raw */ }

    return (
      <div className="flex gap-3 pl-10">
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 w-full">
          <Wrench size={12} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="font-semibold">{msg.toolCall.name}</span>
            <pre className="mt-1 text-[11px] text-amber-600 overflow-auto max-h-24 whitespace-pre-wrap">
              {parsedArgs}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // Agent handoff event
  if (msg.agentHandoff) {
    return (
      <div className="flex gap-3 pl-10">
        <div className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-1.5">
          <ArrowRight size={12} />
          <span>Handing off to <span className="font-semibold">{msg.agentHandoff}</span></span>
        </div>
      </div>
    );
  }

  // User or assistant message
  const isUser = msg.role === "user";
  return (
    <div className="flex gap-3">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          isUser ? "bg-apex-purple text-white" : "bg-gray-100 text-gray-600"
        }`}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-500 mb-1">
          {isUser ? "You" : "APEX Supervisor"}
        </div>
        {isUser ? (
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {msg.content}
          </div>
        ) : (
          <MarkdownContent content={msg.content} />
        )}
      </div>
    </div>
  );
}

export default function MasChat() {
  const { messages, isLoading, streamingContent, sendMessage, clearChat } =
    useMasChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-3 border-b border-apex-border flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">
            Ask APEX — Multi-Agent Supervisor
          </h1>
          <p className="text-xs text-gray-400">
            Routes your question to the best agent — leakage, shopping, sustainability, or knowledge
          </p>
        </div>
        <button
          onClick={clearChat}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50"
        >
          <Trash2 size={12} /> Clear
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Bot size={40} className="mb-3 text-apex-purple/40" />
            <p className="text-sm font-medium">Ask APEX anything</p>
            <p className="text-xs mt-1">
              Your question will be routed to the best agent
            </p>
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-3">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {/* Streaming indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-gray-100 text-gray-600">
                <Bot size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-500 mb-1">
                  APEX Supervisor
                </div>
                {streamingContent ? (
                  <div>
                    <MarkdownContent content={streamingContent} />
                    <span className="inline-block w-1.5 h-4 bg-apex-purple/60 animate-pulse ml-0.5 align-middle" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 size={14} className="animate-spin" /> Thinking...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-apex-border px-6 py-3">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about leakage, shopping, sustainability, or anything else..."
            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-apex-purple/30 focus:border-apex-purple"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2.5 bg-apex-purple text-white rounded-lg hover:bg-apex-purple-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
