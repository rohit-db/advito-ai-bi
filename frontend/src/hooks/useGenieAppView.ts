import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CallToolRequest,
  CallToolResult,
  ReadResourceRequest,
  ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";
import {
  listConversations,
  createConversation,
  getConversation,
  saveConversationTurn,
  deleteConversation as apiDeleteConversation,
  type ConversationMeta,
} from "@/config";

// Ask Prism MCP View conversations share the Lakebase history table with the
// text Ask Prism chat, but are tagged with this distinct mode so each page only
// lists (and replays) its own threads.
const APP_VIEW_MODE = "app_view";

export type { ConversationMeta };

// ─── Ask Prism Live (Genie MCP App View) ───────────────────────────────────────
//
// Drives the interactive `view_ask` path of Genie One MCP. The browser is the
// MCP Apps *host*: it renders the sandboxed View (charts + progress) and routes
// the View's own `resources/read` / `tools/call` back through our stateless
// backend proxy (server/routes/genie_mcp/app_view.py), so Databricks credentials
// never reach the browser and per-tenant SP isolation is preserved.

export interface AppAskResult {
  ok: boolean;
  toolName: string;
  resourceUri?: string | null;
  toolResult: CallToolResult;
  conversationId?: string | null;
  deepLink?: string | null;
  message?: string;
}

export type AppViewHealth =
  | { state: "connecting" }
  | { state: "error"; message?: string }
  | {
      state: "connected";
      hasViewAsk: boolean;
      toolName?: string | null;
      resourceUri?: string | null;
    };

export interface AppViewMessage {
  id: string;
  role: "user" | "assistant";
  content?: string;
  ask?: AppAskResult;
  error?: string | null;
  isLoading: boolean;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data && (data.message as string)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

interface UseGenieAppViewOptions {
  // When true, conversations are persisted to (and replayable from) Lakebase.
  persist?: boolean;
}

export function useGenieAppView(options: UseGenieAppViewOptions = {}) {
  const { persist = false } = options;

  const [messages, setMessages] = useState<AppViewMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [health, setHealth] = useState<AppViewHealth>({ state: "connecting" });
  const conversationIdRef = useRef<string | null>(null); // Genie session id
  const dbConvRef = useRef<string | null>(null); // Lakebase conversation id

  // Conversation history (Lakebase) — only populated when persist is on.
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const refreshConversations = useCallback(async () => {
    if (!persist) return;
    const all = await listConversations();
    setConversations(all.filter((c) => c.mode === APP_VIEW_MODE));
  }, [persist]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  const checkHealth = useCallback(async () => {
    setHealth({ state: "connecting" });
    try {
      const res = await fetch("/api/genie-mcp/app/health");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setHealth({ state: "error", message: data.message });
        return;
      }
      setHealth({
        state: "connected",
        hasViewAsk: !!data.hasViewAsk,
        toolName: data.toolName,
        resourceUri: data.resourceUri,
      });
    } catch (err) {
      setHealth({ state: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || isLoading) return;

      const userId = `user-${Date.now()}`;
      const asstId = `asst-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", content: question, isLoading: false },
        { id: asstId, role: "assistant", isLoading: true },
      ]);
      setIsLoading(true);

      // Ensure a Lakebase conversation exists so this turn can be persisted.
      if (persist && !dbConvRef.current) {
        const newId = await createConversation(APP_VIEW_MODE);
        if (newId) {
          dbConvRef.current = newId;
          setActiveConversationId(newId);
        }
      }

      try {
        const ask = await postJson<AppAskResult>("/api/genie-mcp/app/ask", {
          question,
          conversation_id: conversationIdRef.current,
        });
        if (ask.conversationId) conversationIdRef.current = ask.conversationId;
        setMessages((prev) =>
          prev.map((m) => (m.id === asstId ? { ...m, ask, isLoading: false } : m))
        );
        // Persist the completed turn (the `ask` carries the View tool result +
        // ui:// resource so the interactive card can be replayed).
        if (persist && dbConvRef.current) {
          await saveConversationTurn(dbConvRef.current, question, { content: "", ask });
          await refreshConversations();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) => (m.id === asstId ? { ...m, error: message, isLoading: false } : m))
        );
        if (persist && dbConvRef.current) {
          await saveConversationTurn(dbConvRef.current, question, { content: "", error: message });
          await refreshConversations();
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, persist, refreshConversations]
  );

  const clearChat = useCallback(() => {
    conversationIdRef.current = null;
    dbConvRef.current = null;
    setActiveConversationId(null);
    setMessages([]);
    setIsLoading(false);
  }, []);

  // Load a past MCP View conversation from Lakebase (display + continue). The
  // stored `ask` re-hydrates the interactive View; note that if the underlying
  // Genie conversation has expired server-side, the View may not re-poll for
  // live updates — the last rendered result is what's replayed.
  const loadConversation = useCallback(async (id: string) => {
    const conv = await getConversation(id);
    if (!conv) return;
    conversationIdRef.current = null; // start a fresh Genie session for new turns
    dbConvRef.current = conv.id;
    setActiveConversationId(conv.id);
    const mapped: AppViewMessage[] = (conv.messages || []).map((m: any, i: number) => ({
      id: `${m.role}-${i}-${Date.now()}`,
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content ?? "",
      ask: m.ask ?? undefined,
      error: m.error ?? null,
      isLoading: false,
    }));
    setMessages(mapped);
    setIsLoading(false);
  }, []);

  const removeConversation = useCallback(
    async (id: string) => {
      await apiDeleteConversation(id);
      if (dbConvRef.current === id) clearChat();
      refreshConversations();
    },
    [clearChat, refreshConversations]
  );

  // Stable proxy handlers passed to @mcp-ui/client's AppRenderer. The View calls
  // these to fetch its own HTML and to poll Genie for progress + results.
  const readResource = useCallback(
    async (params: ReadResourceRequest["params"]): Promise<ReadResourceResult> => {
      return postJson<ReadResourceResult>("/api/genie-mcp/app/read-resource", {
        uri: params.uri,
      });
    },
    []
  );

  const callTool = useCallback(
    async (params: CallToolRequest["params"]): Promise<CallToolResult> => {
      return postJson<CallToolResult>("/api/genie-mcp/app/call-tool", {
        name: params.name,
        arguments: params.arguments ?? {},
      });
    },
    []
  );

  return {
    messages,
    isLoading,
    health,
    checkHealth,
    sendMessage,
    clearChat,
    readResource,
    callTool,
    // history (persist mode)
    conversations,
    activeConversationId,
    loadConversation,
    removeConversation,
    refreshConversations,
  };
}
