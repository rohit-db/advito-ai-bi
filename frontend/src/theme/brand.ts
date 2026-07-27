import brandJson from "@brand";

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
    sidebarFrom: string;
    sidebarVia: string;
    sidebarTo: string;
    bg: string;
    border: string;
  };
  typography: { fontSans: string };
}

export const brand = brandJson as Brand;

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
