import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { Registry } from "./types";
import { bundledRegistry } from "./seed";
import { RegistryContext } from "./useRegistry";

/**
 * Boot-time registry loader (sibling to ThemeProvider). Fetches GET /api/assets
 * ONCE, gating the app shell behind a branded skeleton until it settles, then
 * provides the resolved registry so every downstream consumer reads it
 * synchronously. If the fetch fails, falls back to the bundled seed copy so the
 * app always renders (fail-soft — the zero-infra demo promise).
 */
export function RegistryProvider({ children }: { children: ReactNode }) {
  const [registry, setRegistry] = useState<Registry | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/assets");
        if (!res.ok) throw new Error(`assets ${res.status}`);
        const data = (await res.json()) as Registry;
        if (!cancelled) {
          setRegistry(data?.assets ? data : bundledRegistry);
        }
      } catch {
        if (!cancelled) setRegistry(bundledRegistry);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!registry) {
    return (
      <div className="h-full flex items-center justify-center bg-brand-bg">
        <Loader2 size={28} className="animate-spin text-brand-accent" />
      </div>
    );
  }

  return <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>;
}
