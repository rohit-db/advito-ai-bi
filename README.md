# Advito AI-BI Embedding POC

Demo POC for validating Databricks AI/BI embedding behaviors for Advito (BCD Travel subsidiary).

## Context

BCD Travel / Advito are wrapping up their AI/BI + Genie POC and moving toward the build phase. Overall sentiment is positive, but they're blocked on branding and white-labeling controls. This repo contains POC code to validate each embedding behavior and document gaps.

**Competitive pressure:** BCD spends ~$110K/year on QuickSight. Projected 100–1000 MAUs by 2028. Without white-labeling clarity, they default to QuickSight for 3–5 years.

## Primary Blockers

| # | Blocker | Status |
|---|---------|--------|
| 1 | White-label "Ask Genie" → "Ask Apex" | Blocked — needs product |
| 2 | Remove "Powered by Databricks" | Unclear — may be available |
| 3 | Remove console redirect links | Blocked — needs product |

## POC Behaviors

| # | Behavior | Directory | Status |
|---|----------|-----------|--------|
| 1 | Dashboard embedding (iframe) | `demos/dashboard-embed/` | Not started |
| 2 | Genie chat embedding | `demos/genie-embed/` | Not started |
| 3 | White-label controls | `demos/white-label/` | Not started |
| 4 | Console link suppression | `demos/console-suppression/` | Not started |
| 5 | App-layer RBAC | `demos/rbac/` | Not started |
| 6 | MAS research mode | `demos/mas-research/` | Not started |
| 7 | Filter passthrough (DB-I-14988) | `demos/filter-passthrough/` | Not started |

## Project Structure

```
advito-ai-bi/
├── README.md
├── docs/
│   ├── requirements.md          # Key requirements from BCD
│   └── embedding-gaps.md        # Product gaps and Aha items
├── demos/                       # POC implementations per behavior
├── notebooks/                   # Databricks notebooks for testing
└── src/                         # Shared utilities
```

## Key Resources

| Resource | ID |
|----------|----|
| Genie Space (Leakage) | `01f109125c561c30bcf480f0e8c53340` |
| Genie Space (Shopping) | `01f109125c8b1065ba03cc90e41884dc` |
| Dashboard v3 | `01f1142a82151789a6e33853112927b6` |
| MAS Endpoint | `bcd-supervisor` |

## Related

- [Slack Thread](https://databricks.enterprise.slack.com/archives/C09T2G70BLH)
- Obsidian: `Accounts/bcd-travel/AI-BI Embedding.md`
- Obsidian: `Projects/Advito AI-BI Demo.md`
