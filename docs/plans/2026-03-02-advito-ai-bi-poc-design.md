# Advito AI-BI POC — Design Doc

**Date:** 2026-03-02
**Author:** Rohit Bhagwat
**Account:** BCD Travel / Advito
**Status:** Approved

## Goal

Build a POC Databricks App that demonstrates AI/BI dashboard embedding + Genie-powered "Ask APEX" chat, deployed to the BCD customer workspace. Proves out white-labeling, embedding, and streaming capabilities so BCD can confidently move from POC → build phase.

## Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Tech stack | FastAPI + React/Vite | Proven pattern from bcd-shopping-app, familiar to team |
| Architecture | Single Databricks App (phased) | Phase 1: Genie API chat. Phase 2: MAS serving endpoint |
| Dashboard | NYC Taxi Trip (published) | Simple, available, proves embedding mechanics |
| MAS approach | Real MAS on BCD workspace | Proves full stack in customer environment |
| Chat UX | Collapsible right-side section | Docked panel that pushes dashboard content, not a popup |

## Architecture

```
BCD Workspace (https://dbc-1e27e56a-90cd.cloud.databricks.com)
└── Databricks App: advito-ai-bi
    ├── FastAPI (Python)
    │   ├── GET /               → serves React SPA
    │   ├── POST /api/chat      → SSE stream (Genie API → Phase 2: MAS)
    │   ├── GET /api/health     → health check
    │   └── Static files        → frontend/dist/
    ├── React/Vite (TypeScript)
    │   ├── Sidebar (APEX-branded, static React)
    │   ├── Main content area (embedded Lakeview iframe)
    │   └── Ask APEX panel (collapsible right section, SSE streaming)
    └── app.yaml (resources: SQL warehouse)
```

## Project Structure

```
advito-ai-bi/
├── app.yaml                    # Databricks App config
├── app.py                      # FastAPI entry point (serves SPA + API)
├── requirements.txt            # Python dependencies
├── .env                        # Local dev tokens (gitignored)
├── server/
│   ├── config.py               # Settings from env vars
│   ├── routes/
│   │   ├── api.py              # REST endpoints (health, config)
│   │   └── genie.py            # Genie API chat (Phase 1) / MAS (Phase 2)
│   └── sql.py                  # Databricks SQL helpers
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── App.tsx             # Root: router + layout
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── Sidebar.tsx     # APEX nav (Insights & Analytics + Exploration)
│   │   │   ├── Header.tsx      # Client switcher + Ask APEX toggle
│   │   │   ├── ChatSection.tsx # Collapsible right panel (SSE streaming)
│   │   │   └── KpiCard.tsx     # Metric card with trend
│   │   ├── pages/
│   │   │   └── Dashboard.tsx   # Embedded Lakeview iframe
│   │   └── hooks/
│   │       └── useChat.ts      # SSE streaming hook
│   └── public/
│       └── apex-logo.svg
└── docs/
```

## Frontend Layout

```
┌────────┬──────────────────────────────┬──────────────┐
│        │                              │  Ask APEX    │
│ NAV    │  Embedded Dashboard          │  ──────────  │
│        │  (resizes when panel open)   │  [messages]  │
│ Spend  │                              │  [messages]  │
│ Suppl. │  ┌─────┐ ┌─────┐ ┌─────┐   │  [messages]  │
│ Demand │  │ KPI │ │ KPI │ │ KPI │   │              │
│ Compl. │  └─────┘ └─────┘ └─────┘   │  ──────────  │
│ Well-B │                              │  [Type...]   │
│ Sustai │  [Charts...]                 │  [Send]      │
│ Engage │                              │              │
│────────│                              │              │
│ Report │                              │              │
│ Data   │                              │              │
│ Q&A    │                              │              │
└────────┴──────────────────────────────┴──────────────┘
  ~200px    ← main content flexes →       ~350px
```

