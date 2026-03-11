import json
import httpx
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from ..config import IS_DATABRICKS_APP, MAS_ENDPOINT, get_workspace_client
import os

router = APIRouter()


class MasChatRequest(BaseModel):
    message: str
    history: list[dict] = []


def _get_serving_headers(request: Request) -> dict:
    """Use OBO token in Databricks App, PAT in local dev."""
    if IS_DATABRICKS_APP:
        obo_token = request.headers.get("x-forwarded-access-token")
        if obo_token:
            return {"Authorization": f"Bearer {obo_token}"}
        # Fallback to service principal
        w = get_workspace_client()
        return w.config.authenticate()
    return {"Authorization": f"Bearer {os.environ.get('token', '')}"}


def _sse_line(data: str) -> str:
    return f"data: {data}\n\n"


@router.post("/mas/chat")
async def mas_chat(req: MasChatRequest, request: Request):
    async def event_stream():
        try:
            auth_headers = _get_serving_headers(request)
        except Exception as e:
            yield _sse_line(json.dumps({"type": "error", "content": f"Auth error: {e}"}))
            return

        endpoint_url = MAS_ENDPOINT
        if not endpoint_url:
            yield _sse_line(json.dumps({"type": "error", "content": "MAS endpoint not configured"}))
            return

        chat_input = [{"role": m["role"], "content": m["content"]} for m in req.history]
        chat_input.append({"role": "user", "content": req.message})

        payload = {"input": chat_input, "stream": True}

        try:
            request_headers = {"Content-Type": "application/json", **auth_headers}

            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
                async with client.stream(
                    "POST",
                    endpoint_url,
                    json=payload,
                    headers=request_headers,
                ) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        yield _sse_line(json.dumps({
                            "type": "error",
                            "content": f"MAS returned {resp.status_code}: {body.decode()[:500]}",
                        }))
                        return

                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        if not line.startswith("data: "):
                            continue

                        chunk_data = line[6:].strip()
                        if chunk_data == "[DONE]":
                            break

                        try:
                            event = json.loads(chunk_data)
                        except json.JSONDecodeError:
                            continue

                        event_type = event.get("type", "")

                        # Text streaming deltas — forward as stream chunks
                        if event_type == "response.output_text.delta":
                            yield _sse_line(json.dumps({
                                "type": "stream",
                                "content": event.get("delta", ""),
                                "step": event.get("step"),
                            }))

                        # Completed items — function calls, agent handoffs
                        elif event_type == "response.output_item.done":
                            item = event.get("item", {})
                            item_type = item.get("type", "")

                            if item_type == "function_call":
                                name = item.get("name", "")
                                args = item.get("arguments", "")
                                yield _sse_line(json.dumps({
                                    "type": "tool_call",
                                    "name": name,
                                    "arguments": args,
                                    "step": item.get("step", event.get("step")),
                                }))

                            elif item_type == "message":
                                # Check if it's an agent handoff marker
                                for block in item.get("content", []):
                                    text = block.get("text", "")
                                    if text.startswith("<name>") and text.endswith("</name>"):
                                        agent_name = text[6:-7]
                                        yield _sse_line(json.dumps({
                                            "type": "agent_handoff",
                                            "agent": agent_name,
                                        }))

                        # Response completed
                        elif event_type == "response.completed":
                            pass

            yield _sse_line("[DONE]")

        except httpx.TimeoutException:
            yield _sse_line(json.dumps({"type": "error", "content": "Request timed out (120s)"}))
        except Exception as e:
            yield _sse_line(json.dumps({"type": "error", "content": str(e)}))

    return StreamingResponse(event_stream(), media_type="text/event-stream")
