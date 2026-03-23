# Analysis: bcd_adv_workspace_poc.test.summarydataset & RB Advito POC Dashboard

## 1. Table Overview

**Table:** `bcd_adv_workspace_poc.test.summarydataset`  
**Type:** Managed Delta table  
**Owner:** ashlesha.aher@advito.com  
**Created:** Dec 31, 2025 | **Last Updated:** Mar 09, 2026 (by lalit.toge@advito.com)  
**Row-Level Security:** `client_access_filter` on `client_id`  
**Total Columns:** 116  

### Purpose
A **denormalized corporate travel summary** combining air, hotel, rail, car, taxi/rideshare, personal vehicle, and carbon budget data into a single wide table. Each row represents a travel transaction/segment tied to a client and traveler.

---

## 2. Column Groups (116 columns)

| Group | Count | Key Columns |
|-------|-------|-------------|
| **Identifiers** | 6 | `row_id`, `client_id`, `client_name`, `client`, `record_key`, `project_id` |
| **Travel Basics** | 12 | `category`, `ticket_confirmation_number`, `invoice_date`, `traveler`, `travel_start_date`, `travel_end_date`, `travel_details`, `travel_sector`, `vendor`, `travel_class`, `booking_source`, `locator` |
| **Geography - Origin** | 6 | `origin_city`, `origin_city_id`, `origin_state_id`, `origin_country_id`, `origin_country_name`, `origin_country_code` |
| **Geography - Destination** | 7 | `destination_city`, `destination_city_id`, `destination_state_id`, `destination_country_id`, `destination_country`, `destination_country_code`, `destination_country_region` |
| **Financials** | 6 | `total_amount_net`, `total_amount_gross`, `source_currency`, `currency_rate_usd`, `currency_rate_eur`, `currency_rate_gbp` |
| **CO2 Emissions** | 4 | `co2_emissions_advito`, `co2_emissions_defra`, `co2_emissions_advito_wo_rf`, `co2_emissions_defra_wo_rf` |
| **Air-specific** | 22 | Segment counts, carrier codes, fuel efficiency, OD markets, flight times, rail alternatives, trip indicators, departure/arrival dates, city codes, round trip indicator |
| **Hotel-specific** | 7 | `hotel_nights`, `hotel_eco_certified`, `hotel_liter_per_night`, `hotel_property_city/state/country/region` |
| **Rail-specific** | 2 | `rail_segment_count`, `rail_ticket_count` |
| **Car-specific** | 2 | `car_rental_days`, `car_fuel_type` |
| **Booking Metadata** | 4 | `adv_booking_days`, `exchange_indicator`, `refund_indicator`, `component_count`, `distance_km`, `distance_miles` |
| **Client Custom Fields** | 10 | `client_field_1` through `client_field_10` |
| **HR Custom Fields** | 16 | `hr_field_1`–`hr_field_12`, `traveler_country`, `job_id`, `traveler_email_address`, `traveler_country_id` |
| **Carbon Budgets** | 3 | `budget_field`, `budget_field_value`, `co2_emission_budget` |
| **Reporting** | 4 | `report_invoice_year`, `report_travel_year`, `metro_area`, `true_trip_exists` |

---

## 3. Upstream Sources — Detailed Analysis

### 3.0 CRITICAL FINDING: `advito_poc` is a VIEW

```sql
-- advito_poc definition:
SELECT * FROM summarydataset
```

**`bcd_adv_workspace_poc.test.advito_poc`** is NOT a separate table — it is a **VIEW** that simply does `SELECT * FROM summarydataset`.  
This means the dashboard's KPI-Summary (which queries `advito_poc`) is actually reading from `summarydataset` through a thin view wrapper.  
**Implication:** The "table confusion" is resolved — they are the same data — but the indirection through a view adds unnecessary complexity and should be eliminated.

---

### 3.1 `qs_gate4_insights` — Core Travel Data (Primary Source)

| Property | Value |
|----------|-------|
| **Full Name** | `bcd_adv_workspace_poc.test.qs_gate4_insights` |
| **Type** | Managed Delta table |
| **Owner** | somanath.dixit@advito.com |
| **Created** | Nov 17, 2025 |
| **Columns** | 102 |
| **Row Filter** | `client_name` function on `client_id` |
| **Upload Method** | Imported via file upload |

**Column Summary (102 columns):**

