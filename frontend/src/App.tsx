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
}: {
  route: RouteConfig;
  filters: FilterState;
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
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const location = useLocation();

  const currentRoute = ROUTES.find((r) => r.path === location.pathname);
  const isCustom = currentRoute?.mode === "custom";
  const isApexQA = location.pathname === "/apex-qa";
  const filterContext = filtersToContext(filters);

  return (
    <div className="h-full flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen(!chatOpen)}
        />

        {/* For custom dashboard pages: tabs first, then filters */}
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
                    <RouteRenderer route={route} filters={filters} />
                  }
                />
              ))}
            </Routes>
          </main>

          {/* Inline chat side panel — pushes content, doesn't overlay */}
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
