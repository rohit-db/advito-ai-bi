import os
from dotenv import load_dotenv
from databricks.sdk import WorkspaceClient

load_dotenv()

IS_DATABRICKS_APP = bool(os.environ.get("DATABRICKS_APP_NAME"))
WORKSPACE_URL = os.environ.get("workspace_url", "https://dbc-1e27e56a-90cd.cloud.databricks.com")
DASHBOARD_URL = os.environ.get(
    "DASHBOARD_URL",
    "https://dbc-1e27e56a-90cd.cloud.databricks.com/embed/dashboardsv3/01f1169e4b5810418541b22a792aa916/published?o=1048934788948873",
)
GENIE_SPACE_ID = os.environ.get("GENIE_SPACE_ID", "01f0dc0bf5ce1e3088ad455c5f489911")
WAREHOUSE_ID = os.environ.get("WAREHOUSE_ID", "5cd3a4956df6152f")


def get_workspace_client() -> WorkspaceClient:
    if IS_DATABRICKS_APP:
        return WorkspaceClient()
    return WorkspaceClient(
        host=WORKSPACE_URL,
        token=os.environ.get("token"),
    )
