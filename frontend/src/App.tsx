import { useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import FilterBar from "@/components/FilterBar";
import ChatPanel from "@/components/ChatPanel";
import NativeDashboard from "@/pages/NativeDashboard";
import CustomDashboard from "@/pages/CustomDashboard";
import ApexChat from "@/pages/ApexChat";
import Placeholder from "@/pages/Placeholder";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ROUTES,
  buildNativeEmbedUrl,
  filtersToContext,
  DEFAULT_FILTERS,
} from "@/config";
import type { FilterState, RouteConfig } from "@/config";

function RouteRenderer({
  route,
  filters,
  activePageId,
}: {
  route: RouteConfig;
  filters: FilterState;
  activePageId?: string;
}) {
  switch (route.mode) {
    case "native":
      return (
        <NativeDashboard embedUrl={buildNativeEmbedUrl(route.dashboardId!)} />
      );
    case "custom":
      return (
        <CustomDashboard
          dashboardId={route.dashboardId!}
          pages={route.pages || []}
          filters={filters}
          activePageId={activePageId}
        />
      );
    case "react":
      return <ApexChat />;
    case "placeholder":
    default:
      return <Placeholder />;
  }
}

export default function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [activePageId, setActivePageId] = useState<string | undefined>();
  const location = useLocation();

  const currentRoute = ROUTES.find((r) => r.path === location.pathname);
  const isCustom = currentRoute?.mode === "custom";
  const isApexQA = location.pathname === "/apex-qa";
  const filterContext = filtersToContext(filters);
  const pages = currentRoute?.pages || [];

  // Reset active page when route changes
  const effectivePageId = activePageId && pages.some(p => p.pageId === activePageId)
    ? activePageId
    : pages[0]?.pageId;

  return (
    <div className="h-full flex">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen(!chatOpen)}
        />

        {/* For custom pages: page tabs first, then filters */}
        {isCustom && pages.length > 0 && (
          <div className="shrink-0 bg-white border-b border-gray-200 px-5 py-2">
            <Tabs value={effectivePageId} onValueChange={setActivePageId}>
              <TabsList>
                {pages.map((page) => (
                  <TabsTrigger key={page.pageId} value={page.pageId}>
                    {page.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        {isCustom && <FilterBar filters={filters} onChange={setFilters} />}

        <div className="flex-1 flex min-h-0">
          <main className="flex-1 flex flex-col min-w-0">
            <Routes>
              <Route path="/" element={<Navigate to="/spend" replace />} />
              {ROUTES.map((route) => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={
                    <RouteRenderer
                      route={route}
                      filters={filters}
                      activePageId={effectivePageId}
                    />
                  }
                />
              ))}
            </Routes>
          </main>

          {!isApexQA && (
            <ChatPanel
              isOpen={chatOpen}
              onClose={() => setChatOpen(false)}
              activePath={location.pathname}
              activePageLabel={currentRoute?.label || "APEX"}
              filterContext={filterContext}
            />
          )}
        </div>
      </div>
    </div>
  );
}
