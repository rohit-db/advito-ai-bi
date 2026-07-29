import { createContext, useContext, useMemo } from "react";
import type { AssetSpec, Registry } from "./types";
import { buildRoutes, type RouteConfig } from "@/config";

export const RegistryContext = createContext<Registry | null>(null);

export function useRegistry(): Registry {
  const reg = useContext(RegistryContext);
  if (!reg) throw new Error("useRegistry must be used within <RegistryProvider>");
  return reg;
}

export function useDashboardAsset(key?: string): AssetSpec | undefined {
  const reg = useRegistry();
  return key ? reg.assets[key] : undefined;
}

/**
 * The merged nav/route list: fixed react pages + dashboard routes derived from
 * the (already entitlement-filtered) registry. Both Sidebar and App consume this
 * so adding an asset produces a sidebar entry and a route with no code change.
 */
export function useRoutes(): RouteConfig[] {
  const reg = useRegistry();
  return useMemo(() => buildRoutes(reg), [reg]);
}
