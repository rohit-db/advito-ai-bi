# APEX v2 UI Redesign — Design Spec

**Date:** 2026-03-23
**Branch:** `feature/next-level`
**Status:** Draft

---

## 0. Migration Notes

**Route migration:** All old routes (`/`, `/single`, `/tabbed`, `/ask-apex`) are removed. The default route `/` redirects to `/spend`. No backward compatibility needed — this is a POC.

**Theme token rename:** `--color-apex-purple` → `--color-apex-primary`, `--color-apex-purple-dark` → `--color-apex-primary-dark`. Find-replace across all existing components during implementation.

## 1. Goal

Transform the APEX POC from prototype-grade to demo-ready. The UI should look like a production SaaS product that Advito could ship to clients. Two demo paradigms coexist: native AI/BI dashboard embedding and app-controlled custom pages with filters — both accessible from the sidebar.

## 2. Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Demo modes | Route-based (sidebar determines render mode) | No toggle needed; each sidebar item maps to a render strategy |
| Color palette | Indigo/purple accent (#4f46e5) | Matches Figma mockup, consistent APEX brand |
| Component library | shadcn/ui (Radix + Tailwind) | Industry standard for polished React+Tailwind apps |
| Auth (POC) | `/api/me` endpoint via `w.current_user.me()` | Works in both local dev (PAT) and Databricks App (OBO) |
| Auth (Production) | **FUTURE:** Switch to Databricks App OBO headers for user identity. Implement ABAC via row-level security on `client_id`. The current `/api/me` approach is a POC shortcut — in production, user identity should come from the App platform's auth layer, not a separate API call. |
| Filters | Simplified (Date range + Currency + Category) with expandable Advanced section | Start simple, iterate later |
| Chat on dashboards | Slide-in right sidebar (Genie-powered, context-aware) | Quick Q&A while viewing dashboards |
| Chat on APEX Q&A | Full-page centered chat (MAS-powered) | Power-user experience with visible tool calls and agent handoffs |
| Routing | `react-router-dom` BrowserRouter with config-driven routes | Already in package.json (v7.13); enables deep linking, URL reflects current page, refresh persistence |

## 3. Sidebar Navigation

Matches the Figma mockup. Two sections with distinct behaviors.

### INSIGHTS & ANALYTICS

| Item | Route | Render Mode | Description |
|------|-------|-------------|-------------|
| Spend | `/spend` | Native AI/BI | Full multi-page dashboard iframe. Dashboard handles its own tabs, filters, everything. |
| Spend Custom | `/spend-custom` | App-Controlled | App tab bar + filter bar + per-page iframes with clipped Databricks headers. |
| Suppliers | `/suppliers` | Placeholder | "Coming Soon" card |
| General MGT | `/general-mgt` | Placeholder | "Coming Soon" card |
| Compliance | `/compliance` | Placeholder | "Coming Soon" card |
| Well-Being | `/well-being` | Placeholder | "Coming Soon" card |
| Sustainability | `/sustainability` | App-Controlled | App tab bar + filter bar + per-page iframes with clipped Databricks headers. |
| Engage | `/engage` | Placeholder | "Coming Soon" card |

### EXPLORATION

| Item | Route | Render Mode | Description |
|------|-------|-------------|-------------|
| Reports | `/reports` | Placeholder | "Coming Soon" card |
| Data Store | `/data-store` | Placeholder | "Coming Soon" card |
| APEX Q&A | `/apex-qa` | Custom React | Full-page MAS chat (Chainlit-style) |
| Community | `/community` | Placeholder | "Coming Soon" card |

## 4. Render Modes

### 4.1 Native AI/BI (Spend)

- Full iframe embed of the multi-page dashboard
- No app-controlled tab bar or filter bar
- Dashboard's own navigation and filters are visible
- "Ask APEX" slide-in panel still available
- Simplest path — demonstrates "out of the box" embedding

### 4.2 App-Controlled (Sustainability, Spend Custom)

- **Tab Bar:** App renders a shadcn Tabs component mapping to dashboard page IDs. Active tab has filled pill style. Clicking a tab swaps the embedded iframe URL to the corresponding page.
- **Filter Bar:** Simplified filters (Date range, Currency, Category) with "+ Advanced" expandable section. Filters are passed to the dashboard via URL parameters (`f_{pageId}~{widgetId}={value}`) and to Genie as context text.
- **Content:** Per-page iframes with CSS clipping to hide Databricks tab headers (48px negative margin-top). Each page gets its own iframe URL.
- Demonstrates the "fully native" experience — user sees no Databricks chrome.

**Tab mapping (Sustainability):**
- SUMMARY → summary page ID
- COMPARATIVE ACTIVITY → comparative page ID
- CARBON BUDGETS → carbon budgets page ID
- FORECASTING → carbon forecasting page ID

**Tab mapping (Spend Custom):** Same pages as Sustainability but focused on spend KPIs. Tab labels: SUMMARY, TOTAL TRIP, EXPENSE ANALYSIS. (Page IDs to be configured from the dashboard.)

### 4.3 Custom React (APEX Q&A)

- Full-page centered chat layout (no iframe)
- MAS-powered via `POST /api/mas/chat` SSE streaming
- Visible tool calls (amber cards), agent handoffs (indigo cards), streaming text
- User avatar with initials from authenticated user
- APEX avatar with gradient branding
- No sidebar chat panel on this page (chat IS the page)

### 4.4 Placeholder

- Clean "Coming Soon" card centered in the content area
- Page title, brief description, subtle icon
- Consistent with APEX branding

## 5. Component Architecture

### 5.1 Frontend Components

```
frontend/src/
├── components/
│   ├── ui/                    # shadcn/ui components (auto-generated)
│   │   ├── tabs.tsx
│   │   ├── select.tsx
│   │   ├── sheet.tsx
│   │   ├── button.tsx
│   │   ├── avatar.tsx
│   │   ├── badge.tsx
│   │   ├── scroll-area.tsx
│   │   ├── popover.tsx
│   │   └── tooltip.tsx
│   ├── Sidebar.tsx            # Figma-matching nav, client badge, APEX branding
│   ├── Header.tsx             # Dynamic page title, "Ask APEX" button, user avatar+name
│   ├── FilterBar.tsx          # Date range, Currency, Category + Advanced toggle
│   ├── TabBar.tsx             # App-controlled page tabs (shadcn Tabs)
│   ├── ChatPanel.tsx          # Slide-in Genie chat sidebar (shadcn Sheet)
│   └── MarkdownContent.tsx    # Existing markdown renderer
├── pages/
│   ├── NativeDashboard.tsx    # Full iframe embed (AI/BI mode)
│   ├── CustomDashboard.tsx    # Tabbed iframe with clipped headers + filter integration
│   ├── ApexChat.tsx           # Full-page MAS chat (Chainlit-style)
│   └── Placeholder.tsx        # "Coming Soon" page
├── hooks/
│   ├── useChat.ts             # Existing Genie SSE hook
│   ├── useMasChat.ts          # Existing MAS SSE hook
│   └── useUser.ts             # NEW: Fetch /api/me, cache in state
├── lib/
│   └── utils.ts               # shadcn cn() utility
├── config.ts                  # NEW: Route definitions, dashboard IDs, page mappings
├── App.tsx                    # Shell + router logic
├── main.tsx                   # Entry point
└── index.css                  # Tailwind + shadcn theme tokens
```

### 5.2 Key Component Details

**App.tsx** — The shell. Uses `react-router-dom` `<BrowserRouter>` with a single dynamic route that reads from `ROUTES` config. A `<RouteRenderer>` component inspects the current route's `mode` field and renders the appropriate page component. Sidebar + Header render always. Conditionally renders FilterBar and TabBar for app-controlled routes. Manages chat panel open/close state. Default route `/` redirects to `/spend`.

**Sidebar.tsx** — Static nav items matching the Figma mockup. Icons from Lucide. Active item highlighted with indigo fill. Client badge ("CloudVenture") below logo. Compact (200-220px width).

**Header.tsx** — Dynamic: shows current page title on the left. Right side: "Ask APEX" toggle button (not shown on `/apex-qa` route since chat IS the page), user avatar with initials + display name from `useUser()` hook.

**FilterBar.tsx** — Three primary filters:
- **Period:** Date range picker (shadcn Popover + calendar or simple month inputs). Presets: YTD, Last Year, Custom.
- **Currency:** shadcn Select with USD, EUR, GBP options.
- **Category:** shadcn Select with All, Air, Hotel, Rail, Car, Taxi/Rideshare options.
- **"+ Advanced"** expands to show: Emission Methodology, Date Type, Country, Travel Sector, Travel Class.
- **Apply** button commits filter changes. **Clear** resets all.
- Filter state passed to both dashboard iframe (URL params) and Genie chat (context string).

**Filter state TypeScript interface:**
```typescript
export interface FilterState {
  periodFrom?: string;   // "2024-01" format
  periodTo?: string;     // "2025-12" format
  currency: "USD" | "EUR" | "GBP";
  category: "All" | "Air" | "Hotel" | "Rail" | "Car" | "Taxi/Rideshare";
  // Advanced (collapsed by default)
  emissionMethodology?: "ADVITO" | "DEFRA" | "ADVITO_wo_RF";
  dateType?: "invoice_date" | "travel_start_date";
  country?: string;
  travelSector?: string;
  travelClass?: string;
}
```

**Filter-to-URL encoding:** Filters are encoded as Lakeview URL params: `f_{pageId}~{widgetId}={value}`. The `PageConfig.filterWidgets` map provides the mapping from filter name (matching `FilterState` keys) to widget ID. Widget IDs must be extracted from the dashboard during implementation — mark as `"TODO"` in config until populated.

**ChatPanel.tsx** — shadcn Sheet (right side, 380px). Uses overlay/portal pattern (Sheet slides over content, does not push it). Gradient header with APEX branding. Context pills showing current page + active filters. Message thread with user bubbles (right) and APEX responses (left, with avatar). Suggestion chips when empty. SQL toggle and data table inline. Input bar at bottom. Conversation resets when `activePath` changes (prevents stale context).

**ChatPanel props:**
```typescript
interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activePath: string;       // current route, for context pills
  activePageLabel: string;  // human-readable page name
  filterContext: string;    // serialized filter state for Genie
}
```

**CustomDashboard.tsx** — Receives a config object defining tabs (label + page ID + filter widget IDs). Renders TabBar + content area. Each tab maps to an iframe URL. CSS clips the Databricks header (48px). Filter state from FilterBar is encoded into URL params per the Lakeview format.

**ApexChat.tsx** — Centered layout (max-width 800px). APEX header with branding. Message thread with:
- User messages (right, with initials avatar)
- Tool call indicators (amber, collapsible)
- Agent handoff indicators (indigo)
- APEX responses (left, with gradient avatar, rich content)
- Streaming cursor animation
- Follow-up suggestion chips
- Input bar at bottom center with rounded pill style

**Placeholder.tsx** — Centered card with icon, title, "This module is coming soon" message.

### 5.3 Backend Changes

**New endpoint: `GET /api/me`**

```python
@router.get("/me")
def get_current_user():
    w = get_workspace_client()
    user = w.current_user.me()
    return {
        "displayName": user.display_name,
        "email": user.user_name,
        "initials": compute_initials(user.display_name),
    }
```

**No other backend changes.** Existing `/api/chat` (Genie) and `/api/mas/chat` (MAS) endpoints remain as-is.

### 5.4 New Hook: `useUser()`

Fetches `/api/me` on mount, caches the result. Returns `{ displayName, email, initials, isLoading, error }`. On error, falls back to displaying a generic user icon (no name). Used by Header and ApexChat for user display.

**`compute_initials` utility** (server-side helper in `server/routes/api.py`):
```python
def compute_initials(display_name: str) -> str:
    parts = (display_name or "").split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return (parts[0][0] if parts else "?").upper()
```

## 6. Configuration

Centralize route and dashboard config in `frontend/src/config.ts`:

```typescript
export const WORKSPACE = "https://dbc-1e27e56a-90cd.cloud.databricks.com";
export const ORG = "1048934788948873";

export const DASHBOARDS = {
  multiPage: "01f11c0671df190d96063a4632a3611a",
  singlePage: "01f1169e4b5810418541b22a792aa916",
};

export type PageConfig = {
  label: string;
  pageId: string;
  filterWidgets?: Record<string, string>; // filter name → widget ID
};

// Icon lookup map — maps string names to Lucide components
export const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  DollarSign, Users, TrendingUp, ShieldCheck, Heart, Leaf, Zap,
  FileText, Database, MessageCircle, UsersRound,
};

export type RouteConfig = {
  path: string;
  label: string;
  icon: string; // Key into ICON_MAP (e.g., "DollarSign")
  section: "insights" | "exploration";
  mode: "native" | "custom" | "react" | "placeholder";
  dashboardId?: string;
  pages?: PageConfig[];
};

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
    pages: [/* page configs with IDs */],
  },
  // ... etc
];
```

This makes adding new dashboard pages or changing IDs a config change, not a code change.

## 7. Styling

### Theme Tokens (index.css)

```css
@theme {
  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  /* APEX brand */
  --color-apex-primary: #4f46e5;
  --color-apex-primary-dark: #3730a3;
  --color-apex-primary-light: #e0e7ff;
  /* Sidebar */
  --color-apex-sidebar: #1e1b4b;
  --color-apex-sidebar-hover: #312e81;
  /* Surfaces */
  --color-apex-bg: #f8fafc;
  --color-apex-border: #e2e8f0;
  /* Chat */
  --color-apex-chat-gradient-from: #4f46e5;
  --color-apex-chat-gradient-to: #6366f1;
}
```

### shadcn/ui Setup (Tailwind v4)

The project uses Tailwind CSS v4.1 with the `@tailwindcss/vite` plugin (CSS-first config, no `tailwind.config.js`). shadcn/ui supports Tailwind v4 — the init wizard detects v4 and generates the appropriate config.

**Initialization:**
```bash
cd frontend
npx shadcn@latest init
# Select: New York style, Zinc base color, CSS variables: yes
```

This creates `components.json` and adds shadcn's required CSS variables to `index.css`. shadcn v4 uses HSL-format CSS variables (e.g., `--primary: 239 84% 67%` for indigo). These must be mapped to the APEX brand:

```css
/* shadcn required variables — map to APEX indigo */
:root {
  --primary: 239 84% 67%;         /* #4f46e5 */
  --primary-foreground: 0 0% 100%; /* white */
  --background: 210 40% 98%;       /* #f8fafc */
  --border: 214 32% 91%;           /* #e2e8f0 */
  --ring: 239 84% 67%;             /* focus ring = primary */
  /* ... shadcn generates the full set, we override the key ones */
}
```

**Add components:**
```bash
npx shadcn@latest add tabs select sheet button avatar badge scroll-area popover tooltip
```

Components land in `frontend/src/components/ui/` and are customized via Tailwind classes.

## 8. Data Flow

```
User clicks sidebar item
  → App.tsx reads route config
  → Determines render mode (native | custom | react | placeholder)
  → Renders appropriate page component

User changes filters (custom mode)
  → FilterBar updates filter state
  → CustomDashboard rebuilds iframe URL with filter params
  → ChatPanel receives filter context string

User clicks "Ask APEX" (dashboard pages)
  → ChatPanel (Sheet) slides in from right
  → Context pills show current page + filters
  → User message sent to POST /api/chat with context prefix
  → Genie SSE response streamed back

User navigates to APEX Q&A
  → ApexChat renders full-page
  → Messages sent to POST /api/mas/chat
  → MAS SSE response with tool calls + handoffs streamed
```

## 9. What We're NOT Doing (YAGNI)

- No ABAC / row-level security implementation (future, after POC)
- No filter passthrough to native AI/BI mode (dashboard handles its own)
- No custom chart rendering (we embed AI/BI dashboards, not rebuild them)
- No real-time collaboration or multi-user features
- No mobile responsive design (desktop demo only)
- No dark mode
- No i18n

## 10. Files Changed

### New Files
- `frontend/src/components/ui/*.tsx` — shadcn components (~9 files)
- `frontend/src/components/TabBar.tsx`
- `frontend/src/components/ChatPanel.tsx`
- `frontend/src/pages/NativeDashboard.tsx`
- `frontend/src/pages/CustomDashboard.tsx`
- `frontend/src/pages/ApexChat.tsx`
- `frontend/src/pages/Placeholder.tsx`
- `frontend/src/hooks/useUser.ts`
- `frontend/src/config.ts`
- `frontend/src/lib/utils.ts`

### Modified Files
- `frontend/src/App.tsx` — Rewrite routing logic, add render mode switching
- `frontend/src/components/Sidebar.tsx` — Match Figma mockup nav items
- `frontend/src/components/Header.tsx` — Dynamic title, authenticated user, conditional Ask APEX
- `frontend/src/components/FilterBar.tsx` — Rewrite with shadcn Select, date picker
- `frontend/src/index.css` — Updated theme tokens for shadcn
- `frontend/package.json` — Add shadcn deps (Radix primitives, clsx, tailwind-merge)
- `server/routes/api.py` — Add `/me` endpoint
- `app.yaml` — No changes needed (existing resources sufficient)

### Removed Files
- `frontend/src/pages/Dashboard.tsx` — Replaced by NativeDashboard.tsx
- `frontend/src/pages/TabbedDashboard.tsx` — Replaced by CustomDashboard.tsx
- `frontend/src/pages/MasChat.tsx` — Replaced by ApexChat.tsx
- `frontend/src/components/ChatSection.tsx` — Replaced by ChatPanel.tsx (Sheet-based)

## 11. Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| shadcn/ui + Tailwind v4 compatibility | shadcn supports v4; init detects it. Map shadcn HSL CSS variables to APEX brand colors (see Section 7). Verify after init that components render correctly. |
| Dashboard page IDs may change | Centralized in config.ts, easy to update |
| Genie context injection may not influence results | Existing behavior — this spec doesn't change Genie integration |
| MAS latency (30-60s) | Out of scope for UI redesign — separate optimization track |
