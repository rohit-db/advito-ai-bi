import { useState, useCallback, useRef, useEffect } from "react";

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

export interface GenieMcpMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps: string[];
  sql: GenieSqlBlock[];
  table?: GenieTable | null;
  deepLink?: { url: string; label: string } | null;
  status?: string | null;
  error?: string | null;
  isStreaming: boolean;
}

export type McpTool = { name: string; description?: string | null };

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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGenieMcpChat() {
  const [messages, setMessages] = useState<GenieMcpMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mcpStatus, setMcpStatus] = useState<McpStatus>({ state: "connecting" });

  const conversationIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Probe the managed Genie MCP server — proves a real MCP session and surfaces
  // the discovered tool contract (genie_ask / genie_poll_response).
  const checkHealth = useCallback(async () => {
    setMcpStatus({ state: "connecting" });
    try {
      const res = await fetch("/api/genie-mcp/health");
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
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const sendMessage = useCallback(async (text: string, context?: string) => {
    if (!text.trim() || isLoading) return;

    const userId = `user-${Date.now()}`;
    const assistantId = `ai-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: text, steps: [], sql: [], isStreaming: false },
      { id: assistantId, role: "assistant", content: "", steps: [], sql: [], isStreaming: true },
    ]);
    setIsLoading(true);

    const patch = (updater: (m: GenieMcpMessage) => GenieMcpMessage) =>
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? updater(m) : m)));

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/genie-mcp/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationIdRef.current || undefined,
          context: context || "",
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
    }
  }, [isLoading]);

  const clearChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    conversationIdRef.current = null;
    setMessages([]);
    setIsLoading(false);
  }, []);

  return { messages, isLoading, mcpStatus, checkHealth, sendMessage, clearChat };
}
