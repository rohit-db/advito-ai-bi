import bundled from "@dashboards-seed";
import type { Registry } from "./types";

/**
 * Build-time copy of server/assets/dashboards.seed.json (imported via the
 * @dashboards-seed alias). The RegistryProvider falls back to this if
 * GET /api/assets fails, so the app always renders (zero-infra demo promise).
 */
export const bundledRegistry: Registry = bundled as Registry;
