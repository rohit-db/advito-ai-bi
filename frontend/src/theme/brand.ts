import brandJson from "@brand";

export type Theme = "light" | "dark";

export interface Brand {
  identity: {
    appName: string;
    shortName: string;
    tagline: string;
    logo: string;
    logoMark: string;
    favicon: string;
  };
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    accent: string;
    accentDark: string;
    duboisAccent: string;
    accentFg: string;
    accentHover: string;
    sidebarFrom: string;
    sidebarVia: string;
    sidebarTo: string;
    bg: string;
    border: string;
  };
  typography: { fontSans: string };
  defaults?: { theme: Theme };
}

export const brand = brandJson as Brand;

export const DEFAULT_THEME: Theme = brand.defaults?.theme ?? "light";

/** Theme-INVARIANT accent vars written at runtime by ThemeProvider.
 *  The neutral ramp + --overlay are theme-variant and stay CSS-only. */
export function accentVars(b: Brand): Record<string, string> {
  return {
    "--accent": b.colors.duboisAccent,
    "--accent-fg": b.colors.accentFg,
    "--accent-hover": b.colors.accentHover,
  };
}

const camelToKebab = (s: string) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

/** Flatten the brand doc into the raw `--brand-*` CSS custom properties. */
export function brandToCssVars(b: Brand): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(b.colors)) {
    vars[`--brand-${camelToKebab(key)}`] = value;
  }
  vars["--brand-font-sans"] = b.typography.fontSans;
  return vars;
}
