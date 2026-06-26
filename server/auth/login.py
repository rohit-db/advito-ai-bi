"""Login / logout / identity routes for the white-label auth layer.

A self-contained FastAPI ``APIRouter`` that makes this app its own OEM Identity
Provider: users sign in against the app's own directory and receive an
HMAC-signed session cookie. No Databricks login is ever shown.

Routes:
  * ``GET  /login``        — branded login HTML with clickable sample-login chips.
  * ``POST /login``        — validate credentials, set the session cookie, redirect.
  * ``GET  /logout``       — clear the cookie, redirect to /login.
  * ``POST /logout``       — same as GET (convenience).
  * ``GET  /api/auth/me``  — current session identity JSON (or 401).

The login HTML is ported/adapted from ``edge/login_page.py``.
"""
from __future__ import annotations

import html
import logging
import os

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response

from . import users as users_repo
from .sessions import SESSION_COOKIE, SESSION_TTL_SECONDS, create_session, verify_session

logger = logging.getLogger("server.auth.login")

router = APIRouter()


def _cookie_secure(request: Request) -> bool:
    """Set Secure when the request arrived over TLS (or AUTH_COOKIE_SECURE forces it)."""
    forced = os.environ.get("AUTH_COOKIE_SECURE")
    if forced is not None:
        return forced.strip().lower() in ("1", "true", "yes", "on")
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    return proto == "https"


def _render_login_page(error: str | None = None, next_url: str = "/") -> str:
    demo_pw = users_repo.demo_password_hint() or ""
    chips = "\n".join(
        f"""<button type="button" class="chip" data-u="{html.escape(u['email'])}" data-p="{html.escape(demo_pw)}">
              <span class="chip-name">{html.escape(u['name'])}</span>
              <span class="chip-tenant">{html.escape(u['tenant'])}</span>
              <span class="chip-cred">{html.escape(u['email'])}{(' &middot; ' + html.escape(demo_pw)) if demo_pw else ''}</span>
            </button>"""
        for u in users_repo.list_logins()
    )
    error_html = f'<div class="error">{html.escape(error)}</div>' if error else ""
    return f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in &middot; APEX Travel Intelligence</title>
