import { useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { brand, brandToCssVars, accentVars, neutralsStyleSheet, DEFAULT_THEME } from "./brand";

/**
 * Applies brand.config.json to the document at runtime as CSS custom
 * properties, and delegates light/dark to next-themes (class-based `.dark`).
 *
 * IMPORTANT: only THEME-INVARIANT vars are written inline here (brand-* +
 * accent). The neutral ramp + --overlay are theme-variant and injected as
 * real cascade rules (:root / .dark) so the class flip can still swap them;
 * writing them inline would override that rule and break dark mode.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const css = neutralsStyleSheet(brand);
    if (css) {
      let styleEl = document.getElementById("apex-neutrals") as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "apex-neutrals";
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = css;
    }

    const root = document.documentElement;
    const vars = { ...brandToCssVars(brand), ...accentVars(brand) };
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    document.title = brand.identity.appName;
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
