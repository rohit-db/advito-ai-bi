import { useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { brand, brandToCssVars } from "./brand";

/**
 * Applies brand.config.json to the document at runtime as CSS custom
 * properties. Defaults already live in index.css :root (branded first paint);
 * this overwrites them, which is the seam a future per-tenant payload uses.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(brandToCssVars(brand))) {
      root.style.setProperty(key, value);
    }
    document.title = brand.identity.appName;
  }, []);

  return <>{children}</>;
}
