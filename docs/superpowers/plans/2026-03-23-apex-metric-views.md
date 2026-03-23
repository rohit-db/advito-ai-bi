# APEX Metric Views — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `bcd_adv_workspace_poc.apex.travel_metrics` — a governed metric view with 27 dimensions and 23 measures, tracked in version control and deployable via Asset Bundles.

**Architecture:** The metric view YAML is authored as a SQL `CREATE VIEW` statement stored in `src/sql/`. A DABs job resource executes the SQL to create/update the metric view. Validation queries live alongside. This gives us version control, reproducibility, and multi-environment deployment.

**Tech Stack:** Databricks Asset Bundles, Unity Catalog Metric Views (YAML v1.1), SQL

**Spec:** `docs/superpowers/specs/2026-03-23-apex-metric-views-design.md`

**Workspace:** `https://dbc-1e27e56a-90cd.cloud.databricks.com`
**CLI Profile:** `bcd-customer`
**Warehouse:** `5cd3a4956df6152f`
**Schema:** `bcd_adv_workspace_poc.apex` (already created)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/sql/create_travel_metrics.sql` | Create | The metric view DDL (CREATE OR REPLACE VIEW ... WITH METRICS) |
| `src/sql/validate_travel_metrics.sql` | Create | All 11 validation queries with expected results as comments |
| `resources/metric_views.yml` | Create | DABs job resource to deploy the metric view |
| `databricks.yml` | Modify | Add include for resources/*.yml and variables for catalog/schema |

---

## Task 1: Pre-flight — Verify Access and Column Types

- [ ] **Step 1: Confirm apex schema exists**

```bash
databricks api post /api/2.0/sql/statements --profile bcd-customer --json '{
  "statement": "SHOW SCHEMAS IN bcd_adv_workspace_poc",
  "warehouse_id": "5cd3a4956df6152f",
  "wait_timeout": "50s"
}'
```

Expected: `apex` in the list.

- [ ] **Step 2: Check co2_emission_budget column type**

```bash
databricks api post /api/2.0/sql/statements --profile bcd-customer --json '{
  "statement": "SELECT typeof(co2_emission_budget) as budget_type FROM bcd_adv_workspace_poc.test.summarydataset LIMIT 1",
  "warehouse_id": "5cd3a4956df6152f",
  "wait_timeout": "50s",
  "format": "JSON_ARRAY"
}'
```

Expected: `double`. If `string`, the metric view measure needs `SUM(CAST(co2_emission_budget AS DOUBLE))`.

- [ ] **Step 3: Record source row count**

```bash
databricks api post /api/2.0/sql/statements --profile bcd-customer --json '{
  "statement": "SELECT COUNT(*) as row_count FROM bcd_adv_workspace_poc.test.summarydataset",
  "warehouse_id": "5cd3a4956df6152f",
  "wait_timeout": "50s",
  "format": "JSON_ARRAY"
}'
```

Record the exact count (expected ~1,408,893) for validation in Task 4.

---

## Task 2: Create the Metric View SQL File

**Files:**
- Create: `src/sql/create_travel_metrics.sql`

- [ ] **Step 1: Create directories**

```bash
mkdir -p src/sql
```

- [ ] **Step 2: Write the metric view DDL**

Create `src/sql/create_travel_metrics.sql` with the full `CREATE OR REPLACE VIEW ... WITH METRICS LANGUAGE YAML AS $$ ... $$` statement.

The complete YAML definition includes:
- 27 dimensions (9 time, 7 geography, 6 travel, 1 booking, 4 client)
- 23 measures (4 emissions, 3 spend, 9 volume, 4 intensity, 2 carbon budget, 1 booking)
- All with comments, display_names, synonyms, and formatting

See the spec (Section 3) for the full dimension/measure list. The YAML content is defined in the implementation plan at `docs/superpowers/plans/2026-03-23-apex-metric-views.md` (the prior version had the complete YAML — use that as the source).

Note: If Task 1 Step 2 showed `co2_emission_budget` is STRING, change the CO2 Budget measure expr to `SUM(CAST(co2_emission_budget AS DOUBLE))`.

- [ ] **Step 3: Commit**

```bash
git add src/sql/create_travel_metrics.sql
git commit -m "feat: add travel_metrics metric view DDL"
```

---

## Task 3: Create Validation SQL and Bundle Resources

**Files:**
- Create: `src/sql/validate_travel_metrics.sql`
- Create: `resources/metric_views.yml`
- Modify: `databricks.yml`

- [ ] **Step 1: Write validation queries**

Create `src/sql/validate_travel_metrics.sql` with all 11 test queries from the spec (Section 4), each as a separate statement with comments describing expected results.

- [ ] **Step 2: Create bundle resource for metric view deployment**

Create `resources/metric_views.yml`:

```yaml
resources:
  jobs:
    deploy_travel_metrics:
      name: "[${bundle.target}] Deploy APEX Travel Metrics"
      tasks:
        - task_key: create_metric_view
          sql_task:
            file:
              path: ../src/sql/create_travel_metrics.sql
            warehouse_id: ${var.warehouse_id}
      permissions:
        - level: CAN_VIEW
          group_name: "users"
```

- [ ] **Step 3: Update databricks.yml**

Add `include` and `variables` to `databricks.yml`:

```yaml
bundle:
  name: advito-ai-bi

