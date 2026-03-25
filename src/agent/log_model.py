"""Log the APEX Travel Agent to Unity Catalog."""

import mlflow
from mlflow.models.resources import DatabricksServingEndpoint, DatabricksGenieSpace

mlflow.set_registry_uri("databricks-uc")

MODEL_NAME = "bcd_adv_workspace_poc.apex.travel_agent"
LLM_ENDPOINT = "databricks-claude-sonnet-4-6"
GENIE_SPACE_ID = "01f127092d2219f3be10180d79b2ee5d"

resources = [
    DatabricksServingEndpoint(endpoint_name=LLM_ENDPOINT),
    DatabricksGenieSpace(genie_space_id=GENIE_SPACE_ID),
]

with mlflow.start_run():
    model_info = mlflow.pyfunc.log_model(
        name="apex_travel_agent",
        python_model="/Workspace/Users/rohit.bhagwat@bcdtravel.com/advito-ai-bi/src/agent/agent.py",
        resources=resources,
        pip_requirements=[
            "mlflow==3.6.0",
            "databricks-langchain",
            "databricks-sdk",
        ],
        input_example={
            "input": [{"role": "user", "content": "Give me an executive summary for 2025"}]
        },
        registered_model_name=MODEL_NAME,
    )

print(f"Model registered: {MODEL_NAME}")
print(f"Version: {model_info.registered_model_version}")
print(f"Run ID: {model_info.run_id}")
