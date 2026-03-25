# APEX Embedding & Authentication — Decision Document

**Date:** 2026-03-25
**Author:** Rohit Bhagwat + AI
**Status:** POC — honest assessment of what works, what doesn't, and what's needed for production

---

## Current State (POC)

The POC runs as a **Databricks App** with iframe embedding. Users must have Databricks accounts.

| Component | Auth Method | Who Can Use It |
|-----------|-------------|---------------|
| Dashboard embed (iframe) | Databricks session cookie (user logged in) | Databricks account holders only |
| Genie chat (Ask APEX) | Service principal via SDK | Anyone (backend handles auth) |
| Custom Agent (Claude + Genie) | Service principal via SDK + FMAPI | Anyone (backend handles auth) |
| User identity (/api/me) | Service principal → `current_user.me()` | Returns SP identity, not actual user |
| Filter passthrough | URL params on iframe | Works when user has Databricks session |
| Page navigation | URL path `/pages/{pageId}` on iframe | Works when user has Databricks session |

### What the POC proves:
- Dashboard embedding with app-controlled tabs and filters works
- Genie-powered chat with context injection works
- Custom agent with parallel Genie queries provides fast executive summaries
- Metric views provide a governed semantic layer for all analytics
- The UI shell (sidebar, header, filters) is production-grade

### What the POC does NOT prove:
- External user access (users without Databricks accounts)
- Per-user data isolation (ABAC)
- Hiding the Databricks logo (requires JS SDK)
- True OBO authentication (attempted, deferred)

---

## Two Paths to Production

### Path A: Users in Databricks (Recommended for Phase 1)

**Who this serves:** Advito internal analysts, BCD Travel employees who already have or can get Databricks accounts.

**Architecture:** Keep the current Databricks App approach.

| Feature | How | Status |
|---------|-----|--------|
| Dashboard access | User's own Databricks session in iframe | Works today |
| Per-user data | Row-level security on `client_id` + OBO token | Needs OBO fix |
| User identity | OBO → `current_user.me()` returns real user | Needs OBO fix |
| Filters & pages | URL params on iframe | Works today |
| Genie chat | OBO → Genie API (user's permissions) | Needs OBO fix |
| Agent | SP for FMAPI + OBO for Genie | Partially works |
| Hide Databricks logo | Not possible with iframes | Gap |

**Effort:** Fix OBO authentication (~1 day). Everything else works.

**Limitation:** Every user needs a Databricks account.

### Path B: External Users via JS SDK (Required for Client-Facing)

**Who this serves:** Advito's clients (the travel companies) — external users who do NOT have Databricks accounts.

**Architecture:** Replace iframes with `@databricks/aibi-client` JS SDK. Deploy on any platform.

| Feature | How | Status |
|---------|-----|--------|
| Dashboard access | JS SDK with scoped token (3-step OAuth) | Requires service principal with OAuth secret |
| Per-user data | `external_value` → `__aibi_external_value` in SQL queries | Requires dataset SQL changes |
| User identity | External app's own auth (Okta/Auth0) | Requires auth integration |
| Filters & pages | SDK API (currently undocumented, alpha) | **GAP — SDK doesn't support this yet** |
| Genie chat | Genie Conversation API (backend, SP auth) | Works — Ask Genie NOT available in external embed |
| Agent | Same as today (backend, SP auth) | Works |
| Hide Databricks logo | `config: { hideDatabricksLogo: true }` | Works with SDK |
| Audit trail | `external_viewer_id` logged per view | Built into SDK token flow |

**Effort:** ~2 weeks for the full migration.

**Critical gap:** The JS SDK is alpha (`0.0.0-alpha.7`) and does NOT document page navigation or filter APIs. This means:
- We lose app-controlled page tabs (would need to embed one dashboard per page, or wait for SDK maturity)
- We lose URL-based filter passthrough (would need to wait for SDK filter API)

---

## Token Flow for External Users (Path B)

```
Client User → External App (React) → Backend (FastAPI)
                                        │
                                        ├── Step 1: POST /oidc/v1/token
                                        │   (SP credentials → all-apis token)
                                        │
                                        ├── Step 2: GET /api/2.0/lakeview/dashboards/{id}/published/tokeninfo
                                        │   (all-apis token + external_viewer_id + external_value)
                                        │   → returns authorization_details
                                        │
                                        └── Step 3: POST /oidc/v1/token
                                            (SP credentials + authorization_details → scoped token)

Scoped Token → DatabricksDashboard SDK → Dashboard renders with user-filtered data
```

### Per-User Data Filtering

Dashboard SQL datasets reference `__aibi_external_value`:
```sql
SELECT ... FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE client_id = __aibi_external_value
```

Each user's scoped token carries their `external_value` (e.g., their `client_id`), so the query automatically filters to their data.

---

## Recommendation

| Phase | Approach | Timeline | Users |
|-------|----------|----------|-------|
| **POC (now)** | Databricks App + iframes | Done | Advito team (Databricks accounts) |
| **MVP (Apr-May)** | Databricks App + OBO fix | ~1 day | Advito + BCD (Databricks accounts) |
| **Pilot (H2 2026)** | JS SDK + external auth | ~2 weeks | Advito clients (external users) |

### What to tell the developers:

1. **The POC architecture is sound.** The iframe + URL param pattern is exactly how Databricks internally embeds dashboards. It's not a hack.

2. **For production with external users, we'll migrate to the JS SDK.** The token flow is well-documented and production-ready. The SDK itself is alpha but maturing fast.

3. **The backend (Genie, Agent, Metric View) doesn't change.** Only the frontend embedding method changes. The data layer, API routes, and agent logic are deployment-agnostic.

4. **The biggest gap is the JS SDK's filter/page API.** Until that matures, external embedding means losing some of our app-controlled interactivity. Workaround: embed multiple dashboards (one per "page") instead of using page navigation.

---

## References

- [Embedding for external users](https://docs.databricks.com/aws/en/dashboards/embedding/external-embed)
- [Basic embedding](https://docs.databricks.com/aws/en/dashboards/share/embedding/basic)
- [Dashboard parameters](https://docs.databricks.com/aws/en/dashboards/manage/filters/parameters)
- [@databricks/aibi-client SDK](https://github.com/databricks-solutions/aibi-dashboards-external-embedding)
- [FireFly Analytics](https://www.firefly-analytics.com/) — reference implementation
