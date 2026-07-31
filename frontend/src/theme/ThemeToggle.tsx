import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const toDark = theme !== "dark";
  const label = toDark ? "Switch to dark theme" : "Switch to light theme";
  return (
    <button
      type="button"
      onClick={() => setTheme(toDark ? "dark" : "light")}
      aria-label={label}
      title={label}
      className="grid place-items-center h-6 w-6 rounded-sm text-fg-ghost hover:bg-[var(--fill-hover)] hover:text-fg-muted transition-colors"
    >
      {toDark ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}
