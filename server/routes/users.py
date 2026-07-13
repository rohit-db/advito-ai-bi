"""Operator API for the white-label login user directory.

Users map to tenants via ``tenant_id`` — the same key used in
``apex_client_registry``. At login, ``resolve_tenant_sp`` looks up that tenant
and mints a token for its Service Principal. There is no separate user→SP table.

Endpoints:
  GET    /users           list login users
  POST   /users           create user (password required)
  PUT    /users/{email}   update user (password optional)
  DELETE /users/{email}   remove user
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..auth import users as users_repo
from ..auth.sessions import SESSION_COOKIE, hash_password, verify_session

router = APIRouter()


def _require_operator(request: Request) -> dict:
    ident = verify_session(request.cookies.get(SESSION_COOKIE))
    if not ident:
        raise HTTPException(status_code=401, detail="authentication required")
    if ident.get("role") != "operator":
        raise HTTPException(status_code=403, detail="operator role required")
    return ident


class UserOut(BaseModel):
    email: str
    display_name: str
    tenant: str
    tenant_id: str
    role: str


class UserCreateIn(BaseModel):
    email: str
    password: str = Field(min_length=1)
    display_name: str
    tenant: str
    tenant_id: str
    role: str = "user"


class UserUpdateIn(BaseModel):
    display_name: Optional[str] = None
    tenant: Optional[str] = None
    tenant_id: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


def _out(row: users_repo.UserRow) -> UserOut:
    return UserOut(
        email=row.email,
        display_name=row.display_name,
        tenant=row.tenant,
        tenant_id=row.tenant_id,
        role=row.role,
    )


@router.get("/users")
def list_users(request: Request):
    _require_operator(request)
    return {
        "users": [_out(r) for r in users_repo.list_users()],
        "writable": users_repo.lakebase_writable(),
    }


@router.post("/users")
def create_user(request: Request, body: UserCreateIn):
    _require_operator(request)
    email = body.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="email is required")
    if users_repo.get_user(email):
        raise HTTPException(status_code=409, detail=f"user {email} already exists")
    try:
        users_repo.save_user(
            users_repo.UserRow(
                email=email,
                password_hash=hash_password(body.password),
                display_name=body.display_name.strip(),
                tenant=body.tenant.strip(),
                tenant_id=body.tenant_id.strip(),
                role=(body.role or "user").strip() or "user",
            )
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e
    row = users_repo.get_user(email)
    if not row:
        raise HTTPException(status_code=500, detail="user created but not found")
    return {"user": _out(row)}


@router.put("/users/{email}")
def update_user(request: Request, email: str, body: UserUpdateIn):
    _require_operator(request)
    em = email.strip().lower()
    existing = users_repo.get_user(em)
    if not existing:
        raise HTTPException(status_code=404, detail=f"user {em} not found")
    password_hash = existing.password_hash
    if body.password:
        password_hash = hash_password(body.password)
    try:
        users_repo.save_user(
            users_repo.UserRow(
                email=em,
                password_hash=password_hash,
                display_name=(body.display_name or existing.display_name).strip(),
                tenant=(body.tenant or existing.tenant).strip(),
                tenant_id=(body.tenant_id or existing.tenant_id).strip(),
                role=(body.role or existing.role).strip() or existing.role,
            )
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e
    row = users_repo.get_user(em)
    if not row:
        raise HTTPException(status_code=500, detail="user updated but not found")
    return {"user": _out(row)}


@router.delete("/users/{email}")
def remove_user(request: Request, email: str):
    ident = _require_operator(request)
    em = email.strip().lower()
    if em == (ident.get("email") or "").strip().lower():
        raise HTTPException(status_code=400, detail="cannot delete your own account")
    if not users_repo.get_user(em):
        raise HTTPException(status_code=404, detail=f"user {em} not found")
    try:
        users_repo.delete_user(em)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {"ok": True, "email": em}
