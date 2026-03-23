# APEX Metric Views — Design Spec

**Date:** 2026-03-23
**Branch:** `feature/next-level`
**Status:** Draft
**Scope:** Metric view only. Genie Space and MAS endpoint are separate future specs.

---

## 1. Goal

Create a single, clean metric view (`bcd_adv_workspace_poc.apex.travel_metrics`) that serves as the governed semantic layer for APEX. It will be used by:
- **AI/BI Dashboards** — as a dataset source, replacing the monolithic KPI-Summary query
- **Genie Spaces** — for natural language Q&A
- **SQL queries** — for any ad-hoc analysis

The metric view is based on `summarydataset` (1.4M rows, 116 columns) and distills it into 25 focused dimensions and 22 measures with proper comments, synonyms, and formatting.

## 2. Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Number of metric views | 1 (`apex.travel_metrics`) | Carbon budget columns are already in `summarydataset` — no join needed |
| Source table | `bcd_adv_workspace_poc.test.summarydataset` | Properly typed (DATE, DOUBLE), unlike `qs_gate4_insights` which is all STRING |
| Schema | `bcd_adv_workspace_poc.apex` | Our own schema, doesn't touch existing `test` assets |
| Global filter | None | Existing view filters `co2_emissions_advito <> 0` — we don't. Let consumers decide. |
| Existing assets | Untouched | We do NOT modify `summarydataset_metric_view` or any other existing assets |
| Joins | None for v1 | `client` table join could be added later but `client_name` is already in `summarydataset` |

## 3. Metric View Definition

### 3.1 Dimensions (25)

#### Time (9 dimensions)

| Name | Expression | Comment |
|------|-----------|---------|
| `Invoice Date` | `invoice_date` | Transaction date for Taxi/Rideshare and Personal Vehicle |
| `Travel Start Date` | `travel_start_date` | Check-in for Hotel, Pickup for Car, Departure for Air/Rail |
| `Travel End Date` | `travel_end_date` | Check-out for Hotel, Return for Car, Arrival for Air/Rail |
| `Travel Month` | `DATE_FORMAT(travel_start_date, 'yyyy-MM')` | Derived monthly grain |
| `Travel Quarter Label` | `CONCAT('Q', QUARTER(travel_start_date), ' ', YEAR(travel_start_date))` | e.g., "Q1 2024" |
| `Travel Year` | `report_travel_year` | Integer year |
| `Invoice Month` | `DATE_FORMAT(invoice_date, 'yyyy-MM')` | Derived monthly grain |
| `Invoice Quarter Label` | `CONCAT('Q', QUARTER(invoice_date), ' ', YEAR(invoice_date))` | e.g., "Q2 2024" |
| `Invoice Year` | `report_invoice_year` | Integer year |

#### Geography (7 dimensions)

| Name | Expression | Comment | Synonyms |
|------|-----------|---------|----------|
| `Origin City` | `origin_city` | Departure city (Air/Rail), Pickup city (Car) | Departure City, Pickup City |
| `Destination City` | `destination_city` | Arrival city (Air/Rail), Return city (Car), Major city (Hotel) | Arrival City, Major City |
| `Origin Country` | `origin_country_name` | Country of origin | |
| `Destination Country` | `destination_country` | Country of destination | |
| `Traveler Country` | `traveler_country` | Country of the traveler (POS) | Country POS |
| `Hotel City` | `hotel_property_city` | City where hotel is located | Property City |
| `Travel Sector` | `travel_sector` | Intra-Country, Intra-Continental, Inter-Continental | Sector, Geographic Scope |

#### Travel (6 dimensions)

| Name | Expression | Comment | Synonyms |
|------|-----------|---------|----------|
| `Category` | `category` | Air, Hotel, Rail, Car, Taxi/Rideshare | Travel Type |
| `Travel Class` | `travel_class` | Cabin class (Air/Rail), Market tier (Hotel), Car type | Cabin, Car Type |
| `Vendor` | `vendor` | Airline, Hotel chain, Car company, Rail carrier | Supplier, Carrier, Airline |
| `Travel Details` | `travel_details` | Route (Air/Rail), Property name (Hotel), Expense type (Taxi) | City Pair, Route |
| `Air Carrier` | `air_carrier_code` | IATA airline code | Airline, Carrier Code |
| `Eco Certified Hotel` | `hotel_eco_certified` | Whether hotel has sustainability certification | Green Hotel |

#### Client (4 dimensions)

| Name | Expression | Comment |
|------|-----------|---------|
| `Client ID` | `client_id` | Client identifier |
| `Client Name` | `client_name` | Client display name |
| `Budget Field` | `budget_field` | Carbon budget dimension (e.g., "traveler_country") |
| `Budget Field Value` | `budget_field_value` | Carbon budget dimension value (e.g., "Romania") |

### 3.2 Measures (22)

#### Emissions — 4 methodologies, all in tCO₂e

