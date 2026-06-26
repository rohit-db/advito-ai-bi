"""White-label, in-process login layer for the external-host app.

Makes the FastAPI app its own OEM Identity Provider: users authenticate against
a Lakebase-backed (or JSON-fallback) user directory, receive an HMAC-signed
session cookie, and never see a Databricks login. The authenticated identity
flows into ``request.state.identity`` for per-tenant row scoping in the embed
route.

Exports:
  * ``router``                 — login/logout/identity FastAPI APIRouter.
  * ``SessionGateMiddleware``  — Starlette middleware enforcing the session gate.
  * ``current_identity(request)`` — helper to read the decoded identity.
"""
from __future__ import annotations

from starlette.requests import Request

from .login import router
from .middleware import SessionGateMiddleware
from .sessions import SESSION_COOKIE, verify_session

__all__ = ["router", "SessionGateMiddleware", "current_identity"]


def current_identity(request: Request) -> dict | None:
    """Return the decoded session identity for this request, or None.

    Prefers ``request.state.identity`` (set by the middleware) and falls back to
    decoding the session cookie directly (useful when the middleware is a no-op
    but a cookie is still present)."""
    identity = getattr(request.state, "identity", None)
    if identity:
        return identity
    return verify_session(request.cookies.get(SESSION_COOKIE))
