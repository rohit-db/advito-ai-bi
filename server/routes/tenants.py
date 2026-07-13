"""Operator API for per-tenant Service Principal isolation.

Mounted by ``app.py`` under ``/api`` (this router declares no prefix). Every
endpoint requires an authenticated operator session (``role == "operator"``);
the operator's email is threaded through to the service layer as the audit
``actor``.

Endpoints:
  GET    /tenants                        list tenants
  POST   /tenants/onboard                create tenant SP (returns secret once)
  POST   /tenants/{id}/rotate            rotate SP secret
  POST   /tenants/{id}/deactivate        disable SP
  POST   /tenants/{id}/reactivate        re-enable SP (new secret)
  DELETE /tenants/{id}                   delete SP + registry rows
  GET    /tenants/{id}/history           audit history for one tenant
  POST   /tenants/verify                 run UC isolation verification
  GET    /tenants/audit                  recent audit rows (all tenants)
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..auth.sessions import SESSION_COOKIE, verify_session
from ..tenants import audit, registry, service

logger = logging.getLogger("server.routes.tenants")

router = APIRouter()


# ----------------------------------------------------------------- auth deps
def _current_user(request: Request) -> dict:
    ident = verify_session(request.cookies.get(SESSION_COOKIE))
    if not ident:
        raise HTTPException(status_code=401, detail="authentication required")
    return ident


def _require_operator(request: Request) -> dict:
    ident = _current_user(request)
    if ident.get("role") != "operator":
        raise HTTPException(status_code=403, detail="operator role required")
    return ident


# ----------------------------------------------------------------- models
class OnboardIn(BaseModel):
    tenant_id: str
    display_name: str
    genie_space_id: Optional[str] = None


class TenantOut(BaseModel):
    tenant_id: str
    display_name: str
    sp_app_id: str
    sp_display_name: str
    status: str
    genie_space_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AuditRow(BaseModel):
    id: Optional[int] = None
    tenant_id: Optional[str] = None
    actor: Optional[str] = None
    action: str
    sp_app_id: Optional[str] = None
    status: str
    detail: Optional[str] = None
    latency_ms: Optional[int] = None
    created_at: Optional[str] = None


class VerifyRow(BaseModel):
    tenant_id: str
    display_name: Optional[str] = None
    passed: bool
    distinct_tenant_ids: list = []
    session_user: Optional[str] = None
    visible_row_count: Optional[int] = None
    error: Optional[str] = None


def _tenant_out(tenant_id: str) -> TenantOut:
    row = registry.get_tenant(tenant_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"tenant {tenant_id} not found")
    return TenantOut(
        tenant_id=row.tenant_id,
        display_name=row.display_name,
        sp_app_id=row.sp_app_id,
        sp_display_name=row.sp_display_name,
        status=row.status,
        genie_space_id=row.genie_space_id,
        created_at=row.created_at.isoformat() if row.created_at else None,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


# ----------------------------------------------------------------- endpoints
@router.get("/tenants")
def list_tenants(request: Request):
    _require_operator(request)
    return {"tenants": service.list_tenants()}


@router.post("/tenants/onboard")
def onboard_tenant(request: Request, body: OnboardIn):
    ident = _require_operator(request)
    tenant_id = (body.tenant_id or "").strip().lower()
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id is required")
    try:
        res = service.onboard(
            tenant_id,
            body.display_name,
            genie_space_id=body.genie_space_id,
            actor=ident.get("email"),
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
    return {
        "tenant": _tenant_out(tenant_id),
        "client_id": res["sp_app_id"],
        "client_secret": res["client_secret"],
    }


@router.post("/tenants/{tenant_id}/rotate")
def rotate_tenant(request: Request, tenant_id: str):
    ident = _require_operator(request)
    try:
        new_secret = service.rotate(tenant_id, actor=ident.get("email"))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
    return {"tenant_id": tenant_id, "new_client_secret": new_secret}


@router.post("/tenants/{tenant_id}/deactivate")
def deactivate_tenant(request: Request, tenant_id: str):
    ident = _require_operator(request)
    try:
        service.deactivate(tenant_id, actor=ident.get("email"))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True, "tenant_id": tenant_id}


@router.post("/tenants/{tenant_id}/reactivate")
def reactivate_tenant(request: Request, tenant_id: str):
    ident = _require_operator(request)
    try:
        new_secret = service.reactivate(tenant_id, actor=ident.get("email"))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
    return {"tenant_id": tenant_id, "new_client_secret": new_secret}


@router.delete("/tenants/{tenant_id}")
def delete_tenant(request: Request, tenant_id: str):
    ident = _require_operator(request)
    try:
        service.delete(tenant_id, actor=ident.get("email"))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True, "tenant_id": tenant_id}


@router.get("/tenants/{tenant_id}/history")
def tenant_history(request: Request, tenant_id: str, limit: int = 50):
    _require_operator(request)
    return {"rows": audit.history(tenant_id, limit=limit)}


@router.post("/tenants/verify")
def verify_tenants(request: Request):
    _require_operator(request)
    try:
        results = service.verify()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
    return {"results": results}


@router.get("/tenants/audit")
def audit_feed(request: Request, limit: int = 20):
    _require_operator(request)
    return {"rows": audit.recent(limit=limit)}
