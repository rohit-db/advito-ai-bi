"""
APEX Custom Agent — Claude (via Databricks FMAPI) + Parallel Genie
Replaces MAS with true parallel Genie calls for fast executive summaries.
Uses Databricks Foundation Model API to call Claude — no separate API key needed.
"""

import json
import time
import asyncio
import os
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from databricks.sdk import WorkspaceClient
from ..config import GENIE_SPACE_ID, WORKSPACE_URL, IS_DATABRICKS_APP

router = APIRouter()

# Use Claude via Databricks Foundation Model API
LLM_ENDPOINT = "databricks-claude-sonnet-4-6"

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
- All tool calls you make will be executed IN PARALLEL — so emit them all at once.

For focused questions (specific metric, single comparison):
- Use a single query_genie call.

CONTEXT FROM APP:
The app passes filter context with each question. Apply ALL specified filters.
Default emission methodology is Advito. Default currency is USD. Default date is travel start date.

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
            "description": "Query the APEX Travel Intelligence database for travel analytics data. "
                           "Ask natural language questions about emissions, spend, volume, travelers, "
                           "destinations, airlines, hotels, carbon budgets, and trends. "
                           "Combine multiple related metrics into one question for efficiency.",
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


class AgentChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    context: str = ""


def _get_workspace_client(request: Request) -> WorkspaceClient:
    if IS_DATABRICKS_APP:
        obo_token = request.headers.get("x-forwarded-access-token")
        if obo_token:
            return WorkspaceClient(host=WORKSPACE_URL, token=obo_token)
        return WorkspaceClient()
    return WorkspaceClient(host=WORKSPACE_URL, token=os.environ.get("token"))


async def _query_genie_async(w: WorkspaceClient, question: str) -> dict:
    """Execute a single Genie query. Runs in a thread pool for async compatibility."""
    def _sync_query():
        try:
            resp = w.genie.start_conversation(
                space_id=GENIE_SPACE_ID,
                content=question,
            )
            cid, mid = resp.conversation_id, resp.message_id

            for _ in range(30):
                msg = w.genie.get_message(space_id=GENIE_SPACE_ID, conversation_id=cid, message_id=mid)
                status = msg.status.value if hasattr(msg.status, "value") else str(msg.status)
                if status in ("COMPLETED", "QUERY_RESULT_EXPIRED"):
                    break
                if status in ("FAILED", "CANCELLED"):
                    return {"question": question, "error": f"Query {status}"}
                time.sleep(2)
            else:
                return {"question": question, "error": "Timed out"}

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
                    parts.append(f"SQL: {qb['query']}\n\nResults:\n{data_str}" if data_str else f"SQL: {qb['query']}")

            return {"question": question, "result": "\n\n".join(parts) if parts else "No results"}

        except Exception as e:
            return {"question": question, "error": str(e)}

    return await asyncio.get_event_loop().run_in_executor(None, _sync_query)


def _sse(data: str) -> str:
    return f"data: {data}\n\n"


@router.post("/agent/chat")
async def agent_chat(req: AgentChatRequest, request: Request):
    async def event_stream():
        w = _get_workspace_client(request)

        # Build messages
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for m in req.history:
            messages.append({"role": m["role"], "content": m["content"]})

        user_msg = req.message
        if req.context:
            user_msg = f"[Filter context: {req.context}]\n\n{req.message}"
        messages.append({"role": "user", "content": user_msg})

        yield _sse(json.dumps({"type": "status", "content": "Thinking..."}))

        try:
            # Step 1: Call Claude via Databricks FMAPI to get tool calls
            import httpx
            fmapi_url = f"{WORKSPACE_URL}/serving-endpoints/{LLM_ENDPOINT}/invocations"

            # Get auth token for FMAPI
            # In Databricks App: use SP client's authenticate() which handles OAuth
            # Locally: use PAT from .env
            if IS_DATABRICKS_APP:
                sp_client = WorkspaceClient()
                auth_headers = sp_client.config.authenticate()
                token = auth_headers.get("Authorization", "").replace("Bearer ", "")
            else:
                token = os.environ.get("token")

            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }

            payload = {
                "messages": messages,
                "max_tokens": 4096,
                "tools": TOOLS,
            }

            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(fmapi_url, json=payload, headers=headers)
                if resp.status_code != 200:
                    yield _sse(json.dumps({"type": "error", "content": f"LLM error {resp.status_code}: {resp.text[:300]}"}))
                    return
                llm_result = resp.json()

            choice = llm_result["choices"][0]
            assistant_msg = choice["message"]

            # Check for tool calls
            tool_calls = assistant_msg.get("tool_calls", [])

            if not tool_calls:
                # No tools needed — Claude answered directly
                yield _sse(json.dumps({"type": "stream", "content": assistant_msg.get("content", "")}))
                yield _sse("[DONE]")
                return

            # Stream initial text if any
            if assistant_msg.get("content"):
                yield _sse(json.dumps({"type": "stream", "content": assistant_msg["content"]}))

            # Step 2: Execute ALL Genie queries in PARALLEL
            questions = []
            for tc in tool_calls:
                args = json.loads(tc["function"]["arguments"])
                q = args["question"]
                questions.append(q)
                yield _sse(json.dumps({"type": "tool_call", "name": "query_genie", "arguments": q}))

            yield _sse(json.dumps({"type": "status", "content": f"Querying data ({len(questions)} calls in parallel)..."}))

            start = time.time()
            results = await asyncio.gather(*[_query_genie_async(w, q) for q in questions])
            elapsed = time.time() - start

            yield _sse(json.dumps({"type": "status", "content": f"Data retrieved in {elapsed:.1f}s. Synthesizing..."}))

            # Step 3: Feed results back to Claude for synthesis (streaming)
            messages.append(assistant_msg)

            for tc, result in zip(tool_calls, results):
                content = result.get("error") or result.get("result", "No data")
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": content,
                })

            # Stream the synthesis
            payload_synth = {
                "messages": messages,
                "max_tokens": 4096,
                "stream": True,
            }

            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", fmapi_url, json=payload_synth, headers=headers) as stream_resp:
                    async for line in stream_resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        chunk = line[6:].strip()
                        if chunk == "[DONE]":
                            break
                        try:
                            d = json.loads(chunk)
                            delta = d["choices"][0].get("delta", {})
                            text = delta.get("content")
                            if text:
                                yield _sse(json.dumps({"type": "stream", "content": text}))
                        except (json.JSONDecodeError, KeyError):
                            continue

            yield _sse("[DONE]")

        except Exception as e:
            yield _sse(json.dumps({"type": "error", "content": str(e)}))

    return StreamingResponse(event_stream(), media_type="text/event-stream")
