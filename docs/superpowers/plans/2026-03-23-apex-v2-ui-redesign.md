# APEX v2 UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the APEX POC UI from prototype-grade to polished, demo-ready SaaS using shadcn/ui, config-driven routing, and distinct render modes (native AI/BI, app-controlled, custom React, placeholder).

**Architecture:** React 19 + Vite + Tailwind v4 + shadcn/ui frontend served by FastAPI backend as a Databricks App. Routes defined in a central config determine which render mode each sidebar item uses. Existing dashboard embed URLs (NYC Taxi data) are used as scaffolding — Advito dashboards swapped in later.

**Tech Stack:** React 19, TypeScript, Vite 7, Tailwind CSS 4.1, shadcn/ui (Radix), react-router-dom 7, Lucide icons, FastAPI, Databricks SDK

**Spec:** `docs/superpowers/specs/2026-03-23-apex-v2-ui-redesign.md`

**Notes:**
- **SPA fallback:** The FastAPI backend (`app.py`) already has a catch-all route that serves `index.html` for any non-file path (`serve_spa`). This means BrowserRouter works in production — no changes needed.
- **react-router-dom v7:** We use the v7 compatibility layer (`BrowserRouter` + `<Routes>`), not the new `createBrowserRouter` data router. Fine for a POC.
- **shadcn init:** If running as an agent, write `components.json` directly instead of running the interactive init. The exact content depends on what shadcn generates for Tailwind v4 — check after running `npx shadcn@latest init` and adapt.
- **Iframe remounting:** Unlike the old `App.tsx` which kept all iframes alive via CSS visibility, the new router unmounts iframes on navigation. This means re-loading when switching back. Acceptable for POC — dashboard loads are ~2-3s. If this becomes a demo issue, we can add a persistence layer later.
- **ScrollArea refs:** shadcn's `ScrollArea` doesn't forward refs to the scrollable viewport. Use a wrapper `div` ref for auto-scroll, or access the viewport via `[data-radix-scroll-area-viewport]` selector.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/config.ts` | Create | Route definitions, dashboard IDs, page configs, icon map, filter types |
| `frontend/src/lib/utils.ts` | Create | shadcn `cn()` utility (clsx + tailwind-merge) |
| `frontend/src/components/ui/*.tsx` | Create | shadcn/ui auto-generated components (~9 files) |
| `frontend/src/index.css` | Modify | shadcn CSS variables + APEX theme tokens |
| `frontend/src/main.tsx` | Modify | Wrap app in BrowserRouter |
| `frontend/src/App.tsx` | Rewrite | Config-driven router, render mode switching, shell layout |
| `frontend/src/components/Sidebar.tsx` | Rewrite | Figma-matching nav from ROUTES config |
| `frontend/src/components/Header.tsx` | Rewrite | Dynamic title, Ask APEX button, authenticated user |
| `frontend/src/hooks/useUser.ts` | Create | Fetch /api/me, cache user info |
| `frontend/src/pages/Placeholder.tsx` | Create | "Coming Soon" page |
| `frontend/src/pages/NativeDashboard.tsx` | Create | Full iframe embed for native AI/BI mode |
| `frontend/src/components/FilterBar.tsx` | Rewrite | shadcn Select/Popover, FilterState interface |
| `frontend/src/pages/CustomDashboard.tsx` | Create | Tabbed iframe with clipped headers + filter URL encoding |
| `frontend/src/pages/ApexChat.tsx` | Create | Full-page MAS chat (Chainlit-style) |
| `frontend/src/components/ChatPanel.tsx` | Create | Slide-in Genie chat (shadcn Sheet) |
| `server/routes/api.py` | Modify | Add GET /api/me endpoint |
| `frontend/tsconfig.app.json` | Modify | Add path alias for `@/` |
| `frontend/vite.config.ts` | Modify | Add path alias for `@/` |
| `frontend/src/pages/Dashboard.tsx` | Delete | Replaced by NativeDashboard.tsx |
| `frontend/src/pages/TabbedDashboard.tsx` | Delete | Replaced by CustomDashboard.tsx |
| `frontend/src/pages/MasChat.tsx` | Delete | Replaced by ApexChat.tsx |
| `frontend/src/components/ChatSection.tsx` | Delete | Replaced by ChatPanel.tsx |

---

## Task 1: Initialize shadcn/ui and Foundation

**Files:**
- Create: `frontend/src/lib/utils.ts`
- Create: `frontend/src/components/ui/*.tsx` (auto-generated)
- Modify: `frontend/src/index.css`
- Modify: `frontend/package.json` (auto by shadcn)
- Modify: `frontend/tsconfig.app.json`
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Add path alias for `@/` imports (required by shadcn)**

In `frontend/tsconfig.app.json`, add inside `compilerOptions`:
```json
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```

In `frontend/vite.config.ts`, add the resolve alias:
```typescript
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
```

- [ ] **Step 2: Initialize shadcn/ui**

```bash
cd frontend
npx shadcn@latest init
```

When prompted: select New York style, Zinc base color, CSS variables: yes. This creates `components.json` and updates `index.css` with shadcn CSS variables.

- [ ] **Step 3: Add required shadcn components**

```bash
cd frontend
npx shadcn@latest add button tabs select sheet avatar badge scroll-area popover tooltip
```

Verify files created in `frontend/src/components/ui/`.

- [ ] **Step 4: Create `lib/utils.ts`**

If shadcn init didn't create it, create manually:
```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: Update index.css with APEX theme overrides**

After shadcn init adds its variables, override the key ones to match APEX brand. In `frontend/src/index.css`, update the `:root` block shadcn generated — set `--primary` to APEX indigo (`239 84% 67%`), `--primary-foreground` to white. Keep the APEX `@theme` block for custom tokens (`--color-apex-sidebar`, `--color-apex-bg`, etc.) and rename `--color-apex-purple` to `--color-apex-primary`, `--color-apex-purple-dark` to `--color-apex-primary-dark`.

- [ ] **Step 6: Verify build compiles**

```bash
cd frontend && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: initialize shadcn/ui with APEX theme and path aliases"
```

---

## Task 2: Config and Route Definitions

**Files:**
- Create: `frontend/src/config.ts`

- [ ] **Step 1: Create config.ts with all route definitions**

```typescript
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import {
  DollarSign, Users, Briefcase, ShieldCheck, Heart, Leaf, Zap,
  FileText, Database, MessageCircle, UsersRound,
} from "lucide-react";

// --- Workspace ---
export const WORKSPACE = "https://dbc-1e27e56a-90cd.cloud.databricks.com";
export const ORG = "1048934788948873";

// --- Dashboards ---
export const DASHBOARDS = {
  multiPage: "01f11c0671df190d96063a4632a3611a",
  singlePage: "01f1169e4b5810418541b22a792aa916",
};

// --- Icon Map ---
export const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  DollarSign, Users, Briefcase, ShieldCheck, Heart, Leaf, Zap,
  FileText, Database, MessageCircle, UsersRound,
};

// --- Types ---
export interface PageConfig {
  label: string;
  pageId: string;
  filterWidgets?: Record<string, string>;
}

export interface RouteConfig {
  path: string;
  label: string;
  icon: string;
  section: "insights" | "exploration";
  mode: "native" | "custom" | "react" | "placeholder";
  dashboardId?: string;
  pages?: PageConfig[];
}

export interface FilterState {
  periodFrom?: string;
  periodTo?: string;
  currency: "USD" | "EUR" | "GBP";
  category: "All" | "Air" | "Hotel" | "Rail" | "Car" | "Taxi/Rideshare";
  emissionMethodology?: "ADVITO" | "DEFRA" | "ADVITO_wo_RF";
  dateType?: "invoice_date" | "travel_start_date";
  country?: string;
  travelSector?: string;
  travelClass?: string;
}

export const DEFAULT_FILTERS: FilterState = {
  currency: "USD",
  category: "All",
};

// --- Embed URL builders ---
export function buildNativeEmbedUrl(dashboardId: string): string {
  return `${WORKSPACE}/embed/dashboardsv3/${dashboardId}?o=${ORG}`;
}

export function buildPageEmbedUrl(
  dashboardId: string,
  pageId: string,
  filters?: Record<string, string>
): string {
  let url = `${WORKSPACE}/embed/dashboardsv3/${dashboardId}/pages/${pageId}?o=${ORG}`;
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value) url += `&${key}=${encodeURIComponent(value)}`;
    }
  }
  return url;
}

// --- Filter context for Genie ---
export function filtersToContext(filters: FilterState): string {
  const parts: string[] = [];
  if (filters.periodFrom) parts.push(`Period from: ${filters.periodFrom}`);
  if (filters.periodTo) parts.push(`Period to: ${filters.periodTo}`);
  if (filters.currency !== "USD") parts.push(`Currency: ${filters.currency}`);
  if (filters.category !== "All") parts.push(`Category: ${filters.category}`);
  return parts.length > 0 ? `Active filters: ${parts.join(", ")}` : "No filters applied";
}

// --- Routes ---
// Page IDs are from the existing NYC Taxi dashboard — will be swapped for Advito dashboards later
export const ROUTES: RouteConfig[] = [
  {
    path: "/spend",
    label: "Spend",
    icon: "DollarSign",
    section: "insights",
    mode: "native",
    dashboardId: DASHBOARDS.multiPage,
  },
  {
    path: "/spend-custom",
    label: "Spend Custom",
    icon: "DollarSign",
    section: "insights",
    mode: "custom",
    dashboardId: DASHBOARDS.multiPage,
    pages: [
      { label: "Summary", pageId: "5a35864d", filterWidgets: {} },
      { label: "Global Filters", pageId: "ceb09eeb", filterWidgets: {} },
      { label: "Detail", pageId: "75ecdc14", filterWidgets: {} },
    ],
  },
  {
    path: "/suppliers",
    label: "Suppliers",
    icon: "Users",
    section: "insights",
    mode: "placeholder",
  },
  {
    path: "/general-mgt",
    label: "General MGT",
    icon: "Briefcase",
    section: "insights",
    mode: "placeholder",
  },
  {
    path: "/compliance",
    label: "Compliance",
    icon: "ShieldCheck",
    section: "insights",
    mode: "placeholder",
  },
  {
    path: "/well-being",
    label: "Well-Being",
    icon: "Heart",
    section: "insights",
    mode: "placeholder",
  },
  {
    path: "/sustainability",
    label: "Sustainability",
    icon: "Leaf",
    section: "insights",
    mode: "custom",
    dashboardId: DASHBOARDS.multiPage,
    pages: [
      { label: "Summary", pageId: "5a35864d", filterWidgets: {} },
      { label: "Comparative", pageId: "ceb09eeb", filterWidgets: {} },
      { label: "Carbon Budgets", pageId: "75ecdc14", filterWidgets: {} },
      { label: "Forecasting", pageId: "TODO", filterWidgets: {} },
    ],
  },
  {
    path: "/engage",
    label: "Engage",
    icon: "Zap",
    section: "insights",
    mode: "placeholder",
  },
  {
    path: "/reports",
    label: "Reports",
    icon: "FileText",
    section: "exploration",
    mode: "placeholder",
  },
  {
    path: "/data-store",
    label: "Data Store",
    icon: "Database",
    section: "exploration",
    mode: "placeholder",
  },
  {
    path: "/apex-qa",
    label: "APEX Q&A",
    icon: "MessageCircle",
    section: "exploration",
    mode: "react",
  },
  {
    path: "/community",
    label: "Community",
    icon: "UsersRound",
    section: "exploration",
    mode: "placeholder",
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/config.ts
git commit -m "feat: add centralized route config with dashboard IDs and filter types"
```

---

## Task 3: Backend — `/api/me` Endpoint

**Files:**
- Modify: `server/routes/api.py`

- [ ] **Step 1: Add `/me` endpoint to api.py**

Add to `server/routes/api.py`:

```python
from fastapi import APIRouter
from ..config import DASHBOARD_URL, MULTI_PAGE_DASHBOARD_URL, get_workspace_client

router = APIRouter()


def compute_initials(display_name: str) -> str:
    parts = (display_name or "").split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return (parts[0][0] if parts else "?").upper()


@router.get("/me")
def get_current_user():
    try:
        w = get_workspace_client()
        user = w.current_user.me()
        return {
            "displayName": user.display_name or user.user_name,
            "email": user.user_name,
            "initials": compute_initials(user.display_name or user.user_name),
        }
    except Exception:
        return {
            "displayName": "Demo User",
            "email": "demo@advito.com",
            "initials": "DU",
        }


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/config")
def get_config():
    return {
        "dashboardUrl": DASHBOARD_URL,
        "multiPageDashboardUrl": MULTI_PAGE_DASHBOARD_URL,
    }
```

- [ ] **Step 2: Test the endpoint**

```bash
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi
python -c "
from server.routes.api import compute_initials
assert compute_initials('Rohit Bhagwat') == 'RB'
assert compute_initials('John') == 'J'
assert compute_initials('') == '?'
print('All assertions passed')
"
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/api.py
git commit -m "feat: add /api/me endpoint for authenticated user display"
```

---

## Task 4: useUser Hook

**Files:**
- Create: `frontend/src/hooks/useUser.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useEffect } from "react";

interface UserInfo {
  displayName: string;
  email: string;
  initials: string;
}

interface UseUserReturn {
  user: UserInfo | null;
  isLoading: boolean;
  error: string | null;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setUser(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err));
          setIsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return { user, isLoading, error };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useUser.ts
git commit -m "feat: add useUser hook for authenticated user display"
```

---

## Task 5: Sidebar Component

**Files:**
- Rewrite: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Rewrite Sidebar.tsx using ROUTES config**

```typescript
import { useLocation, useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ROUTES, ICON_MAP } from "@/config";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const insightsRoutes = ROUTES.filter((r) => r.section === "insights");
  const explorationRoutes = ROUTES.filter((r) => r.section === "exploration");

  const renderItem = (route: typeof ROUTES[number]) => {
    const Icon = ICON_MAP[route.icon];
    const isActive = location.pathname === route.path;

    return (
      <button
        key={route.path}
        onClick={() => navigate(route.path)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150",
          isActive
            ? "bg-apex-primary text-white font-medium shadow-sm"
            : "text-white/60 hover:bg-apex-sidebar-hover hover:text-white/90"
        )}
      >
        {Icon && <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />}
        <span>{route.label}</span>
        {route.mode === "placeholder" && (
          <span className="ml-auto text-[9px] text-white/30 uppercase">soon</span>
        )}
      </button>
    );
  };

  return (
    <aside className="w-[220px] bg-apex-sidebar text-white flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">APEX</span>
          <span className="text-apex-primary text-lg">&#10022;</span>
        </div>
        <div className="text-[9px] text-white/40 tracking-[0.2em] uppercase mt-0.5">
          Advito Practice Exchange
        </div>
      </div>

      {/* Client badge */}
      <div className="px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-white/60">CloudVenture</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {/* Insights & Analytics */}
        <div className="px-3 pt-5">
          <div className="text-[9px] text-white/30 font-semibold tracking-[0.2em] uppercase px-3 mb-2">
            Insights & Analytics
          </div>
          <div className="space-y-0.5">
            {insightsRoutes.map(renderItem)}
          </div>
        </div>

        {/* Exploration */}
        <div className="px-3 pt-6 pb-4">
          <div className="text-[9px] text-white/30 font-semibold tracking-[0.2em] uppercase px-3 mb-2">
            Exploration
          </div>
          <div className="space-y-0.5">
            {explorationRoutes.map(renderItem)}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "feat: rewrite Sidebar with Figma-matching nav from route config"
