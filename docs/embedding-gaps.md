# AI-BI Embedding — Product Gaps

Consolidated list of product gaps identified during BCD Travel / Advito AI-BI embedding work. To be raised with Jess + AI-BI product leaders.

## Filed

| Aha ID | Title | Priority | Description |
|--------|-------|----------|-------------|
| DB-I-14988 | Genie API filter/parameter context passthrough | P2 | Genie API lacks ability to receive dashboard filter state. Users expect Genie questions to be contextual to current filter selections. |

## To File

| # | Gap | Priority | Description | Workaround |
|---|-----|----------|-------------|------------|
| 1 | White-label Genie branding | P0 | No API/config to rename "Ask Genie" or customize branding | Custom chat UI over Genie API (loses native UX) |
| 2 | Suppress "Powered by Databricks" | P0 | Attribution footer visible in embedded components | CSS override? Needs verification |
| 3 | Console link suppression | P0 | Embedded components contain links to Databricks workspace | iframe sandbox attribute may help |
| 4 | Page-level RBAC in Lakeview | P1 | No native per-page access control on dashboards | Multiple dashboards + app routing |
| 5 | Embedded layout controls | P1 | Limited control over sizing/positioning of embedded components | Custom CSS wrapper |
| 6 | Genie Research Agent (embedded) | P1 | No native deep-analysis mode in embedded Genie | MAS with specialized Genie Spaces |

## Actions

- [ ] Consolidate into single Aha submission
- [ ] Share with Jess in 1:1
- [ ] Request meeting with AI-BI product team (embedded analytics PM)
- [ ] Open ASQ for embedded analytics SME engagement
