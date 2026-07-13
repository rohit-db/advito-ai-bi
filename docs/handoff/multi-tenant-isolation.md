# Multi-tenant isolation — Genie + dashboards run as per-tenant Service Principals

**What & why.** In the single-SP build, every user's Genie questions and dashboard
queries run as the *one* app Service Principal, so isolation depends entirely on
the app passing the right `tenant_id`. That's fine for a demo, not defensible
for a real multi-tenant deployment. This feature gives **each tenant its own
Service Principal**: when a user signs in, the app resolves them to their tenant
SP and runs **both** Ask APEX (Genie MCP) **and** the embedded AI/BI dashboards
**as that SP**. A Unity Catalog **row filter keyed on the SQL caller identity**
(`session_user()`) then enforces isolation *in the data plane* — the load-bearing
control that holds even if the app layer is wrong.

> **Companion docs — read them for their topics, don't duplicate:**
> - [`tenant-isolation-runbook.md`](./tenant-isolation-runbook.md) — operator
>   runbook (apply the row filter, onboard, verify). This doc is the
>   *architecture + code map + admin*.
> - [`whitelabel-auth-and-hosting.md`](./whitelabel-auth-and-hosting.md) — how a
>   user becomes an identity: login → signed session cookie → `tenant_id`.
>   This doc picks up where that one ends: `tenant_id` → tenant SP.

---

## The identity → isolation chain (one screen)

```
Login (white-label IdP)                 server/auth/*   (see auth doc)
  └─ session cookie identity: { email, tenant, tenant_id, role }
        │  tenant_id  ==  apex_client_registry.tenant_id   (direct join — no extra table)
        ▼
resolver.resolve_tenant_sp(request)     server/tenants/resolver.py  ← THE SEAM
        │  tenant_id → apex_client_registry.tenant_id → sp_app_id
        ▼
apex_sp_credentials (Lakebase, AES-GCM) server/tenants/{registry,crypto}.py
        │  sp_app_id → client_secret (decrypted)
        ▼
TokenMinter → OAuth M2M token for the SP server/tenants/minter.py
        │
        ├──► Genie MCP call        (as tenant SP)  genie_mcp/auth.resolve_genie
        └──► AI/BI embed-token mint (as tenant SP) embed._resolve_embed_credentials
                     │
                     ▼
Unity Catalog:  session_user() == sp_app_id
  row filter joins sp_app_id → tenant_id  → SP sees only its own rows
```

The one idea to internalize: **for an OAuth M2M caller, `session_user()` (and
`current_user()`) resolve to the SP's `application_id`.** The row filter joins that
against a mapping (`sp_app_id → tenant_id`), so a tenant SP can only ever see its
own rows — over Genie, the dashboard embed, MCP, or raw SQL. Members of
`TENANT_ADMIN_GROUP` bypass the filter (back-office/operators).

---

## The seam — `resolve_tenant_sp`

Everything hinges on one function. It maps a request's session to a tenant SP
token, or returns `None` so callers **fall back to the app SP and never fail**:

```46:63:server/tenants/resolver.py
def resolve_tenant_sp(request: Request) -> Optional[Tuple[str, TenantRow]]:
    """Return ``(bearer_token, TenantRow)`` for the request's tenant, or None."""
    tid = tenant_id_for_request(request)
    if not tid:
        return None
    row = registry.get_tenant(tid)
    if not row or row.status != "active":
        return None
    secret = runtime.secret_for_sp(row.sp_app_id)
    if not secret:
        logger.warning("tenant %s is registered but has no stored SP secret", tid)
        return None
    try:
        token = runtime.minter().get_token(row.sp_app_id, secret)
    except Exception as e:  # noqa: BLE001
        logger.warning("tenant SP token mint failed for %s: %s", tid, e)
        return None
    return token, row
```

`tenant_id_for_request` returns the session's `tenant_id`, treating `*` and
empty (operator / all-rows) as "no tenant SP" → `None`.

---

## The `server/tenants/` package

