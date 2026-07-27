import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Trash2, X } from "lucide-react";
import ExecutiveSummaryModal from "@/components/ExecutiveSummaryModal";
import { Badge } from "@/components/ui/badge";
import { useGenieMcpChat, type GenieMcpMessage } from "@/hooks/useGenieMcpChat";
import { McpStatusDot } from "@/components/genie/GenieMcpStatus";
import GenieAssistantMessage from "@/components/genie/GenieAssistantMessage";

export interface DashboardWorkspaceProps {
  pageKey: string;
  pageLabel: string;
  pageContext: string;
  summaryPrompt: string;
  suggestions: string[];
  railOpen: boolean;
  onRailOpenChange: (open: boolean) => void;
  summaryOpen: boolean;
  onSummaryOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export default function DashboardWorkspace({
  pageKey,
  pageLabel,
  pageContext,
  summaryPrompt,
  suggestions,
  railOpen,
  onRailOpenChange,
  summaryOpen,
  onSummaryOpenChange,
  children,
}: DashboardWorkspaceProps) {
  const { messages, isLoading, mcpStatus, sendMessage, clearChat } = useGenieMcpChat();
  const [input, setInput] = useState("");
  const [openSql, setOpenSql] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset the conversation whenever the page changes.
  useEffect(() => {
    clearChat();
    setInput("");
    setOpenSql({});
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
        {/* Dashboard content */}
        <div className="flex-1 min-h-0">{children}</div>
      </div>

      {/* Right rail */}
      {railOpen && (
        <aside className="w-[400px] shrink-0 border-l border-slate-200 bg-white flex flex-col h-full">
          {/* Gradient header */}
          <div className="bg-linear-to-r from-brand-primary to-brand-accent px-4 pt-4 pb-3 shrink-0">
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
                  <p className="text-[11px] text-brand-primary-light">AI-powered travel intelligence</p>
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
                  onClick={() => onRailOpenChange(false)}
                  className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                  title="Close panel"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Context badge */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge className="bg-brand-accent/40 text-brand-primary-light border-brand-accent/30 text-[11px] px-2 py-0.5">
                {pageLabel}
              </Badge>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
            {messages.length === 0 && !isLoading ? (
              <div className="space-y-4 pt-2">
                <p className="text-xs text-slate-400 text-center">Ask about what you're viewing</p>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold px-1">
                    Suggested
                  </p>
                  {suggestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSuggestion(q)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-600 bg-white hover:bg-brand-primary-light hover:text-brand-primary rounded-lg border border-slate-200 transition-colors"
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
                  <GenieAssistantMessage
                    key={m.id}
                    message={m}
                    variant="compact"
                    sqlOpen={!!openSql[m.id]}
                    onToggleSql={() => toggleSql(m.id)}
                  />
                )
              )
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-slate-200 bg-white px-3 py-3 shrink-0">
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 focus-within:border-brand-accent focus-within:ring-2 focus-within:ring-brand-primary-light transition-all"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your data..."
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none py-0.5"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="w-7 h-7 flex items-center justify-center bg-brand-primary hover:bg-brand-primary disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full transition-colors shrink-0"
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
          onClose={() => onSummaryOpenChange(false)}
        />
      )}
    </div>
  );
}

function UserBubble({ message }: { message: GenieMcpMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] bg-brand-primary text-white rounded-2xl rounded-br-sm px-3 py-2.5 text-sm shadow-sm">
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}
