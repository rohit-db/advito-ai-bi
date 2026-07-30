import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Sparkles, ArrowUp } from "lucide-react";
import {
  useGenieMcpChat,
  type GenieMcpMessage,
} from "@/hooks/useGenieMcpChat";
import { useUser } from "@/hooks/useUser";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SUGGESTIONS_BY_MODE } from "@/components/genie/genieModes";
import { McpStatusPill } from "@/components/genie/GenieMcpStatus";
import GenieAssistantMessage from "@/components/genie/GenieAssistantMessage";
import ConversationRail from "@/components/genie/ConversationRail";
import GradientMark from "@/theme/GradientMark";

export default function GenieMcpExperience() {
  const {
    messages,
    isLoading,
    mcpStatus,
    checkHealth,
    sendMessage,
    clearChat,
    conversations,
    activeConversationId,
    loadConversation,
    removeConversation,
  } = useGenieMcpChat("multi", { persist: true }); // Genie One MCP (workspace-wide), no toggle
  const { user } = useUser();
  const [input, setInput] = useState("");
  const [openSql, setOpenSql] = useState<Record<string, boolean>>({});
  const [openTools, setOpenTools] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const seededRef = useRef(false);

  const empty = messages.length === 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Seed an initial question handed off from the Home page (/genie-mcp?q=…),
  // then strip it from the URL so a refresh doesn't re-ask.
  useEffect(() => {
    const q = searchParams.get("q");
    if (!q || seededRef.current || isLoading) return;
    seededRef.current = true;
    sendMessage(q);
    searchParams.delete("q");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, isLoading, sendMessage, setSearchParams]);

  const submit = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  const toggleSql = (id: string) => setOpenSql((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleTools = (id: string) => setOpenTools((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="flex-1 flex h-full min-w-0">
      <ConversationRail
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={loadConversation}
        onNew={clearChat}
        onDelete={removeConversation}
        disabled={isLoading}
      />

      <div className="relative flex-1 flex flex-col h-full min-w-0 bg-surface">
        {/* Header */}
        <header className="z-10 shrink-0 border-b border-border bg-surface-2 px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-3">
                <Sparkles className="h-[18px] w-[18px] text-fg-muted" />
              </div>
              <div>
                <h1 className="text-[15px] font-medium leading-tight tracking-tight text-fg">
                  Ask APEX
                </h1>
                <p className="text-[11px] text-fg-muted">Conversational analytics, governed</p>
              </div>
            </div>
            <McpStatusPill status={mcpStatus} onRetry={checkHealth} />
          </div>
        </header>

        {empty ? (
          /* ───── Landing: centered hero composer ───── */
          <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6">
            <div className="relative z-10 w-full max-w-2xl text-center">
              <GradientMark size={56} className="mx-auto mb-5" />
              <h2 className="text-3xl font-medium tracking-tight text-fg">
                Ask APEX anything
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-fg-muted">
                Grounded answers on your travel spend, sustainability, and bookings — with live SQL
                and results.
              </p>

              <div className="mt-7">
                <HeroComposer
                  value={input}
                  onChange={setInput}
                  onSubmit={submit}
                  disabled={isLoading}
                />
              </div>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS_BY_MODE.multi.map((q) => (
                  <button
                    key={q}
                    onClick={() => !isLoading && sendMessage(q)}
                    className="rounded-sm border border-border bg-surface px-3.5 py-1.5 text-[13px] text-fg-2 transition-colors hover:bg-[var(--fill-hover)] hover:text-fg"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ───── Conversation ───── */
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mx-auto max-w-3xl space-y-5">
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
            </div>

            {/* Footer composer */}
            <div className="shrink-0 bg-surface px-6 pb-5 pt-3">
              <div className="mx-auto flex max-w-3xl items-center gap-2.5">
                <button
                  type="button"
                  onClick={clearChat}
                  title="New conversation"
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 text-sm font-medium text-fg-2 transition-colors hover:bg-[var(--fill-hover)] hover:text-fg"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">New</span>
                </button>
                <FooterComposer
                  value={input}
                  onChange={setInput}
                  onSubmit={submit}
                  disabled={isLoading}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────── Composers ───────────────────────────────────── */

function HeroComposer({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="gradient-border group relative flex items-center rounded-md bg-[var(--fill-hover)] px-4 py-2.5 transition-all focus-within:border-border-emphasis focus-within:ring-2 focus-within:ring-[rgba(var(--overlay),0.06)]"
    >
      <Sparkles className="mr-2.5 h-4 w-4 shrink-0 text-fg-muted" />
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about spend, emissions, bookings…"
        disabled={disabled}
        className="flex-1 bg-transparent py-1.5 text-[15px] text-fg placeholder:text-fg-muted focus:outline-none disabled:cursor-not-allowed"
      />
      <SendButton disabled={disabled || !value.trim()} />
    </form>
  );
}

function FooterComposer({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-1 items-center rounded-md border border-border bg-[var(--fill-hover)] px-4 py-1.5 transition-all focus-within:border-border-emphasis focus-within:ring-2 focus-within:ring-[rgba(var(--overlay),0.06)]"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask a follow-up…"
        disabled={disabled}
        className="h-8 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-muted focus:outline-none disabled:cursor-not-allowed"
      />
      <SendButton disabled={disabled || !value.trim()} />
    </form>
  );
}

function SendButton({ disabled }: { disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-30"
    >
      <ArrowUp size={16} strokeWidth={2.5} />
    </button>
  );
}

function UserBubble({ message, initials }: { message: GenieMcpMessage; initials: string }) {
  return (
    <div className="flex items-start justify-end gap-2.5">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--fill-active)] px-4 py-2.5 text-fg">
        <p className="text-sm leading-relaxed">{message.content}</p>
      </div>
      <Avatar className="h-7 w-7 shrink-0 ring-2 ring-[var(--surface)]">
        <AvatarFallback className="bg-surface-3 text-[10px] font-semibold text-fg-muted">
          {initials}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
