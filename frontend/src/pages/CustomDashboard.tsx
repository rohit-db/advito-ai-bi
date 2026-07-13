import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { DatabricksDashboard } from "@databricks/aibi-client";
import { WORKSPACE, ORG, DEFAULT_FILTERS, buildTokenEmbedUrl, fetchEmbedToken } from "@/config";
import type { DashboardSpec, FilterState, PageConfig } from "@/config";

// Config payload that hides the "Powered by Databricks" footer. Mirrors what
// @databricks/aibi-client sends; we re-send it ourselves after any iframe reload
// because the SDK only pushes it once (after the first DATABRICKS_EMBED_READY).
const LOGO_CONFIG = { version: 1, hideRefreshButton: false, hideDatabricksLogo: true };

// The embedded dashboard renders its own page header/title bar at the top. We
// crop it by shifting the iframe up and over-sizing its height (the SDK renders
// the iframe at a flat 100%, so we re-apply this after it builds the iframe).
const HEADER_OFFSET = 48;

function cropIframeHeader(iframe: HTMLIFrameElement | null | undefined) {
  if (!iframe) return;
  iframe.style.display = "block";
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.marginTop = `-${HEADER_OFFSET}px`;
  iframe.style.height = `calc(100% + ${HEADER_OFFSET}px)`;
}

interface CustomDashboardProps {
  spec: DashboardSpec;
  pages: PageConfig[];
  filters: FilterState;
  activePageId?: string;
}

function filtersAreDefault(f: FilterState): boolean {
  return (
    f.currentPeriodFrom === DEFAULT_FILTERS.currentPeriodFrom &&
    f.currentPeriodTo === DEFAULT_FILTERS.currentPeriodTo &&
    f.previousPeriodFrom === DEFAULT_FILTERS.previousPeriodFrom &&
    f.previousPeriodTo === DEFAULT_FILTERS.previousPeriodTo &&
    !f.travelSector &&
    !f.destinationRegion
  );
}

/**
 * White-label dashboard embed.
 *
 * Uses the official @databricks/aibi-client SDK so we get the supported
 * `config.hideDatabricksLogo` flag (removes the "Powered by Databricks" footer)
 * plus token mint/refresh. The SDK has no filter API, so we apply the dashboard
 * `f_…` filter widgets by reloading the embed iframe with the documented URL
 * params — and re-push the hide-logo config after each reload (the SDK only
 * sends it once). Page switches also reload the iframe (the SDK's navigate()
 * only posts a message and silently no-ops in the token-embed context).
 */
export default function CustomDashboard({
  spec,
  pages,
  filters,
  activePageId,
}: CustomDashboardProps) {
  const dashboardId = spec.id;
  const instanceUrl = spec.workspace ?? WORKSPACE;
  const orgId = spec.org ?? ORG;
  const currentPageId = activePageId || pages[0]?.pageId || "";

  const containerRef = useRef<HTMLDivElement>(null);
  const dashRef = useRef<DatabricksDashboard | null>(null);
  const tokenRef = useRef<string>("");
  const readyRef = useRef(false);
  const pageRef = useRef(currentPageId);
  pageRef.current = currentPageId;

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const fromEmbed = (e: MessageEvent): boolean => {
    try {
      return new URL(e.origin).origin === new URL(instanceUrl).origin;
    } catch {
      return false;
    }
  };

  // Re-send the hide-logo config the next time the embed reports READY (needed
  // after every reload, since the SDK only auto-sends it once).
  const reapplyConfigOnNextReady = () => {
    const onReady = (e: MessageEvent) => {
      if (!fromEmbed(e)) return;
      if (e.data?.type === "DATABRICKS_EMBED_READY") {
        const iframe = containerRef.current?.querySelector("iframe");
        iframe?.contentWindow?.postMessage(
          { type: "DATABRICKS_SET_CONFIG", config: LOGO_CONFIG },
          instanceUrl
        );
        window.removeEventListener("message", onReady);
      }
    };
    window.addEventListener("message", onReady);
    setTimeout(() => window.removeEventListener("message", onReady), 20000);
  };

  // Reload the embed iframe on `pageId`. When `f` is omitted we load the plain
  // page URL (no f_ params) — this keeps the dashboard's filter panel collapsed
  // for the default browsing case. Pass filters to apply them.
  const reloadWithFilters = (pageId: string, f?: FilterState) => {
    const iframe = containerRef.current?.querySelector("iframe");
    if (!iframe || !tokenRef.current) return;
    reapplyConfigOnNextReady();
    iframe.src = buildTokenEmbedUrl(spec, pageId, tokenRef.current, f);
  };

  // Create the SDK dashboard once per dashboard.
  useEffect(() => {
    let cancelled = false;
    readyRef.current = false;
    setPhase("loading");
    setError(null);

    const onFirstReady = (e: MessageEvent) => {
      if (!fromEmbed(e)) return;
      if (e.data?.type === "DATABRICKS_EMBED_READY" && !readyRef.current) {
        readyRef.current = true;
        setPhase("ready");
        // Apply any non-default initial filters (e.g. restored from Lakebase).
        if (!filtersAreDefault(filters)) reloadWithFilters(pageRef.current, filters);
      }
    };
    window.addEventListener("message", onFirstReady);

    (async () => {
      const res = await fetchEmbedToken(dashboardId);
      if (cancelled) return;
      if (!res.ok || !res.token) {
        setError(res.error || "Could not mint embed token");
        setPhase("error");
        return;
      }
      tokenRef.current = res.token;
      if (!containerRef.current) return;
      const dash = new DatabricksDashboard({
        instanceUrl,
        workspaceId: orgId,
        dashboardId,
        pageId: currentPageId || undefined,
        token: res.token,
        container: containerRef.current,
        config: { version: 1, hideDatabricksLogo: true },
        getNewToken: async () => {
          const r = await fetchEmbedToken(dashboardId);
          if (r.ok && r.token) tokenRef.current = r.token;
          return r.token || "";
        },
      });
      dash.initialize();
      dashRef.current = dash;
      // The SDK appends its iframe synchronously during initialize(); crop the
      // embedded dashboard's page header (rAF guards against append timing).
      requestAnimationFrame(() => cropIframeHeader(containerRef.current?.querySelector("iframe")));
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("message", onFirstReady);
      try {
        dashRef.current?.destroy();
      } catch {
        /* ignore */
      }
      dashRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardId]);

  // Page switch → reload the embed on the new page. We deliberately do NOT use
  // the SDK's navigate(): in the token-embed context it only fires a postMessage
  // and resolves even when the embed ignores it (so the page silently doesn't
  // change), and it wouldn't carry the f_ filter params. Rebuilding the iframe
  // URL reliably switches the page AND keeps the active filters + hide-logo config.
  useEffect(() => {
    if (!readyRef.current) return;
    // Only carry f_ params across the page switch when the user actually has
    // non-default filters; otherwise load the clean page (panel stays collapsed).
    reloadWithFilters(currentPageId, filtersAreDefault(filters) ? undefined : filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageId]);

  // Filter change → reload the current page with f_ params.
  useEffect(() => {
    if (!readyRef.current) return;
    reloadWithFilters(pageRef.current, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  if (pages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-slate-400">
        No pages configured for this dashboard.
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertCircle size={16} />
            Could not load the dashboard
          </div>
          <p className="text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 relative overflow-hidden bg-apex-bg">
        {phase === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-apex-bg">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 size={28} className="animate-spin text-indigo-500" />
              <span className="text-xs font-medium">Preparing secure dashboard…</span>
            </div>
          </div>
        )}
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
