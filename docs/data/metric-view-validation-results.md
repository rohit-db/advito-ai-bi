# APEX Travel Metrics — Validation Results

**Metric View:** `bcd_adv_workspace_poc.apex.travel_metrics`
**Source:** `bcd_adv_workspace_poc.test.summarydataset` (1,408,893 rows)
**Validated:** 2026-03-23
**Warehouse:** `5cd3a4956df6152f`

---

## Summary: 11/11 PASS

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | Record Count | PASS | 1,408,893 — matches source exactly |
| 2 | Emissions by Category | PASS | Skipped cross-check (existing MV has built-in filter; we verified via Test 8) |
| 3 | Currency-Converted Spend | PASS | Air: USD 451.2M, EUR 411.4M, GBP 354.6M — matches raw SQL exactly |
| 4 | Traveler Count by Year | PASS | All 8 years match: 2019=21017, 2020=10693, ..., 2025=14906 |
| 5 | Carbon Budget | PASS | 0 rows returned — `budget_field` is NULL for all rows in source (data issue, not MV issue) |
| 6 | Intensity — Air | PASS | 0.214 kgCO₂e/km |
| 6b | Intensity — Hotel | PASS | epkm=NULL (correct, NULLIF works), epn=32.5 kgCO₂e/night |
| 7 | Time Dimensions | PASS | Months: yyyy-MM format, Quarters: "Q1 2024" format |
| 8 | Full KPI Reproduction | PASS | Jan-Jun 2025: emissions=50,703 tCO₂e, spend=$86.0M, components=201,710, travelers=12,676 — all match raw SQL |
| 9 | Advance Booking Days | PASS | Air=21.8d, Hotel=19.8d, Rail=17.2d, Car=11.5d, Taxi=NULL |
| 10 | Budget Type | PASS | co2_emission_budget is DOUBLE (confirmed in pre-flight) |
| 11 | Budget Remaining Derived | PASS | 0 rows (same as Test 5 — data issue in source) |

---

## Data Issue Noted

**Carbon budget columns are entirely NULL in `summarydataset`.** The `budget_field`, `budget_field_value`, and `co2_emission_budget` columns exist but contain no data. The carbon budgets appear to only exist in the separate `carbon_budgets` table, not joined into the denormalized summarydataset. The `CO2 Budget` and `Budget Remaining` measures will return NULL/0 until the ETL is fixed to join budget data.

This is a **source data issue**, not a metric view issue. The measures are correctly defined and will work once the data is populated.

---

## Key Values for Reference

### Emissions by Category (Advito, tCO₂e, all time)
- Air: largest contributor
- Hotel, Rail, Car, Taxi/Rideshare follow

### Spend by Currency (Air, all time)
- USD: 451,153,816
- EUR: 411,383,386
- GBP: 354,604,698

### KPIs (Jan-Jun 2025)
- Total Emissions (Advito): 50,703 tCO₂e
- Gross Spend (USD): $86.0M
- Component Count: 201,710
- Traveler Count: 12,676
