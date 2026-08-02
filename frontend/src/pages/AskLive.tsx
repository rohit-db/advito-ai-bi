import { useEffect, useMemo, useRef, useState } from "react";
import { AppRenderer } from "@mcp-ui/client";
import { BarChart3, Plus, Sparkles, ArrowUp, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUser } from "@/hooks/useUser";
import { useGenieAppView, type AppViewMessage } from "@/hooks/useGenieAppView";
import ConversationRail from "@/components/genie/ConversationRail";
import GradientMark from "@/theme/GradientMark";

const SUGGESTIONS = [
  "Show total travel spend in 2025 as a chart",
  "Air vs. hotel vs. rail spend by month",
  "Top 10 vendors by spend",
  "Monthly booking volume trend",
];

// The interactive counterpart to the text-only "Ask Prism" page: this renders
// Genie One MCP's `view_ask` **App View** (charts + progress inline) inside a
// sandboxed iframe via @mcp-ui/client. See docs/handoff/ask-apex-genie-mcp.md.
export default function AskLive() {
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
      />

      <div className="relative flex h-full min-w-0 flex-1 flex-col bg-background">
      {/* Header */}
      <header className="z-10 shrink-0 border-b border-border bg-secondary px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
              <BarChart3 className="h-[18px] w-[18px] text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-[15px] font-medium leading-tight tracking-tight text-foreground">
                Ask Prism MCP View
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Interactive Genie answers with charts, rendered inline
              </p>
            </div>
          </div>
          <HealthPill health={health} onRetry={checkHealth} />
        </div>
      </header>

      {viewUnavailable && (
        <div className="shrink-0 border-b border-[color:var(--border-warning)] bg-[var(--background-warning)] px-6 py-2.5 text-[13px] text-[var(--warning)]">
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
          <div className="relative z-10 w-full max-w-2xl text-center">
            <GradientMark size={56} className="mx-auto mb-5" />
            <h2 className="text-3xl font-medium tracking-tight text-foreground">Ask Prism, see the chart</h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Genie writes the SQL and renders the answer as a live, interactive visualization —
              right here in the conversation.
            </p>
            <div className="mt-7">
              <HeroComposer value={input} onChange={setInput} onSubmit={submit} disabled={isLoading} />
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => !isLoading && sendMessage(q)}
                  className="rounded border border-border bg-background px-3.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-[var(--action-default-bg-hover)] hover:text-foreground"
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
          <div className="shrink-0 bg-background px-6 pb-5 pt-3">
            <div className="mx-auto flex max-w-3xl items-center gap-2.5">
              <button
                type="button"
                onClick={clearChat}
                title="New conversation"
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-[var(--action-default-bg-hover)] hover:text-foreground"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">New</span>
              </button>
              <FooterComposer value={input} onChange={setInput} onSubmit={submit} disabled={isLoading} />
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
        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
          <Sparkles size={15} />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-foreground">
        {message.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Asking Genie…
          </div>
        )}

        {message.error && (
          <div className="rounded-md border border-[color:var(--border-danger)] bg-[var(--background-danger)] px-3 py-2 text-sm text-[var(--destructive)]">
            {message.error}
          </div>
        )}

        {canRender && (
          <div className="overflow-hidden rounded-md">
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
          <div className="text-sm text-muted-foreground">
            Genie answered, but no interactive View was returned.
            {ask.deepLink && (
              <a
                href={ask.deepLink}
                target="_blank"
                rel="noreferrer"
                className="ml-1 inline-flex items-center gap-1 font-medium text-primary hover:text-blue-700"
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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
        <Loader2 size={11} className="animate-spin" /> Connecting…
      </span>
    );
  }
  if (health.state === "error") {
    return (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--background-danger)] px-2.5 py-1 text-[11px] font-medium text-[var(--destructive)]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--destructive)]" /> MCP offline — retry
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--background-success)] px-2.5 py-1 text-[11px] font-medium text-[var(--success)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
      {health.hasViewAsk ? "Genie One MCP · View ready" : "Genie One MCP"}
    </span>
  );
}

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
      className="gradient-border group relative flex items-center rounded-md bg-background px-4 py-2.5 transition-all focus-within:ring-2 focus-within:ring-ring"
    >
      <Sparkles className="mr-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about spend, emissions, bookings…"
        disabled={disabled}
        className="flex-1 bg-transparent py-1.5 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed"
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
      className="flex flex-1 items-center rounded-md border border-input bg-background px-4 py-1.5 transition-all focus-within:ring-2 focus-within:ring-ring"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about spend, emissions, bookings…"
        disabled={disabled}
        className="h-8 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed"
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
      className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-30"
    >
      <ArrowUp size={16} strokeWidth={2.5} />
    </button>
  );
}

function UserBubble({ message, initials }: { message: AppViewMessage; initials: string }) {
  return (
    <div className="flex items-start justify-end gap-2.5">
      <div className="max-w-[80%] rounded-md rounded-br-md bg-primary/10 px-4 py-2.5 text-foreground">
        <p className="text-sm leading-relaxed">{message.content}</p>
      </div>
      <Avatar className="h-7 w-7 shrink-0 ring-2 ring-[var(--background)]">
        <AvatarFallback className="bg-muted text-[10px] font-semibold text-muted-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