<style>
  :root {{ --indigo:#4f46e5; --purple:#7c3aed; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
         min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:linear-gradient(135deg,#1e1b4b 0%,#3730a3 50%,#6d28d9 100%); color:#0f172a; }}
  .card {{ width:380px; background:#fff; border-radius:18px; box-shadow:0 24px 60px rgba(0,0,0,.35);
          padding:30px 28px 26px; }}
  .brand {{ display:flex; align-items:center; gap:9px; margin-bottom:4px; }}
  .brand .logo {{ width:30px;height:30px;border-radius:8px;
                 background:linear-gradient(135deg,var(--indigo),var(--purple));
                 display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800; }}
  .brand h1 {{ font-size:17px; margin:0; letter-spacing:.2px; }}
  .sub {{ color:#64748b; font-size:12.5px; margin:2px 0 18px 1px; }}
  label {{ font-size:12px; font-weight:600; color:#334155; display:block; margin:12px 0 6px; }}
  input {{ width:100%; padding:11px 12px; border:1px solid #e2e8f0; border-radius:10px; font-size:14px; }}
  input:focus {{ outline:none; border-color:var(--indigo); box-shadow:0 0 0 3px rgba(79,70,229,.15); }}
  button.submit {{ width:100%; margin-top:18px; padding:11px; border:0; border-radius:10px; color:#fff;
                  font-size:14px; font-weight:600; cursor:pointer;
                  background:linear-gradient(135deg,var(--indigo),var(--purple)); }}
  button.submit:hover {{ filter:brightness(1.06); }}
  .divider {{ display:flex; align-items:center; gap:10px; color:#94a3b8; font-size:11px;
             text-transform:uppercase; letter-spacing:.08em; margin:20px 0 12px; }}
  .divider::before, .divider::after {{ content:""; flex:1; height:1px; background:#e2e8f0; }}
  .chips {{ display:flex; flex-direction:column; gap:8px; }}
  .chip {{ text-align:left; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;
          padding:9px 11px; cursor:pointer; display:grid; grid-template-columns:1fr auto; row-gap:2px; }}
  .chip:hover {{ border-color:var(--indigo); background:#eef2ff; }}
  .chip-name {{ font-size:13px; font-weight:600; }}
  .chip-tenant {{ font-size:11px; color:#fff; background:var(--indigo); border-radius:999px;
                 padding:1px 8px; justify-self:end; }}
  .chip-cred {{ grid-column:1 / -1; font-size:11px; color:#64748b; font-family:ui-monospace,monospace; }}
  .error {{ background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; border-radius:8px;
           padding:8px 10px; font-size:12.5px; margin-bottom:12px; }}
  .foot {{ text-align:center; color:#94a3b8; font-size:10.5px; margin-top:16px; }}
</style></head>
<body>
  <form class="card" method="post" action="/login">
    <div class="brand"><div class="logo">A</div><h1>APEX Travel Intelligence</h1></div>
    <div class="sub">Sign in to your analytics workspace</div>
    {error_html}
    <input type="hidden" name="next" value="{html.escape(next_url)}">
    <label for="u">Email</label>
    <input id="u" name="username" type="email" autocomplete="username" placeholder="you@company.com" required>
    <label for="p">Password</label>
    <input id="p" name="password" type="password" autocomplete="current-password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;" required>
    <button class="submit" type="submit">Sign in</button>

    <div class="divider">Sample logins</div>
    <div class="chips">{chips}</div>
    <div class="foot">Custom authentication &middot; powered by Databricks behind the scenes</div>
  </form>
  <script>
    document.querySelectorAll(".chip").forEach(function(c) {{
      c.addEventListener("click", function() {{
        document.getElementById("u").value = c.dataset.u;
        if (c.dataset.p) document.getElementById("p").value = c.dataset.p;
      }});
    }});
  </script>
</body></html>"""


def _safe_next(next_url: str) -> str:
    """Only allow same-site relative redirects."""
    return next_url if next_url.startswith("/") and not next_url.startswith("//") else "/"


@router.get("/login")
async def login_get(request: Request) -> Response:
    if verify_session(request.cookies.get(SESSION_COOKIE)):
        return RedirectResponse("/", status_code=303)
    next_url = _safe_next(request.query_params.get("next", "/"))
    return HTMLResponse(_render_login_page(next_url=next_url))


@router.post("/login")
async def login_post(request: Request) -> Response:
    form = await request.form()
    username = str(form.get("username", ""))
    password = str(form.get("password", ""))
    next_url = _safe_next(str(form.get("next", "/")) or "/")
    user = users_repo.verify_login(username, password)
    if not user:
        return HTMLResponse(
            _render_login_page(error="Invalid email or password.", next_url=next_url),
            status_code=401,
        )
    identity = {
        "email": user.email,
        "display_name": user.display_name,
        "tenant": user.tenant,
        "external_value": user.external_value,
        "role": user.role,
    }
    resp = RedirectResponse(next_url, status_code=303)
    resp.set_cookie(
        SESSION_COOKIE,
        create_session(identity),
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=_cookie_secure(request),
        path="/",
    )
    logger.info("Login: %s (tenant=%s)", user.email, user.tenant)
    return resp


@router.get("/logout")
@router.post("/logout")
async def logout() -> Response:
    resp = RedirectResponse("/login", status_code=303)
    resp.delete_cookie(SESSION_COOKIE, path="/")
    return resp


@router.get("/api/auth/me")
async def auth_me(request: Request) -> Response:
    identity = getattr(request.state, "identity", None) or verify_session(
        request.cookies.get(SESSION_COOKIE)
    )
    if not identity:
        return JSONResponse({"authenticated": False}, status_code=401)
    return JSONResponse({
        "authenticated": True,
        "email": identity.get("email"),
        "display_name": identity.get("display_name"),
        "tenant": identity.get("tenant"),
        "external_value": identity.get("external_value"),
        "role": identity.get("role", "user"),
    })