| Group | Columns | Types |
|-------|---------|-------|
| IDs | `row_id`, `client_id`, `origin_city_id`, `destination_city_id`, etc. | **BIGINT** |
| Client | `client_name` | varchar(100) |
| Travel Core | `record_key`, `category`, `ticket_confirmation_number`, `traveler`, `vendor`, `travel_class`, `travel_sector`, `travel_details`, `booking_source`, `locator` | varchar/string |
| Dates | `invoice_date`, `travel_start_date`, `travel_end_date`, `air_departure_date`, `air_arrival_date` | **STRING** (not DATE!) |
| Times | `air_departure_time`, `air_arrival_time` | **STRING** |
| Financials | `total_amount_net`, `total_amount_gross`, `currency_rate_usd/eur/gbp` | **STRING** (not DOUBLE!) |
| CO2 | `co2_emissions_advito`, `co2_emissions_defra`, `co2_emissions_advito_wo_rf`, `co2_emissions_defra_wo_rf` | **STRING** (not DOUBLE!) |
| Distances | `distance_km`, `distance_miles` | **STRING** |
| Air | `air_net_segment_count`, `air_od_segment_count`, `air_segment_number`, `air_trip_length` (BIGINT); `air_direct_indicator`, `air_od_market`, `air_carrier_code`, `air_trip_indicator`, `air_rail_alternative`, `air_fuel_efficiency_type_id` (BIGINT), `air_odflighttimeinminutes` (STRING), `air_rail_co2_factor` (STRING), `air_rail_train_distance` (STRING), `air_rail_train_duration` (STRING) | Mixed |
| Hotel | `hotel_nights` (BIGINT), `hotel_eco_certified`, `hotel_property_city`, `hotel_liter_per_night` (STRING) | Mixed |
| Rail | `rail_segment_count`, `rail_ticket_count` | BIGINT |
| Car | `car_rental_days` (BIGINT), `car_fuel_type` | Mixed |
| Client Fields | `client_field_1` through `client_field_10` | varchar(100) |
| HR Fields | `hr_field_1` through `hr_field_12`, `traveler_country`, `traveler_email_address` | varchar(100) |
| Other | `project_id`, `traveler_id`, `employee_id`, `job_id`, `report_invoice_year`, `report_travel_year`, `emissions_exclude_reason_id`, `metro_area`, `air_destination_city_code`, `air_origin_city_code`, `round_trip_indicator` | Mixed |

#### ⚠️ CRITICAL DATA TYPE ISSUE
Almost all numeric and date columns in `qs_gate4_insights` are stored as **STRING**:
- Dates (`invoice_date`, `travel_start_date`, etc.) → STRING instead of DATE
- Amounts (`total_amount_gross`, `total_amount_net`) → STRING instead of DOUBLE
- Emissions (`co2_emissions_advito`, etc.) → STRING instead of DOUBLE
- Exchange rates (`currency_rate_usd/eur/gbp`) → STRING instead of DOUBLE

This forces `try_cast()` everywhere in dashboard queries and is the root cause of carbon forecasting complexity.

#### Columns in `qs_gate4_insights` NOT in `summarydataset`
- `air_departure_time`, `air_arrival_time` — dropped during transformation
- `emissions_exclude_reason_id` — dropped during transformation

#### Columns in `summarydataset` NOT in `qs_gate4_insights` (enriched during ETL)
- `client` — likely derived from `client_name` or a mapping
- `air_fuel_efficiency` — derived from `air_fuel_efficiency_type_id` lookup
- `air_trip_length_days` — STRING version of `air_trip_length`
- `true_trip_exists` — computed flag
- `origin_country_name`, `origin_country_code` — from geo lookups
- `destination_country`, `destination_country_code`, `destination_country_region` — from geo lookups
- `hotel_property_state`, `hotel_property_country`, `hotel_property_region` — from geo lookups
- `traveler_country_id`, `traveler_region` — from geo lookups
- `budget_field`, `budget_field_value`, `co2_emission_budget` — from carbon_budgets join

---

### 3.2 `carbon_budgets` — Carbon Budget Allocations

| Property | Value |
|----------|-------|
| **Full Name** | `bcd_adv_workspace_poc.test.carbon_budgets` |
| **Type** | Managed Delta table |
| **Columns** | 15 |
| **Upload Method** | File upload UI |

