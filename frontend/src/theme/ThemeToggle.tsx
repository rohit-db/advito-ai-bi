import { Moon, Sun } from "lucide-react";
import { useTheme } from "./useTheme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const toDark = theme === "light";
  const label = toDark ? "Switch to dark theme" : "Switch to light theme";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="grid place-items-center h-6 w-6 rounded-sm text-fg-ghost hover:bg-[var(--fill-hover)] hover:text-fg-muted transition-colors"
    >
      {toDark ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}
