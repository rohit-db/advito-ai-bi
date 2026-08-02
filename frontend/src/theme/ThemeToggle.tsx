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
      className="grid place-items-center h-6 w-6 rounded text-muted-foreground hover:bg-[var(--action-default-bg-hover)] hover:text-foreground transition-colors"
    >
      {toDark ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}
