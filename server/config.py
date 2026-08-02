import os
from dotenv import load_dotenv
from databricks.sdk import WorkspaceClient

load_dotenv()

IS_DATABRICKS_APP = bool(os.environ.get("DATABRICKS_APP_NAME"))


def _normalize_host(value: str | None) -> str | None:
    """Return a host with an https:// scheme, or None."""
    if not value:
        return None
    value = value.strip().rstrip("/")
    if not value:
        return None
    if not value.startswith(("http://", "https://")):
        value = f"https://{value}"
    return value


# Workspace host. Externally we run with the *standard* SDK env var
# DATABRICKS_HOST; inside a Databricks App that is injected automatically, and we
# also accept the legacy lowercase `workspace_url` used by older local .env files.
WORKSPACE_URL = (
    _normalize_host(os.environ.get("DATABRICKS_HOST"))
    or _normalize_host(os.environ.get("workspace_url"))
    or "https://dbc-1e27e56a-90cd.cloud.databricks.com"
)

# Service Principal OAuth (M2M / client_credentials). When these are present the
# app authenticates to Databricks AS THE SP from anywhere — no Databricks Apps
# platform, no Databricks login. On Databricks Apps the platform injects these
# same two variables, so a single code path works in both environments.
DATABRICKS_CLIENT_ID = (
    os.environ.get("DATABRICKS_CLIENT_ID") or os.environ.get("EMBED_SP_CLIENT_ID")
)
DATABRICKS_CLIENT_SECRET = (
    os.environ.get("DATABRICKS_CLIENT_SECRET") or os.environ.get("EMBED_SP_CLIENT_SECRET")
)
HAS_SP_CREDENTIALS = bool(DATABRICKS_CLIENT_ID and DATABRICKS_CLIENT_SECRET)
DASHBOARD_URL = os.environ.get(
    "DASHBOARD_URL",
    "https://dbc-1e27e56a-90cd.cloud.databricks.com/embed/dashboardsv3/01f1271698161d42b3c66528415775e8?o=1048934788948873",
)
MULTI_PAGE_DASHBOARD_URL = os.environ.get(
    "MULTI_PAGE_DASHBOARD_URL",
    "https://dbc-1e27e56a-90cd.cloud.databricks.com/embed/dashboardsv3/01f1271698161d42b3c66528415775e8?o=1048934788948873",
)
GENIE_SPACE_ID = os.environ.get("GENIE_SPACE_ID", "01f127092d2219f3be10180d79b2ee5d")

# ── Multi-tenant per-SP isolation (see server/tenants/) ──────────────────────
# Unity Catalog catalog/schema holding the governed tables, the
# ``tenant_row_filter`` function, and the ``sp_tenant_mapping`` lookup joined by
# that filter. WAREHOUSE_NAME is resolved to an id at runtime for admin SQL.
UC_CATALOG = os.environ.get("UC_CATALOG", "").strip()
UC_SCHEMA = os.environ.get("UC_SCHEMA", "").strip()
WAREHOUSE_NAME = os.environ.get("WAREHOUSE_NAME", "Serverless Starter Warehouse").strip()
# Account group whose members bypass the tenant row filter (admins/back-office).
TENANT_ADMIN_GROUP = os.environ.get("TENANT_ADMIN_GROUP", "admins").strip()
# Display-name prefix for onboarded per-tenant Service Principals.
TENANT_SP_PREFIX = os.environ.get("TENANT_SP_PREFIX", "prism-tenant").strip()
# Optional CLI profile used ONLY for SP lifecycle (create/rotate/delete), which
# requires workspace-admin. Lets you onboard locally as an admin without making
# the app SP an admin. Falls back to the app SP client when unset.
TENANTS_ADMIN_PROFILE = os.environ.get("TENANTS_ADMIN_PROFILE", "").strip()

# ── Row-filter mapping shape ─────────────────────────────────────────────────
# The isolation control is a UC row filter that joins governed tables to a
# mapping table keyed on the SQL caller identity. Defaults match this app's
# built-in ``sp_tenant_mapping`` (created by scripts/tenants/apply_row_filter.py).
# Override these to REUSE an existing customer filter table/function instead of
# creating our own — e.g. a customer's ``user_client_access(user_email, client_id)``
# joined by ``client_access_filter`` on ``current_user()``.
#
#   MAPPING_TABLE          table the filter function joins (in UC_CATALOG.UC_SCHEMA)
#   MAPPING_USER_COLUMN    column holding the caller identity (the SP app id)
#   MAPPING_TENANT_COLUMN  column holding the tenant key
#   MAPPING_ACTIVE_COLUMN  boolean "active" column, or "" if the table has none
#                          (when absent, deactivate = delete the mapping row)
#   MAPPING_TS_COLUMN      optional timestamp column to stamp on insert (e.g. granted_at)
#   TENANT_COLUMN          the tenant column on the GOVERNED FACT TABLE (for verify)
#   FILTER_FUNCTION        the row-filter function name to attach (apply script)
MAPPING_TABLE = os.environ.get("MAPPING_TABLE", "sp_tenant_mapping").strip()
MAPPING_USER_COLUMN = os.environ.get("MAPPING_USER_COLUMN", "sp_app_id").strip()
MAPPING_TENANT_COLUMN = os.environ.get("MAPPING_TENANT_COLUMN", "tenant_id").strip()
MAPPING_ACTIVE_COLUMN = os.environ.get("MAPPING_ACTIVE_COLUMN", "active").strip()
MAPPING_TS_COLUMN = os.environ.get("MAPPING_TS_COLUMN", "").strip()
TENANT_COLUMN = os.environ.get("TENANT_COLUMN", "tenant_id").strip()
# Optional human-readable label column on VERIFY_TABLE (e.g. ``client_name``).
TENANT_LABEL_COLUMN = os.environ.get("TENANT_LABEL_COLUMN", "").strip()
FILTER_FUNCTION = os.environ.get("FILTER_FUNCTION", "tenant_row_filter").strip()


def get_workspace_client() -> WorkspaceClient:
    """Workspace client that works inside Databricks Apps *and* on any external host.

    Resolution order:
      1. Service Principal (M2M / OAuth client_credentials) when client id/secret
         are set — the portable, host-agnostic path used for external hosting.
      2. Databricks Apps platform default auth (injected SP) when running in-app.
      3. Local PAT via the legacy ``token`` env var.
    """
    if HAS_SP_CREDENTIALS:
        return WorkspaceClient(
            host=WORKSPACE_URL,
            client_id=DATABRICKS_CLIENT_ID,
            client_secret=DATABRICKS_CLIENT_SECRET,
        )
    if IS_DATABRICKS_APP:
        return WorkspaceClient()
    return WorkspaceClient(
        host=WORKSPACE_URL,
        token=os.environ.get("token"),
    )


def get_sp_bearer() -> str | None:
    """Return a service-principal bearer token via M2M, or None if no SP creds.

    Host-agnostic: relies only on DATABRICKS_HOST + DATABRICKS_CLIENT_ID/SECRET,
    so it works identically on EC2/ECS/any container and inside Databricks Apps.
    """
    if not HAS_SP_CREDENTIALS:
        return None
    w = WorkspaceClient(
        host=WORKSPACE_URL,
        client_id=DATABRICKS_CLIENT_ID,
        client_secret=DATABRICKS_CLIENT_SECRET,
    )
    headers = w.config.authenticate() or {}
    token = headers.get("Authorization", "").replace("Bearer ", "").strip()
    return token or None