| Name | Expression | Comment | Synonyms |
|------|-----------|---------|----------|
| `Total Emissions (Advito)` | `SUM(co2_emissions_advito)/1000` | Advito Gate4 methodology | Emissions, CO2, Carbon |
| `Total Emissions (Defra)` | `SUM(co2_emissions_defra)/1000` | Defra methodology | Emissions Defra |
| `Total Emissions W/O RF (Advito)` | `SUM(co2_emissions_advito_wo_rf)/1000` | Advito without Radiative Forcing | |
| `Total Emissions W/O RF (Defra)` | `SUM(co2_emissions_defra_wo_rf)/1000` | Defra without Radiative Forcing | |

#### Spend — pre-converted to 3 currencies

| Name | Expression | Comment | Synonyms |
|------|-----------|---------|----------|
| `Gross Spend (USD)` | `SUM(currency_rate_usd * total_amount_gross)` | Total spend converted to USD | Spend USD, Total Amount USD |
| `Gross Spend (EUR)` | `SUM(currency_rate_eur * total_amount_gross)` | Total spend converted to EUR | Spend EUR |
| `Gross Spend (GBP)` | `SUM(currency_rate_gbp * total_amount_gross)` | Total spend converted to GBP | Spend GBP |

#### Volume

| Name | Expression | Comment | Synonyms |
|------|-----------|---------|----------|
| `Component Count` | `SUM(component_count)` | Total trip components (segments, nights, rental days) | Volume, Trip Components |
| `Flight Count` | `SUM(air_net_segment_count)` | Number of flights | Flights, Air Legs |
| `Air Segment Count` | `SUM(air_od_segment_count)` | Number of OD air segments | Air Segments |
| `Hotel Nights` | `SUM(hotel_nights)` | Room nights | Room Nights |
| `Car Rental Days` | `SUM(car_rental_days)` | Rental days charged | Rental Days |
| `Rail Segment Count` | `SUM(rail_segment_count)` | Rail journey legs | Rail Segments |
| `Total Distance (KM)` | `SUM(distance_km)` | Total distance traveled | Distance |
| `Traveler Count` | `COUNT(DISTINCT employee_id)` | Unique travelers | Unique Travelers |

#### Intensity — derived ratios using MEASURE()

| Name | Expression | Comment |
|------|-----------|---------|
| `Emissions per KM` | `MEASURE(\`Total Emissions (Advito)\`)*1000 / MEASURE(\`Total Distance (KM)\`)` | kgCO₂e per km |
| `Emissions per Night` | `MEASURE(\`Total Emissions (Advito)\`)*1000 / MEASURE(\`Hotel Nights\`)` | kgCO₂e per hotel night |
| `Emissions per Segment` | `MEASURE(\`Total Emissions (Advito)\`)*1000 / MEASURE(\`Air Segment Count\`)` | kgCO₂e per air segment |
| `Emissions per Rental Day` | `MEASURE(\`Total Emissions (Advito)\`)*1000 / MEASURE(\`Car Rental Days\`)` | kgCO₂e per car rental day |

#### Carbon Budget

| Name | Expression | Comment |
|------|-----------|---------|
| `CO2 Budget` | `SUM(co2_emission_budget)` | Allocated carbon budget (from summarydataset) |
| `Budget Remaining` | `SUM(co2_emission_budget) - SUM(co2_emissions_advito)/1000` | Budget minus actual emissions |

#### Booking

| Name | Expression | Comment |
|------|-----------|---------|
| `Avg Advance Booking Days` | `AVG(adv_booking_days)` | Average days booked before travel |

### 3.3 Formatting

All emission measures: `number`, 1 decimal place, compact abbreviation
All spend measures: `number`, 1 decimal place, compact abbreviation
All volume measures: `number`, 0 decimal places, compact abbreviation
Intensity measures: `number`, 2 decimal places
Date dimensions: `date`, YEAR_MONTH_DAY, leading zeros

## 4. Validation Test Queries

After creating the metric view, run these queries to validate against known values from the existing dashboard/data.

### Test 1: Total row count (should match summarydataset)

```sql
-- Expected: 1,408,893 (no global filter, so full table)
SELECT MEASURE(`Component Count`) as total_components
FROM bcd_adv_workspace_poc.apex.travel_metrics
```

### Test 2: Emissions by category — cross-check with existing metric view

```sql
-- Run against BOTH views and compare
-- Our view:
SELECT
  `Category`,
  MEASURE(`Total Emissions (Advito)`) as emissions_advito
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE co2_emissions_advito <> 0
GROUP BY ALL
ORDER BY emissions_advito DESC

-- Existing view:
SELECT
  `Category`,
  MEASURE(`total_co2_emissions_advito`) as emissions_advito
FROM bcd_adv_workspace_poc.test.summarydataset_metric_view
GROUP BY ALL
ORDER BY emissions_advito DESC

-- EXPECTED: Values should match exactly (same source, same aggregation, same filter applied manually)
```

### Test 3: Currency-converted spend — verify math

