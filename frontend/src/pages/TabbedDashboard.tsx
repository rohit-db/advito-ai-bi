import { useState, useMemo } from "react";
import { Filter, X } from "lucide-react";

const WORKSPACE = "https://dbc-1e27e56a-90cd.cloud.databricks.com";
const ORG = "1048934788948873";
const DASHBOARD_ID = "01f11c0671df190d96063a4632a3611a";

// Height of the Lakeview tab header to hide (px)
const HEADER_OFFSET = 48;

// Global filter lives on the Global Filters page — applies to ALL pages
// Format: f_{globalPageId}~{widgetId}={value}
const GLOBAL_FILTER_PAGE_ID = "ceb09eeb";
const GLOBAL_FILTERS = {
  route: "30d8fe71", // Route filter widget on Global Filters page
};

// Per-page filter widget IDs
// Format: f_{pageId}~{widgetId}={value}
const PAGES = [
  {
    label: "Summary",
    id: "5a35864d",
    filters: { pickup_zip: "c4e14639", dropoff_zip: "c6fc64a3" },
  },
  {
    label: "Global Filters",
    id: "ceb09eeb",
    filters: { route: "30d8fe71" },
  },
  {
    label: "Detail",
    id: "75ecdc14",
    filters: { pickup_zip: "30da51e5", dropoff_zip: "c8eb25c7" },
  },
];

interface DashboardFilters {
  pickupZip?: string;
  dropoffZip?: string;
  route?: string; // global filter
}

function buildEmbedUrl(
  page: (typeof PAGES)[number],
  filters: DashboardFilters
): string {
  let url = `${WORKSPACE}/embed/dashboardsv3/${DASHBOARD_ID}/pages/${page.id}?o=${ORG}`;

  // Per-page filters: f_{pageId}~{widgetId}={value}
  if (filters.pickupZip && page.filters.pickup_zip) {
    url += `&f_${page.id}~${page.filters.pickup_zip}=${encodeURIComponent(filters.pickupZip)}`;
  }
  if (filters.dropoffZip && page.filters.dropoff_zip) {
    url += `&f_${page.id}~${page.filters.dropoff_zip}=${encodeURIComponent(filters.dropoffZip)}`;
  }

  // Global filter: always uses Global Filters page ID, works on any page
  if (filters.route && GLOBAL_FILTERS.route) {
    url += `&f_${GLOBAL_FILTER_PAGE_ID}~${GLOBAL_FILTERS.route}=${encodeURIComponent(filters.route)}`;
  }

  return url;
}

export default function TabbedDashboard() {
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [filterVersion, setFilterVersion] = useState(0);

  const hasFilters = filters.pickupZip || filters.dropoffZip || filters.route;

  const applyFilters = () => setFilterVersion((v) => v + 1);

  const clearFilters = () => {
    setFilters({});
    setFilterVersion((v) => v + 1);
  };

  const pageUrls = useMemo(
    () => PAGES.map((page) => buildEmbedUrl(page, filters)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterVersion]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Custom tab bar */}
      <div className="shrink-0 bg-white border-b border-apex-border px-4 py-2 flex items-center gap-1">
        <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold mr-3">
          Page
        </span>
        {PAGES.map((page, idx) => (
          <button
            key={page.id}
            onClick={() => setActivePageIdx(idx)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activePageIdx === idx
                ? "bg-apex-purple text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {page.label}
          </button>
        ))}
      </div>

      {/* App-controlled filter bar */}
      <div className="shrink-0 bg-white border-b border-apex-border px-4 py-2 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Filter size={14} />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Filters
          </span>
        </div>

        {/* Global filter: Route */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">Route</label>
          <input
            type="text"
            placeholder="e.g. 10001-10003"
            value={filters.route || ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, route: e.target.value || undefined }))
            }
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="w-28 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-apex-purple/30"
          />
          <span className="text-[10px] text-amber-500 font-medium">GLOBAL</span>
        </div>

        {/* Page filter: Pickup Zip */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">Pickup Zip</label>
          <input
            type="text"
            placeholder="e.g. 7087"
            value={filters.pickupZip || ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, pickupZip: e.target.value || undefined }))
            }
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="w-20 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-apex-purple/30"
          />
        </div>

        {/* Page filter: Dropoff Zip */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">Dropoff Zip</label>
          <input
            type="text"
            placeholder="e.g. 10001"
            value={filters.dropoffZip || ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, dropoffZip: e.target.value || undefined }))
            }
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="w-20 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-apex-purple/30"
          />
        </div>

        <button
          onClick={applyFilters}
          className="px-3 py-1 text-xs font-medium bg-apex-purple text-white rounded hover:bg-apex-purple-dark"
        >
          Apply
        </button>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <X size={12} /> Clear
          </button>
        )}

        {hasFilters && (
          <span className="text-[10px] text-indigo-500 ml-auto">
            Filters applied via URL params & passed to Genie
          </span>
        )}
      </div>

      {/* Dashboard iframes — clip the Lakeview tab headers */}
      <div className="flex-1 relative overflow-hidden">
        {PAGES.map((page, idx) => (
          <div
            key={`${page.id}-${filterVersion}`}
            className="absolute inset-0"
            style={{
              visibility: activePageIdx === idx ? "visible" : "hidden",
              overflow: "hidden",
            }}
          >
            <iframe
              src={pageUrls[idx]}
              className="w-full border-0"
              title={`Dashboard - ${page.label}`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              style={{
                marginTop: `-${HEADER_OFFSET}px`,
                height: `calc(100% + ${HEADER_OFFSET}px)`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