**Columns:**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | bigint | Primary key |
| `client_id` | int | FK to client |
| `date_from` | string | Budget period start |
| `date_to` | string | Budget period end |
| `is_global` | boolean | Global vs regional scope |
| `budget_field` | varchar(100) | Budget category (e.g., "Traveler Country") |
| `budget_field_value` | varchar(100) | Specific value (e.g., "Poland") |
| `co2_emission_budget` | **string** | CO2 budget amount — ⚠️ STRING, not DOUBLE |
| `created_by` | varchar(100) | Audit |
| `modified_by` | varchar(100) | Audit |
| `created` | string | Audit timestamp |
| `modified` | string | Audit timestamp |
| `_rescued_data` | string | Upload recovery |
| `month_start` | timestamp | Period month start |
| `month_count` | int | Number of months covered |

**Note:** `co2_emission_budget` is STRING type, requiring casting. This budget data is joined into `summarydataset` during the ETL process.

---

### 3.3 `geo_region` — Geographic Region Lookups

| Property | Value |
|----------|-------|
| **Full Name** | `bcd_adv_workspace_poc.test.geo_region` |
| **Type** | Managed Delta table |
| **Columns** | 10 |
| **Upload Method** | File upload UI |

**Columns:** `id` (bigint), `geo_region_group_id` (bigint), `region_name` (varchar(64)), `region_code` (varchar(4)), `region_note` (string), `created`, `modified`, `created_by`, `modified_by`, `_rescued_data`

**Usage:** Provides region names/codes enriched into `summarydataset` columns like `destination_country_region`, `hotel_property_region`, `traveler_region`.

---

### 3.4 `geo_subregion` — Subregion Lookups

| Property | Value |
|----------|-------|
| **Full Name** | `bcd_adv_workspace_poc.test.geo_subregion` |
| **Type** | Managed Delta table |
| **Columns** | 8 |
| **Upload Method** | File upload UI |

**Columns:** `id` (bigint), `geo_region_id` (bigint → FK to geo_region), `subregion_name` (varchar(64)), `subregion_code` (varchar(4)), `subregion_note` (string), `created`, `modified`, `_rescued_data`

**Usage:** Links subregions to regions, part of the geography hierarchy: region → subregion → country → state → city.

---

### 3.5 `geo_state` — State-Level Geography

| Property | Value |
|----------|-------|
| **Full Name** | `bcd_adv_workspace_poc.test.geo_state` |
| **Type** | Managed Delta table |
| **Columns** | 12 |
| **Upload Method** | File upload UI |

**Columns:** `id` (bigint), `geo_country_id` (bigint → FK to country), `state_name` (varchar(64)), `state_code` (varchar(8)), `latitude` (string), `longitude` (string), `master_created`, `master_modified`, `note`, `created`, `modified`, `_rescued_data`

**Usage:** State-level geography lookup enriching `hotel_property_state` and potentially origin/destination state names.

---

## 4. Data Lineage Diagram

```
┌──────────────────────┐     ┌──────────────────────┐
│   qs_gate4_insights   │     │    carbon_budgets     │
│  (102 cols, STRING    │     │  (15 cols, budget     │
│   types everywhere)   │     │   allocations)        │
└──────────┬───────────┘     └──────────┬───────────┘
           │                            │
           │  ┌────────────────┐        │
           │  │   geo_region   │        │
           │  │   geo_subregion│        │
           │  │   geo_state    │        │
           │  └───────┬────────┘        │
           │          │                 │
           ▼          ▼                 ▼
    ┌─────────────────────────────────────────┐
    │          summarydataset                  │
    │  (116 cols, proper types: DATE, DOUBLE)  │
    │  Row filter: client_access_filter        │
    └────────────────┬────────────────────────┘
                     │
                     ▼
    ┌─────────────────────────────────────────┐
    │           advito_poc (VIEW)              │
    │        SELECT * FROM summarydataset      │
    └────────────────┬────────────────────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
   ┌────────────┐ ┌──────┐ ┌────────────────────┐
   │KPI-Summary │ │Budget│ │  Other dashboard    │
   │(6 pages)   │ │page  │ │  datasets           │
   └────────────┘ └──────┘ └────────────────────┘

   *** Carbon Forecasting queries bypass this entirely ***
   *** and go directly to qs_gate4_insights (raw STRINGs) ***
```

---

