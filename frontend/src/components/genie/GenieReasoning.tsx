import { useState } from "react";
import { Zap, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";

// Live reasoning steps from Genie. `variant="full"` renders the collapsible
// violet timeline card (auto-expanded while streaming); `variant="compact"`
// renders a single-line indicator for the dashboard rail.
export default function GenieReasoning({
  steps,
  isStreaming,
  variant = "full",
}: {
  steps: string[];
  isStreaming: boolean;
  variant?: "full" | "compact";
}) {
  return variant === "compact" ? (
    <CompactReasoning steps={steps} isStreaming={isStreaming} />
  ) : (
    <FullReasoning steps={steps} isStreaming={isStreaming} />
  );
}

function ThinkingDots({ accent }: { accent: string }) {
  return (
    <span className="flex gap-1">
      <span className={`w-1.5 h-1.5 ${accent} rounded-full animate-bounce`} style={{ animationDelay: "0ms" }} />
      <span className={`w-1.5 h-1.5 ${accent} rounded-full animate-bounce`} style={{ animationDelay: "150ms" }} />
      <span className={`w-1.5 h-1.5 ${accent} rounded-full animate-bounce`} style={{ animationDelay: "300ms" }} />
    </span>
  );
}

function FullReasoning({ steps, isStreaming }: { steps: string[]; isStreaming: boolean }) {
  const [open, setOpen] = useState(false);

  if (!steps || steps.length === 0) {
    return isStreaming ? (
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        <ThinkingDots accent="bg-violet-600" />
        <span>Genie is thinking…</span>
      </div>
    ) : null;
  }

  const showAll = isStreaming || open;
  const stepLabel = `${steps.length} step${steps.length > 1 ? "s" : ""}`;

  return (
    <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isStreaming}
        className="w-full flex items-center justify-between gap-2 text-left disabled:cursor-default"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" /> Genie reasoning
          <span className="text-violet-500 normal-case font-medium">· {stepLabel}</span>
        </span>
        {!isStreaming &&
          (open ? (
            <ChevronUp className="w-3.5 h-3.5 text-violet-700 shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-violet-700 shrink-0" />
          ))}
      </button>

      {showAll ? (
        <ol className="space-y-1.5 mt-2">
          {steps.map((step, idx) => {
            const pending = isStreaming && idx === steps.length - 1;
            return (
              <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                {pending ? (
                  <span className="w-3.5 h-3.5 mt-0.5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-600 shrink-0" />
                )}
                <span className="break-words">{step}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-1.5 text-xs text-gray-500 truncate">{steps[steps.length - 1]}</p>
      )}
    </div>
  );
}

function CompactReasoning({ steps, isStreaming }: { steps: string[]; isStreaming: boolean }) {
  if (!steps || steps.length === 0) {
    return isStreaming ? (
      <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1.5">
        <ThinkingDots accent="bg-indigo-600" />
        <span>Thinking…</span>
      </div>
    ) : null;
  }

  if (isStreaming) {
    return (
      <div className="mb-2 flex items-start gap-1.5 text-[11px] text-gray-600">
        <span className="w-3 h-3 mt-0.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
        <span className="break-words">{steps[steps.length - 1]}</span>
      </div>
    );
  }

  return (
    <div className="mb-2 flex items-start gap-1.5 text-[11px] text-gray-500">
      <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-600 shrink-0" />
      <span className="break-words">
        {steps.length} reasoning step{steps.length > 1 ? "s" : ""} · {steps[steps.length - 1]}
      </span>
    </div>
  );
}
