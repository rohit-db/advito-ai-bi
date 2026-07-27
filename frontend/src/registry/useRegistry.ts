import { createContext, useContext } from "react";
import type { AssetSpec, Registry } from "./types";

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
