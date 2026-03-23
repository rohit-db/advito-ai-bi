import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildPageEmbedUrl } from "@/config";
import type { FilterState, PageConfig } from "@/config";

// Height of the Databricks Lakeview tab header to clip (px)
const HEADER_OFFSET = 48;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CustomDashboardProps {
  dashboardId: string;
  pages: PageConfig[];
  filters: FilterState;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CustomDashboard({
  dashboardId,
  pages,
  filters: _filters, // reserved for future filter-to-URL encoding
}: CustomDashboardProps) {
  const [activePageId, setActivePageId] = useState<string>(
    pages[0]?.pageId ?? ""
  );

  // Track which pages have finished loading (show spinner until onLoad fires)
  const [loadedPages, setLoadedPages] = useState<Set<string>>(new Set());

  // Build all iframe URLs. Re-computed when dashboardId or pages list changes.
  // Filter params are not yet wired to URL — the config's buildPageEmbedUrl
  // handles that once filter widget IDs are defined per page.
  const pageUrls = useMemo(() => {
    return Object.fromEntries(
      pages.map((page) => [
        page.pageId,
        buildPageEmbedUrl(dashboardId, page.pageId),
      ])
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
      {/* Tab bar */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-4 py-2 flex items-center">
        <Tabs value={activePageId} onValueChange={setActivePageId}>
          <TabsList className="bg-gray-50 border border-gray-100">
            {pages.map((page) => (
              <TabsTrigger key={page.pageId} value={page.pageId}>
                {page.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Iframe layer — all pages stay mounted for instant tab switching */}
      <div className="flex-1 relative overflow-hidden bg-apex-bg">
        {pages.map((page) => {
          const isActive = page.pageId === activePageId;
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
              {/* Loading spinner — shown until iframe fires onLoad */}
              {!isLoaded && isActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-apex-bg z-10">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Loader2
                      size={28}
                      className="animate-spin text-indigo-500"
                    />
                    <span className="text-xs font-medium">
                      Loading {page.label}…
                    </span>
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
                  // Clip the Databricks tab header row
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
