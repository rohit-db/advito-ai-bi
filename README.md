# APEX — Corporate Travel Intelligence Platform

Embedded analytics platform for Advito (BCD Travel), replacing QuickSight with Databricks-powered dashboards, Genie chat, and AI agents.

**Live POC:** https://advito-ai-bi-1048934788948873.aws.databricksapps.com
**Workspace:** https://dbc-1e27e56a-90cd.cloud.databricks.com

## What This Does

- **Embedded AI/BI Dashboards** — app-controlled tabs and filters via iframe URL parameters
- **Genie Chat ("Ask APEX")** — slide-in panel with filter context on any dashboard page
- **Custom AI Agent** — Claude (FMAPI) + parallel Genie queries for fast executive summaries (~15s vs ~45s sequential)
- **Governed Metric View** — 27 dimensions, 23 measures, single source of truth for all analytics

## Architecture

```
Users → React UI → FastAPI Backend → Databricks Platform
                                      ├── AI/BI Dashboard (iframe embed)
                                      ├── Genie Space (Conversation API)
                                      ├── Claude Sonnet 4.6 (FMAPI)
                                      └── apex.travel_metrics (Metric View)
                                           └── test.summarydataset (1.4M rows)
```

See `docs/architecture/` for detailed diagrams (PNG + editable Mermaid).

## Project Structure

```
advito-ai-bi/
├── app.py                          # FastAPI entry point
├── app.yaml                        # Databricks App config
├── databricks.yml                  # Asset Bundle config
├── requirements.txt                # Python dependencies
│
├── frontend/                       # React + Vite + Tailwind v4
│   └── src/
│       ├── App.tsx                 # Shell + config-driven routing
│       ├── config.ts               # Routes, dashboard IDs, filter logic
│       ├── components/
│       │   ├── Sidebar.tsx         # Collapsible nav (Figma mockup)
│       │   ├── Header.tsx          # Dynamic title + user + Ask APEX
│       │   ├── FilterBar.tsx       # Period, sector, region filters
│       │   ├── ChatPanel.tsx       # Slide-in Genie chat (Sheet)
│       │   └── ui/                 # shadcn-style components
│       ├── pages/
│       │   ├── NativeDashboard.tsx # Full iframe embed (AI/BI mode)
│       │   ├── CustomDashboard.tsx # Tabbed iframe + clipped headers
│       │   ├── ApexChat.tsx        # Full-page MAS chat
│       │   ├── AgentChat.tsx       # Full-page custom agent chat
│       │   └── Placeholder.tsx     # Coming soon pages
│       └── hooks/
│           ├── useChat.ts          # Genie SSE hook
│           ├── useMasChat.ts       # MAS SSE hook
│           └── useAgentChat.ts     # Custom agent SSE hook
│
├── server/                         # FastAPI backend
│   ├── config.py                   # Workspace client, env vars
│   └── routes/
│       ├── api.py                  # /health, /config, /me
│       ├── genie.py                # POST /api/chat (Genie SSE)
│       ├── mas.py                  # POST /api/mas/chat (MAS SSE)
│       └── agent.py                # POST /api/agent/chat (Claude + parallel Genie)
│
├── src/
│   ├── sql/
│   │   ├── create_travel_metrics.sql   # Metric view DDL (YAML v1.1)
│   │   └── validate_travel_metrics.sql # 11 validation queries
│   └── agent/
│       ├── agent.py                # ResponsesAgent for model serving (unused, kept for reference)
│       ├── log_model.py            # MLflow model registration script
│       └── deploy_agent.py         # Model serving deployment script
│
├── resources/
│   └── metric_views.yml            # DABs job resource for metric view
│
└── docs/
    ├── architecture/
    │   ├── apex_architecture.mmd           # Mermaid diagram (editable)
    │   ├── apex_architecture.png           # Python diagrams output
    │   └── embedding-auth-decision.md      # iframe vs SDK vs external auth
    ├── data/
    │   ├── summarydataset_analysis.md      # Source data analysis
    │   ├── metric-view-validation-results.md
    │   ├── genie-space-config.md           # Genie space setup instructions
    │   └── mas-config.md                   # MAS instructions + parallel execution
    ├── poc-tracker.md                      # P0/P1/P2 requirements + status
    ├── requirements.md                     # Original customer requirements
    └── embedding-gaps.md                   # Product gaps + Aha items
```

## Databricks Resources

| Resource | ID / Name |
|----------|-----------|
| Dashboard | `01f1271698161d42b3c66528415775e8` |
| Genie Space | `01f127092d2219f3be10180d79b2ee5d` |
| MAS Endpoint | `mas-d4bc5d36-endpoint` |
| Metric View | `bcd_adv_workspace_poc.apex.travel_metrics` |
| Source Table | `bcd_adv_workspace_poc.test.summarydataset` |
| Schema | `bcd_adv_workspace_poc.apex` |

## Local Development

```bash
# Backend
python -m uvicorn app:app --host 0.0.0.0 --port 8000

# Frontend (separate terminal)
cd frontend && npm run dev
```

Requires `.env` with `workspace_url` and `token` (PAT).

## Deploy to Databricks App

```bash
# Build frontend
cd frontend && npx vite build && cd ..

# Upload and deploy
databricks workspace import-dir frontend/dist /Workspace/Users/rohit.bhagwat@bcdtravel.com/advito-ai-bi/frontend/dist --profile bcd-customer --overwrite
databricks workspace import-dir server /Workspace/Users/rohit.bhagwat@bcdtravel.com/advito-ai-bi/server --profile bcd-customer --overwrite
databricks workspace import /Workspace/Users/rohit.bhagwat@bcdtravel.com/advito-ai-bi/app.yaml --file app.yaml --profile bcd-customer --overwrite --format RAW
databricks workspace import /Workspace/Users/rohit.bhagwat@bcdtravel.com/advito-ai-bi/app.py --file app.py --profile bcd-customer --overwrite --format RAW
databricks apps deploy advito-ai-bi --profile bcd-customer --source-code-path /Workspace/Users/rohit.bhagwat@bcdtravel.com/advito-ai-bi
```

## Known Gaps

| Gap | Status | Details |
|-----|--------|---------|
| "Powered by Databricks" logo | Cannot hide with iframes — requires JS SDK | SDK is alpha, lacks page/filter APIs |
| MAS sequential execution | Worked around with custom agent | Product ask: parallel tool calls |
| OBO authentication | Deferred — using SP auth | Feature branch: `feature/obo-auth` |
| Carbon budget data | NULL in source table | ETL fix needed from Advito team |

## Branches

| Branch | Purpose | Status |
|--------|---------|--------|
| `feature/custom-agent` | **Main working branch** — UI + data + Genie + MAS + custom agent | Active, deployed |
| `feature/next-level` | UI + data layer (no custom agent) | Stable |
| `feature/obo-auth` | OBO authentication experiment | Parked |
| `feature/sdk-embed` | JS SDK embedding experiment | Parked |
| `main` | Original scaffolding | Outdated |