## 5. Dashboard Analysis: RB Advito POC

**Dashboard:** RB Advito POC  
**Pages:** 8 | **Datasets:** 14  
**Owner:** rohit.bhagwat@bcdtravel.com  

### 5.1 Pages & Structure

| Page | Purpose | Primary Dataset |
|------|---------|-----------------|
| Global Filters | Emission methodology, date type, country, currency | Multiple filter datasets |
| SUMMARY | KPI counters + emissions charts | KPI-Summary |
| Summary 2 | Extended summary with category/emission cost filters | KPI-Summary |
| COMPARATIVE ACTIVITY | Pivot table for dimension comparison | KPI-Summary |
| Summary - formatting | Another summary variant (appears to be a copy of Summary 2) | KPI-Summary |
| carbon_budgets | Budget vs actual emissions tracking | KPI-Summary |
| carbon forecasting | Multi-year forecasting with scenario modeling | carbon_forecasting |
| KPI Dashboard | Consolidated KPI counters | KPI-Summary |

### 5.2 Datasets

| Dataset | Source Table | Purpose |
|---------|-------------|---------|
| `summarydataset` | advito_poc + summarydataset | Stale query: `select count(*)` from advito_poc then `select *` from summarydataset |
| **KPI-Summary** | **advito_poc (VIEW → summarydataset)** | Main dataset powering 6 of 8 pages |
| emissions_methodology | Static values | Filter: ADVITO, ADVITO_wo_RF, DEFRA |
| Select_date | Static values | Filter: Invoice date, travel_start_date |
| Select_Column | Static values | Filter: category, country, traveler, travel_sector, travel_class |
| Select_Metric | Static values | Filter: Emissions, Gross Spend, Components |
| Currency | Static values | Filter: USD, EUR, GBP |
| carbon_budgets | advito_poc | Budget field aggregation |
| Summary Dataset Overview Count | qs_gate4_insights | Top destination city (hardcoded Q2 2024) |
| Single Day Carbon Emission YoY | summarydataset | YoY emissions (hardcoded 2025-11-28) |
| carbon_forecasting_archive | qs_gate4_insights | Archived version of forecasting |
| **carbon_forecasting** | **qs_gate4_insights** | Active forecasting with 4 CTE layers |
| carbon_forecasting_optimized | qs_gate4_insights | Optimization attempt v1 |
| carbon_forecasting_optimized_v2 | qs_gate4_insights | Optimization attempt v2 |

---

## 6. Critical Issues Found

### 6.1 advito_poc is a Redundant VIEW (RESOLVED)
- `advito_poc` is simply `SELECT * FROM summarydataset` — a thin wrapper view
- The dashboard should query `summarydataset` directly and the view should be dropped
- The view adds confusion and an unnecessary layer of indirection

### 6.2 Inconsistent Data Sources Across Dashboard
- **Summary pages** → `advito_poc` → `summarydataset` (proper DATE/DOUBLE types)
- **Carbon forecasting pages** → `qs_gate4_insights` directly (raw STRING types, needs `try_cast` everywhere)
- This means two different pages in the same dashboard read from different stages of the data pipeline, creating inconsistency risks

### 6.3 qs_gate4_insights Has All-STRING Types
Almost every numeric and date column is STRING, forcing:
- `try_cast(co2_emissions_advito AS DOUBLE)` in every forecasting query
- Potential silent data loss when casts fail
- **Root cause fix:** Add proper data type casting in the ETL that creates `qs_gate4_insights`, or always use `summarydataset` which has proper types

### 6.4 Monolithic KPI-Summary Query
The single `KPI-Summary` query (~6,200 chars) does EVERYTHING in one place:
- Period filtering (current vs previous)
- Dynamic dimension selection via parameters
- Currency conversion (3 currencies)
- Emissions methodology selection (3 methods)
- Metric selection (emissions/spend/components)
- Traveler name cleaning (strip MR/MRS/MS/DR/MISS suffixes)
- Share calculations via window functions
- Traveler type classification (Road Warrior/Frequent/Occasional)

**This is the single biggest problem.** One query powers 6 pages making it nearly impossible to debug or optimize.

### 6.5 Duplicate/Redundant Pages
- **SUMMARY**, **Summary 2**, and **Summary - formatting** appear to be iterations of the same page that were never cleaned up
- All three use the same `KPI-Summary` dataset with similar widgets

