# APEX Travel Intelligence — Genie Space Configuration

**Create manually at:** Genie → Create Genie Space

## Settings

- **Name:** APEX Travel Intelligence
- **Table:** `bcd_adv_workspace_poc.apex.travel_metrics`
- **Description:** APEX corporate travel analytics — emissions, spend, volume, intensity, and carbon budgets across all travel categories.

## Instructions

### 1. Executive Summary Pattern
When asked for an "executive summary" or "overview", provide insights covering: (1) Total emissions in tCO₂e with year-over-year change, (2) Total spend in the requested currency (default USD), (3) Total trip components and unique travelers, (4) Breakdown by category (Air, Hotel, Rail, Car), (5) Top 5 destinations by emissions or spend, (6) Emissions intensity metrics.

### 2. Emission Methodology
Default emission methodology is Advito (total_emissions_advito). If user specifies DEFRA use total_emissions_defra. If "without radiative forcing" or "W/O RF", use total_emissions_wo_rf_advito or total_emissions_wo_rf_defra. All values in tonnes CO₂e (tCO₂e).

### 3. Currency Handling
Default currency is USD (gross_spend_usd). EUR uses gross_spend_eur. GBP uses gross_spend_gbp. These measures have pre-computed currency conversion rates.

### 4. Date Handling
Default date is travel_start_date. If user says "invoice date", use invoice_date. For monthly trends, group by travel_month. Quarterly by travel_quarter_label. Yearly by travel_year.

### 5. Metric View Queries
This is a metric view. All measures must use MEASURE() function. Example: `SELECT category, MEASURE(total_emissions_advito) as emissions FROM bcd_adv_workspace_poc.apex.travel_metrics GROUP BY ALL`. Dimensions can be used directly in SELECT and WHERE.

### 6. Category Definitions
Categories: Air (flights), Hotel (room nights), Rail (trains), Car (rentals), Taxi/Rideshare. Volume measures: flight_count for Air, hotel_nights for Hotel, car_rental_days for Car, rail_segment_count for Rail. component_count is the total across all categories.

### 7. App Filter Context
The APEX app passes filter context with questions. When you see context like "Period: 2025-01-01 to 2025-12-31. Previous period: 2024-01-01 to 2024-12-31. Sector: Inter Continental. Region: Europe", apply those as WHERE clauses (Period → `travel_start_date` range, Sector → travel sector, Region → destination region). Default the currency measure to USD unless the user specifies otherwise. (The app's filter model has no currency filter — currency is chosen per measure.)

## Sample Questions

1. Give me an executive summary of travel emissions and spend for 2024
2. What are total emissions by category for the current year?
3. Show me the top 10 destinations by CO2 emissions
4. Compare total spend USD between 2024 and 2025 by category
5. How many unique travelers do we have this year vs last year?
6. Which airlines have the highest carbon emissions?
7. Show monthly emissions trend for 2024 and 2025
8. What is our average advance booking days by category?
9. Show me the top 5 traveler countries by spend
10. What is the emissions per km for air travel by quarter?
11. Compare hotel emissions per night across destination regions
12. Which travel sector has the highest emissions growth year over year?
