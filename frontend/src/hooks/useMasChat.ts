import { useState, useCallback, useRef } from "react";

export interface MasMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolCall?: { name: string; arguments: string };
  agentHandoff?: string;
}

export function useMasChat() {
  const [messages, setMessages] = useState<MasMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const historyRef = useRef<{ role: string; content: string }[]>([]);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: MasMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setStreamingContent("");

    const history = historyRef.current;

    try {
      const res = await fetch("/api/mas/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
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
              // Flush accumulated text before tool call
              if (fullContent.trim()) {
                const flushed = fullContent;
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: flushed },
                ]);
                fullContent = "";
                setStreamingContent("");
              }
              setMessages((prev) => [
                ...prev,
                {
                  role: "system",
                  content: "",
                  toolCall: { name: event.name, arguments: event.arguments },
                },
              ]);

            } else if (event.type === "agent_handoff") {
              // Flush accumulated text before handoff
              if (fullContent.trim()) {
                const flushed = fullContent;
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: flushed },
                ]);
                fullContent = "";
                setStreamingContent("");
              }
              setMessages((prev) => [
                ...prev,
                { role: "system", content: "", agentHandoff: event.agent },
              ]);

            } else if (event.type === "error") {
              fullContent += "\n\nError: " + event.content;
              setStreamingContent(fullContent);
            }
          } catch {
            // skip malformed
          }
        }
      }

      // Add any remaining text as final message
      if (fullContent.trim()) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: fullContent },
        ]);
      }

      historyRef.current = [
        ...history,
        { role: "user", content: text },
        { role: "assistant", content: allText || "(No response)" },
      ];
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err}` },
      ]);
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
