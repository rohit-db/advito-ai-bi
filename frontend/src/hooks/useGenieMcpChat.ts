import { useState, useCallback, useRef, useEffect } from "react";
import {
  listConversations,
  createConversation,
  getConversation,
  saveConversationTurn,
  deleteConversation as apiDeleteConversation,
  type ConversationMeta,
} from "@/config";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenieTableColumn {
  name: string;
  type?: string;
}

export interface GenieTable {
  columns: (GenieTableColumn | string)[];
  rows: (string | number | null)[][];
}

export interface GenieSqlBlock {
  sql: string;
  description?: string;
}

export interface GenieToolCallResult {
  status?: string | null;
  messageId?: string | null;
  hasText?: boolean;
  sql?: number;
  tables?: number;
}

export interface GenieToolCall {
  tool: string;
  phase: "ask" | "poll";
  args?: Record<string, unknown>;
  result?: GenieToolCallResult;
  attempt?: number;
}

export interface GenieMcpMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps: string[];
  sql: GenieSqlBlock[];
  toolCalls: GenieToolCall[];
  table?: GenieTable | null;
  deepLink?: { url: string; label: string } | null;
  status?: string | null;
  error?: string | null;
  isStreaming: boolean;
}

export type McpTool = { name: string; description?: string | null };

// "space" -> per-space Genie Space MCP; "multi" -> workspace-wide Genie MCP.
export type GenieMode = "space" | "multi";

export type McpStatus =
  | { state: "connecting" }
  | { state: "error"; message?: string; serverUrl?: string | null }
  | {
      state: "connected";
      serverUrl?: string | null;
      auth?: "obo" | "service_principal" | string;
      tools: McpTool[];
      askTool?: string | null;
      pollTool?: string | null;
    };

export type { ConversationMeta };

interface UseGenieMcpChatOptions {
  // When true, conversations are persisted to (and replayable from) Lakebase.
  persist?: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGenieMcpChat(
  initialMode: GenieMode = "space",
  options: UseGenieMcpChatOptions = {}
) {
  const { persist = false } = options;

  const [messages, setMessages] = useState<GenieMcpMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mcpStatus, setMcpStatus] = useState<McpStatus>({ state: "connecting" });
  const [mode, setModeState] = useState<GenieMode>(initialMode);

  // Conversation history (Lakebase) — only populated when persist is on.
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const conversationIdRef = useRef<string | null>(null); // Genie session id
  const dbConvRef = useRef<string | null>(null); // Lakebase conversation id
  const abortRef = useRef<AbortController | null>(null);