include:
  - resources/*.yml

variables:
  catalog:
    default: "bcd_adv_workspace_poc"
  schema:
    default: "apex"
  warehouse_id:
    default: "5cd3a4956df6152f"

targets:
  bcd:
    workspace:
      host: https://dbc-1e27e56a-90cd.cloud.databricks.com
      profile: bcd-customer
    variables:
      catalog: "bcd_adv_workspace_poc"
      schema: "apex"
    # ... existing app config remains unchanged
```

Keep the existing `targets.bcd.resources.apps` and `sync` sections intact.

- [ ] **Step 4: Validate the bundle**

```bash
databricks bundle validate -t bcd
```

Expected: Validation passes.

- [ ] **Step 5: Commit**

```bash
git add src/sql/validate_travel_metrics.sql resources/metric_views.yml databricks.yml
git commit -m "feat: add metric view bundle resource and validation queries"
```

---

## Task 4: Deploy and Create the Metric View

- [ ] **Step 1: Deploy the bundle**

```bash
databricks bundle deploy -t bcd
```

- [ ] **Step 2: Run the metric view creation job**

```bash
databricks bundle run deploy_travel_metrics -t bcd
```

Or if the bundle job approach has issues, deploy directly via API:

```bash
databricks api post /api/2.0/sql/statements --profile bcd-customer --json '{
  "statement": "'"$(cat src/sql/create_travel_metrics.sql)"'",
  "warehouse_id": "5cd3a4956df6152f",
  "wait_timeout": "50s"
}'
```

- [ ] **Step 3: Verify creation**

```bash
databricks api post /api/2.0/sql/statements --profile bcd-customer --json '{
  "statement": "DESCRIBE TABLE EXTENDED bcd_adv_workspace_poc.apex.travel_metrics",
  "warehouse_id": "5cd3a4956df6152f",
  "wait_timeout": "50s"
}'
```

Expected: Lists all 27 dimensions and 23 measures with Type=METRIC_VIEW.

---

## Task 5: Run Validation Suite

Run each validation query from `src/sql/validate_travel_metrics.sql` and record results.

- [ ] **Step 1: Test 1 — Record count**

```sql
SELECT MEASURE(`Record Count`) as record_count FROM bcd_adv_workspace_poc.apex.travel_metrics
```

Cross-check: Should match the count from Task 1 Step 3.

- [ ] **Step 2: Test 2 — Emissions by category (cross-check with existing metric view)**

```sql
SELECT `Category`, MEASURE(`Total Emissions (Advito)`) as emissions
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE co2_emissions_advito <> 0
GROUP BY ALL ORDER BY emissions DESC
```

Cross-check against `test.summarydataset_metric_view`.

- [ ] **Step 3: Test 3 — Currency-converted spend**

```sql
SELECT `Category`,
  MEASURE(`Gross Spend (USD)`) as usd,
  MEASURE(`Gross Spend (EUR)`) as eur,
  MEASURE(`Gross Spend (GBP)`) as gbp
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE `Category` = 'Air' GROUP BY ALL
```

Cross-check against raw SQL: `SUM(currency_rate_usd * total_amount_gross)`.

- [ ] **Step 4: Test 4 — Traveler count by year**

```sql
SELECT `Travel Year`, MEASURE(`Traveler Count`) as travelers
FROM bcd_adv_workspace_poc.apex.travel_metrics
GROUP BY ALL ORDER BY `Travel Year`
```

Cross-check against `COUNT(DISTINCT employee_id)` on raw table.

- [ ] **Step 5: Test 5 — Carbon budget derived measure**

```sql
SELECT `Budget Field Value`,
  MEASURE(`CO2 Budget`) as budget,
  MEASURE(`Total Emissions (Advito)`) as actual,
  MEASURE(`Budget Remaining`) as remaining
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE `Budget Field` IS NOT NULL GROUP BY ALL
```

Verify: `remaining = budget - actual`.

- [ ] **Step 6: Test 6 — Intensity ratios + NULLIF**

```sql
-- Air: should have valid emissions_per_km
SELECT `Category`, MEASURE(`Emissions per KM`) as epkm
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE `Category` = 'Air' GROUP BY ALL

-- Hotel: emissions_per_km should be NULL, emissions_per_night should be valid
SELECT `Category`, MEASURE(`Emissions per KM`) as epkm, MEASURE(`Emissions per Night`) as epn
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE `Category` = 'Hotel' GROUP BY ALL
```

- [ ] **Step 7: Test 7 — Time dimensions format**

```sql
SELECT `Travel Month`, `Travel Quarter Label`, `Travel Year`, MEASURE(`Record Count`) as records
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE `Travel Year` = 2024 GROUP BY ALL ORDER BY `Travel Month` LIMIT 12
```

Verify: months `yyyy-MM`, quarters `Q1 2024`.

- [ ] **Step 8: Test 8 — Full KPI reproduction**

```sql
SELECT
  MEASURE(`Total Emissions (Advito)`) as total_emissions,
  MEASURE(`Gross Spend (USD)`) as total_spend_usd,
  MEASURE(`Component Count`) as total_components,
  MEASURE(`Traveler Count`) as total_travelers
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE `Invoice Date` BETWEEN '2025-01-01' AND '2025-06-30'
```

Cross-check against raw SQL with same filter.

- [ ] **Step 9: Test 9 — Advance booking days**

```sql
SELECT `Category`, MEASURE(`Avg Advance Booking Days`) as avg_days
FROM bcd_adv_workspace_poc.apex.travel_metrics
GROUP BY ALL ORDER BY avg_days DESC
```

- [ ] **Step 10: Test 10 — Budget type verification**

Already done in Task 1 Step 2. Confirm SUM worked without errors in Test 5.

---

## Task 6: Document Results and Final Commit

- [ ] **Step 1: Create validation results document**

Create `docs/data/metric-view-validation-results.md` with:
- Timestamp of validation run
- Each test: query, actual result, expected result, PASS/FAIL
- Summary: X/11 tests passed

- [ ] **Step 2: Final commit**

```bash
git add docs/data/metric-view-validation-results.md
git commit -m "docs: metric view validation results — all tests passed"
```
