# APEX Embedded Analytics — POC Status & Path Forward

## What We've Built and Proven

- **Polished React UI** with app-controlled page navigation and filters — users see a branded APEX experience, not Databricks chrome
- **Dashboard embedding** via iframe with URL parameter passthrough for filters (period, sector, region) and page switching — all working
- **Genie-powered "Ask APEX"** chat panel that passes the user's active filters as context, so answers are relevant to what they're viewing
- **Custom AI agent** (Claude via FMAPI + parallel Genie queries) that delivers executive summaries in ~15s vs ~45s with the standard MAS approach
- **Governed metric view** (27 dimensions, 23 measures) as the single source of truth for dashboards, Genie, and the agent
- **Deployed and running** as a Databricks App: [https://advito-ai-bi-1048934788948873.aws.databricksapps.com](https://advito-ai-bi-1048934788948873.aws.databricksapps.com)

## Where We Stand

The POC proves the technology works end-to-end. 
The one remaining gap is Databricks branding: the "Powered by Databricks" footer on embedded dashboards using iframe (we've asked Product to deliver this ASAP) and the Databricks SSO login screen when users access the app.

## Two Paths Forward

### Path 1: Databricks Apps (Fastest for MVP)

If we're working with a limited set of customers for the initial rollout, Databricks Apps is the fastest route. 
Users would need Databricks accounts (account-level, not full workspace). In the long run user provisioning can be automated as long as users are in Entra. But the benefits are significant:

- Everything we've built works today — zero rearchitecting
- Deployment is a single command via Asset Bundles
- MLflow tracing, monitoring, and app management are built-in
- Scaling, compute, and infrastructure are fully managed
- The branding gap is a known product ask (we've filed it) and may be resolved by the time we go to pilot

**Trade-off:** Users see the Databricks SSO screen on first login and the "Powered by Databricks" footer on dashboards.

### Path 2: External Hosting with Proxy (Firefly Pattern — Full White-Label)

**Firefly Analytics** ([https://www.firefly-analytics.com](https://www.firefly-analytics.com)) is a "Built on Databricks" reference blueprint that solves exactly this. We can get our hands on the implementation to fastrack. 

Architecture docs: [https://www.firefly-analytics.com/docs/architecture/overview](https://www.firefly-analytics.com/docs/architecture/overview)

Their approach: a lightweight reverse proxy ("front door" / edge gateway) sits in front of the Databricks-hosted app, injecting an **edge Service Principal** token server-side. Users authenticate through the customer's own IdP (Azure AD B2C in our case) and never see Databricks SSO. Multi-tenant data isolation is handled via one SP per customer org with Unity Catalog row-level security.

**We have built and empirically validated this front door in `edge/`** (a self-contained localhost reverse proxy that fronts the deployed APEX app). Two findings, both proven against the live app:

1. **Front door works for the app shell.** A no-Databricks-session browser hitting the edge (`localhost:9000`) loads the full APEX experience — sidebar, filters, tabs, Ask APEX, Genie MCP — with **no SSO screen**. The edge SP token clears the Apps OAuth proxy (`without bearer → 302 redirect-to-SSO`; `with bearer → 200`). The app behind the edge sees the SP identity, so OBO/Genie calls work.

2. **Basic embedding does NOT survive the front door.** Basic-embedding dashboards load their iframe **directly from the workspace origin** (`dbc-….cloud.databricks.com/embed/…`), *bypassing the edge entirely*, and authenticate with a **Databricks browser session cookie** — not a bearer token. With no session, the iframe redirects to `login.html` and renders a "Log in / Continue" card, even though the `f_…` URL filters are correctly present. We confirmed this in a headless browser: the app shell rendered while the dashboard panel showed the Databricks login card.

**Conclusion for dashboards behind the front door:** use **external embedding** — the dashboard iframe authenticated with a **per-tenant SP-scoped embed token** (minted via the documented 3-step OAuth exchange — see `multi-tenant-genie/server/primitives/aibi_embed.py`). This renders with **no Databricks login** and pairs naturally with the edge gateway.

**Filters DO work with external embedding — validated live.** The `@databricks/aibi-client` SDK is a ~13KB shim: it just builds a standard `/embed/dashboardsv3/<id>/pages/<page>?o=<ws>#token=<jwt>` iframe URL and talks to the iframe over `postMessage` (`DATABRICKS_NAVIGATE`, `DATABRICKS_SET_TOKEN`, `DATABRICKS_SET_CONFIG`). It exposes **no filter method** — but the embed SPA it loads is the *same* one basic embedding uses, and it **honors the `f_{page}~{widget}=value` URL params regardless of auth mode**. We proved this end-to-end: minting a scoped SP token, appending `f_54194f59~tsector=Air` to the SDK-style token URL, and loading it in a fresh no-Databricks-session browser on localhost — the dashboard rendered with no login **and** applied the filter (`travel_sector: Air` selected, filter chip shown). The unfiltered load showed `All`.

So **"extending the SDK ourselves" is trivial**: append the `f_…` params to the iframe URL the SDK builds (fork the shim, or skip the SDK and build the ~15-line iframe ourselves — we control the whole URL). This gives us **no-login white-label + app-driven filters together**, today. Caveats: (1) it relies on the `f_` URL syntax, which Databricks documents for basic embedding but not (yet) for the SDK path — it's the same SPA, so stable, but officially the SDK filter API is still "on the roadmap"; (2) host-app-driven re-filtering after load means re-setting the iframe `src` (a quick reload), though the dashboard's own in-frame filter widgets remain fully interactive; (3) the viewer SP still needs data access (warehouse + UC `SELECT`), and Unity Catalog row filters / `external_value` remain the mechanism for per-tenant data isolation.

**Key point: everything we've built is reusable.** Our React UI, FastAPI backend, Genie integration, custom agent, and metric view all work the same — the additions are the edge gateway (`edge/`, ~200 lines) and swapping the dashboard iframe for the SDK component when full white-label is required.

**SP management is not a heavy lift.** The Firefly blueprint includes patterns for automating the full lifecycle — SP creation, credential generation, encryption, and rotation. RBAC is implemented by assigning each customer's SP specific Unity Catalog permissions (row-level security on `client_id`), so each customer only sees their own data. This is the same ABAC model we've already designed with the metric view. Creating and managing 20-25 SPs (one per customer) is straightforward to automate via the Databricks SDK.

## Recommendation

Go with **Path 1 (Databricks Apps) for MVP** with a limited customer set. It's the fastest route, everything works, and we avoid the infrastructure overhead. If the Databricks branding or user onboarding become blockers during MVP, we can pivot to **Path 2 (external hosting)** without rearchitecting — the proxy layer is the only new piece, and the Firefly blueprint gives us the code and patterns to move quickly.

## Reference

- **Live POC:** [https://advito-ai-bi-1048934788948873.aws.databricksapps.com](https://advito-ai-bi-1048934788948873.aws.databricksapps.com)
- **Edge gateway (front door):** `edge/` — run `./edge/run.sh`, then open `http://localhost:9000`. Setup + the validated findings above are in `edge/README.md`.
- **OEM analytics pattern (blog):** [Building a Customer-Facing OEM Analytics App on Databricks](https://medium.com/@rohitbhagwat/building-a-customer-facing-oem-analytics-app-on-databricks-2233f89efc66)
- **Firefly Architecture:** [https://www.firefly-analytics.com/docs/architecture/overview](https://www.firefly-analytics.com/docs/architecture/overview)
- **Firefly Apps Proxy:** [https://www.firefly-analytics.com/docs/solutions/embedding-apps](https://www.firefly-analytics.com/docs/solutions/embedding-apps)
- **SDK Findings:** `docs/architecture/sdk-embed-findings.md`
- **Auth Decision Doc:** `docs/architecture/embedding-auth-decision.md`

