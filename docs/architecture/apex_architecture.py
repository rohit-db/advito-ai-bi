"""APEX POC Architecture Diagram — Clean Layout"""

import os
from diagrams import Diagram, Cluster, Edge
from diagrams.custom import Custom
from diagrams.onprem.client import Users
from diagrams.programming.framework import React, FastAPI

ICONS = os.path.expanduser("~/.claude/plugins/cache/fe-vibe/fe-workflows/1.2.0/skills/fe-architecture-diagram/resources/icons")
DB = f"{ICONS}/databricks"

OUT = os.path.dirname(os.path.abspath(__file__))

with Diagram(
    "APEX — Corporate Travel Intelligence Platform",
    show=False,
    filename=f"{OUT}/apex_architecture",
    outformat="png",
    direction="LR",
    graph_attr={
        "splines": "polyline",
        "nodesep": "0.8",
        "ranksep": "2.0",
        "pad": "1.0",
        "fontsize": "18",
        "bgcolor": "white",
        "dpi": "150",
        "fontname": "Helvetica",
    },
    node_attr={"fontsize": "11", "fontname": "Helvetica", "width": "1.8"},
    edge_attr={"fontsize": "9", "fontname": "Helvetica"},
):

    users = Users("Client Users")

    # ── Databricks App ──────────────────────────────────────────────────
    with Cluster("Databricks App  (advito-ai-bi)", graph_attr={"bgcolor": "#f0f4ff", "style": "rounded", "fontsize": "14"}):

        with Cluster("React UI", graph_attr={"bgcolor": "#e8edff"}):
            ui_dash = React("Dashboard\nEmbed")
            ui_genie = React("Ask APEX\nChat Panel")
            ui_agent = React("APEX Agent\nFull Page")

        with Cluster("FastAPI", graph_attr={"bgcolor": "#e8edff"}):
            be_genie = FastAPI("/api/chat\nGenie SSE")
            be_agent = FastAPI("/api/agent/chat\nClaude+Genie")

    # ── Databricks Platform ─────────────────────────────────────────────
    with Cluster("Databricks Platform", graph_attr={"bgcolor": "#fffbe8", "style": "rounded", "fontsize": "14"}):

        with Cluster("AI / BI", graph_attr={"bgcolor": "#fff3d0"}):
            dashboard = Custom("Lakeview\nDashboard", f"{DB}/sql_warehouse.png")
            genie = Custom("Genie Space\nTravel Intelligence", f"{DB}/workspace.png")

        with Cluster("Foundation Models", graph_attr={"bgcolor": "#fff3d0"}):
            claude = Custom("Claude Sonnet 4.6\n(FMAPI)", f"{DB}/model_serving.png")

        with Cluster("Data Layer  (Unity Catalog)", graph_attr={"bgcolor": "#e8f5e8"}):
            mv = Custom("apex.travel_metrics\nMetric View", f"{DB}/unity_catalog.png")
            src = Custom("summarydataset\n1.4M rows", f"{DB}/delta_lake.png")

    # ── Flows ───────────────────────────────────────────────────────────

    # User → UI
    users >> Edge(color="#4f46e5") >> ui_dash
    users >> Edge(color="#4f46e5") >> ui_genie
    users >> Edge(color="#4f46e5") >> ui_agent

    # Dashboard embed
    ui_dash >> Edge(label="iframe +\nURL filters", color="#6366f1") >> dashboard

    # Genie chat
    ui_genie >> be_genie >> Edge(label="Genie API", color="#6366f1") >> genie

    # Custom agent
    ui_agent >> be_agent
    be_agent >> Edge(label="1 Reason", color="#059669") >> claude
    be_agent >> Edge(label="2 Parallel\n  Genie", color="#059669") >> genie

    # Data
    genie >> Edge(label="MEASURE()", color="#16a34a") >> mv
    dashboard >> Edge(color="#16a34a") >> mv
    mv >> Edge(color="#16a34a") >> src

print(f"Done: {OUT}/apex_architecture.png")
