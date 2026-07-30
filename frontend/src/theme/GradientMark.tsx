import { Sparkles, type LucideIcon } from "lucide-react";

export default function GradientMark({
  size = 56,
  className = "",
  icon: Icon = Sparkles,
}: {
  size?: number;
  className?: string;
  icon?: LucideIcon;
}) {
  return (
    <div
      className={`grid place-items-center rounded-2xl text-white shadow-sm ${className}`}
      style={{ width: size, height: size, background: "var(--accent-gradient)" }}
    >
      <Icon size={Math.round(size * 0.45)} strokeWidth={1.75} />
    </div>
  );
}
