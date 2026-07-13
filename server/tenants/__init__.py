"""Per-tenant Service Principal isolation.

This package makes every downstream Databricks call (Genie MCP, AI/BI embed,
warehouse SQL) run AS the logged-in tenant's own Service Principal, so Unity
Catalog enforces isolation via a row filter keyed on ``session_user()``.

Layout:
  * ``crypto``        — AES-256-GCM encryption of SP secrets at rest.
  * ``registry``      — apex_client_registry + apex_sp_credentials (Lakebase).
  * ``minter``        — per-SP OAuth (M2M) token cache.
  * ``runtime``       — process singletons (minter, admin client, warehouse id).
  * ``sp_lifecycle``  — create / rotate / deactivate / delete SPs (SDK).
  * ``unity_catalog`` — sp_tenant_mapping CRUD + row-filter apply + verify.
  * ``service``       — onboard/rotate/... orchestration + grants + audit.
  * ``resolver``      — session identity → tenant SP token (used by genie/embed).

The tenant join key is the white-label user's ``external_value`` (e.g.
"acme-travel"): it equals ``apex_client_registry.tenant_id``, so a logged-in
user resolves to their SP with no extra mapping table.
"""