  const refreshConversations = useCallback(async () => {
    if (!persist) return;
    setConversations(await listConversations());
  }, [persist]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // Probe the managed Genie MCP server for the selected mode — proves a real MCP
  // session and surfaces the discovered tool contract.
  const checkHealth = useCallback(async () => {
    setMcpStatus({ state: "connecting" });
    try {
      const res = await fetch(`/api/genie-mcp/health?mode=${mode}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMcpStatus({ state: "error", message: data.message, serverUrl: data.server_url });
        return;
      }
      setMcpStatus({
        state: "connected",
        serverUrl: data.server_url,
        auth: data.auth,
        tools: data.tools || [],
        askTool: data.ask_tool,
        pollTool: data.poll_tool,
      });
    } catch (err) {
      setMcpStatus({ state: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [mode]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const sendMessage = useCallback(
    async (text: string, context?: string) => {
      if (!text.trim() || isLoading) return;

      const userId = `user-${Date.now()}`;
      const assistantId = `ai-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", content: text, steps: [], sql: [], toolCalls: [], isStreaming: false },
        { id: assistantId, role: "assistant", content: "", steps: [], sql: [], toolCalls: [], isStreaming: true },
      ]);
      setIsLoading(true);

      // Ensure a Lakebase conversation exists so this turn can be persisted.
      if (persist && !dbConvRef.current) {
        const newId = await createConversation(mode);
        if (newId) {
          dbConvRef.current = newId;
          setActiveConversationId(newId);
        }
      }

      // `draft` mirrors the streaming assistant message so we can persist the
      // final assembled object after the stream completes.
      let draft: GenieMcpMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        steps: [],
        sql: [],
        toolCalls: [],
        isStreaming: true,
      };
      const patch = (updater: (m: GenieMcpMessage) => GenieMcpMessage) => {
        draft = updater(draft);
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? draft : m)));
      };

      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/genie-mcp/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversation_id: conversationIdRef.current || undefined,
            context: context || "",
            mode,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "");
          throw new Error(errText || `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;

            let event: any;
            try {
              event = JSON.parse(payload);
            } catch {
              continue;
            }

            switch (event.type) {
              case "meta":
                if (event.conversationId) conversationIdRef.current = event.conversationId;
                break;
              case "status":
                patch((m) =>
                  m.steps[m.steps.length - 1] === event.content
                    ? m
                    : { ...m, steps: [...m.steps, event.content] }
                );
                break;
              case "sql":
                patch((m) => ({
                  ...m,
                  sql: [...m.sql, { sql: event.sql, description: event.description }],
                }));
                break;
              case "tool_call":
                patch((m) => ({
                  ...m,
                  toolCalls: [
                    ...m.toolCalls,
                    {
                      tool: event.tool,
                      phase: event.phase,
                      args: event.args,
                      result: event.result,
                      attempt: event.attempt,
                    },
                  ],
                }));
                break;
              case "table":
                patch((m) => ({ ...m, table: { columns: event.columns, rows: event.rows } }));
                break;
              case "text":
                patch((m) => ({ ...m, content: event.content }));
                break;
              case "deep_link":
                patch((m) => ({ ...m, deepLink: { url: event.url, label: event.label } }));
                break;
              case "error":
                patch((m) => ({ ...m, error: event.content, status: "failed" }));
                break;
            }
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          patch((m) => ({ ...m, error: err instanceof Error ? err.message : String(err), status: "failed" }));
        }
      } finally {
        patch((m) => ({ ...m, isStreaming: false }));
        setIsLoading(false);

        // Persist the completed turn to Lakebase and refresh the thread list.
        if (persist && dbConvRef.current) {
          saveConversationTurn(dbConvRef.current, text, draft).then(() => refreshConversations());
        }
      }
    },
    [isLoading, mode, persist, refreshConversations]
  );

  const clearChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    conversationIdRef.current = null;
    dbConvRef.current = null;
    setActiveConversationId(null);
    setMessages([]);
    setIsLoading(false);
  }, []);

  // Load a past conversation from Lakebase into the chat (display + continue).
  const loadConversation = useCallback(async (id: string) => {
    const conv = await getConversation(id);
    if (!conv) return;
    if (abortRef.current) abortRef.current.abort();
    conversationIdRef.current = null; // start a fresh Genie session for new turns
    dbConvRef.current = conv.id;
    setActiveConversationId(conv.id);
    if (conv.mode === "space" || conv.mode === "multi") setModeState(conv.mode);
    const mapped: GenieMcpMessage[] = (conv.messages || []).map((m: any, i: number) => ({
      id: `${m.role}-${i}-${Date.now()}`,
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content ?? "",
      steps: m.steps ?? [],
      sql: m.sql ?? [],
      toolCalls: m.toolCalls ?? [],
      table: m.table ?? null,
      deepLink: m.deepLink ?? null,
      status: m.status ?? null,
      error: m.error ?? null,
      isStreaming: false,
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

  return {
    messages,
    isLoading,
    mcpStatus,
    mode,
    checkHealth,
    sendMessage,
    clearChat,
    // history (persist mode)
    conversations,
    activeConversationId,
    loadConversation,
    removeConversation,
    refreshConversations,
  };
}
