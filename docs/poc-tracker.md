# Advito APEX — POC Tracker

> **Goal:** Go/no-go on Databricks for APEX by March 31.
> **Team:** Rohit, Malathy, Juliann, Lalit | John (optional)  
> **Cadence:** Tue & Fri, 9AM ET
> **Timeline:** POC (→ Mar 31) → MVP (2 mo) → Pilot (2-3 mo) → Launch (EOY 2026)

---

## Status Key


| Tag         | Meaning                              |
| ----------- | ------------------------------------ |
| BLOCKER     | Must resolve before build phase      |
| AT RISK     | Workaround exists, not yet validated |
| IN PROGRESS | Actively being worked                |
| VALIDATED   | Demonstrated working in POC          |
| DEFERRED    | Not needed for POC decision          |


---

## P0 — Blockers


| ID     | Requirement                                               | What                                                                                                                 | Status  | Workaround                                                   |
| ------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------ |
| REQ-9  | **Filter passthrough**                                    | Pass dashboard filter state to Genie so AI knows what the user is looking at. #1 gap vs QuickSight.**(DB-I-14988)** | BLOCKER | App-layer context injection into Genie API. Aha: DB-I-14988. |
| REQ-1  | **White-label Genie**                                     | "Ask Genie" → "Ask Apex". No Databricks branding visible to end users.                                               | BLOCKER | Custom chat UI over Genie API. Aha: DB-I-18362.              |
| REQ-2  | **Remove "Powered by Databricks"**                        | Suppress attribution footer in embedded components.                                                                  | BLOCKER | CSS override in iframe. Needs testing.                       |
| REQ-3  | **No console links**                                      | Remove links that navigate to Databricks workspace. End users don't have accounts.                                   | BLOCKER | iframe sandbox attribute.                                    |
| REQ-15 | **MAS latency & Streaming output**                        | Agent response time must be <10s. Currently 30-60s (20 calls × 3s).                                                  | BLOCKER | Hybrid: lightweight router + direct Genie API calls.         |
| REQ-16 | **No tab headers in embed**                               | Hide Lakeview page tabs. App controls its own nav.                                                                   | BLOCKER | Page-specific embed URLs; CSS override.                      |
|        | **Passing Multiple Values to Dashboard filteres from UI** | For example: Storing User default filters (preferences) and setting user based defaults for Dashboards               |         |                                                              |


## P1 — Important


| ID     | Requirement                                       | What                                                                                    | Status  | Workaround                                          |
| ------ | ------------------------------------------------- | --------------------------------------------------------------------------------------- | ------- | --------------------------------------------------- |
| REQ-17 | **Auth / SSO**                                    | External users via SSO (AWS Cognito today). Need Databricks-compatible auth for embeds. | AT RISK | Service principal + app-layer Cognito. SME engaged. |
| REQ-4  | **RBAC by client**                                | Different BCD clients see different data.                                               | AT RISK | Multiple dashboards + app routing + UC row filters. |
|        |                                                   |                                                                                         |         |                                                     |
|        |                                                   |                                                                                         |         |                                                     |
| REQ-5  | **Research mode (Narrative / Executive Summary)** | Deep multi-step analysis for power users.                                               | AT RISK | MAS routing to specialized Genie Spaces.            |
|        |                                                   |                                                                                         |         |                                                     |


## P2 — Defer to MVP


| ID     | Requirement                           | Workaround                       |
| ------ | ------------------------------------- | -------------------------------- |
| REQ-10 | Narrative generation (auto-summaries) | MAS agent + fixed prompt         |
| REQ-11 | Client/tenant switcher                | Dropdown → parameterized URLs    |
| REQ-12 | Period-over-period comparison         | Lakeview supports natively       |
| REQ-13 | Data exploration (self-service)       | Custom app pages + SQL warehouse |
| REQ-14 | Community / collaboration             | App-level, out of scope          |


## UX (from Figma)


| ID   | What                                             | Status      |
| ---- | ------------------------------------------------ | ----------- |
| UX-1 | Sidebar nav (Insights & Analytics + Exploration) | DEFERRED    |
| UX-2 | KPI cards with trend arrows                      | DEFERRED    |
| UX-3 | "Ask APEX" button in top bar                     | IN PROGRESS |
| UX-4 | Clean filter bar (no Databricks chrome)          | DEFERRED    |
| UX-5 | Tab content (Summary, Trip, Expense, etc.)       | DEFERRED    |
| UX-6 | Client branding in header                        | DEFERRED    |


---

## Product Gaps to Escalate


