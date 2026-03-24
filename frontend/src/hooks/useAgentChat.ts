import { useState, useCallback, useRef } from "react";

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolCall?: { name: string; arguments: string };
}

export function useAgentChat() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const historyRef = useRef<{ role: string; content: string }[]>([]);

  const sendMessage = useCallback(async (text: string, context?: string) => {
    const userMsg: AgentMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setStreamingContent("");

    const history = historyRef.current;

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, context: context || "" }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let fullContent = "";
      let allText = "";
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

            if (event.type === "stream") {
              fullContent += event.content;
              allText += event.content;
              setStreamingContent(fullContent);

            } else if (event.type === "tool_call") {
              if (fullContent.trim()) {
                const flushed = fullContent;
                setMessages((prev) => [...prev, { role: "assistant", content: flushed }]);
                fullContent = "";
                setStreamingContent("");
              }
              setMessages((prev) => [
                ...prev,
                { role: "system", content: "", toolCall: { name: event.name, arguments: event.arguments } },
              ]);

            } else if (event.type === "status") {
              // Show status as a system message briefly
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "system" && !last.toolCall) {
                  return [...prev.slice(0, -1), { role: "system", content: event.content }];
                }
                return [...prev, { role: "system", content: event.content }];
              });

            } else if (event.type === "error") {
              fullContent += "\n\nError: " + event.content;
              setStreamingContent(fullContent);
            }
          } catch {
            // skip malformed
          }
        }
      }

      if (fullContent.trim()) {
        setMessages((prev) => [...prev, { role: "assistant", content: fullContent }]);
      }

      historyRef.current = [
        ...history,
        { role: "user", content: text },
        { role: "assistant", content: allText || "(No response)" },
      ];
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err}` }]);
    } finally {
      setIsLoading(false);
      setStreamingContent("");
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    historyRef.current = [];
  }, []);

  return { messages, isLoading, streamingContent, sendMessage, clearChat };
}