### 6.6 Duplicate Carbon Forecasting Queries
Four versions exist: `carbon_forecasting_archive`, `carbon_forecasting`, `carbon_forecasting_optimized`, `carbon_forecasting_optimized_v2`
- All query `qs_gate4_insights` with similar 4-layer CTE structures
- Indicates iterative development that was never consolidated

### 6.7 Hardcoded Values
- `Summary Dataset Overview Count`: Hardcoded date range `2024-04-01 to 2024-06-30`
- `Single Day Carbon Emission YoY`: Hardcoded date `2025-11-28`
- These won't update dynamically

### 6.8 Carbon Forecasting Complexity
The active `carbon_forecasting` query has:
- 4 CTE layers: `carbon_budgeting` → `calc_layer_1` → `calc_layer_2` → `calc_layer_3`
- 25+ columns carried through GROUP BY in every layer
- ~20 dashboard parameters for scenario modeling (SAF price, FTE increase, hotel shift, car shift, etc.)
- LATERAL VIEW explode for year sequence generation
- Multiple forecast variants (BAU, scenario, with/without efficiency, with/without FTE)

### 6.9 Repeated Logic
- Traveler name cleaning (`CASE WHEN RIGHT(traveler,3)='MRS'...`) appears in both `KPI-Summary` and `carbon_forecasting`
- Emissions methodology selection CASE appears in both queries
- Date type selection CASE appears in both queries

### 6.10 Excessive Granularity in GROUP BY
The KPI-Summary groups by individual `traveler` name, then calculates shares via window functions. This produces massive intermediate result sets when most visualizations only need category/country/sector-level aggregations.

### 6.11 Geography Lookup Tables are File Uploads with STRING Types
All geo tables (`geo_region`, `geo_subregion`, `geo_state`) and `carbon_budgets` were uploaded via the file upload UI:
- Dates/timestamps stored as STRING
- Lat/long stored as STRING in `geo_state`
- No foreign key enforcement between them
- `_rescued_data` columns present in all (auto-generated by upload)

---

## 7. Refactoring Recommendations

### 7.1 Eliminate the `advito_poc` View
- Drop the view; update all dashboard queries to reference `summarydataset` directly
- Or better: rename `summarydataset` to something more descriptive (e.g., `travel_summary_fact`)

### 7.2 Fix Data Types at Source
- Alter `qs_gate4_insights` columns to proper types (DATE, DOUBLE, BIGINT) instead of STRING
- Or create a properly typed intermediate view/table between raw import and `summarydataset`
- This eliminates the need for `try_cast()` in every downstream query

### 7.3 Standardize on ONE Source for the Dashboard
- All dashboard datasets should use `summarydataset` (or its successor)
- Carbon forecasting queries should NOT bypass to `qs_gate4_insights` directly

### 7.4 Break Up KPI-Summary into Purpose-Built Datasets
Instead of one monolithic query, create focused datasets:
1. **Summary KPIs**: Pre-aggregated totals (emissions, spend, components)
2. **Trend Data**: Monthly/yearly aggregations for time series charts
3. **Dimensional Breakdown**: Category/sector/country aggregations for pie/bar charts
4. **Traveler Analysis**: Traveler-level data only for pages that need it
5. **Carbon Budget Comparison**: Budget vs actual

### 7.5 Move Repeated Logic to Views or the Source Table
- Traveler name cleaning → add a `traveler_clean` column to the source table
- Emissions methodology selection → create a view with pre-calculated `selected_emissions` column
- Currency conversion → pre-compute in the source table or a materialized view

### 7.6 Consolidate Carbon Forecasting
- Delete the 3 archive/optimization variants
- Keep only the active `carbon_forecasting` query
- Consider pre-computing forecast scenarios in a separate table/view

### 7.7 Clean Up Pages
- Consolidate SUMMARY / Summary 2 / Summary - formatting into a single page
- Remove unused datasets

### 7.8 Parameterize Hardcoded Values
- Replace hardcoded dates in `Summary Dataset Overview Count` and `Single Day Carbon Emission YoY` with dashboard parameters

### 7.9 Consider Restructuring the Source Table
- The 116-column wide table with many NULL columns per category is a candidate for:
  - Vertical decomposition (separate Air, Hotel, Rail, Car fact tables)
  - Or at minimum, pre-computed aggregate tables for dashboard consumption
