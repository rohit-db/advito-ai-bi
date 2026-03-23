-- ============================================================================
-- APEX Travel Metrics — Validation Suite
-- Run after creating bcd_adv_workspace_poc.apex.travel_metrics
-- ============================================================================

-- TEST 1: Record Count
-- Expected: Should match SELECT COUNT(*) FROM bcd_adv_workspace_poc.test.summarydataset (~1,408,893)
SELECT MEASURE(`Record Count`) as record_count
FROM bcd_adv_workspace_poc.apex.travel_metrics;

-- TEST 1 cross-check:
SELECT COUNT(*) as row_count FROM bcd_adv_workspace_poc.test.summarydataset;

-- TEST 2: Emissions by Category
-- Cross-check our view (with manual filter) against existing metric view (which has built-in filter)
SELECT `Category`, MEASURE(`Total Emissions (Advito)`) as emissions
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE co2_emissions_advito <> 0
GROUP BY ALL ORDER BY emissions DESC;

-- TEST 2 cross-check:
SELECT `Category`, MEASURE(`total_co2_emissions_advito`) as emissions
FROM bcd_adv_workspace_poc.test.summarydataset_metric_view
GROUP BY ALL ORDER BY emissions DESC;

-- TEST 3: Currency-Converted Spend (Air only)
SELECT MEASURE(`Gross Spend (USD)`) as usd, MEASURE(`Gross Spend (EUR)`) as eur, MEASURE(`Gross Spend (GBP)`) as gbp
FROM bcd_adv_workspace_poc.apex.travel_metrics WHERE `Category` = 'Air' GROUP BY ALL;

-- TEST 3 cross-check:
SELECT SUM(currency_rate_usd * total_amount_gross) as usd, SUM(currency_rate_eur * total_amount_gross) as eur, SUM(currency_rate_gbp * total_amount_gross) as gbp
FROM bcd_adv_workspace_poc.test.summarydataset WHERE category = 'Air';

-- TEST 4: Traveler Count by Year
SELECT `Travel Year`, MEASURE(`Traveler Count`) as travelers
FROM bcd_adv_workspace_poc.apex.travel_metrics GROUP BY ALL ORDER BY `Travel Year`;

-- TEST 4 cross-check:
SELECT report_travel_year, COUNT(DISTINCT employee_id) as travelers
FROM bcd_adv_workspace_poc.test.summarydataset GROUP BY 1 ORDER BY 1;

-- TEST 5: Carbon Budget Derived Measure
-- Verify: remaining = budget - actual (exactly, since it's a derived MEASURE())
SELECT `Budget Field Value`,
  MEASURE(`CO2 Budget`) as budget,
  MEASURE(`Total Emissions (Advito)`) as actual,
  MEASURE(`Budget Remaining`) as remaining
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE `Budget Field` IS NOT NULL GROUP BY ALL;

-- TEST 6: Intensity Ratios — Air (should have valid epkm)
SELECT `Category`, MEASURE(`Emissions per KM`) as epkm,
  MEASURE(`Total Emissions (Advito)`) as emissions,
  MEASURE(`Total Distance (KM)`) as distance
FROM bcd_adv_workspace_poc.apex.travel_metrics WHERE `Category` = 'Air' GROUP BY ALL;

-- TEST 6b: Intensity Ratios — Hotel (epkm should be NULL, epn should be valid)
SELECT `Category`, MEASURE(`Emissions per KM`) as epkm, MEASURE(`Emissions per Night`) as epn
FROM bcd_adv_workspace_poc.apex.travel_metrics WHERE `Category` = 'Hotel' GROUP BY ALL;

-- TEST 7: Time Dimension Format
-- Verify: months yyyy-MM, quarters Q1 2024
SELECT `Travel Month`, `Travel Quarter Label`, `Travel Year`, MEASURE(`Record Count`) as records
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE `Travel Year` = 2024 GROUP BY ALL ORDER BY `Travel Month` LIMIT 12;

-- TEST 8: Full KPI Reproduction
SELECT MEASURE(`Total Emissions (Advito)`) as total_emissions,
  MEASURE(`Gross Spend (USD)`) as total_spend_usd,
  MEASURE(`Component Count`) as total_components,
  MEASURE(`Traveler Count`) as total_travelers
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE `Invoice Date` BETWEEN '2025-01-01' AND '2025-06-30';

-- TEST 8 cross-check:
SELECT SUM(co2_emissions_advito)/1000 as total_emissions,
  SUM(currency_rate_usd * total_amount_gross) as total_spend_usd,
  SUM(component_count) as total_components,
  COUNT(DISTINCT employee_id) as total_travelers
FROM bcd_adv_workspace_poc.test.summarydataset
WHERE invoice_date BETWEEN '2025-01-01' AND '2025-06-30';

-- TEST 9: Advance Booking Days
SELECT `Category`, MEASURE(`Avg Advance Booking Days`) as avg_days
FROM bcd_adv_workspace_poc.apex.travel_metrics GROUP BY ALL ORDER BY avg_days DESC;

-- TEST 9 cross-check:
SELECT category, AVG(adv_booking_days) as avg_days
FROM bcd_adv_workspace_poc.test.summarydataset GROUP BY 1 ORDER BY avg_days DESC;

-- TEST 10: Budget column type (already verified as DOUBLE in pre-flight)
-- This test confirms SUM(co2_emission_budget) works without CAST
SELECT MEASURE(`CO2 Budget`) as total_budget FROM bcd_adv_workspace_poc.apex.travel_metrics;

-- TEST 11: Budget Remaining derived measure consistency
SELECT `Budget Field Value`,
  MEASURE(`CO2 Budget`) as budget,
  MEASURE(`Total Emissions (Advito)`) as actual,
  MEASURE(`Budget Remaining`) as remaining
FROM bcd_adv_workspace_poc.apex.travel_metrics
WHERE `Budget Field` IS NOT NULL GROUP BY ALL;
-- Verify: remaining = budget - actual for each row
