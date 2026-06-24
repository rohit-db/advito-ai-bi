import { useState, useMemo, useEffect, useRef } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { buildTokenEmbedUrl, fetchEmbedToken } from "@/config";
import type { FilterState, PageConfig } from "@/config";

const HEADER_OFFSET = 48;

interface CustomDashboardProps {
  dashboardId: string;
  pages: PageConfig[];
  filters: FilterState;
  activePageId?: string;
}

export default function CustomDashboard({
  dashboardId,
  pages,
  filters,
  activePageId,
}: CustomDashboardProps) {
  const currentPageId = activePageId || pages[0]?.pageId || "";

  const [loadedPages, setLoadedPages] = useState<Set<string>>(new Set());

  // External (token) embedding: fetch a scoped SP token so the dashboard
  // renders with no Databricks login, then refresh it before expiry.
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const refreshRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetchEmbedToken(dashboardId);
        if (cancelled) return;
        if (res.ok && res.token) {
          setToken(res.token);
          setTokenError(null);
          const ms = Math.max(60_000, (res.expires_in ?? 3600) * 1000 - 300_000);
          refreshRef.current = window.setTimeout(load, ms);
        } else {
          setTokenError(res.error || "Could not mint embed token");
        }
      } catch (e) {
        if (!cancelled) setTokenError(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    return () => {
      cancelled = true;
      if (refreshRef.current) window.clearTimeout(refreshRef.current);
    };
  }, [dashboardId]);

  // Rebuild URLs when filters or token change — iframe src change triggers reload
  const pageUrls = useMemo(() => {
    if (!token) return {} as Record<string, string>;
    return Object.fromEntries(
      pages.map((page) => [page.pageId, buildTokenEmbedUrl(dashboardId, page.pageId, token, filters)])
    );
  }, [dashboardId, pages, filters, token]);

  const markLoaded = (pageId: string) => {
    setLoadedPages((prev) => {
      if (prev.has(pageId)) return prev;
      const next = new Set(prev);
      next.add(pageId);
      return next;
    });
  };

  if (pages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-400">
        No pages configured for this dashboard.
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertCircle size={16} />
            Could not load the dashboard
          </div>
          <p className="text-rose-600">{tokenError}</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="h-full flex items-center justify-center bg-apex-bg">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
          <span className="text-xs font-medium">Preparing secure dashboard…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Iframe layer — all pages stay mounted for instant tab switching */}
      <div className="flex-1 relative overflow-hidden bg-apex-bg">
        {pages.map((page) => {
          const isActive = page.pageId === currentPageId;
          const isLoaded = loadedPages.has(page.pageId);
          const src = pageUrls[page.pageId];

          return (
            <div
              key={page.pageId}
              className="absolute inset-0"
              style={{
                visibility: isActive ? "visible" : "hidden",
                zIndex: isActive ? 1 : 0,
                overflow: "hidden",
              }}
            >
              {!isLoaded && isActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-apex-bg z-10">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Loader2 size={28} className="animate-spin text-indigo-500" />
                    <span className="text-xs font-medium">Loading {page.label}…</span>
                  </div>
                </div>
              )}
              <iframe
                src={src}
                title={`APEX — ${page.label}`}
                className="w-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                onLoad={() => markLoaded(page.pageId)}
                style={{
                  marginTop: `-${HEADER_OFFSET}px`,
                  height: `calc(100% + ${HEADER_OFFSET}px)`,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
