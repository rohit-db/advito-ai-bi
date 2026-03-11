import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import MasChat from "./pages/MasChat";
import TabbedDashboard from "./pages/TabbedDashboard";
import FilterBar, { type Filters } from "./components/FilterBar";
import ChatSection from "./components/ChatSection";

const WORKSPACE = "https://dbc-1e27e56a-90cd.cloud.databricks.com";
const ORG = "1048934788948873";

// Multi-page dashboard (with global filters)
const MULTI_PAGE_DASHBOARD = `${WORKSPACE}/embed/dashboardsv3/01f11c0671df190d96063a4632a3611a?o=${ORG}`;
// Single-page dashboard (no global filter)
const SINGLE_PAGE_DASHBOARD = `${WORKSPACE}/embed/dashboardsv3/01f1169e4b5810418541b22a792aa916?o=${ORG}`;

// Map each sidebar path to a dashboard key
const PAGE_DASHBOARD: Record<string, string> = {
  "/": MULTI_PAGE_DASHBOARD,
  "/single": SINGLE_PAGE_DASHBOARD,
  "/reports": MULTI_PAGE_DASHBOARD,
  "/data-store": SINGLE_PAGE_DASHBOARD,
  "/community": SINGLE_PAGE_DASHBOARD,
};

// Unique dashboards to mount (deduped)
const DASHBOARDS = [
  { key: "multi", url: MULTI_PAGE_DASHBOARD },
  { key: "single", url: SINGLE_PAGE_DASHBOARD },
];

function activeDashboardKey(path: string): string | null {
  const url = PAGE_DASHBOARD[path];
  if (!url) return null;
  return url === MULTI_PAGE_DASHBOARD ? "multi" : "single";
}

// Build a text description of active filters for Genie context
function filtersToContext(filters: Filters): string {
  const parts: string[] = [];
  if (filters.dateFrom) parts.push(`Date from: ${filters.dateFrom}`);
  if (filters.dateTo) parts.push(`Date to: ${filters.dateTo}`);
  if (filters.pickupZip) parts.push(`Pickup Zip: ${filters.pickupZip}`);
  if (filters.paymentType) parts.push(`Payment Type: ${filters.paymentType}`);
  return parts.length > 0
    ? `Active filters: ${parts.join(", ")}`
    : "No filters applied";
}

export default function App() {
  const [activePath, setActivePath] = useState("/");
  const [chatOpen, setChatOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({});

  const showMas = activePath === "/ask-apex";
  const showTabbed = activePath === "/tabbed";
  const showDashboard = !showMas && !showTabbed;
  const currentDashboard = activeDashboardKey(activePath);

  const filterContext = filtersToContext(filters);

  return (
    <div className="h-full flex">
      <Sidebar activePath={activePath} onNavigate={setActivePath} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header chatOpen={chatOpen} onToggleChat={() => setChatOpen(!chatOpen)} />

        {/* App-controlled filter bar — visible on dashboard pages */}
        {showDashboard && <FilterBar filters={filters} onChange={setFilters} />}

        <div className="flex-1 flex min-h-0">
          <main className="flex-1 bg-apex-bg p-0 min-w-0 relative">
            {/* All dashboard iframes stay mounted — toggle via CSS */}
            {DASHBOARDS.map((d) => (
              <div
                key={d.key}
                className="absolute inset-0"
                style={{ visibility: showDashboard && currentDashboard === d.key ? "visible" : "hidden" }}
              >
                <Dashboard dashboardUrl={d.url} />
              </div>
            ))}

            {/* Tabbed dashboard with custom page buttons */}
            {showTabbed && <TabbedDashboard />}

            {/* MasChat only renders when active */}
            {showMas && <MasChat />}
          </main>
          {chatOpen && (
            <ChatSection
              activePath={activePath}
              filterContext={filterContext}
              onClose={() => setChatOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
