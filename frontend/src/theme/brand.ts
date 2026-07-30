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
    neutrals?: {
      light: { ramp: string[]; overlay: string };
      dark: { ramp: string[]; overlay: string };
    };
    accentGradient?: { enabled: boolean; stops: string[] };
  };
  typography: { fontSans: string };
  defaults?: { theme: Theme };
}

export const brand = brandJson as Brand;

export const DEFAULT_THEME: Theme = brand.defaults?.theme ?? "light";

/** Theme-INVARIANT accent vars written at runtime by ThemeProvider.
 *  The neutral ramp + --overlay are theme-variant and stay CSS-only. */
export function accentVars(b: Brand): Record<string, string> {
  const g = b.colors.accentGradient;
  const gradient =
    g?.enabled && g.stops.length >= 2
      ? `linear-gradient(135deg, ${g.stops.join(", ")})`
      : "var(--accent)";
  return {
    "--accent": b.colors.duboisAccent,
    "--accent-fg": b.colors.accentFg,
    "--accent-hover": b.colors.accentHover,
    "--accent-gradient": gradient,
  };
}

function rampBlock(sel: string, ramp: string[], overlay: string): string {
  const vars = ramp.map((c, i) => `--n${i}:${c};`).join("");
  return `${sel}{${vars}--overlay:${overlay};}`;
}

/** CSS text for the injected <style> — real cascade rules so the
 *  [data-theme="dark"] flip keeps working (ramp is theme-variant). "" if unset. */
export function neutralsStyleSheet(b: Brand): string {
  const n = b.colors.neutrals;
  if (!n) return "";
  return (
    rampBlock(":root", n.light.ramp, n.light.overlay) +
    rampBlock('[data-theme="dark"]', n.dark.ramp, n.dark.overlay)
  );
}

const camelToKebab = (s: string) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

/** Flatten the brand doc into the raw `--brand-*` CSS custom properties. */
export function brandToCssVars(b: Brand): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(b.colors)) {
    if (typeof value !== "string") continue;
    vars[`--brand-${camelToKebab(key)}`] = value;
  }
  vars["--brand-font-sans"] = b.typography.fontSans;
  return vars;
}
