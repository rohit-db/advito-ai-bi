# APEX Embedded Analytics — POC Status & Path Forward

## What We've Built and Proven

- **Polished React UI** with app-controlled page navigation and filters — users see a branded APEX experience, not Databricks chrome
- **Dashboard embedding** via iframe with URL parameter passthrough for filters (period, sector, region) and page switching — all working
- **Genie-powered "Ask APEX"** chat panel that passes the user's active filters as context, so answers are relevant to what they're viewing
- **Custom AI agent** (Claude via FMAPI + parallel Genie queries) that delivers executive summaries in ~15s vs ~45s with the standard MAS approach
- **Governed metric view** (27 dimensions, 23 measures) as the single source of truth for dashboards, Genie, and the agent
- **Deployed and running** as a Databricks App: [https://advito-ai-bi-1048934788948873.aws.databricksapps.com](https://advito-ai-bi-1048934788948873.aws.databricksapps.com)

## Where We Stand

The POC proves the technology works end-to-end. The one remaining gap is Databricks branding — the "Powered by Databricks" footer on embedded dashboards and the Databricks SSO login screen when users access the app.

We tested the JS SDK (`@databricks/aibi-client`), OBO tokens, and session cookie approaches:

- The SDK can hide the logo but lacks filter/page APIs
- OBO tokens don't have an embedding scope
- Session cookies work for everything except the logo

## Two Paths Forward

### Path 1: Databricks Apps (Fastest for MVP)

If we're working with a limited set of customers for the initial rollout, Databricks Apps is the fastest route. Users would need Databricks accounts (account-level, not full workspace), but the benefits are significant:

- Everything we've built works today — zero rearchitecting
- Deployment is a single command via Asset Bundles
- MLflow tracing, monitoring, and app management are built-in
- Scaling, compute, and infrastructure are fully managed
- The branding gap is a known product ask (we've filed it) and may be resolved by the time we go to pilot

**Trade-off:** Users see the Databricks SSO screen on first login and the "Powered by Databricks" footer on dashboards.

### Path 2: External Hosting with Proxy (Firefly Pattern — Full White-Label)

**Firefly Analytics** ([https://www.firefly-analytics.com](https://www.firefly-analytics.com)) is a "Built on Databricks" reference blueprint that solves exactly this.

Architecture docs: [https://www.firefly-analytics.com/docs/architecture/overview](https://www.firefly-analytics.com/docs/architecture/overview)

Their approach: a lightweight reverse proxy sits between the app and Databricks, injecting SP tokens server-side. Users authenticate through the customer's own IdP (Azure AD B2C in our case) and never see Databricks at all — no login screen, no branding. Multi-tenant isolation is handled via one SP per customer org.

**Key point: everything we've built is reusable.** Our React UI, FastAPI backend, Genie integration, custom agent, and metric view all work the same — the only addition is the proxy layer (~200 lines of code).

**SP management is not a heavy lift.** The Firefly blueprint includes patterns for automating the full lifecycle — SP creation, credential generation, encryption, and rotation. RBAC is implemented by assigning each customer's SP specific Unity Catalog permissions (row-level security on `client_id`), so each customer only sees their own data. This is the same ABAC model we've already designed with the metric view. Creating and managing 20-25 SPs (one per customer) is straightforward to automate via the Databricks SDK.

## Recommendation

Go with **Path 1 (Databricks Apps) for MVP** with a limited customer set. It's the fastest route, everything works, and we avoid the infrastructure overhead. If the Databricks branding or user onboarding become blockers during MVP, we can pivot to **Path 2 (external hosting)** without rearchitecting — the proxy layer is the only new piece, and the Firefly blueprint gives us the code and patterns to move quickly.

## Reference

- **Live POC:** [https://advito-ai-bi-1048934788948873.aws.databricksapps.com](https://advito-ai-bi-1048934788948873.aws.databricksapps.com)
- **Firefly Architecture:** [https://www.firefly-analytics.com/docs/architecture/overview](https://www.firefly-analytics.com/docs/architecture/overview)
- **Firefly Apps Proxy:** [https://www.firefly-analytics.com/docs/solutions/embedding-apps](https://www.firefly-analytics.com/docs/solutions/embedding-apps)
- **SDK Findings:** `docs/architecture/sdk-embed-findings.md`
- **Auth Decision Doc:** `docs/architecture/embedding-auth-decision.md`

