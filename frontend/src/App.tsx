import { useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import FilterBar from "@/components/FilterBar";
import DashboardWorkspace from "@/components/DashboardWorkspace";
import NativeDashboard from "@/pages/NativeDashboard";
import CustomDashboard from "@/pages/CustomDashboard";
import GenieMcpExperience from "@/pages/GenieMcpExperience";
import Placeholder from "@/pages/Placeholder";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ROUTES,
  buildNativeEmbedUrl,
  filtersToContext,
  getDashboardGenie,
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
    case "custom": {
      const genie = getDashboardGenie(route.path, activePageId);
      const pageLabel =
        route.mode === "custom"
          ? `${route.label} · ${
              route.pages?.find((p) => p.pageId === activePageId)?.label ?? ""
            }`.replace(/ · $/, "")
          : route.label;
      const pageContext = [`Dashboard: ${pageLabel}`, filtersToContext(filters)]
        .filter(Boolean)
        .join(". ");

      const content =
        route.mode === "native" ? (
          <NativeDashboard embedUrl={buildNativeEmbedUrl(route.dashboardId!, filters)} />
        ) : (
          <CustomDashboard
            dashboardId={route.dashboardId!}
            pages={route.pages || []}
            filters={filters}
            activePageId={activePageId}
          />
        );

      return (
        <DashboardWorkspace
          pageKey={`${route.path}:${activePageId ?? ""}`}
          pageLabel={pageLabel}
          pageContext={pageContext}
          summaryPrompt={genie.summaryPrompt}
          suggestions={genie.suggestions}
        >
          {content}
        </DashboardWorkspace>
      );
    }
    case "react":
      if (route.path === "/genie-mcp") return <GenieMcpExperience />;
      return <Placeholder />;
    case "placeholder":
    default:
      return <Placeholder />;
  }
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [activePageId, setActivePageId] = useState<string | undefined>();
  const location = useLocation();

  const currentRoute = ROUTES.find((r) => r.path === location.pathname);
  const isCustom = currentRoute?.mode === "custom";
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
        <Header />

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
              <Route path="/" element={<Navigate to="/spend-custom" replace />} />
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
        </div>
      </div>
    </div>
  );
}
