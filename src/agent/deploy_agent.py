"""Deploy the APEX Travel Agent to a Model Serving endpoint."""

from databricks import agents

MODEL_NAME = "bcd_adv_workspace_poc.apex.travel_agent"
VERSION = "1"

print(f"Deploying {MODEL_NAME} version {VERSION}...")
print("This takes ~15 minutes...")

deployment = agents.deploy(
    MODEL_NAME,
    VERSION,
    tags={"source": "apex-poc", "environment": "bcd"},
)

print(f"Deployment complete!")
print(f"Endpoint: {deployment.endpoint_name}")
