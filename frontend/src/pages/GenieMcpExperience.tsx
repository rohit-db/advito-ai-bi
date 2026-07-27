import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, Plus, Sparkles, MessageSquare, Trash2, History, ArrowUp } from "lucide-react";
import {
  useGenieMcpChat,
  type GenieMcpMessage,
  type ConversationMeta,
} from "@/hooks/useGenieMcpChat";
import { useUser } from "@/hooks/useUser";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SUGGESTIONS_BY_MODE } from "@/components/genie/genieModes";
import { McpStatusPill } from "@/components/genie/GenieMcpStatus";
import GenieAssistantMessage from "@/components/genie/GenieAssistantMessage";

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

      <div className="relative flex-1 flex flex-col h-full min-w-0 bg-slate-50">
        {/* Header */}
        <header className="z-10 shrink-0 border-b border-slate-200/70 bg-white/70 px-6 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-brand-primary to-brand-accent shadow-sm shadow-brand-primary-light/50">
                <Sparkles className="h-[18px] w-[18px] text-white" />
              </div>
              <div>
                <h1 className="text-[15px] font-semibold leading-tight tracking-tight text-slate-900">
                  Ask APEX
                </h1>
                <p className="text-[11px] text-slate-500">Conversational analytics, governed</p>
              </div>
            </div>
            <McpStatusPill status={mcpStatus} onRetry={checkHealth} />
          </div>
        </header>

        {empty ? (
          /* ───── Landing: centered hero composer ───── */
          <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6">
            {/* decorative depth */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-[22%] h-72 w-72 -translate-x-1/2 rounded-full bg-brand-accent/15 blur-3xl" />
              <div className="absolute left-[30%] top-[55%] h-56 w-56 rounded-full bg-brand-accent/10 blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-2xl text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-brand-primary to-brand-accent shadow-lg shadow-brand-primary-light/40 ring-1 ring-white/40">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Ask APEX anything
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-slate-500">
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
                    className="rounded-full border border-slate-200 bg-white/70 px-3.5 py-1.5 text-[13px] text-slate-600 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-brand-primary-light hover:text-brand-primary hover:shadow"
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
            <div className="shrink-0 bg-linear-to-t from-slate-50 via-slate-50 to-transparent px-6 pb-5 pt-3">
              <div className="mx-auto flex max-w-3xl items-center gap-2.5">
                <button
                  type="button"
                  onClick={clearChat}
                  title="New conversation"
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-brand-primary-light hover:bg-brand-primary-light hover:text-brand-primary"
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
      className="group relative flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-xl shadow-slate-300/30 transition-all focus-within:border-brand-accent focus-within:shadow-brand-primary-light/40 focus-within:ring-4 focus-within:ring-brand-primary-light"
    >
      <Sparkles className="mr-2.5 h-4 w-4 shrink-0 text-brand-accent" />
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about spend, emissions, bookings…"
        disabled={disabled}
        className="flex-1 bg-transparent py-1.5 text-[15px] text-slate-800 placeholder-slate-400 focus:outline-none disabled:cursor-not-allowed"
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
      className="flex flex-1 items-center rounded-2xl border border-slate-200 bg-white px-4 py-1.5 shadow-sm transition-all focus-within:border-brand-accent focus-within:ring-2 focus-within:ring-brand-primary-light"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask a follow-up…"
        disabled={disabled}
        className="h-8 flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none disabled:cursor-not-allowed"
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
      className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-primary to-brand-accent text-white shadow-sm transition-all hover:shadow-md hover:brightness-105 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
    >
      <ArrowUp size={16} strokeWidth={2.5} />
    </button>
  );
}

/* ─────────────────────────── Conversation history ──────────────────────────── */

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ConversationRail({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  disabled,
}: {
  conversations: ConversationMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex shrink-0 items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2 text-slate-700">
          <History size={15} className="text-brand-primary" />
          <span className="text-sm font-semibold">History</span>
        </div>
        <button
          type="button"
          onClick={onNew}
          disabled={disabled}
          title="New conversation"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-brand-primary to-brand-accent text-white shadow-sm transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={15} />
        </button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs leading-relaxed text-slate-400">
            Your conversations appear here.
            <br />
            Ask a question to start one.
          </p>
        ) : (
          conversations.map((c) => {
            const active = c.id === activeId;
            return (
              <div
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`group relative flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 transition-colors ${
                  active ? "bg-brand-primary-light text-brand-primary-dark" : "hover:bg-slate-50"
                }`}
              >
                {active && (
                  <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-accent" />
                )}
                <MessageSquare
                  size={14}
                  className={`mt-0.5 shrink-0 ${active ? "text-brand-primary" : "text-slate-400"}`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[13px] font-medium ${
                      active ? "text-brand-primary-dark" : "text-slate-700"
                    }`}
                  >
                    {c.title}
                  </p>
                  <p className="text-[11px] text-slate-400">{formatRelative(c.updated_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(c.id);
                  }}
                  title="Delete conversation"
                  className="shrink-0 p-1 text-slate-300 opacity-0 transition-all hover:text-rose-500 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="shrink-0 border-t border-slate-100 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          History stored in <span className="font-semibold text-brand-primary">Lakebase</span>
        </p>
      </div>
    </aside>
  );
}

function UserBubble({ message, initials }: { message: GenieMcpMessage; initials: string }) {
  return (
    <div className="flex items-start justify-end gap-2.5">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-linear-to-br from-brand-primary to-brand-accent px-4 py-2.5 text-white shadow-sm shadow-brand-primary-light/50">
        <p className="text-sm leading-relaxed">{message.content}</p>
      </div>
      <Avatar className="h-7 w-7 shrink-0 ring-2 ring-white">
        <AvatarFallback className="bg-brand-primary-light text-[10px] font-semibold text-brand-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
