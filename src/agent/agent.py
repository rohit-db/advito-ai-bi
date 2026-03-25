"""
APEX Travel Intelligence Agent
Claude (via Databricks FMAPI) + Parallel Genie queries for fast executive summaries.
Deployed as a Model Serving endpoint with MLflow tracing.
"""

import json
import time
import mlflow
from concurrent.futures import ThreadPoolExecutor, as_completed
from mlflow.pyfunc import ResponsesAgent
from mlflow.types.responses import (
    ResponsesAgentRequest,
    ResponsesAgentResponse,
    ResponsesAgentStreamEvent,
)

# ── Configuration ────────────────────────────────────────────────────────────

LLM_ENDPOINT = "databricks-claude-sonnet-4-6"
GENIE_SPACE_ID = "01f127092d2219f3be10180d79b2ee5d"

SYSTEM_PROMPT = """You are the APEX Travel Intelligence agent for corporate travel analytics.

You have access to a tool called `query_genie` that queries a travel analytics database.
The database contains corporate travel data across Air, Hotel, Rail, Car, and Taxi/Rideshare categories
with emissions (tCO₂e), spend (USD/EUR/GBP), volume metrics, intensity metrics, and carbon budgets.
Data spans 2019-2025 with ~1.4M transactions.

EFFICIENCY — MINIMIZE CALLS:
When answering broad questions (executive summary, overview, breakdown):
- Devise the FEWEST questions needed — often 1 or 2 is enough. Never more than 3.
- Each question should request MULTIPLE related metrics in a single ask.
- Include year-over-year comparisons within the question.

For focused questions (specific metric, single comparison):
- Use a single query_genie call.

CONTEXT FROM APP:
The app may pass filter context with each question. Apply ALL specified filters.
Default emission methodology is Advito. Default currency is USD.

RESPONSE GUIDELINES:
- Present no more than 5 critical aspects in executive summaries.
- Tone: objective, clear, direct, concise.
- Highlight areas that need attention.
- Include actionable insights when appropriate.
- Use **bold** for critical findings.
- Keep responses under 500 words for summaries.

When you need data, call query_genie. Do NOT make up numbers."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_genie",
            "description": (
                "Query the APEX Travel Intelligence database for travel analytics data. "
                "Ask natural language questions about emissions, spend, volume, travelers, "
                "destinations, airlines, hotels, carbon budgets, and trends. "
                "Combine multiple related metrics into one question for efficiency."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "Natural language question about travel data.",
                    }
                },
                "required": ["question"],
            },
        },
    }
]


# ── Genie Query Helper ───────────────────────────────────────────────────────

def query_genie_sync(question: str) -> str:
    """Execute a single Genie query. Returns formatted result string."""
    from databricks.sdk import WorkspaceClient

    w = WorkspaceClient()
    try:
        resp = w.genie.start_conversation(space_id=GENIE_SPACE_ID, content=question)
        cid, mid = resp.conversation_id, resp.message_id

        # Poll for completion
        for _ in range(30):
            msg = w.genie.get_message(space_id=GENIE_SPACE_ID, conversation_id=cid, message_id=mid)
            status = msg.status.value if hasattr(msg.status, "value") else str(msg.status)
            if status in ("COMPLETED", "QUERY_RESULT_EXPIRED"):
                break
            if status in ("FAILED", "CANCELLED"):
                return f"Error: Query {status}"
            time.sleep(2)
        else:
            return "Error: Query timed out after 60s"

        # Extract results
        parts = []
        for att in msg.attachments or []:
            d = att.as_dict() if hasattr(att, "as_dict") else {}
            text = d.get("text", {}).get("content")
            if text:
                parts.append(text)

            qb = d.get("query")
            if qb and qb.get("query"):
                att_id = d.get("attachment_id")
                data_str = ""
                if att_id:
                    try:
                        qr = w.genie.get_message_query_result(
                            space_id=GENIE_SPACE_ID, conversation_id=cid,
                            message_id=mid, attachment_id=att_id,
                        )
                        sr = qr.statement_response
                        if sr and sr.result and sr.result.data_array:
                            cols = [c.name for c in sr.manifest.schema.columns]
                            data_str = " | ".join(cols) + "\n"
                            for row in sr.result.data_array[:30]:
                                data_str += " | ".join(str(c) for c in row) + "\n"
                    except Exception:
                        pass
                if data_str:
                    parts.append(f"SQL: {qb['query']}\n\nResults:\n{data_str}")
                else:
                    parts.append(f"SQL: {qb['query']} (no data returned)")

        return "\n\n".join(parts) if parts else "No results returned"

    except Exception as e:
        return f"Error: {str(e)}"


def query_genie_parallel(questions: list[str]) -> list[str]:
    """Execute multiple Genie queries in parallel using ThreadPoolExecutor."""
    with ThreadPoolExecutor(max_workers=min(len(questions), 5)) as executor:
        futures = {executor.submit(query_genie_sync, q): i for i, q in enumerate(questions)}
        results = [""] * len(questions)
        for future in as_completed(futures):
            idx = futures[future]
            try:
                results[idx] = future.result()
            except Exception as e:
                results[idx] = f"Error: {str(e)}"
    return results


# ── Agent Class ──────────────────────────────────────────────────────────────

class ApexTravelAgent(ResponsesAgent):
    """APEX Travel Intelligence agent with parallel Genie queries."""

    def __init__(self):
        from databricks_langchain import ChatDatabricks
        self.llm = ChatDatabricks(
            endpoint=LLM_ENDPOINT,
            temperature=0.1,
            max_tokens=4096,
        )

    @mlflow.trace
    def predict(self, request: ResponsesAgentRequest) -> ResponsesAgentResponse:
        # Build messages
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for m in request.input:
            messages.append({"role": m.role, "content": m.content})

        # Step 1: Ask Claude to reason — may emit tool calls
        response = self.llm.invoke(messages, tools=TOOLS)

        tool_calls = response.tool_calls if hasattr(response, "tool_calls") else []

        if not tool_calls:
            # No tools needed — direct response
            return ResponsesAgentResponse(
                output=[self.create_text_output_item(text=response.content, id="msg_1")]
            )

        # Step 2: Execute ALL Genie queries in parallel
        questions = [tc["args"]["question"] for tc in tool_calls]
        start = time.time()
        genie_results = query_genie_parallel(questions)
        elapsed = time.time() - start

        # Build output items: show tool calls + results
        output_items = []
        item_id = 0

        # Add initial text if any
        if response.content:
            output_items.append(self.create_text_output_item(text=response.content, id=f"msg_{item_id}"))
            item_id += 1

        # Add tool calls and results
        for tc, result in zip(tool_calls, genie_results):
            call_id = tc.get("id", f"call_{item_id}")
            output_items.append(
                self.create_function_call_item(
                    id=f"fc_{item_id}",
                    call_id=call_id,
                    name="query_genie",
                    arguments=json.dumps({"question": tc["args"]["question"]}),
                )
            )
            output_items.append(
                self.create_function_call_output_item(
                    call_id=call_id,
                    output=result,
                )
            )
            item_id += 1

        # Step 3: Feed results back to Claude for synthesis
        # Build the tool result messages for the LLM
        from langchain_core.messages import AIMessage, ToolMessage, SystemMessage, HumanMessage

        synth_messages = [SystemMessage(content=SYSTEM_PROMPT)]
        for m in request.input:
            if m.role == "user":
                synth_messages.append(HumanMessage(content=m.content))
            elif m.role == "assistant":
                synth_messages.append(AIMessage(content=m.content))

        # Add the AI's tool calls as an AIMessage
        ai_tool_calls = []
        for tc, result in zip(tool_calls, genie_results):
            call_id = tc.get("id", f"call_{len(ai_tool_calls)}")
            ai_tool_calls.append({
                "name": "query_genie",
                "args": {"question": tc["args"]["question"]},
                "id": call_id,
            })
        synth_messages.append(AIMessage(content=response.content or "", tool_calls=ai_tool_calls))

        # Add tool results
        for tc, result in zip(tool_calls, genie_results):
            call_id = tc.get("id", f"call_0")
            synth_messages.append(ToolMessage(content=result, tool_call_id=call_id))

        # Get synthesis
        synthesis = self.llm.invoke(synth_messages)

        output_items.append(
            self.create_text_output_item(
                text=f"\n\n*Data retrieved in {elapsed:.1f}s (parallel)*\n\n{synthesis.content}",
                id=f"msg_{item_id}",
            )
        )

        return ResponsesAgentResponse(output=output_items)

    def predict_stream(
        self, request: ResponsesAgentRequest
    ) -> ResponsesAgentStreamEvent:
        """Streaming — delegate to predict for now, stream the output items."""
        result = self.predict(request)
        for item in result.output:
            yield ResponsesAgentStreamEvent(type="response.output_item.done", item=item)


# Export
AGENT = ApexTravelAgent()
mlflow.models.set_model(AGENT)
