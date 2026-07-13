# Multi-tenant isolation — Genie + dashboards run as per-tenant Service Principals

**The blocker:** in the single-SP build, every logged-in user's Genie questions
and dashboard queries run as the *one* app Service Principal, so isolation
depends entirely on the app passing the right `external_value`. That's fine for a
demo but not defensible as a reference for a large multi-tenant initiative.

**What this feature adds:** each tenant gets its **own** Service Principal. When a
user signs in, the app resolves them to their tenant SP and runs **both** Ask APEX
(Genie MCP) **and** the embedded AI/BI dashboards **as that SP**. A Unity Catalog
**row filter keyed on `session_user()`** then enforces isolation *in the data
plane* — the load-bearing control that holds even if the app layer is wrong. This
is a direct port of the proven pattern in the `multi-tenant-genie` repo.

> Companion doc: [`tenant-isolation-runbook.md`](./tenant-isolation-runbook.md) —
> the step-by-step operator runbook (apply the row filter, onboard tenants,
> verify). This doc is the *architecture + code map*.

---

## The identity chain (one screen)

```
Login (white-label IdP)                server/auth/*
  └─ user row: { email, tenant, external_value, role }
        │  external_value  ==  tenant_id  (the join key)
        ▼
apex_client_registry (Lakebase)        server/tenants/registry.py
  tenant_id ──► sp_app_id  (a dedicated Service Principal per tenant)
        │
        ▼
apex_sp_credentials (Lakebase, AES-GCM encrypted)   server/tenants/crypto.py
  sp_app_id ──► client_secret
        │
        ▼
TokenMinter  → OAuth M2M token for that SP          server/tenants/minter.py
        │
        ├──► Genie MCP call  (Authorization: Bearer <tenant-SP token>)
        └──► AI/BI embed token mint  (client_credentials = tenant SP)
                     │
                     ▼
Unity Catalog:  session_user() == sp_app_id
  tenant_row_filter(tenant_id) → EXISTS in sp_tenant_mapping → only own rows
```

The one idea to internalize: **`session_user()` resolves to the SP's
`application_id` when a caller authenticates via OAuth M2M as that SP.** The row
filter joins that against `sp_tenant_mapping(sp_app_id → tenant_id)`, so a tenant
SP can only ever see its own rows — over Genie, the dashboard embed, MCP, or raw
SQL. Members of `TENANT_ADMIN_GROUP` bypass the filter (back-office/operators).

---

## The `server/tenants/` package

| Module | Responsibility |
|---|---|
| `crypto.py` | AES-256-GCM encrypt/decrypt of SP secrets (`AES_KEY_BASE64`; `plain:` fallback for local dev). |
| `registry.py` | Lakebase tables `apex_client_registry` (tenant→SP) + `apex_sp_credentials` (encrypted secret); tenant + credential CRUD. |
| `minter.py` | `TokenMinter` — per-SP OAuth (M2M) token cache, refresh 5 min before expiry. |
| `runtime.py` | Singletons: `minter()`, `admin_client()` (SP lifecycle/admin SQL), `secret_for_sp()`, `warehouse_id()`. |
| `resolver.py` | **The seam.** `resolve_tenant_sp(request)` → `(token, TenantRow)` from the session's `external_value`; `None` → callers fall back to the app SP. |
| `sp_lifecycle.py` | Create / rotate / deactivate / reactivate / delete SPs via the Databricks SDK (`service_principals` + `service_principal_secrets_proxy`), with rollback. |
| `unity_catalog.py` | `sp_tenant_mapping` CRUD (Statement Execution) + `verify_tenant`/`verify_all` (mints the tenant token, asserts `SELECT DISTINCT tenant_id == [tenant_id]`). |
| `audit.py` | `apex_tenant_audit` Lakebase table + activity feed (`log`/`history`/`recent`). |
| `service.py` | Orchestration: `onboard` (lifecycle + mapping + best-effort Genie/dashboard/data grants + audit), `rotate`/`deactivate`/`reactivate`/`delete`, `verify`. |

---

## Where it's wired into the existing app

- **Genie MCP** — `server/routes/genie_mcp/auth.py::resolve_genie()` tries
  `resolver.resolve_tenant_sp()` **first**; on a hit it returns the tenant SP
  token *and* the tenant's per-space Genie override (`client_registry.genie_space_id`).
  `routes.py` uses it for both `/genie-mcp/health` and `/genie-mcp/ask`. No tenant
  mapped (operator, or pre-onboarding) → falls back to OBO → app SP → PAT.
- **AI/BI embed** — `server/routes/embed.py::_resolve_embed_credentials()` mints
  the embed token with the **tenant SP's** client_id/secret (falling back to the
  app SP), so the dashboard's warehouse queries run as the tenant SP and hit the
  same row filter. `external_value` is still passed as defense-in-depth.
- **Admin API** — `server/routes/tenants.py`, mounted at `/api/tenants/*`,
  operator-gated (`role == "operator"` from the session cookie).
- **Admin UI** — `frontend/src/pages/AdminPage.tsx` (route `/admin`), reachable
  from the operator-only "Administration → Service Principals" nav entry. Onboard
  a tenant + SP, rotate/deactivate/reactivate/delete, run **Verify isolation**,
  and watch the audit feed. Secrets are shown **once** (stored encrypted).
- **Startup** — `app.py` mounts the router and calls `registry.ensure_schema()` +
  `audit.ensure_schema()` (best-effort; no-op without Lakebase).

---

## Operator flow (short version)

