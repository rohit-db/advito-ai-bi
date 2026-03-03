# Advito AI-BI — Full Requirements & Asks

## Source
- BCD Travel / Advito stakeholders (Ajay Singh, Karan Vora, John Trigg, Malathy)
- Captured by Rohit, Ryan Bates, Gopal
- Slack: https://databricks.enterprise.slack.com/archives/C09T2G70BLH
- Screenshots: see `docs/screenshots/`

## Reference Screenshots

| Screenshot | Description |
|------------|-------------|
| `figma-mockup-apex-v2.jpeg` | **Target state** — Figma mockup of APEX v2. Clean sidebar (Insights & Analytics + Exploration sections), KPI cards, "Ask APEX" button, filter bar, client switcher. |
| `current-poc-sustainability.jpeg` | **Current POC** at poc.advito.club — Sustainability dashboard. Shows raw Databricks dashboard embedded with visible "DBX + GENIE SPACE" tabs, multiple implementation variants exposed. |
| `existing-advito-analytics-trips.jpeg` | **Existing product** — 360analytics.advito.com Total Trip Insights (Nike client). Production quality reference for analytics depth. |
| `existing-advito-gate4-emissions.jpeg` | **Existing product** — GATE4 Insights emissions summary. Shows the analytics depth BCD clients expect. |
| `existing-advito-gate4-air.jpeg` | **Existing product** — GATE4 Insights Air tab with emissions per km, segments, trend charts. |

## Current State vs Target

### Current POC (poc.advito.club)
- Embedded Databricks Lakeview dashboard in iframe
- Multiple tab variants visible (DBX + GENIE SPACE + RECHARTS, ASK APEX WITH AGENT, etc.)
- "APEX Narrative" and "Ask APEX" toggle buttons
- Left nav: Spend, Suppliers, Demand MGT, Compliance QS, Well-Being, Sustainability, APEX Q&A
- CloudVenture demo client branding
- **Problems:** Databricks branding leaks through, dashboard tabs expose implementation details, no polish

### Figma Target (APEX v2)
- Clean APEX branding with Advito Practice Exchange identity
- Refined left sidebar: INSIGHTS & ANALYTICS (Spend, Suppliers, Demand MGT, Compliance, Well-Being, Sustainability, Engage) + EXPLORATION (Reports, Data Store, APEX Q&A, Community)
- Polished KPI cards with trend indicators (Total Travel Spend, Avg Trip Cost, Air Transactions, Cost Per Employee)
- "Ask APEX" integrated cleanly in top-right bar alongside filters + Actions
- Filter bar with time range, source filters
- Tabs: SUMMARY, TOTAL TRIP, EXPENSE ANALYSIS, CREDIT CARD, MEETINGS & EVENTS
- No Databricks branding anywhere

### Existing Product (360analytics.advito.com)
- Mature analytics product with deep drill-down capability
- Multi-tab analysis: Agency, Expense, Credit Card, Booking Leakage, Trip & Traveler, Compliance, Budget, Meetings & Events
- GATE4 sustainability module with air/hotel/rail/car/rideshare breakdowns
- Per-client branding (Nike shown), advanced filter controls
- **This is the bar we need to match or exceed**

---

## Requirements Tracker

### P0 — Must Have (Blockers to Build Phase)

| ID | Requirement | Ask | Status | Workaround | POC? |
|----|-------------|-----|--------|------------|------|
| REQ-1 | White-label Genie branding | Rename "Ask Genie" → "Ask Apex" | Blocked — needs product | Custom chat UI over Genie API (loses native UX) | Yes |
| REQ-2 | Remove "Powered by Databricks" | Suppress Databricks attribution in embedded components | Unclear — may be available | CSS override in iframe? Needs testing | Yes |
| REQ-3 | Suppress console redirect links | Remove any links navigating to Databricks workspace | Blocked — needs product | iframe `sandbox` attribute may block navigations | Yes |

### P1 — Important (Workarounds Accepted)

