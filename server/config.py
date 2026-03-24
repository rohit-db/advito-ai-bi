import os
from fastapi import Request
from dotenv import load_dotenv
from databricks.sdk import WorkspaceClient

load_dotenv()

IS_DATABRICKS_APP = bool(os.environ.get("DATABRICKS_APP_NAME"))
WORKSPACE_URL = os.environ.get("workspace_url", "https://dbc-1e27e56a-90cd.cloud.databricks.com")
DASHBOARD_URL = os.environ.get(
    "DASHBOARD_URL",
    "https://dbc-1e27e56a-90cd.cloud.databricks.com/embed/dashboardsv3/01f1271698161d42b3c66528415775e8?o=1048934788948873",
)
MULTI_PAGE_DASHBOARD_URL = os.environ.get(
    "MULTI_PAGE_DASHBOARD_URL",
    "https://dbc-1e27e56a-90cd.cloud.databricks.com/embed/dashboardsv3/01f1271698161d42b3c66528415775e8?o=1048934788948873",
)
GENIE_SPACE_ID = os.environ.get("GENIE_SPACE_ID", "01f127092d2219f3be10180d79b2ee5d")
WAREHOUSE_ID = os.environ.get("WAREHOUSE_ID", "5cd3a4956df6152f")
MAS_ENDPOINT = os.environ.get(
    "MAS_ENDPOINT",
    "https://dbc-1e27e56a-90cd.cloud.databricks.com/serving-endpoints/mas-d4bc5d36-endpoint/invocations",
)


def get_workspace_client(request: Request | None = None) -> WorkspaceClient:
    """Get a WorkspaceClient using OBO token (Databricks App) or PAT (local dev).

    In Databricks App: Uses the user's OBO token from the forwarded request header.
    This means all API calls run as the logged-in user, enabling ABAC via row-level security.

    In local dev: Falls back to PAT from .env file.
    """
    if IS_DATABRICKS_APP:
        if request:
            obo_token = request.headers.get("x-forwarded-access-token")
            if obo_token:
                return WorkspaceClient(host=WORKSPACE_URL, token=obo_token)
        # Fallback: service principal (no user context)
        return WorkspaceClient()
    # Local dev: PAT
    return WorkspaceClient(
        host=WORKSPACE_URL,
        token=os.environ.get("token"),
    )


def get_obo_token(request: Request) -> str | None:
    """Extract the OBO token from request headers for direct HTTP calls (e.g., MAS)."""
    if IS_DATABRICKS_APP:
        return request.headers.get("x-forwarded-access-token")
    return os.environ.get("token")
