"""APEX persistence API — conversation history + user filter preferences.

All routes are scoped to the white-label session identity
(``current_identity`` → email/tenant), so each viewer only ever sees and
mutates their own threads and saved filters. When Lakebase is disabled the
endpoints degrade gracefully (empty lists / ``persisted: false``) so the demo
still runs against the JSON-only path.

Mounted at ``/api/apex`` (see ``app.py``).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .. import persistence
from ..auth import current_identity

logger = logging.getLogger("server.routes.apex")

router = APIRouter()


def _user(request: Request) -> tuple[str, str]:
    """Resolve (email, tenant) for the current request.

    Prefers the white-label session identity. Falls back to a stable demo key
    when auth is disabled (Databricks-Apps mode), so persistence still works in
    single-user demos.
    """
    identity = current_identity(request)
    if identity and identity.get("email"):
        return identity["email"], identity.get("tenant", "") or ""
    return "demo@advito.com", "Advito (All)"


# ============================================================ conversations
class CreateConversationBody(BaseModel):
    mode: str = "space"
    title: str | None = None


class SaveTurnBody(BaseModel):
    user: str
    assistant: dict = {}


class RenameBody(BaseModel):
    title: str


@router.get("/conversations")
def list_conversations(request: Request):
    email, _ = _user(request)
    return {"conversations": persistence.list_conversations(email)}


@router.post("/conversations")
def create_conversation(request: Request, body: CreateConversationBody):
    email, tenant = _user(request)
    if not persistence.enabled():
        return JSONResponse({"persisted": False, "id": None}, status_code=200)
    conv = persistence.create_conversation(email, tenant=tenant, mode=body.mode, title=body.title or persistence.DEFAULT_TITLE)
    return {"persisted": True, **conv}


@router.get("/conversations/{conversation_id}")
def get_conversation(request: Request, conversation_id: str):
    email, _ = _user(request)
    conv = persistence.get_conversation(conversation_id, email)
    if conv is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return conv


@router.post("/conversations/{conversation_id}/turn")
def save_turn(request: Request, conversation_id: str, body: SaveTurnBody):
    email, _ = _user(request)
    return persistence.save_turn(conversation_id, email, body.user, body.assistant)


@router.patch("/conversations/{conversation_id}")
def rename_conversation(request: Request, conversation_id: str, body: RenameBody):
    email, _ = _user(request)
    ok = persistence.rename_conversation(conversation_id, email, body.title)
    return {"ok": ok}


@router.delete("/conversations/{conversation_id}")
def delete_conversation(request: Request, conversation_id: str):
    email, _ = _user(request)
    ok = persistence.delete_conversation(conversation_id, email)
    return {"ok": ok}


# ============================================================ filter preferences
class FilterPrefsBody(BaseModel):
    filters: dict


@router.get("/filters/{dashboard_id}")
def get_filters(request: Request, dashboard_id: str):
    email, _ = _user(request)
    return {"filters": persistence.get_filter_prefs(email, dashboard_id)}


@router.put("/filters/{dashboard_id}")
def put_filters(request: Request, dashboard_id: str, body: FilterPrefsBody):
    email, _ = _user(request)
    ok = persistence.put_filter_prefs(email, dashboard_id, body.filters)
    return {"ok": ok}
