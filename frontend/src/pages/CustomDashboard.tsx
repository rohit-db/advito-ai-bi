import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { buildPageEmbedUrl } from "@/config";
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
  filters: _filters,
  activePageId,
}: CustomDashboardProps) {
  const currentPageId = activePageId || pages[0]?.pageId || "";

  const [loadedPages, setLoadedPages] = useState<Set<string>>(new Set());

  const pageUrls = useMemo(() => {
    return Object.fromEntries(
      pages.map((page) => [page.pageId, buildPageEmbedUrl(dashboardId, page.pageId)])
    );
  }, [dashboardId, pages]);

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
