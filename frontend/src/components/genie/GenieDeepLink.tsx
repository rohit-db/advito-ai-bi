import { ExternalLink } from "lucide-react";

// "Open in Genie" deep-link button back into the native Genie space.
export default function GenieDeepLink({
  deepLink,
  variant = "full",
}: {
  deepLink: { url: string; label?: string } | null | undefined;
  variant?: "full" | "compact";
}) {
  if (!deepLink) return null;
  const compact = variant === "compact";
  const size = compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs";
  const color = compact ? "bg-indigo-600 hover:bg-indigo-700" : "bg-violet-600 hover:bg-violet-700";
  return (
    <a
      href={deepLink.url}
      target="_blank"
      rel="noreferrer"
      className={`mt-3 inline-flex items-center gap-1.5 rounded-lg text-white font-medium transition-colors ${color} ${size}`}
    >
      <ExternalLink className="w-3.5 h-3.5" />
      <span>{deepLink.label || "Open in Genie"}</span>
    </a>
  );
}