1. **One-time UC setup:** `python scripts/tenants/apply_row_filter.py` creates
   `sp_tenant_mapping` + the `tenant_row_filter` function and attaches it to your
   governed fact table(s). (SQL template: `sql/tenants/row_filter.sql`.)
2. **Onboard tenants:** in `/admin` click *Onboard tenant* (or run
   `python scripts/tenants/create_tenant_sp.py`). This creates the SP, mints +
   encrypts its secret, writes `client_registry` + `sp_tenant_mapping`, and
   best-effort grants Genie/dashboard/`SELECT`. Set each tenant's `tenant_id` to
   the **same value as the login user's `external_value`**.
3. **Verify:** `/admin` → *Verify isolation* (or
   `python scripts/tenants/verify_isolation.py`) — each tenant SP must see only
   its own `tenant_id`.

**Needs workspace-admin** to create SPs + mint secrets. Use `TENANTS_ADMIN_PROFILE`
to run lifecycle ops as your admin CLI profile without making the app SP an admin.

---

## Config (see `.env.example`)

`AES_KEY_BASE64` (encrypts SP secrets — `python -m server.tenants.crypto` to
generate), `UC_CATALOG`/`UC_SCHEMA`, `WAREHOUSE_NAME`, `VERIFY_TABLE` /
`TENANT_COLUMN` / `ISOLATED_TABLES`, `TENANT_ADMIN_GROUP`, `TENANT_SP_PREFIX`,
`TENANTS_ADMIN_PROFILE`.

---

## Is the admin management backed by Lakebase? (yes)

All tenant/SP management state lives in the **same Lakebase instance** the app
already uses — there's nothing new to provision beyond setting `AES_KEY_BASE64`:

| Lakebase table | Written by | Holds |
|---|---|---|
| `apex_client_registry` | `registry.py` | tenant → SP mapping (`tenant_id`, `sp_app_id`, per-tenant `genie_space_id`, status) |
| `apex_sp_credentials` | `registry.py` + `crypto.py` | the SP `client_secret`, **AES-GCM encrypted** at rest |
| `apex_tenant_audit` | `audit.py` | every onboard/rotate/deactivate/verify action for the activity feed |

Tables are created lazily at startup by `registry.ensure_schema()` +
`audit.ensure_schema()` (wired in `app.py`), and are **best-effort no-ops when
Lakebase is disabled** — the app still boots and falls back to the app SP. So
"admin management" is Lakebase-backed the moment `LAKEBASE_ENABLED=1` and
`AES_KEY_BASE64` are set; no separate DB, schema migration, or manual DDL needed.

> The **UC** `sp_tenant_mapping` table (the data-plane control queried by the row
> filter) is separate from these Lakebase tables — it lives in `UC_CATALOG.UC_SCHEMA`
> and is managed by `unity_catalog.py` / `scripts/tenants/apply_row_filter.py`.

---

## Testing on an internal workspace (before BCD SP access)

Creating SPs + minting their secrets is a **workspace-admin** entitlement. Until
that's granted on the customer (BCD) workspace, validate the full loop on **any
Databricks workspace where you have admin** — the whole layer is env-driven and
workspace-agnostic. Point the app at the internal workspace and run:

1. **Auth** — `databricks auth login --profile <internal>`; set that profile as
   `TENANTS_ADMIN_PROFILE` (SP lifecycle runs as the admin profile, not the app SP).
2. **Env** — set `DATABRICKS_HOST`, the app SP `client_id`/`secret`,
   `LAKEBASE_ENABLED=1`, `AES_KEY_BASE64`, `UC_CATALOG`/`UC_SCHEMA`,
   `WAREHOUSE_NAME`, `VERIFY_TABLE`/`TENANT_COLUMN`, `TENANT_ADMIN_GROUP`.
3. **Seed data** — create a small fact table in `UC_CATALOG.UC_SCHEMA` with a
   `tenant_id` column and a couple of tenant values (see the runbook for a
   copy-paste `CREATE TABLE` + inserts).
4. **Row filter** — `python scripts/tenants/apply_row_filter.py` (add `--dry-run`
   first to print the DDL).
5. **Onboard 2 tenants** — `/admin` → *Onboard tenant* twice, or
   `python scripts/tenants/create_tenant_sp.py`, with `tenant_id` matching each
   test login's `external_value`.
6. **Verify** — `/admin` → *Verify isolation* (or
   `python scripts/tenants/verify_isolation.py`); each SP must see only its own
   `tenant_id`. Then sign in as each test user and confirm Ask APEX + the embedded
   dashboard only show that tenant's data.

When BCD access lands, the *only* changes are the workspace env vars + profile —
no code changes.

---

## Graceful degradation

- No Lakebase / no onboarded tenant / operator (`external_value` = `*`) →
  `resolve_tenant_sp` returns `None` and Genie + embed run as the **app SP**
  exactly as before. Nothing breaks pre-onboarding.
- UC catalog/schema unset → mapping writes + verification are skipped with a clear
  log; onboarding still creates the SP and stores the secret.

---

## Relationship to `multi-tenant-genie`

Same model, adapted to this app's structure: `client_registry` + encrypted
`sp_credentials`, per-SP `TokenMinter`, `sp_tenant_mapping` + `tenant_row_filter`
on `session_user()`, and admin onboarding. The key adaptation is the **join key**:
here the tenant is the white-label login's `external_value`, so no separate
user→tenant mapping table is needed — the same identity that already scopes the
dashboard embed now selects the tenant SP.
