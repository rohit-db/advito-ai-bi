-- ============================================================================
-- Per-tenant Unity Catalog row-filter isolation
-- ============================================================================
-- Templated DDL for the load-bearing isolation control used by the per-tenant
-- Service Principal feature. Substitute the ${...} placeholders before running,
-- or let scripts/tenants/apply_row_filter.py execute the equivalent statements
-- via the Statement Execution API.
--
-- Placeholders:
--   ${catalog}        Unity Catalog catalog holding the governed tables
--                     (UC_CATALOG in server/config.py).
--   ${schema}         Schema within that catalog (UC_SCHEMA).
--   ${admin_group}    Account group whose members BYPASS the filter
--                     (TENANT_ADMIN_GROUP, default 'admins').
--   ${table}          A governed fact table to attach the filter to
--                     (e.g. "bookings"). It MUST have a ${tenant_column} column.
--   ${tenant_column}  The per-row tenant discriminator column (default
--                     "tenant_id").
--
-- ─ How isolation works ───────────────────────────────────────────────────────
-- When a caller authenticates via OAuth M2M (client_credentials) AS a Service
-- Principal, Unity Catalog's session_user() resolves to that SP's
-- application_id (its OAuth client_id). Each tenant gets a dedicated SP, and the
-- sp_tenant_mapping lookup joins that application_id to exactly one tenant_id.
-- The row filter therefore keeps every tenant SP scoped to its own rows, no
-- matter whether queries arrive over Genie, the AI/BI embed, MCP, or raw SQL.
--
-- ─ Admin-group bypass ────────────────────────────────────────────────────────
-- Members of ${admin_group} (back-office / operators) skip the row filter
-- entirely (is_account_group_member('${admin_group}') short-circuits to TRUE),
-- so they can see all tenants for support and reconciliation.
--
-- ─ Prerequisite ──────────────────────────────────────────────────────────────
-- The governed fact table (${table}) MUST expose a ${tenant_column} column
-- whose values match sp_tenant_mapping.tenant_id. Rows with a tenant_id not
-- mapped to the calling SP are filtered out.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE FUNCTION make this
-- safe to re-run (e.g. to repair drift after a filter is detached).
-- ============================================================================

-- 1) SP-to-tenant mapping — the row-filter join target. Intentionally minimal so
--    the correlated lookup in the filter stays fast.
CREATE TABLE IF NOT EXISTS ${catalog}.${schema}.sp_tenant_mapping (
    sp_app_id STRING  NOT NULL,   -- SP application_id == session_user() over M2M
    tenant_id STRING  NOT NULL,   -- tenant this SP is allowed to see
    active    BOOLEAN NOT NULL     -- soft-disable a mapping without deleting it
) USING DELTA
COMMENT 'Lookup table joined in tenant_row_filter (sp_app_id == session_user()).';

-- 2) The row filter. Returns TRUE (keep row) when the caller is an admin, or
--    when the calling SP is actively mapped to the row's tenant_id.
--
--    NOTE: session_user() == the SP application_id under OAuth M2M. The function
--    parameter is qualified (tenant_row_filter.tenant_id) to disambiguate it
--    from the mapping table's tenant_id column.
CREATE OR REPLACE FUNCTION ${catalog}.${schema}.tenant_row_filter(tenant_id STRING)
RETURN
  is_account_group_member('${admin_group}')
  OR EXISTS (
    SELECT 1
    FROM ${catalog}.${schema}.sp_tenant_mapping m
    WHERE m.sp_app_id = session_user()
      AND m.active = true
      AND m.tenant_id = tenant_row_filter.tenant_id
  );

-- 3) Attach the filter to a governed fact table. Repeat this ALTER for every
--    table in ISOLATED_TABLES; each must have the ${tenant_column} column.
--    Re-running is safe — it just rebinds the same filter.
ALTER TABLE ${catalog}.${schema}.${table}
    SET ROW FILTER ${catalog}.${schema}.tenant_row_filter ON (${tenant_column});

-- To detach (e.g. for maintenance):
--   ALTER TABLE ${catalog}.${schema}.${table} DROP ROW FILTER;
