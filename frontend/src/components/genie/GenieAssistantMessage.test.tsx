import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import GenieAssistantMessage from "./GenieAssistantMessage";
import type { GenieMcpMessage } from "@/hooks/useGenieMcpChat";

const msg = (over: Partial<GenieMcpMessage> = {}): GenieMcpMessage => ({
  id: "m1", role: "assistant", content: "Total spend was **$4.2M**.",
  steps: [], sql: [], table: null, toolCalls: [], deepLink: null,
  isStreaming: false, error: null, status: "completed", ...over,
} as GenieMcpMessage);

describe("GenieAssistantMessage (flat DuBois)", () => {
  it("renders the answer with NO bubble (no bg-white/shadow/gradient) and a monochrome mark", () => {
    const { container } = render(
      <GenieAssistantMessage message={msg()} variant="full" sqlOpen={false} onToggleSql={() => {}} />
    );
    const html = container.innerHTML;
    // flat: no white bubble, no card shadow, no gradient anywhere in the assistant message
    expect(html).not.toMatch(/bg-white/);
    expect(html).not.toMatch(/from-brand-|from-fuchsia|bg-linear-to/);
    expect(html).not.toMatch(/shadow-sm|shadow-md/);
    // the answer text still renders
    expect(container.textContent).toMatch(/Total spend/);
  });
});