| Module | Responsibility |
|---|---|
| `crypto.py` | AES-256-GCM encrypt/decrypt of SP secrets (`AES_KEY_BASE64`; `plain:` marker fallback for local dev, with a warning). |
| `registry.py` | Lakebase tables `apex_client_registry` (tenant→SP) + `apex_sp_credentials` (encrypted secret); tenant + credential CRUD. |
| `minter.py` | `TokenMinter` — per-SP OAuth (M2M) `all-apis` token cache, refreshed 5 min before expiry. |
| `runtime.py` | Singletons: `minter()`, `admin_client()` (SP lifecycle/admin SQL), `secret_for_sp()`, `warehouse_id()`. |
| `resolver.py` | **The seam.** `resolve_tenant_sp(request)` → `(token, TenantRow)` from the session's `tenant_id`; `None` → callers fall back to the app SP. |
| `sp_lifecycle.py` | Create / rotate / deactivate / reactivate / delete SPs via the SDK (`service_principals` + `service_principal_secrets_proxy`), with transactional rollback on onboard. |
| `unity_catalog.py` | Mapping-table CRUD (`insert/activate/deactivate/delete_mapping`) + `verify_tenant`/`verify_all` (mints the tenant token, asserts `SELECT DISTINCT tenant_id == [tenant_id]`). |
| `resources.py` | **NEW.** Grantable resource catalog + per-tenant `CAN_RUN` grant/revoke on individual dashboards + Genie spaces (the "Manage access" feature). |
| `audit.py` | `apex_tenant_audit` Lakebase table + activity feed (`log`/`history`/`recent`). |
| `service.py` | Orchestration: `onboard` (lifecycle + mapping + best-effort Genie/dashboard/data grants + audit), `rotate`/`deactivate`/`reactivate`/`delete`, `verify`, and resource-access `get_access`/`set_access`. |

---

## Where it's wired into the app

- **Genie MCP** — `genie_mcp/auth.py::resolve_genie()` tries `resolve_tenant_sp()`
  **first**; on a hit it returns the tenant SP token *and* the tenant's per-space
  Genie override (`client_registry.genie_space_id`). Miss (operator, no Lakebase,
  pre-onboarding) → falls back to OBO → app SP → PAT.
- **AI/BI embed** — `embed.py::_resolve_embed_credentials()` mints the embed token
  with the **tenant SP's** client_id/secret (falling back to the app SP), so the
  dashboard's warehouse queries run as the tenant SP and hit the same row filter.
  The session `tenant_id` is also mapped to Databricks' embed `external_value`
  param at token mint as defense-in-depth.
- **Admin API** — `server/routes/tenants.py`, mounted at `/api/tenants/*`,
  operator-gated (`role == "operator"` from the session cookie).
- **Admin UI** — `frontend/src/pages/AdminPage.tsx` (route `/admin`), reachable
  from the operator-only **Administration → Service Principals** nav entry
  (`Sidebar.tsx`, shown only when `role == "operator"`). The page self-guards on
  401/403.
- **Startup** — `app.py` calls `registry.ensure_schema()` + `audit.ensure_schema()`
  (best-effort; no-op without Lakebase).

---

## Admin capabilities (the `/admin` page)

Two groups of operator actions, both audited to `apex_tenant_audit`:

**1. SP lifecycle** (per tenant row → actions menu):

| Action | Backend | Effect |
|---|---|---|
| Onboard | `service.onboard` | Create SP, mint + AES-encrypt secret, write registry + mapping, best-effort grant Genie/dashboards/`SELECT`. Secret shown **once**. |
| Rotate | `service.rotate` | Mint a fresh secret, store it, revoke all older secrets. Shown once. |
| Deactivate | `service.deactivate` | Disable the SP, revoke secrets, deactivate the mapping row. |
| Reactivate | `service.reactivate` | Re-enable the SP + mint a fresh secret. |
| Delete | `service.delete` | Delete the SP + all registry/mapping rows. |
| Verify isolation | `service.verify` | Run `verify_all` — each active SP must see only its own `tenant_id`. |

**2. Manage access — per-tenant resource grants (NEW)**

