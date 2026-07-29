import { useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { brand, brandToCssVars, accentVars } from "./brand";
import { readStoredTheme, applyTheme } from "./useTheme";

/**
 * Applies brand.config.json to the document at runtime as CSS custom
 * properties, and applies the persisted light/dark theme.
 *
 * IMPORTANT: only THEME-INVARIANT vars are written inline here (brand-* +
 * accent). The neutral ramp and --overlay are theme-variant and live in
 * index.css so the [data-theme="dark"] cascade can flip them; writing them
 * inline would override that rule and break dark mode.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const vars = { ...brandToCssVars(brand), ...accentVars(brand) };
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    applyTheme(readStoredTheme());
    document.title = brand.identity.appName;
  }, []);

  return <>{children}</>;
}