- Sidebar: Static React component, APEX-branded, two sections (Insights & Analytics + Exploration)
- Main: Embedded Lakeview dashboard via iframe (`/embed/dashboardsv3/...`)
- Ask APEX: Collapsible right section (~350px). Toggles via header button. Dashboard content resizes.
- Header: APEX logo, client name (CloudVenture), Ask APEX toggle button, user avatar

## Backend (Phase 1: Genie API)

```
POST /api/chat
Content-Type: application/json
Body: { "message": "What are the top pickup locations?", "conversation_id": "optional" }

Response: text/event-stream (SSE)
→ data: {"type": "text", "content": "Based on the data..."}
→ data: {"type": "query", "description": "Top pickup locations", "sql": "SELECT...", "data": [...]}
→ data: [DONE]
```

Auth:
- Production (Databricks App): OBO token from `X-Forwarded-Access-Token`
- Local dev: PAT from `.env`

## Backend (Phase 2: MAS Upgrade)

Same SSE contract to frontend. Backend switches from Genie API to MAS serving endpoint:

```
POST /api/chat → FastAPI → POST {workspace}/serving-endpoints/{mas-endpoint}/invocations
                         → Stream: True
                         → Accept: text/event-stream
```

MAS supervisor (OpenAI Agents SDK) routes to:
- NYC Taxi Genie Space (data Q&A)
- Knowledge Assistant (docs/help)

## app.yaml

```yaml
command:
  - "python"
  - "-m"
  - "uvicorn"
  - "app:app"
  - "--host"
  - "0.0.0.0"
  - "--port"
  - "8000"
env:
  - name: DASHBOARD_URL
    value: "https://dbc-1e27e56a-90cd.cloud.databricks.com/embed/dashboardsv3/01f1169e4b5810418541b22a792aa916/published?o=1048934788948873"
  - name: GENIE_SPACE_ID
    value: "<to-be-determined>"
resources:
  - name: sql-warehouse
    sql_warehouse:
      id: "<to-be-determined>"
      permission: CAN_USE
```

## Requirements Tested

| REQ | Test | Method |
|-----|------|--------|
| REQ-1 | White-label branding | App says "Ask APEX" — check if iframe leaks "Genie" |
| REQ-2 | "Powered by Databricks" | Inspect embedded dashboard for attribution |
| REQ-3 | Console redirect links | Click through embedded dashboard for workspace links |
| REQ-4 | RBAC | Sidebar routing to different dashboards per simulated role |
| REQ-6 | Layout controls | Responsive iframe + collapsible chat panel behavior |
| REQ-7 | MAS streaming | Phase 2: SSE from MAS endpoint to React chat |
| REQ-8 | Unified chat | "Ask APEX" as single branded chat interface |
| REQ-9 | Filter passthrough | URL parameters on dashboard embed URL |

## Phases

### Phase 1 — Embedding + Genie Chat
1. Scaffold FastAPI + React/Vite project
2. Build APEX-branded sidebar + header
3. Embed NYC Taxi published dashboard in iframe
4. Build collapsible Ask APEX chat section with SSE
5. Connect chat to Genie API
6. Test locally with PAT
7. Deploy to BCD workspace
8. Document embedding behaviors (REQ-1, 2, 3, 6, 9)

### Phase 2 — MAS Upgrade
1. Build MAS supervisor agent (OpenAI Agents SDK)
2. Register as MLflow model
3. Deploy as serving endpoint in BCD workspace
4. Swap /api/chat to call MAS endpoint
5. Test multi-agent routing + streaming
6. Document REQ-7, REQ-8 results

## Key Resources

| Resource | ID |
|----------|----|
| BCD Workspace | https://dbc-1e27e56a-90cd.cloud.databricks.com/?o=1048934788948873 |
| NYC Taxi Dashboard | 01f1169e4b5810418541b22a792aa916 |
| Genie Space | TBD (create for NYC Taxi data) |
| SQL Warehouse | TBD (use existing or create) |

## Dependencies

**Python:** fastapi, uvicorn, databricks-sdk, sse-starlette
**Frontend:** react, react-dom, react-router-dom, tailwindcss, lucide-react, vite