```

---

## Task 6: Header Component

**Files:**
- Rewrite: `frontend/src/components/Header.tsx`

- [ ] **Step 1: Rewrite Header.tsx with dynamic title and user**

```typescript
import { MessageCircle, User } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/config";
import { useUser } from "@/hooks/useUser";

interface HeaderProps {
  chatOpen: boolean;
  onToggleChat: () => void;
}

export default function Header({ chatOpen, onToggleChat }: HeaderProps) {
  const location = useLocation();
  const { user } = useUser();

  const currentRoute = ROUTES.find((r) => r.path === location.pathname);
  const pageTitle = currentRoute?.label || "APEX";
  const isApexQA = location.pathname === "/apex-qa";

  return (
    <header className="h-12 bg-white border-b border-apex-border flex items-center justify-between px-5 shrink-0">
      <h1 className="text-sm font-semibold text-gray-900">{pageTitle}</h1>

      <div className="flex items-center gap-3">
        {!isApexQA && (
          <Button
            variant={chatOpen ? "default" : "outline"}
            size="sm"
            onClick={onToggleChat}
            className={cn(
              "gap-1.5 text-xs h-8",
              chatOpen && "bg-apex-primary hover:bg-apex-primary-dark"
            )}
          >
            <MessageCircle size={14} />
            Ask APEX
          </Button>
        )}

        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-indigo-100 text-indigo-600 text-[10px] font-semibold">
              {user?.initials || <User size={14} />}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-gray-600 max-w-[120px] truncate">
            {user?.displayName || "Loading..."}
          </span>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Header.tsx
git commit -m "feat: rewrite Header with dynamic title, Ask APEX button, and user avatar"
```

---

## Task 7: Placeholder Page

**Files:**
- Create: `frontend/src/pages/Placeholder.tsx`

- [ ] **Step 1: Create Placeholder.tsx**

```typescript
import { Construction } from "lucide-react";
import { useLocation } from "react-router-dom";
import { ROUTES } from "@/config";

export default function Placeholder() {
  const location = useLocation();
  const route = ROUTES.find((r) => r.path === location.pathname);

  return (
    <div className="flex-1 flex items-center justify-center bg-apex-bg">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <Construction size={28} className="text-indigo-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          {route?.label || "Coming Soon"}
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          This module is under development and will be available in a future release.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Placeholder.tsx
git commit -m "feat: add Placeholder page for Coming Soon routes"
```

---

## Task 8: NativeDashboard Page

**Files:**
- Create: `frontend/src/pages/NativeDashboard.tsx`
- Delete: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Create NativeDashboard.tsx**

```typescript
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface NativeDashboardProps {
  embedUrl: string;
}

export default function NativeDashboard({ embedUrl }: NativeDashboardProps) {
  const [loading, setLoading] = useState(true);

  return (
    <div className="flex-1 relative bg-apex-bg">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-apex-bg z-10">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" />
            Loading dashboard...
          </div>
        </div>
      )}
      <iframe
        src={embedUrl}
        className="w-full h-full border-0"
        title="APEX Dashboard"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Delete old Dashboard.tsx**

```bash
rm frontend/src/pages/Dashboard.tsx
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/NativeDashboard.tsx
git rm frontend/src/pages/Dashboard.tsx
git commit -m "feat: add NativeDashboard with loading state, remove old Dashboard"
```

---

## Task 9: FilterBar Component

**Files:**
- Rewrite: `frontend/src/components/FilterBar.tsx`

- [ ] **Step 1: Rewrite FilterBar.tsx with shadcn Select**

```typescript
import { useState } from "react";
import { Filter, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { FilterState } from "@/config";
import { DEFAULT_FILTERS } from "@/config";

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [draft, setDraft] = useState<FilterState>(filters);

  const hasFilters =
    draft.periodFrom || draft.periodTo ||
    draft.currency !== "USD" || draft.category !== "All";

  const apply = () => onChange(draft);

  const clear = () => {
    const reset = { ...DEFAULT_FILTERS };
    setDraft(reset);
    onChange(reset);
  };

  return (
    <div className="shrink-0 bg-white border-b border-apex-border px-5 py-2.5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Filter size={14} />
        </div>

        {/* Period */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Period</span>
          <input
            type="month"
            value={draft.periodFrom || ""}
            onChange={(e) => setDraft({ ...draft, periodFrom: e.target.value || undefined })}
            className="px-2 py-1 text-xs border border-gray-200 rounded-md bg-gray-50 focus:outline-none focus:ring-1 focus:ring-apex-primary/30 w-[130px]"
          />
          <span className="text-xs text-gray-300">—</span>
          <input
            type="month"
            value={draft.periodTo || ""}
            onChange={(e) => setDraft({ ...draft, periodTo: e.target.value || undefined })}
            className="px-2 py-1 text-xs border border-gray-200 rounded-md bg-gray-50 focus:outline-none focus:ring-1 focus:ring-apex-primary/30 w-[130px]"
          />
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {/* Currency */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Currency</span>
          <Select value={draft.currency} onValueChange={(v) => setDraft({ ...draft, currency: v as FilterState["currency"] })}>
            <SelectTrigger className="h-7 w-[80px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {/* Category */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Category</span>
          <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as FilterState["category"] })}>
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Air">Air</SelectItem>
              <SelectItem value="Hotel">Hotel</SelectItem>
              <SelectItem value="Rail">Rail</SelectItem>
              <SelectItem value="Car">Car</SelectItem>
              <SelectItem value="Taxi/Rideshare">Taxi/Rideshare</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "text-xs font-medium flex items-center gap-1 transition-colors",
            showAdvanced ? "text-apex-primary" : "text-gray-500 hover:text-gray-700"
          )}
        >
          + Advanced
          <ChevronDown size={12} className={cn("transition-transform", showAdvanced && "rotate-180")} />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="h-7 text-xs px-4" onClick={apply}>
            Apply
          </Button>
          {hasFilters && (
            <button onClick={clear} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Advanced filters row */}
      {showAdvanced && (
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Methodology</span>
            <Select value={draft.emissionMethodology || ""} onValueChange={(v) => setDraft({ ...draft, emissionMethodology: (v || undefined) as FilterState["emissionMethodology"] })}>
              <SelectTrigger className="h-7 w-[120px] text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADVITO">ADVITO</SelectItem>
                <SelectItem value="DEFRA">DEFRA</SelectItem>
                <SelectItem value="ADVITO_wo_RF">ADVITO w/o RF</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Date Type</span>
            <Select value={draft.dateType || ""} onValueChange={(v) => setDraft({ ...draft, dateType: (v || undefined) as FilterState["dateType"] })}>
              <SelectTrigger className="h-7 w-[140px] text-xs">
                <SelectValue placeholder="Invoice Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invoice_date">Invoice Date</SelectItem>
                <SelectItem value="travel_start_date">Travel Start Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/FilterBar.tsx
git commit -m "feat: rewrite FilterBar with shadcn Select and Advanced toggle"
```

---

## Task 10: CustomDashboard Page

**Files:**
- Create: `frontend/src/pages/CustomDashboard.tsx`
- Delete: `frontend/src/pages/TabbedDashboard.tsx`

- [ ] **Step 1: Create CustomDashboard.tsx**

```typescript
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PageConfig, FilterState } from "@/config";
import { buildPageEmbedUrl } from "@/config";

const HEADER_OFFSET = 48;

interface CustomDashboardProps {
  dashboardId: string;
  pages: PageConfig[];
  filters: FilterState;
}

export default function CustomDashboard({ dashboardId, pages, filters }: CustomDashboardProps) {
  const [activeTab, setActiveTab] = useState(pages[0]?.label || "");
  const [loadingPages, setLoadingPages] = useState<Set<string>>(new Set(pages.map((p) => p.label)));

  const activePage = pages.find((p) => p.label === activeTab) || pages[0];

  // Build filter URL params from FilterState + page widget mappings
  const buildFilterParams = (page: PageConfig): Record<string, string> => {
    const params: Record<string, string> = {};
    if (page.filterWidgets) {
      for (const [filterKey, widgetId] of Object.entries(page.filterWidgets)) {
        const value = (filters as Record<string, unknown>)[filterKey];
        if (value && widgetId) {
          params[`f_${page.pageId}~${widgetId}`] = String(value);
        }
      }
    }
    return params;
  };

  const handleIframeLoad = (label: string) => {
    setLoadingPages((prev) => {
      const next = new Set(prev);
      next.delete(label);
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="shrink-0 bg-white border-b border-apex-border px-5 py-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-100/80">
            {pages.map((page) => (
              <TabsTrigger key={page.label} value={page.label} className="text-xs">
                {page.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Dashboard iframes — clip Lakeview tab headers */}
      <div className="flex-1 relative overflow-hidden bg-apex-bg">
        {pages.map((page) => {
          const isActive = page.label === activePage?.label;
          const url = buildPageEmbedUrl(dashboardId, page.pageId, buildFilterParams(page));
          const isLoading = loadingPages.has(page.label);

          return (
            <div
              key={page.pageId}
              className="absolute inset-0"
              style={{
                visibility: isActive ? "visible" : "hidden",
                overflow: "hidden",
              }}
            >
              {isLoading && isActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-apex-bg z-10">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 size={16} className="animate-spin" />
                    Loading {page.label}...
                  </div>
                </div>
              )}
              <iframe
                src={url}
                className="w-full border-0"
                title={`Dashboard - ${page.label}`}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                onLoad={() => handleIframeLoad(page.label)}
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
```

- [ ] **Step 2: Delete old TabbedDashboard.tsx**

```bash
rm frontend/src/pages/TabbedDashboard.tsx
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/CustomDashboard.tsx
git rm frontend/src/pages/TabbedDashboard.tsx
git commit -m "feat: add CustomDashboard with shadcn Tabs and clipped iframes, remove TabbedDashboard"
```

---

## Task 11: ApexChat Page (Full-page MAS Chat)

**Files:**
- Create: `frontend/src/pages/ApexChat.tsx`
- Delete: `frontend/src/pages/MasChat.tsx`

- [ ] **Step 1: Create ApexChat.tsx**

```typescript
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Wrench, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import MarkdownContent from "@/components/MarkdownContent";
import { useMasChat, type MasMessage } from "@/hooks/useMasChat";
import { useUser } from "@/hooks/useUser";

const SUGGESTIONS = [
  "What are the top routes by emissions?",
  "Show total spend by category for 2025",
  "Compare hotel costs across regions",
  "Which travelers have the highest carbon footprint?",
];

export default function ApexChat() {
  const { messages, isLoading, streamingContent, sendMessage, clearChat } = useMasChat();
  const { user } = useUser();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleSuggestion = (q: string) => {
    if (isLoading) return;
    sendMessage(q);
  };

  const renderMessage = (msg: MasMessage, idx: number) => {
    // Tool call indicator
    if (msg.toolCall) {
      return (
        <div key={idx} className="flex justify-center">
          <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700 gap-1.5 py-1 px-3 text-xs font-normal">
            <Wrench size={12} />
            {msg.toolCall.name}
          </Badge>
        </div>
      );
    }

    // Agent handoff indicator
    if (msg.agentHandoff) {
      return (
        <div key={idx} className="flex justify-center">
          <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700 gap-1.5 py-1 px-3 text-xs font-normal">
            <ArrowRightLeft size={12} />
            Routed to: {msg.agentHandoff}
          </Badge>
        </div>
      );
    }

    // User message
    if (msg.role === "user") {
      return (
        <div key={idx} className="flex justify-end gap-2">
          <div className="bg-white border border-gray-200 rounded-2xl rounded-br-md px-4 py-2.5 max-w-[70%] shadow-sm">
            <p className="text-sm text-gray-900">{msg.content}</p>
          </div>
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-indigo-100 text-indigo-600 text-[10px] font-semibold">
              {user?.initials || "U"}
            </AvatarFallback>
          </Avatar>
        </div>
      );
    }

    // Assistant message
    return (
      <div key={idx} className="flex gap-2">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[10px]">
            &#10022;
          </AvatarFallback>
        </Avatar>
        <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[70%] shadow-sm">
          <MarkdownContent content={msg.content} />
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50/50">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm">
            &#10022;
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">APEX Intelligence</h2>
            <p className="text-[11px] text-gray-500">Multi-agent supervisor &middot; Genie-powered</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs text-gray-400"
            onClick={clearChat}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="max-w-3xl mx-auto py-6 px-6 space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl">
                &#10022;
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Ask APEX anything</h3>
              <p className="text-sm text-gray-500 mb-6">
                Powered by multi-agent AI — routes your questions to specialized data agents.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestion(q)}
                    className="px-4 py-2 text-xs text-indigo-600 bg-white border border-gray-200 rounded-full hover:border-indigo-300 hover:bg-indigo-50 transition-colors shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(renderMessage)}

          {/* Streaming content */}
          {streamingContent && (
            <div className="flex gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[10px]">
                  &#10022;
                </AvatarFallback>
              </Avatar>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[70%] shadow-sm">
                <MarkdownContent content={streamingContent} />
                <span className="inline-block w-1.5 h-4 bg-indigo-500 animate-pulse ml-0.5 align-middle rounded-sm" />
              </div>
            </div>
          )}

          {isLoading && !streamingContent && (
            <div className="flex items-center gap-2 text-sm text-gray-400 justify-center py-2">
              <Loader2 size={14} className="animate-spin" /> Thinking...
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="shrink-0 bg-white border-t border-gray-200 px-6 py-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-apex-primary/20 focus-within:border-apex-primary/40 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message APEX..."
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !input.trim()}
              className="h-8 w-8 p-0 rounded-xl"
            >
              <Send size={14} />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete old MasChat.tsx**

```bash
rm frontend/src/pages/MasChat.tsx
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ApexChat.tsx
git rm frontend/src/pages/MasChat.tsx
git commit -m "feat: add ApexChat full-page MAS chat with Chainlit-style UI, remove MasChat"
```

---

## Task 12: ChatPanel (Slide-in Genie Sidebar)

**Files:**
- Create: `frontend/src/components/ChatPanel.tsx`
- Delete: `frontend/src/components/ChatSection.tsx`

- [ ] **Step 1: Create ChatPanel.tsx**

```typescript
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Code, Trash2, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import MarkdownContent from "@/components/MarkdownContent";
import { useChat, type ChatMessage } from "@/hooks/useChat";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activePath: string;
  activePageLabel: string;
  filterContext: string;
}

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  "/spend": [
    "What are the top 5 routes by revenue?",
    "How many trips happened last month?",
    "What is the average fare by day of week?",
  ],
  "/spend-custom": [
    "Compare revenue across routes",
    "What are the busiest pickup zones?",
    "Show fare distribution by trip distance",
  ],
  "/sustainability": [
    "Top routes by emissions?",
    "Compare emissions vs previous period",
    "Which category grew most?",
  ],
};

const DEFAULT_SUGGESTIONS = [
  "Show me total trips",
  "What are the top routes by revenue?",
  "Average fare by day of week?",
];

function DataTable({ data }: { data: NonNullable<ChatMessage["data"]> }) {
  return (
    <div className="overflow-auto max-h-48 mt-2 rounded-md border border-gray-200 text-xs">
      <table className="w-full">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {data.columns.map((col) => (
              <th key={col.name} className="px-2 py-1.5 text-left font-medium text-gray-600 whitespace-nowrap">
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/50">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ChatPanel({ isOpen, onClose, activePath, activePageLabel, filterContext }: ChatPanelProps) {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const [input, setInput] = useState("");
  const [showSql, setShowSql] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevPathRef = useRef(activePath);

  const suggestions = PAGE_SUGGESTIONS[activePath] || DEFAULT_SUGGESTIONS;
  const hasFilters = filterContext !== "No filters applied";
  const fullContext = `Dashboard: ${activePageLabel}. ${filterContext}`;

  // Reset conversation when page changes
  useEffect(() => {
    if (prevPathRef.current !== activePath) {
      clearChat();
      prevPathRef.current = activePath;
    }
  }, [activePath, clearChat]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim(), fullContext);
    setInput("");
  };

  const handleSuggestion = (q: string) => {
    if (isLoading) return;
    sendMessage(q, fullContext);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[400px] p-0 flex flex-col gap-0" side="right">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-sm">&#10022;</div>
              <div>
                <SheetTitle className="text-sm font-semibold text-white">Ask APEX</SheetTitle>
                <p className="text-[10px] text-white/70">AI-powered travel intelligence</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10" onClick={clearChat}>
                <Trash2 size={13} />
              </Button>
            </div>
          </div>
        </div>

        {/* Context pills */}
        <div className="px-4 py-2 border-b border-gray-100 flex gap-1.5 flex-wrap">
          <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-700 border-0">
            {activePageLabel}
          </Badge>
          {hasFilters && (
            <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700 border-0">
              {filterContext}
            </Badge>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3 pt-4">
                <p className="text-xs text-gray-400 text-center">Ask about what you're viewing</p>
                <div className="space-y-1.5">
                  {suggestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSuggestion(q)}
                      className="w-full text-left px-3 py-2 text-xs text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded-xl transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2",
                  msg.role === "user"
                    ? "bg-apex-primary text-white rounded-br-md"
                    : "bg-gray-100 text-gray-800 rounded-bl-md"
                )}>
                  {msg.role === "user" ? (
                    <p className="text-xs">{msg.content}</p>
                  ) : (
                    <MarkdownContent content={msg.content} compact />
                  )}
                  {msg.sql && (
                    <button
                      onClick={() => setShowSql(showSql === i ? null : i)}
                      className={cn(
                        "flex items-center gap-1 mt-1 text-[10px]",
                        msg.role === "user" ? "text-white/70 hover:text-white" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      <Code size={10} /> {showSql === i ? "Hide SQL" : "Show SQL"}
                    </button>
                  )}
                  {showSql === i && msg.sql && (
                    <pre className="mt-1 p-2 bg-gray-800 text-green-300 rounded-md text-[10px] overflow-auto max-h-28">
                      {msg.sql}
                    </pre>
                  )}
                  {msg.data && <DataTable data={msg.data} />}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Loader2 size={12} className="animate-spin" /> Thinking...
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100">
          <div className="flex gap-2 items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-apex-primary/20">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your data..."
              className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-gray-400"
              disabled={isLoading}
            />
            <Button type="submit" size="sm" disabled={isLoading || !input.trim()} className="h-7 w-7 p-0 rounded-lg">
              <Send size={12} />
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Delete old ChatSection.tsx**

```bash
rm frontend/src/components/ChatSection.tsx
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatPanel.tsx
git rm frontend/src/components/ChatSection.tsx
git commit -m "feat: add ChatPanel slide-in Sheet with gradient header, remove ChatSection"
```

---

## Task 13: App Shell — Rewrite App.tsx and main.tsx

**Files:**
- Rewrite: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Update main.tsx with BrowserRouter**

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 2: Rewrite App.tsx with config-driven routing**

```typescript
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
import { ROUTES, buildNativeEmbedUrl, filtersToContext, DEFAULT_FILTERS } from "@/config";
import type { FilterState, RouteConfig } from "@/config";

function RouteRenderer({ route, filters }: { route: RouteConfig; filters: FilterState }) {
  switch (route.mode) {
    case "native":
      return <NativeDashboard embedUrl={buildNativeEmbedUrl(route.dashboardId!)} />;
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
  const showFilters = currentRoute?.mode === "custom";
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

        {showFilters && <FilterBar filters={filters} onChange={setFilters} />}

        <div className="flex-1 flex min-h-0">
          <main className="flex-1 flex flex-col min-w-0">
            <Routes>
              <Route path="/" element={<Navigate to="/spend" replace />} />
              {ROUTES.map((route) => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={<RouteRenderer route={route} filters={filters} />}
                />
              ))}
            </Routes>
          </main>
        </div>
      </div>

      {/* Chat panel — available on all pages except APEX Q&A */}
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
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/main.tsx
git commit -m "feat: rewrite App shell with BrowserRouter and config-driven render modes"
```

---

## Task 14: Update Hook Imports and Final Cleanup

**Files:**
- Modify: `frontend/src/hooks/useChat.ts` (update import paths if needed)
- Modify: `frontend/src/hooks/useMasChat.ts` (update import paths if needed)
- Modify: `frontend/src/components/MarkdownContent.tsx` (no changes expected, verify)

- [ ] **Step 1: Verify existing hooks work with `@/` imports**

Check that `useChat.ts` and `useMasChat.ts` don't need import path changes (they have no internal imports beyond React). MarkdownContent should work as-is.

- [ ] **Step 2: Full build + type check**

```bash
cd frontend && npm run build
```

Expected: Build succeeds with zero errors.

- [ ] **Step 3: Test locally**

```bash
# Terminal 1: Start backend
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi
python -m uvicorn app:app --host 0.0.0.0 --port 8000

# Terminal 2: Start frontend dev server
cd /Users/rohit.bhagwat/Documents/github/advito-ai-bi/frontend
npm run dev
```

Open http://localhost:5173 and verify:
- Sidebar renders with all nav items matching Figma
- `/` redirects to `/spend`
- `/spend` shows native dashboard iframe with loading indicator
- `/spend-custom` shows tab bar + filter bar + clipped iframe
- `/sustainability` shows tab bar + filter bar + clipped iframe
- `/apex-qa` shows full-page chat UI
- Placeholder pages show "Coming Soon"
- Header shows authenticated user (or "Demo User" fallback)
- "Ask APEX" button opens slide-in Sheet chat panel
- Filters Apply/Clear work

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build/runtime issues from UI redesign"
```

---

## Task 15: Build Production Bundle and Final Commit

**Files:**
- Modify: `frontend/dist/` (rebuilt)

- [ ] **Step 1: Build production bundle**

```bash
cd frontend && npm run build
```

- [ ] **Step 2: Verify dist output**

```bash
ls frontend/dist/
ls frontend/dist/assets/
```

Expected: `index.html` and JS/CSS bundles in `assets/`.

- [ ] **Step 3: Final commit**

```bash
git add frontend/dist/
git commit -m "build: production bundle for APEX v2 UI redesign"
```