`AccessDialog.tsx` (opened via the tenant row's **Manage access** action) toggles a
tenant SP's `CAN_RUN` on **individual dashboards and Genie spaces**. The grantable
**catalog** is declarative via env so resources can be added without code changes:

```54:66:server/tenants/resources.py
def catalog() -> dict:
    """Return the grantable resources: ``{dashboards:[{id,name}], genie_spaces:[...]}``."""
    from ..config import GENIE_SPACE_ID

    dashboards = _parse(os.environ.get("RESOURCE_DASHBOARDS", ""))
    if not dashboards:
        dashboards = _parse(os.environ.get("DASHBOARD_IDS", ""))

    spaces = _parse(os.environ.get("RESOURCE_GENIE_SPACES", ""))
    if not spaces and GENIE_SPACE_ID:
        spaces = [{"id": GENIE_SPACE_ID, "name": "Ask APEX (default)"}]

    return {"dashboards": dashboards, "genie_spaces": spaces}
```

- **Catalog:** `RESOURCE_DASHBOARDS` / `RESOURCE_GENIE_SPACES` (comma-separated
  `id:Label`), falling back to `DASHBOARD_IDS` / `GENIE_SPACE_ID`.
- **Grant** = `PATCH` the permissions object adding the SP at `CAN_RUN` (merges,
  non-destructive).
- **Revoke** = `GET` the ACL then `PUT` it back **without** the SP, preserving
  every other principal's *direct* (non-inherited) permissions — the permissions
  API has no per-principal delete.
- Grants run as `runtime.admin_client()` (`TENANTS_ADMIN_PROFILE` when set), which
  needs `CAN_MANAGE` on the object.

Endpoints (all operator-gated, in `server/routes/tenants.py`):

```
GET  /api/tenants/resources          # the grantable catalog
GET  /api/tenants/{id}/access         # {dashboards:{id:bool}, genie_spaces:{id:bool}}
POST /api/tenants/{id}/access         # {resource_type, resource_id, grant}
```

> **Why it matters:** a tenant SP needs `CAN_RUN` on a dashboard for its embed
> token to mint — without it the exchange fails with `invalid_authorization_details`.
> Onboarding auto-grants `DASHBOARD_IDS`; operators fine-tune later via Manage
> access. (Onboard-time grants use `service.grant_dashboard_access`, which falls
> back to a direct REST PATCH with the app SP bearer if the admin client can't.)

---

## Row-level security (the load-bearing control)

The isolation guarantee is a **Unity Catalog row filter** on the governed fact
table, keyed on the SQL caller identity. This app's built-in shape:

```sql
CREATE OR REPLACE FUNCTION ${catalog}.${schema}.tenant_row_filter(tenant_id STRING)
RETURN
  is_account_group_member('${admin_group}')
  OR EXISTS (
    SELECT 1 FROM ${catalog}.${schema}.sp_tenant_mapping m
    WHERE m.sp_app_id = session_user()
      AND m.active = true
      AND m.tenant_id = tenant_row_filter.tenant_id
  );
```

The function + `sp_tenant_mapping` table + the `ALTER TABLE … SET ROW FILTER`
attach are created by `scripts/tenants/apply_row_filter.py` (template:
`sql/tenants/row_filter.sql`). See the runbook for the operator steps.

---

## Reusing an existing customer row filter (verified: Advito)

Customers often already have a row-filter function + mapping table. Instead of
creating our own, point the app at theirs via env (`MAPPING_*` / `FILTER_FUNCTION`
/ `TENANT_COLUMN`) — onboarding then writes the tenant **SP app id** into *their*
mapping table so *their* function enforces isolation. **No code changes.**

Advito's setup (verified working end-to-end on `bcd_adv_workspace_poc`):

| Piece | Value |
|---|---|
| Fact table | `bcd_adv_workspace_poc.apex.summarydataset` (tenant col `client_id`) |
| Dashboards read | metric view `apex.travel_metrics` (`source: apex.summarydataset`) |
| Filter function | `apex.client_access_filter(client_id)` → `is_account_group_member('admins') OR EXISTS(user_client_access WHERE user_email = current_user() AND client_id = cid)` |
| Mapping table | `apex.user_client_access(user_email, client_id, granted_at)` |

Env to reuse it:

```
UC_CATALOG=bcd_adv_workspace_poc
UC_SCHEMA=apex
VERIFY_TABLE=bcd_adv_workspace_poc.apex.summarydataset
TENANT_COLUMN=client_id
MAPPING_TABLE=user_client_access
MAPPING_USER_COLUMN=user_email      # holds the SP app id
MAPPING_TENANT_COLUMN=client_id
MAPPING_ACTIVE_COLUMN=              # no active flag -> deactivate deletes the row
MAPPING_TS_COLUMN=granted_at
FILTER_FUNCTION=client_access_filter
```

Key facts confirmed:
- For an M2M SP, `current_user()` **and** `session_user()` both return the SP's
  **application id**, so putting the app id in `user_email` is what scopes the SP.
- A row filter on the **base table** (`summarydataset`) automatically applies to
  queries through the **metric view** (`travel_metrics`) — attach it once to the
  source table:
  ```sql
  ALTER TABLE bcd_adv_workspace_poc.apex.summarydataset
    SET ROW FILTER bcd_adv_workspace_poc.apex.client_access_filter ON (client_id);
  ```
  Verified: before attach the tenant SP saw all 64 `client_id`s; after attach it
  sees only its own (`447` → Cloud Venture). Set the login user's `tenant_id`
  **and** the registry `tenant_id` to the **numeric `client_id`** so they line up.

---

## Config (see `.env.example`)

| Var | Purpose |
|---|---|
| `AES_KEY_BASE64` | Encrypts SP secrets at rest (`python -m server.tenants.crypto` to generate). Unset → `plain:` fallback (local dev only, logs a warning). |
| `UC_CATALOG` / `UC_SCHEMA` | Catalog/schema holding the governed tables, filter function, and mapping table. Unset → mapping + verify are skipped. |
| `WAREHOUSE_NAME` | SQL warehouse (by name) for admin SQL + verification. |
| `VERIFY_TABLE` / `TENANT_COLUMN` / `ISOLATED_TABLES` | Governed fact table, its tenant column, and the tables to attach the filter to. |
| `TENANT_ADMIN_GROUP` | Account group that bypasses the row filter (default `admins`). |
| `TENANT_SP_PREFIX` | Display-name prefix for onboarded SPs (default `apex-tenant`). |
| `TENANTS_ADMIN_PROFILE` | CLI profile (workspace-admin) used **only** for SP lifecycle, so the app SP need not be admin. |
| `DASHBOARD_IDS` | Comma-separated dashboards auto-granted `CAN_RUN` at onboard (required for embed-token minting). |
| `RESOURCE_DASHBOARDS` / `RESOURCE_GENIE_SPACES` | Grantable catalog for Manage access (`id:Label`); fall back to `DASHBOARD_IDS` / `GENIE_SPACE_ID`. |
| `MAPPING_TABLE` / `MAPPING_USER_COLUMN` / `MAPPING_TENANT_COLUMN` / `MAPPING_ACTIVE_COLUMN` / `MAPPING_TS_COLUMN` / `FILTER_FUNCTION` | Row-filter shape — override to **reuse an existing customer filter** (see Advito above). |

---

## Lakebase-backed state (nothing new to provision)

All tenant/SP management state lives in the **same Lakebase instance** the app
already uses — set `AES_KEY_BASE64` and you're done:

| Lakebase table | Written by | Holds |
|---|---|---|
| `apex_client_registry` | `registry.py` | tenant → SP mapping (`tenant_id`, `sp_app_id`, per-tenant `genie_space_id`, status) |
| `apex_sp_credentials` | `registry.py` + `crypto.py` | the SP `client_secret`, **AES-GCM encrypted** at rest |
| `apex_tenant_audit` | `audit.py` | every lifecycle + access action for the activity feed |

Tables are created lazily at startup and are **best-effort no-ops when Lakebase is
disabled**. The **UC** `sp_tenant_mapping` table (the data-plane control the row
filter queries) is separate — it lives in `UC_CATALOG.UC_SCHEMA` and is managed by
`unity_catalog.py` / `apply_row_filter.py`.

---

## Graceful degradation

- No Lakebase / no onboarded tenant / operator (`tenant_id` = `*`) →
  `resolve_tenant_sp` returns `None` and Genie + embed run as the **app SP**
  exactly as before. Nothing breaks pre-onboarding.
- UC catalog/schema unset → mapping writes + verification are skipped with a clear
  log; onboarding still creates the SP and stores the secret.

---

## Relationship to `multi-tenant-genie`

Same model, adapted to this app: `client_registry` + encrypted `sp_credentials`,
per-SP `TokenMinter`, a mapping table + row filter on `session_user()`, and admin
onboarding. The key adaptation is the **join key**: here the tenant is the
white-label login's `tenant_id`, so no separate user→tenant table is needed —
the same identity that scopes the dashboard embed selects the tenant SP.
