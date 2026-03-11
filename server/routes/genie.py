import json
import time
import asyncio
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from databricks.sdk import WorkspaceClient
from ..config import GENIE_SPACE_ID, WORKSPACE_URL, IS_DATABRICKS_APP
import os

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    context: Optional[str] = None


def _get_client_for_request(request: Request) -> WorkspaceClient:
    """Use OBO token in Databricks App, PAT in local dev."""
    if IS_DATABRICKS_APP:
        obo_token = request.headers.get("x-forwarded-access-token")
        if obo_token:
            return WorkspaceClient(host=WORKSPACE_URL, token=obo_token)
        return WorkspaceClient()
    return WorkspaceClient(
        host=WORKSPACE_URL,
        token=os.environ.get("token"),
    )


def _sse_line(data: str) -> str:
    return f"data: {data}\n\n"


@router.post("/chat")
async def chat(req: ChatRequest, request: Request):
    async def event_stream():
        w = _get_client_for_request(request)
        space_id = GENIE_SPACE_ID

        if not space_id:
            yield _sse_line(json.dumps({"type": "error", "content": "GENIE_SPACE_ID not configured"}))
            return

        try:
            # Prepend dashboard context so Genie knows what the user is viewing
            message = req.message
            if req.context:
                message = f"[Dashboard context: {req.context}]\n\n{req.message}"

            if req.conversation_id:
                resp = w.genie.create_message(
                    space_id=space_id,
                    conversation_id=req.conversation_id,
                    content=message,
                )
            else:
                resp = w.genie.start_conversation(
                    space_id=space_id,
                    content=message,
                )

            conversation_id = resp.conversation_id
            message_id = resp.message_id

            yield _sse_line(json.dumps({"type": "meta", "conversationId": conversation_id}))

            msg = None
            for _ in range(60):
                msg = w.genie.get_message(
                    space_id=space_id,
                    conversation_id=conversation_id,
                    message_id=message_id,
                )
                status = msg.status.value if hasattr(msg.status, "value") else str(msg.status)
                if status in ("COMPLETED", "QUERY_RESULT_EXPIRED"):
                    break
                if status in ("FAILED", "CANCELLED"):
                    yield _sse_line(json.dumps({"type": "error", "content": f"Query {status}"}))
                    return
                yield _sse_line(json.dumps({"type": "status", "content": "Thinking..."}))
                await asyncio.sleep(2)
            else:
                yield _sse_line(json.dumps({"type": "error", "content": "Query timed out"}))
                return

            for att in msg.attachments or []:
                att_dict = att.as_dict() if hasattr(att, "as_dict") else {}
                att_id = att_dict.get("attachment_id")

                text_block = att_dict.get("text")
                if text_block and text_block.get("content"):
                    yield _sse_line(json.dumps({"type": "text", "content": text_block["content"]}))

                query_block = att_dict.get("query")
                if query_block and query_block.get("query"):
                    result_data = None
                    if att_id:
                        try:
                            qr = w.genie.get_message_query_result(
                                space_id=space_id,
                                conversation_id=conversation_id,
                                message_id=message_id,
                                attachment_id=att_id,
                            )
                            sr = qr.statement_response
                            if sr and sr.result and sr.result.data_array:
                                columns = [
                                    {"name": c.name, "type": c.type_name.value if hasattr(c.type_name, "value") else str(c.type_name)}
                                    for c in sr.manifest.schema.columns
                                ]
                                result_data = {"columns": columns, "rows": sr.result.data_array[:50]}
                        except Exception:
                            pass

                    yield _sse_line(json.dumps({
                        "type": "query",
                        "description": query_block.get("description", ""),
                        "sql": query_block["query"],
                        "data": result_data,
                    }))

            yield _sse_line("[DONE]")

        except Exception as e:
            yield _sse_line(json.dumps({"type": "error", "content": str(e)}))

    return StreamingResponse(event_stream(), media_type="text/event-stream")
