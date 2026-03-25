# Databricks notebook source
# COMMAND ----------
# MAGIC %pip install -U mlflow==3.6.0 databricks-langchain databricks-agents
# COMMAND ----------
dbutils.library.restartPython()
# COMMAND ----------
import mlflow
from mlflow.models.resources import DatabricksServingEndpoint, DatabricksGenieSpace

print(f"MLflow version: {mlflow.__version__}")

mlflow.set_registry_uri("databricks-uc")
mlflow.set_experiment("/Users/rohit.bhagwat@bcdtravel.com/apex-travel-agent")

MODEL_NAME = "bcd_adv_workspace_poc.apex.travel_agent"

resources = [
    DatabricksServingEndpoint(endpoint_name="databricks-claude-sonnet-4-6"),
    DatabricksGenieSpace(genie_space_id="01f127092d2219f3be10180d79b2ee5d"),
]

with mlflow.start_run():
    model_info = mlflow.pyfunc.log_model(
        artifact_path="apex_travel_agent",
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
