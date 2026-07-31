import { useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { brand, accentStyleSheet, DEFAULT_THEME } from "./brand";

/**
 * Injects the config-driven accent (the ONLY overridable color) as cascade
 * rules so the `.dark` block can still brighten --primary, and applies the
 * brand identity (title + favicon). Light/dark is delegated to next-themes
 * (class-based `.dark`). All other tokens are canonical DuBois in index.css.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    let styleEl = document.getElementById("apex-accent") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "apex-accent";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = accentStyleSheet(brand);

    document.title = brand.identity.appName;

    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon && brand.identity.favicon) favicon.href = brand.identity.favicon;
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={DEFAULT_THEME}
      enableSystem={false}
      storageKey="apex-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
