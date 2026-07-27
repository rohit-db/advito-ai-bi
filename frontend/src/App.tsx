import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Sparkles, MessageCircle } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import FilterBar from "@/components/FilterBar";
import DashboardWorkspace from "@/components/DashboardWorkspace";
import CustomDashboard from "@/pages/CustomDashboard";
import GenieMcpExperience from "@/pages/GenieMcpExperience";
import AskApexLive from "@/pages/AskApexLive";
import HomePage from "@/pages/HomePage";
import PreferencesPage from "@/pages/PreferencesPage";
import Placeholder from "@/pages/Placeholder";
import AdminPage, { ADMIN_ROUTE_PATH } from "@/pages/AdminPage";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ROUTES,
  filtersToContext,
  getDashboard,
  getDashboardGenie,
  getSupportedFilterKeys,
  DEFAULT_FILTERS,
  loadEffectiveFilterPrefs,
  saveFilterPrefs,
} from "@/config";
import type { FilterState, RouteConfig } from "@/config";

function RouteRenderer({
  route,
  filters,
  filtersReady,
  activePageId,
  railOpen,
  onRailOpenChange,
  summaryOpen,
  onSummaryOpenChange,
}: {
  route: RouteConfig;
  filters: FilterState;
  filtersReady: boolean;
  activePageId?: string;
  railOpen: boolean;
  onRailOpenChange: (open: boolean) => void;
  summaryOpen: boolean;
  onSummaryOpenChange: (open: boolean) => void;
}) {
  switch (route.mode) {
    case "custom": {
      const genie = getDashboardGenie(route, activePageId);
      const spec = getDashboard(route);
      const pageLabel = `${route.label} · ${
        route.pages?.find((p) => p.pageId === activePageId)?.label ?? ""
      }`.replace(/ · $/, "");
      const pageContext = [`Dashboard: ${pageLabel}`, filtersToContext(filters, spec)]
        .filter(Boolean)
        .join(". ");

      const content = (
        <CustomDashboard
          spec={spec!}
          pages={route.pages || []}
          filters={filters}
          filtersReady={filtersReady}
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
          railOpen={railOpen}
          onRailOpenChange={onRailOpenChange}
          summaryOpen={summaryOpen}
          onSummaryOpenChange={onSummaryOpenChange}
        >
          {content}
        </DashboardWorkspace>
      );
    }
    case "react":
      if (route.path === "/") return <HomePage />;
      if (route.path === "/genie-mcp") return <GenieMcpExperience />;
      if (route.path === "/ask-apex-live") return <AskApexLive />;
      if (route.path === "/preferences") return <PreferencesPage />;
      return <Placeholder />;
    case "placeholder":
    default:
      return <Placeholder />;
  }
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filtersReady, setFiltersReady] = useState(false);
  const [activePageId, setActivePageId] = useState<string | undefined>();
  const [railOpen, setRailOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const location = useLocation();

  const currentRoute = ROUTES.find((r) => r.path === location.pathname);
  const isCustom = currentRoute?.mode === "custom";
  const pages = currentRoute?.pages || [];
  const currentDashboard = getDashboard(currentRoute);
  const currentDashboardId = currentDashboard?.id;
  const filterKeys = getSupportedFilterKeys(currentDashboard);

  // Restore filters: My Filters defaults, with per-dashboard FilterBar overrides on top.
  const loadFilterPrefs = useCallback(async (): Promise<FilterState | null> => {
    if (!currentDashboardId) return null;
    return loadEffectiveFilterPrefs(currentDashboardId);
  }, [currentDashboardId]);

  useEffect(() => {
    let cancelled = false;
    setFiltersReady(false);
    loadFilterPrefs().then((next) => {
      if (cancelled) return;
      if (next) setFilters(next);
      setFiltersReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [currentDashboardId, location.pathname, loadFilterPrefs]);

  // Re-apply when global defaults are saved on the Preferences page.
  useEffect(() => {
    const onPrefsSaved = () => {
      void loadFilterPrefs().then((next) => {
        if (next) setFilters(next);
      });
    };
    window.addEventListener("apex:filter-prefs-saved", onPrefsSaved);
    return () => window.removeEventListener("apex:filter-prefs-saved", onPrefsSaved);
  }, [loadFilterPrefs]);

  // Apply + persist the user's filter selection.
  const handleFilterChange = useCallback(
    (next: FilterState) => {
      setFilters(next);
      if (currentDashboardId) saveFilterPrefs(currentDashboardId, next);
    },
    [currentDashboardId]
  );

  // Reset active page when route changes
  const effectivePageId = activePageId && pages.some(p => p.pageId === activePageId)
    ? activePageId
    : pages[0]?.pageId;

  // Close the assistant rail / summary modal when navigating to a new page.
  useEffect(() => {
    setRailOpen(false);
    setSummaryOpen(false);
  }, [location.pathname, effectivePageId]);

  return (
    <div className="h-full flex">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        {/* Unified dashboard toolbar: page tabs (left) + page actions (right) */}
        {isCustom && (
          <div className="shrink-0 bg-white px-5 pt-3 pb-1 flex items-center justify-between gap-3">
            {isCustom && pages.length > 0 ? (
              <Tabs value={effectivePageId} onValueChange={setActivePageId}>
                <TabsList>
                  {pages.map((page) => (
                    <TabsTrigger key={page.pageId} value={page.pageId}>
                      {page.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSummaryOpen(true)}
                className="gap-1.5 text-indigo-700 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800"
              >
                <Sparkles size={14} />
                <span>Executive Summary</span>
              </Button>
              <Button
                size="sm"
                variant={railOpen ? "default" : "outline"}
                onClick={() => setRailOpen((o) => !o)}
                className="gap-1.5"
              >
                <MessageCircle size={14} />
                <span>Ask APEX</span>
              </Button>
            </div>
          </div>
        )}

        {isCustom && filterKeys.length > 0 && (
          <FilterBar filters={filters} onChange={handleFilterChange} filterKeys={filterKeys} />
        )}

        <div className="flex-1 flex min-h-0">
          <main className="flex-1 flex flex-col min-w-0">
            <Routes>
              {/* Operator-only Service Principal management. The page self-guards
                  via 401/403; the nav entry is hidden for non-operators. */}
              <Route path={ADMIN_ROUTE_PATH} element={<AdminPage />} />
              {ROUTES.map((route) => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={
                    <RouteRenderer
                      route={route}
                      filters={filters}
                      filtersReady={filtersReady}
                      activePageId={effectivePageId}
                      railOpen={railOpen}
                      onRailOpenChange={setRailOpen}
                      summaryOpen={summaryOpen}
                      onSummaryOpenChange={setSummaryOpen}
                    />
                  }
                />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}
