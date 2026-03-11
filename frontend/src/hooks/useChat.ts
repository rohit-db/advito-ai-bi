import { useState, useCallback } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sql?: string;
  data?: { columns: { name: string; type: string }[]; rows: string[][] } | null;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string, context?: string) => {
      const userMsg: ChatMessage = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversation_id: conversationId,
            context: context || undefined,
          }),
        });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        let assistantSql: string | undefined;
        let assistantData: ChatMessage["data"] = null;

        if (!reader) return;

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

            try {
              const event = JSON.parse(payload);
              if (event.type === "meta") {
                setConversationId(event.conversationId);
              } else if (event.type === "text") {
                assistantContent += event.content;
              } else if (event.type === "query") {
                if (event.description) assistantContent += event.description + "\n";
                assistantSql = event.sql;
                assistantData = event.data;
              } else if (event.type === "error") {
                assistantContent += "Error: " + event.content;
              }
            } catch {
              // skip malformed lines
            }
          }
        }

        if (assistantContent || assistantSql) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: assistantContent || "Here are the results:",
              sql: assistantSql,
              data: assistantData,
            },
          ]);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${err}` },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  return { messages, isLoading, sendMessage, clearChat };
}