```sql
-- Spot-check: USD spend should equal raw total_amount_gross for USD-denominated transactions
SELECT
  MEASURE(`Gross Spend (USD)`) as spend_usd,
  MEASURE(`Gross Spend (EUR)`) as spend_eur,
  MEASURE(`Gross Spend (GBP)`) as spend_gbp
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE `Category` = 'Air'
GROUP BY ALL

-- Cross-check against raw SQL:
SELECT
  SUM(currency_rate_usd * total_amount_gross) as spend_usd,
  SUM(currency_rate_eur * total_amount_gross) as spend_eur,
  SUM(currency_rate_gbp * total_amount_gross) as spend_gbp
FROM bcd_adv_workspace_poc.test.summarydataset
WHERE category = 'Air'

-- EXPECTED: Values should match exactly
```

### Test 4: Traveler count — verify distinct count works

```sql
SELECT
  `Travel Year`,
  MEASURE(`Traveler Count`) as travelers
FROM bcd_adv_workspace_poc.apex.travel_metrics
GROUP BY ALL
ORDER BY `Travel Year`

-- Cross-check:
SELECT
  report_travel_year,
  COUNT(DISTINCT employee_id) as travelers
FROM bcd_adv_workspace_poc.test.summarydataset
GROUP BY 1
ORDER BY 1

-- EXPECTED: Values should match exactly
```

### Test 5: Carbon budget measures

```sql
SELECT
  `Budget Field`,
  `Budget Field Value`,
  MEASURE(`CO2 Budget`) as budget,
  MEASURE(`Total Emissions (Advito)`) as actual,
  MEASURE(`Budget Remaining`) as remaining
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE `Budget Field` IS NOT NULL
GROUP BY ALL
ORDER BY budget DESC
LIMIT 10

-- Verify: budget - actual ≈ remaining (within floating point tolerance)
```

### Test 6: Intensity ratios — sanity check

```sql
SELECT
  `Category`,
  MEASURE(`Emissions per KM`) as epkm,
  MEASURE(`Total Emissions (Advito)`) as emissions,
  MEASURE(`Total Distance (KM)`) as distance
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE `Category` = 'Air'
GROUP BY ALL

-- Verify: epkm ≈ (emissions * 1000) / distance
```

### Test 7: Time dimensions — verify derivations

```sql
SELECT
  `Travel Month`,
  `Travel Quarter Label`,
  `Travel Year`,
  MEASURE(`Component Count`) as components
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE `Travel Year` = 2024
GROUP BY ALL
ORDER BY `Travel Month`
LIMIT 12

-- Verify: months are yyyy-MM format, quarter labels are "Q1 2024" etc.
```

### Test 8: Dashboard KPI reproduction — verify the new view can produce the same KPIs

```sql
-- Reproduce the dashboard's "Total Emissions" KPI counter for a specific period
-- The existing dashboard uses the KPI-Summary query with date filtering
SELECT
  MEASURE(`Total Emissions (Advito)`) as total_emissions,
  MEASURE(`Gross Spend (USD)`) as total_spend_usd,
  MEASURE(`Component Count`) as total_components,
  MEASURE(`Traveler Count`) as total_travelers
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE `Invoice Date` BETWEEN '2025-01-01' AND '2025-06-30'

-- Compare against the raw source with the same filter:
SELECT
  SUM(co2_emissions_advito)/1000 as total_emissions,
  SUM(currency_rate_usd * total_amount_gross) as total_spend_usd,
  SUM(component_count) as total_components,
  COUNT(DISTINCT employee_id) as total_travelers
FROM bcd_adv_workspace_poc.test.summarydataset
WHERE invoice_date BETWEEN '2025-01-01' AND '2025-06-30'

-- EXPECTED: Values should match exactly
```

## 5. What This Replaces

The metric view makes these existing dashboard artifacts obsolete (but we do NOT delete them):

| Existing Asset | Problem | How metric view helps |
|---|---|---|
| KPI-Summary query (134 lines) | Monolithic, does everything in one query | Break into focused `SELECT ... FROM METRIC()` queries per visualization |
| 6 static filter datasets (VALUES tables) | Hardcoded dropdown options | Filters come from dimension values in the metric view |
| `carbon_forecasting` 4-CTE query | Reads from `qs_gate4_insights` (STRING types) | Can read from metric view with proper types |
| `advito_poc` redundant view | Unnecessary indirection | Not needed — metric view points to `summarydataset` directly |

## 6. What's NOT In Scope

- Modifying any existing tables, views, or metric views in `test` schema
- Carbon forecasting scenario modeling (complex CTE logic — stays as a dashboard dataset for now)
- Materialization (can be enabled later for performance)
- Row-level security / ABAC (future, post-POC)
- Genie Space or MAS endpoint (separate specs)

## 7. Schema & Permissions

- **Schema:** `bcd_adv_workspace_poc.apex` (already created)
- **Owner:** `rohit.bhagwat@bcdtravel.com`
- **Metric view:** `bcd_adv_workspace_poc.apex.travel_metrics`
- After creation, grant SELECT to relevant users/groups as needed
