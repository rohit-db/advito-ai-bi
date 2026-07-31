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
    /** The one client-overridable color. Drives --primary and its derivations. */
    accent: string;
  };
  defaults?: { theme: Theme };
}

export const brand = brandJson as Brand;

export const DEFAULT_THEME: Theme = brand.defaults?.theme ?? "light";

/**
 * The ONLY config-driven CSS: the accent color and its derivations, emitted as
 * real cascade rules so the `.dark` block can brighten --primary (inline styles
 * would override the class rule and break dark-mode contrast). Everything else
 * is canonical DuBois and lives in index.css.
 */
export function accentStyleSheet(b: Brand): string {
  const a = b.colors.accent;
  const aDark = `color-mix(in srgb, ${a} 65%, white)`;
  return (
    `:root{` +
    `--primary:${a};--primary-foreground:#ffffff;` +
    `--ring:${a};--sidebar-primary:${a};--sidebar-ring:${a};` +
    `}` +
    `.dark{` +
    `--primary:${aDark};--primary-foreground:#11171c;` +
    `--ring:${aDark};--sidebar-primary:${aDark};--sidebar-ring:${aDark};` +
    `}`
  );
}