| Aha ID     | Gap                              | Priority | Filed? |
| ---------- | -------------------------------- | -------- | ------ |
| DB-I-14988 | Filter passthrough to Genie      | **P0**   | Yes    |
| DB-I-18362 | White-label Genie branding       | **P0**   | Yes    |
| TBD        | Remove "Powered by Databricks"   | **P0**   | No     |
| TBD        | Suppress console links in embeds | **P0**   | No     |
| TBD        | Hide tab headers in embeds       | **P0**   | No     |
| TBD        | Page-level RBAC in Lakeview      | P1       | No     |


---

## Architecture: MAS vs Genie

**Decide by mid-March.**


| Approach                        | Latency | Trade-off                                                                            |
| ------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| **Pure Genie**                  | 2-5s    | Fast and free, but no doc Q&A or unified chat                                        |
| **Full MAS**                    | 30-60s  | Unified chat, but too slow and complex                                               |
| **Hybrid (router + Genie API)** | 3-8s    | Single LLM call classifies intent, then direct Genie for data queries. Best balance. |


**Recommendation:** Hybrid. Covers 80%+ of queries via direct Genie API. Only routes to knowledge agent when needed.

---

## Reference: Firefly Analytics

[firefly-analytics.com](https://www.firefly-analytics.com/) — A "Built on Databricks" reference implementation that solves many of the same problems.

**What it is:** Multi-tenant analytics platform. Custom UI, no Databricks branding visible to end users. Acts as an intelligent proxy between users and Databricks.

**Patterns we can reuse:**


| Pattern            | How Firefly Does It                                                                                                                                          | APEX Relevance                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| **Auth**           | Two-layer: users auth via OAuth/OIDC (Okta, Azure AD, Auth0), all Databricks calls use org-level Service Principals. No end user needs a Databricks account. | Solves REQ-17. Keep Cognito for users, SPN for API calls.                         |
| **Multi-tenancy**  | One SPN per org, scoped Unity Catalog permissions. Credentials encrypted in Lakebase.                                                                        | Solves REQ-4. Each BCD client = isolated org.                                     |
| **White-labeling** | Server-side API routes hide credentials. Custom UI wraps embedded components.                                                                                | Addresses REQ-1, REQ-2, REQ-3. Branding controlled at app layer.                  |
| **Apps proxy**     | Embeds Databricks Apps and AI-BI dashboards without exposing login flows or Databricks chrome.                                                               | Core pattern for APEX. AI-BI embedding stays, but wrapped cleanly. Solves REQ-16. |
| **Stack**          | Next.js 15, React 19, TanStack Query, shadcn/ui, Tailwind, Better-Auth, Drizzle ORM, Lakebase                                                                | Close to our stack. Reusable patterns.                                            |
| **APIs**           | Unity Catalog, Statement Execution, Files, Apps — all via SPN bearer tokens.                                                                                 | Same APIs we'd use. Validates the approach.                                       |


**Key insight:** Firefly uses a two-track approach — AI-BI dashboard embedding via Apps proxy (hiding login flows and Databricks chrome) *plus* custom React pages backed by server-side Databricks APIs for anything that needs full control. APEX should do the same: embed AI-BI dashboards where they work, and build custom UI for what they can't (chat, navigation, branding).

**Action:** Get access to Firefly repo (requested). Study their Apps proxy embedding pattern, auth flow, and where they draw the line between embedded AI-BI and custom rendering.

---

## Checkpoint Log


| Date  | Updates                                                                                      | Decisions                                                | Blockers                                             |
| ----- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| Mar 7 | SWAT team formed. Tracker created. Filter passthrough → P0. Firefly identified as reference. | Tue/Fri 9AM ET cadence. Core: Rohit + Malathy + Juliann. | MAS latency. Filter passthrough needs product input. |


---

## Links


| What                    | URL                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| POC Repo                | `~/Documents/github/advito-ai-bi/`                                                                                                       |
| BCD Workspace           | [https://dbc-1e27e56a-90cd.cloud.databricks.com/?o=1048934788948873](https://dbc-1e27e56a-90cd.cloud.databricks.com/?o=1048934788948873) |
| Current POC             | [https://poc.advito.club](https://poc.advito.club)                                                                                       |
| Existing product        | [https://360analytics.advito.com](https://360analytics.advito.com)                                                                       |
| Figma mockup            | `docs/screenshots/figma-mockup-apex-v2.jpeg`                                                                                             |
| Firefly Analytics       | [https://www.firefly-analytics.com/](https://www.firefly-analytics.com/)                                                                 |
| Firefly Architecture    | [https://www.firefly-analytics.com/docs/architecture/overview](https://www.firefly-analytics.com/docs/architecture/overview)             |
| Aha: Filter passthrough | DB-I-14988                                                                                                                               |
| Aha: White-label Genie  | [DB-I-18362](https://databrickinternal.ideas.aha.io/ideas/DB-I-18362)                                                                    |
| Slack                   | [https://databricks.enterprise.slack.com/archives/C09T2G70BLH](https://databricks.enterprise.slack.com/archives/C09T2G70BLH)             |


