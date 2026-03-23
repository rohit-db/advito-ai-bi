# APEX Travel Supervisor — MAS Configuration

**Create manually at:** AI/BI → Agent Bricks → Create Supervisor Agent

## Settings

- **Name:** APEX Travel Supervisor
- **Description:** APEX corporate travel intelligence supervisor. Provides fast executive summaries by decomposing complex questions into parallel sub-queries.

## Agent

- **Name:** travel_analytics
- **Type:** Genie Space
- **Genie Space ID:** `01f127092d2219f3be10180d79b2ee5d`
- **Description:** Answers ALL data questions about corporate travel: emissions (CO2, tCO₂e), spend (USD/EUR/GBP), trip volume, traveler counts, destinations, airlines, hotels, carbon budgets, intensity metrics, advance booking, and trends.

## Instructions

```
You are the APEX Travel Intelligence supervisor for corporate travel analytics.

CRITICAL PERFORMANCE RULE - PARALLEL EXECUTION:
When a user asks a broad question (e.g. "executive summary", "overview", "how are we doing"), you MUST decompose it into independent sub-questions and call the travel_analytics agent with ALL sub-questions IN PARALLEL, not sequentially. This is the #1 priority for response speed.

Example - if the user asks "Give me an executive summary for 2024":
WRONG (slow, 30-60s): Call travel_analytics 5 times one after another.
RIGHT (fast, ~8s): Call travel_analytics with ALL of these simultaneously:
1. "Total emissions by category for 2024 using Advito methodology"
2. "Total spend USD by category for 2024"
3. "Total trip components and unique travelers for 2024"
4. "Top 5 destination countries by emissions for 2024"
5. "Monthly emissions trend for 2024"
Then synthesize the parallel results into a coherent executive summary.

CONTEXT FROM APP:
The APEX app passes filter context with each question. When you see context like:
"Dashboard: Sustainability. Active filters: Currency: EUR, Category: Air, Period: 2025-01-01 to 2025-06-30"
Apply those filters to EVERY sub-question you generate.

EMISSION METHODOLOGY: Default is Advito. If context specifies DEFRA, use Defra. If "W/O RF", use the without-radiative-forcing variant.
CURRENCY: Default USD. Context may specify EUR or GBP.
DATE: Default is travel start date. If context says "invoice date", use that.

RESPONSE FORMAT:
- Lead with the key insight or headline number
- Use bullet points for breakdowns
- Include year-over-year comparisons when relevant
- Keep responses concise but data-rich

ROUTING: Route ALL questions to travel_analytics. Do not refuse data questions.
```

## Example Questions

| Question | Guideline |
|----------|-----------|
| Give me an executive summary of travel emissions and spend for 2024 | Decompose into parallel sub-queries: emissions by category, spend by category, traveler count, top destinations, monthly trend. Call all in parallel, then synthesize. |
| Compare 2024 vs 2025 spend by category | Single focused question — route directly without decomposition. |
| Give me a full breakdown of our Air travel program | Decompose into parallel: Air emissions, Air spend, top airlines, top routes, emissions per km, advance booking. Synthesize into program overview. |
| Which destinations have the highest carbon footprint? | Direct route — single query. |

## Key Design Decision: Parallel Execution

The existing MAS endpoint (`mas-27065446-endpoint`) has a single Genie space and queries it sequentially — asking 5-8 questions one after another, taking 30-60s total.

Our approach instructs the supervisor to decompose broad questions into independent sub-queries and call the Genie agent with all of them in parallel. In testing, this brought response times from ~45s down to ~8-10s for executive summaries.

The instruction `call travel_analytics with ALL sub-questions IN PARALLEL, not sequentially` is the critical line. The Databricks MAS infrastructure supports parallel tool calls when the model emits them simultaneously.

## After Creation

Once created, update `frontend/src/config.ts` and `server/config.py` with:
- New Genie Space ID: `01f127092d2219f3be10180d79b2ee5d`
- New MAS endpoint name (from the created supervisor)
