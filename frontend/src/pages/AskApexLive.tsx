import { useEffect, useMemo, useRef, useState } from "react";
import { AppRenderer } from "@mcp-ui/client";
import { BarChart3, Plus, Sparkles, ArrowUp, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUser } from "@/hooks/useUser";
import { useGenieAppView, type AppViewMessage } from "@/hooks/useGenieAppView";
import ConversationRail from "@/components/genie/ConversationRail";

const SUGGESTIONS = [
  "Show total travel spend in 2025 as a chart",
  "Air vs. hotel vs. rail spend by month",
  "Top 10 vendors by spend",
  "Monthly booking volume trend",
];

// The interactive counterpart to the text-only "Ask APEX" page: this renders
// Genie One MCP's `view_ask` **App View** (charts + progress inline) inside a
// sandboxed iframe via @mcp-ui/client. See docs/handoff/ask-apex-genie-mcp.md.
export default function AskApexLive() {
  const {
    messages,
    isLoading,
    health,
    checkHealth,
    sendMessage,
    clearChat,
    readResource,
    callTool,
    conversations,
    activeConversationId,
    loadConversation,
    removeConversation,
  } = useGenieAppView({ persist: true });
  const { user } = useUser();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // The sandbox proxy that hosts the View iframe (served from /public).
  const sandboxUrl = useMemo(() => new URL("/mcp-sandbox-proxy.html", window.location.origin), []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const empty = messages.length === 0;

  const submit = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  const viewUnavailable = health.state === "connected" && !health.hasViewAsk;

  return (
    <div className="flex h-full min-w-0 flex-1">
      <ConversationRail
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={loadConversation}
        onNew={clearChat}
        onDelete={removeConversation}
        disabled={isLoading}
        accent="fuchsia"
      />

      <div className="relative flex h-full min-w-0 flex-1 flex-col bg-slate-50">
      {/* Header */}
      <header className="z-10 shrink-0 border-b border-slate-200/70 bg-white/70 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600 to-indigo-500 shadow-sm shadow-indigo-300/50">
              <BarChart3 className="h-[18px] w-[18px] text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold leading-tight tracking-tight text-slate-900">
                Ask APEX MCP View
              </h1>
              <p className="text-[11px] text-slate-500">
                Interactive Genie answers with charts, rendered inline
              </p>
            </div>
          </div>
          <HealthPill health={health} onRetry={checkHealth} />
        </div>
      </header>

      {viewUnavailable && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-[13px] text-amber-800">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              The Genie MCP App View isn&apos;t available on this workspace. Enable the{" "}
              <strong>Managed MCP Servers</strong> preview and Chat in Genie One, then retry.
            </span>
          </div>
        </div>
      )}

      {empty ? (
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[22%] h-72 w-72 -translate-x-1/2 rounded-full bg-fuchsia-400/15 blur-3xl" />
            <div className="absolute left-[30%] top-[55%] h-56 w-56 rounded-full bg-indigo-400/10 blur-3xl" />
          </div>
          <div className="relative z-10 w-full max-w-2xl text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-indigo-500 shadow-lg shadow-indigo-300/40 ring-1 ring-white/40">
              <BarChart3 className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Ask APEX, see the chart</h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-slate-500">
              Genie writes the SQL and renders the answer as a live, interactive visualization —
              right here in the conversation.
            </p>
            <div className="mt-7">
              <Composer value={input} onChange={setInput} onSubmit={submit} disabled={isLoading} autoFocus />
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => !isLoading && sendMessage(q)}
                  className="rounded-full border border-slate-200 bg-white/70 px-3.5 py-1.5 text-[13px] text-slate-600 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-fuchsia-300 hover:text-fuchsia-700 hover:shadow"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.map((m) =>
                m.role === "user" ? (
                  <UserBubble key={m.id} message={m} initials={user?.initials || "U"} />
                ) : (
                  <AssistantView
                    key={m.id}
                    message={m}
                    sandboxUrl={sandboxUrl}
                    onReadResource={readResource}
                    onCallTool={callTool}
                  />
                )
              )}
            </div>
          </div>
          <div className="shrink-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent px-6 pb-5 pt-3">
            <div className="mx-auto flex max-w-3xl items-center gap-2.5">
              <button
                type="button"
                onClick={clearChat}
                title="New conversation"
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-700"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">New</span>
              </button>
              <Composer value={input} onChange={setInput} onSubmit={submit} disabled={isLoading} />
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

/* ─────────────────────────────── Assistant View ─────────────────────────────── */

function AssistantView({
  message,
  sandboxUrl,
  onReadResource,
  onCallTool,
}: {
  message: AppViewMessage;
  sandboxUrl: URL;
  onReadResource: ReturnType<typeof useGenieAppView>["readResource"];
  onCallTool: ReturnType<typeof useGenieAppView>["callTool"];
}) {
  const ask = message.ask;
  const canRender = ask?.ok && ask.toolName && ask.resourceUri;

  return (
    <div className="flex items-start gap-2">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-white text-xs">
          <Sparkles size={15} />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3 py-3 shadow-sm">
        {message.isLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 size={14} className="animate-spin" /> Asking Genie…
          </div>
        )}

        {message.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {message.error}
          </div>
        )}

        {canRender && (
          <div className="overflow-hidden rounded-lg">
            <AppRenderer
              toolName={ask!.toolName}
              toolResourceUri={ask!.resourceUri ?? undefined}
              sandbox={{ url: sandboxUrl }}
              toolResult={ask!.toolResult}
              // In client-less mode AppRenderer can't derive capabilities from a
              // client, so declare explicitly that this host proxies tool calls
              // and resource reads — the genie-mcp-app View polls conversation
              // state via server tools and refuses to run without this.
              hostCapabilities={{
                serverTools: { listChanged: false },
                serverResources: { listChanged: false },
                openLinks: {},
              }}
              onReadResource={onReadResource}
              onCallTool={onCallTool}
              onOpenLink={async ({ url }) => {
                if (url.startsWith("https://") || url.startsWith("http://")) window.open(url, "_blank");
                return {};
              }}
              onError={(e) => console.error("Genie View error:", e)}
            />
          </div>
        )}

        {ask && !canRender && !message.error && (
          <div className="text-sm text-slate-600">
            Genie answered, but no interactive View was returned.
            {ask.deepLink && (
              <a
                href={ask.deepLink}
                target="_blank"
                rel="noreferrer"
                className="ml-1 inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800"
              >
                Open in Genie <ExternalLink size={13} />
              </a>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

/* ─────────────────────────────── Bits ─────────────────────────────── */

function HealthPill({
  health,
  onRetry,
}: {
  health: ReturnType<typeof useGenieAppView>["health"];
  onRetry: () => void;
}) {
  if (health.state === "connecting") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
        <Loader2 size={11} className="animate-spin" /> Connecting…
      </span>
    );
  }
  if (health.state === "error") {
    return (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> MCP offline — retry
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {health.hasViewAsk ? "Genie One MCP · View ready" : "Genie One MCP"}
    </span>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="group relative flex flex-1 items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm transition-all focus-within:border-fuchsia-400 focus-within:ring-2 focus-within:ring-fuchsia-100"
    >
      <Sparkles className="mr-2.5 h-4 w-4 shrink-0 text-fuchsia-400" />
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about spend, emissions, bookings…"
        disabled={disabled}
        className="flex-1 bg-transparent py-1 text-[15px] text-slate-800 placeholder-slate-400 focus:outline-none disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600 to-indigo-500 text-white shadow-sm transition-all hover:shadow-md hover:brightness-105 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
      >
        <ArrowUp size={16} strokeWidth={2.5} />
      </button>
    </form>
  );
}

function UserBubble({ message, initials }: { message: AppViewMessage; initials: string }) {
  return (
    <div className="flex items-start justify-end gap-2.5">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-fuchsia-600 to-indigo-500 px-4 py-2.5 text-white shadow-sm shadow-indigo-200/50">
        <p className="text-sm leading-relaxed">{message.content}</p>
      </div>
      <Avatar className="h-7 w-7 shrink-0 ring-2 ring-white">
        <AvatarFallback className="bg-fuchsia-100 text-[10px] font-semibold text-fuchsia-700">
          {initials}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
