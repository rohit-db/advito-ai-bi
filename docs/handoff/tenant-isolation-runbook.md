# Tenant Isolation Runbook (per-tenant Service Principal)

Operator guide for the load-bearing isolation control: a Unity Catalog **row
filter** keyed on `session_user()`. When a caller authenticates via OAuth M2M as
a Service Principal (SP), `session_user()` equals that SP's `application_id`. A
lookup table `sp_tenant_mapping(sp_app_id, tenant_id, active)` joins the SP to
exactly one tenant, so each tenant SP only ever sees its own rows.

## How isolation is enforced

- Each tenant gets a **dedicated SP**. The app mints an OAuth (M2M) token per SP,
  so every downstream Databricks call (Genie, AI/BI embed, MCP, warehouse SQL)
  runs **as that tenant's SP**.
- The row filter `tenant_row_filter(tenant_id)` returns TRUE for a row when:
  1. the caller is in the **admin group** (`TENANT_ADMIN_GROUP`, default
     `admins`) — a deliberate back-office bypass so operators can see all
     tenants; **or**
  2. `sp_tenant_mapping` has an `active` row where
     `sp_app_id = session_user()` and `tenant_id` matches the row.
- The governed fact table therefore **must have a `tenant_id` column**
  (configurable via `TENANT_COLUMN`) whose values match
  `sp_tenant_mapping.tenant_id`.

### The exact filter function

```sql
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
```

## Prerequisites

- **Workspace admin** identity to create SPs + OAuth secrets. Set
  `TENANTS_ADMIN_PROFILE` to a CLI profile with admin rights (so the app SP need
  not be an admin).
- A **governed fact table** with a `tenant_id` column (see `TENANT_COLUMN`).
- Env set: `UC_CATALOG`, `UC_SCHEMA`, `WAREHOUSE_NAME`, and `AES_KEY_BASE64`
  (used to encrypt SP secrets at rest in Lakebase). Optional:
  `TENANT_ADMIN_GROUP`, `VERIFY_TABLE`, `ISOLATED_TABLES`, `TENANT_COLUMN`.
- Lakebase enabled (for the tenant registry + encrypted secrets).

## Order of operations

### 0. (Test workspaces only) Seed a demo fact table

Skip on the real workspace where a governed fact table already exists. For an
**internal test workspace**, create a tiny table with a `tenant_id` column so you
can prove isolation end-to-end. Run in a SQL editor / notebook (as your admin):

```sql
CREATE TABLE IF NOT EXISTS main.apex.bookings (
  booking_id STRING, tenant_id STRING, spend DOUBLE, booked_on DATE
);
INSERT INTO main.apex.bookings VALUES
  ('b1','acme-travel',  1200.0, current_date()),
  ('b2','acme-travel',   980.5, current_date()),
  ('b3','globex-corp',  4300.0, current_date()),
  ('b4','globex-corp',   250.0, current_date());
```

Set `UC_CATALOG=main`, `UC_SCHEMA=apex`, `VERIFY_TABLE=main.apex.bookings`,
`ISOLATED_TABLES=bookings`, and onboard two tenants with `tenant_id`
`acme-travel` and `globex-corp` (matching each test login's `external_value`).

### 1. Apply the row filter

Creates `sp_tenant_mapping`, the `tenant_row_filter` function, and attaches the
filter to each table in `ISOLATED_TABLES` (defaults to `VERIFY_TABLE`).

```bash
# preview the SQL
python scripts/tenants/apply_row_filter.py --dry-run

# apply (idempotent — safe to re-run to repair drift)
UC_CATALOG=main UC_SCHEMA=apex WAREHOUSE_NAME="Serverless Starter Warehouse" \
ISOLATED_TABLES=bookings TENANT_COLUMN=tenant_id \
  python scripts/tenants/apply_row_filter.py
```

> If a workspace drifts (filter detached, function dropped) tenant SPs start
> seeing **all** rows. Re-run this script to restore the guarantee.

### 2. Onboard tenants

Use the **admin UI**, or the CLI wrapper (both create the SP, store its
encrypted secret, and write the `sp_tenant_mapping` row):

```bash
TENANTS_ADMIN_PROFILE=my-admin \
  python scripts/tenants/create_tenant_sp.py \
    --tenant-id acme-travel \
    --display-name "Acme Travel" \
    --genie-space-id 01f1270...
```

The `client_id` / `client_secret` are printed **once** — capture the secret
immediately (it is also encrypted at rest in the registry).

### 3. Verify isolation

Mints a token per active tenant SP and asserts each sees only its own rows.
Exits non-zero on any failure (CI-friendly).

```bash
VERIFY_TABLE=main.apex.bookings TENANT_COLUMN=tenant_id \
  python scripts/tenants/verify_isolation.py

# if Lakebase isn't reachable from here, read secrets from env instead:
VERIFY_TABLE=main.apex.bookings \
TENANT_SECRET_ACME_TRAVEL=... \
  python scripts/tenants/verify_isolation.py --secrets-env
```

A tenant **PASSes** iff its visible `DISTINCT tenant_id` equals exactly
`[tenant_id]`.

## Mapping an app login to a tenant

The tenant join key is the white-label user's **`external_value`** (e.g.
`acme-travel`). By convention that value **equals**
`apex_client_registry.tenant_id`, so a logged-in user resolves directly to their
tenant SP — no extra mapping table. When onboarding, set `--tenant-id` to the
same string the identity provider emits as `external_value`.

## Troubleshooting

- **A tenant sees all rows** — the row filter is detached or the function was
  dropped. Re-run step 1.
- **A tenant sees no rows** — no `active` row in `sp_tenant_mapping` for that
  SP, or a `tenant_id` mismatch between the mapping and the fact table.
- **Admin sees only some rows** — the admin identity isn't in
  `TENANT_ADMIN_GROUP`, or you're querying as an SP rather than as the admin.
- **`session_user()` is a user, not an app id** — the connection isn't
  authenticated via OAuth M2M as the SP; verify the token was minted for the
  tenant SP.