| ID | Requirement | Ask | Status | Workaround | POC? |
|----|-------------|-----|--------|------------|------|
| REQ-4 | RBAC on dashboard pages | Per-page/tab visibility by user role | No native page-level RBAC | Multiple dashboards + app-layer routing | Yes |
| REQ-5 | Genie Research Agent | Deep analytical mode — multi-step reasoning | Product roadmap item | MAS routing to specialized Genie Spaces | Yes |
| REQ-6 | Layout controls | Sizing, positioning, responsive behavior | Limited native controls | Custom CSS wrapper around iframe embeds | Yes |
| REQ-7 | Multi-agent supervisor streaming | Real-time streaming from MAS to frontend | Available via MLflow AgentServer | Using OpenAI Agents SDK + Vercel AI SDK for SSE | Yes |
| REQ-8 | Unified chat (Knowledge + Data Q&A) | Single "Ask APEX" for docs + data queries | Not native | MAS supervisor routes by intent | Yes |

### P2 — Nice to Have

| ID | Requirement | Ask | Status | Workaround | POC? |
|----|-------------|-----|--------|------------|------|
| REQ-9 | Filter context passthrough (DB-I-14988) | Dashboard filter state passed to Genie | Aha item filed | URL param filtering + app-controlled iframe src | Yes |
| REQ-10 | Narrative/insight generation | Auto-generate text summaries from dashboard data | Partially available (APEX Narrative toggle) | MAS agent with fixed prompt → markdown summary | Yes |
| REQ-11 | Client/tenant switcher | Switch between BCD clients (CloudVenture, Nike, etc.) | App-level concern | Dropdown → filter all dashboards + Genie context | Yes |
| REQ-12 | Comparative period analysis | Current vs previous period with trend indicators | Available in Lakeview | Dashboard design pattern | Yes |
| REQ-13 | Data exploration (Reports, Data Store) | Self-service exploration beyond fixed dashboards | Not native in embedded mode | Custom app pages backed by SQL warehouse queries | Partial |
| REQ-14 | Community / collaboration features | Share insights, annotate, discuss within APEX | Not a Databricks feature | App-level feature (out of scope for POC) | No |

### UX/Design Asks (from Figma mockup analysis)

| ID | Requirement | Ask | Notes |
|----|-------------|-----|-------|
| UX-1 | Polished sidebar navigation | Two-section nav (Insights & Analytics + Exploration) | Match Figma layout exactly |
| UX-2 | KPI cards with trend indicators | Cards showing metric + % change + comparison | Figma shows 4 KPI cards at top |
| UX-3 | Integrated "Ask APEX" button | Top-right bar, not a separate page/tab | Currently a separate toggle — should be inline |
| UX-4 | Clean filter bar | Time range + source filters + Actions dropdown | Remove Databricks-native filter chrome |
| UX-5 | Tab-based content areas | SUMMARY, TOTAL TRIP, EXPENSE, etc. | Match existing 360analytics depth |
| UX-6 | Client branding in header | Client logo + name in top bar | CloudVenture shown in Figma |

---

## MAS Architecture (Ask APEX Backend)

Per email to Malathy/John (Mar 2):

**Backend:**
- Orchestrator agent using OpenAI Agents SDK
- Routes questions to subagents (Databricks Apps, serving endpoints, Genie spaces via MCP)
- Served via MLflow AgentServer → `/invocations` endpoint with streaming
- `@stream` handler yields events as agent works

**Frontend:**
- React chat app + Express proxy
- Vercel AI SDK (`streamText`) pipes SSE events to browser
- `useChat` hook renders tokens, tool calls, reasoning steps in real time
- Auto-resume on connection drop

**Templates (from databricks/app-templates):**
- `agent-openai-agents-sdk-multiagent` — supervisor backend
- `e2e-chatbot-app-next` — production React chat UI

---

## BCD Workspace for POC

**URL:** https://dbc-1e27e56a-90cd.cloud.databricks.com/?o=1048934788948873

This is the customer workspace where we'll build the POC.

---

## Acceptance Criteria for Build Phase

BCD will greenlight the build if:
1. White-labeling is confirmed on roadmap with clear timeline (REQ-1, REQ-2, REQ-3)
2. Workarounds for P1 items are demonstrated working in POC
3. "Ask APEX" experience works end-to-end with MAS streaming (REQ-7, REQ-8)
4. UX matches Figma mockup quality (UX-1 through UX-6)
5. Embedding patterns are documented and reproducible
6. Clear path from POC → production with scaling to 100+ MAUs
