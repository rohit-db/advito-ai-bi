# White-Label Auth, the Edge-Gateway Pattern & External Hosting (Docker)

> **Audience:** partner/solutions team standing up **APEX** — a self-contained
> FastAPI + React app that puts a **branded, no-Databricks-login sign-on** in
> front of Databricks-hosted AI/BI content.
>
> **Scope of this doc:** the built-in white-label authentication layer
> (`server/auth/`), the two deployment models (**edge-gateway** vs
> **external-host**), and how to run the app in a container.
>
> **Companion docs (do not duplicate — read them for their topics):**
> - [`../architecture/external-hosting.md`](../architecture/external-hosting.md)
>   — the authoritative deep-dive on self-hosting off Databricks, SP setup, and
>   the full env contract. This doc summarizes and links to it.
> - [`../architecture/aibi-embedding-filter-passing-workaround.md`](../architecture/aibi-embedding-filter-passing-workaround.md)
>   — owns the embed-token exchange + `f_` filter-passing details.

---

## TL;DR

- **Built-in white-label login.** The app is its own OEM Identity Provider.
  Users sign in against **APEX's own user directory** (Lakebase Postgres, or a
  JSON file for demos), get an **HMAC-signed session cookie**, and **never see a
  Databricks login screen**. Passwords are **PBKDF2-HMAC-SHA256** hashed.
- **Two deployment models** for putting that branded login in front of
  Databricks content:
  1. **Edge-gateway** — the analytics app stays **hosted on Databricks Apps** and
     a small **external "edge" front-door** (reverse proxy) authenticates the
     user and proxies through to the Databricks-hosted app.
  2. **External-host** (this branch's shipped variant) — the **whole app runs
     off Databricks** in a container and reaches Databricks purely via a
     **Service Principal (M2M)**. There is no separate proxy: the app *is* the
     front door.
- **Same login code, either way.** The `server/auth/` layer is portable; only
  *where* it runs (in-process vs a separate proxy) differs.
- **This branch (`feature/sustainability-dashboards`) ships the external-host
  variant.** There is **no `edge/` gateway code committed here** — see
  [The two hosting models](#the-two-hosting-models) for why, and where the edge
  pattern lives conceptually.

---

## The two hosting models

Both models exist to solve the same problem: **let viewers reach
Databricks-hosted analytics through a branded login, without ever seeing a
Databricks SSO screen.** They differ in *where the app runs* and *where the
custom login lives*.

### Model A — Edge-gateway (app on Databricks + external auth proxy)

- The analytics app stays deployed on the **Databricks Apps** platform and uses
  **basic embedding**.
- A small, separate **"edge" service** sits in front of it as a **reverse-proxy
  front-door gateway**: it renders the branded custom login, establishes its own
  signed session, and then **proxies authenticated traffic through to the
  Databricks-hosted app** (injecting an SP bearer to clear the Apps OAuth proxy).
- Net effect: viewers hit *your* domain and *your* login; Databricks Apps is
  never exposed directly, so no Databricks SSO screen appears.

### Model B — External-host (whole app off Databricks, SP auth) — **this branch**

- The entire app — custom login, React SPA, and FastAPI backend — runs in **one
  container on your infrastructure** (EC2 / ECS/Fargate / any Docker host).
- It reaches Databricks **purely via a Service Principal (M2M)** using the
  standard SDK env vars (`DATABRICKS_HOST` + `DATABRICKS_CLIENT_ID` +
  `DATABRICKS_CLIENT_SECRET`).
- There is **no Apps OAuth proxy to clear**, so the reverse-proxy trick is
  unnecessary — **the app itself is the front door**. The edge gateway's
  custom-login + Lakebase user-directory pattern is **ported in-process** into
  `server/auth/`.

The shipped auth modules are explicit about this lineage — they were adapted
from the earlier edge gateway:

```1:19:server/auth/sessions.py
"""Self-contained session crypto for the white-label login layer.

This is the "your own IdP" layer of the OEM pattern: end users sign in against
*this app*, not Databricks. The app issues its own HMAC-signed session cookie so
users never see a Databricks login screen.

Stdlib-only crypto (no extra deps):
  * PBKDF2-HMAC-SHA256 for password hashing/verification.
  * HMAC-SHA256 over a base64url payload for the signed session cookie.

The cookie payload carries the authenticated identity ({email, tenant,
external_value, display_name, role, exp}) so the embed-token route can scope
dashboard rows per tenant.

Ported from ``edge/auth.py`` — same proven scheme, adapted to the env contract
of the external-host app (AUTH_SESSION_* variables).
"""
```

> **Verification note.** `git ls-files` shows **no `edge/` and no `app-appkit`
> paths tracked in this branch.** The docstrings above reference `edge/auth.py`,
> `edge/db.py`, `edge/users.py`, `edge/seed_users.py`, and `edge/login_page.py`
> only as the *historical source* the in-process modules were ported from — they
> are **not present here**. Treat the edge-gateway as a conceptual sibling
> deployment model, not committed code in this repo. (The root `.dockerignore`
> lists `edge/.env` and `app-appkit` as ignore patterns; those are defensive
> excludes, not evidence the paths exist.)

### When to use which

| | **Edge-gateway (Model A)** | **External-host (Model B)** |
| --- | --- | --- |
| **App runtime** | Databricks Apps platform | Your container (EC2 / ECS / any Docker) |
| **Custom login lives in** | Separate `edge/` reverse-proxy service | In-process `server/auth/` |
| **Embedding** | Basic embedding behind the proxy | SP-minted scoped embed tokens |
| **Front door** | The edge proxy (injects SP bearer to clear Apps OAuth proxy) | The app itself |
| **Use when** | You want to keep hosting on Databricks Apps but need branded, no-SSO sign-on | You need to host fully off-platform / on your own infra |
| **Shipped in this branch?** | No (conceptual / prior demo) | **Yes** |

---

## Custom auth internals

All four pieces live in `server/auth/` and are stdlib-only (no extra crypto
deps). The package exports the router, the middleware, and an identity helper:

```1:22:server/auth/__init__.py
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
```

### Passwords — PBKDF2-HMAC-SHA256

Password hashing and verification use `hashlib.pbkdf2_hmac` with **SHA-256** and
**200,000 iterations**, a random 16-byte salt, and a self-describing encoded
string (`pbkdf2_sha256$<iters>$<salt_b64>$<hash_b64>`). Verification is
constant-time via `hmac.compare_digest`:

```35:64:server/auth/sessions.py
_PBKDF2_ITERATIONS = 200_000


def _session_secret() -> str:
    """The HMAC signing secret. Read at call time so tests/processes can set it
    after import. Falls back to a clearly-marked dev default."""
    return os.environ.get("AUTH_SESSION_SECRET", "").strip() or "apex-dev-session-secret-change-me"


# ------------------------------------------------------------------ passwords
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return (
        f"pbkdf2_sha256${_PBKDF2_ITERATIONS}$"
        f"{base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt_b64, hash_b64 = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iters))
        return hmac.compare_digest(dk, expected)
    except Exception:  # noqa: BLE001
        return False
```

### The signed session cookie — how it's signed, what's inside, expiry

The cookie value is `"<payload_b64>.<hmac_sig>"`. The payload is a compact JSON
identity dict, base64url-encoded; the signature is **HMAC-SHA256 over that
payload** keyed by `AUTH_SESSION_SECRET`. On read, the signature is re-computed
and compared constant-time, then the `exp` timestamp is checked.

- **Signing key:** `AUTH_SESSION_SECRET` (falls back to a clearly-marked dev
  default — set a real one in production).
- **Inside the payload:** `email`, `name` (display name), `tenant`, `ext`
  (= `external_value`), `role`, and `exp` (absolute unix expiry).
- **Expiry / TTL:** `AUTH_SESSION_TTL_SECONDS` (default **28800s = 8h**).
- **Cookie name:** `AUTH_SESSION_COOKIE` (default `apex_session`).

```29:33:server/auth/sessions.py
SESSION_COOKIE = os.environ.get("AUTH_SESSION_COOKIE", "apex_session").strip() or "apex_session"
try:
    SESSION_TTL_SECONDS = int(os.environ.get("AUTH_SESSION_TTL_SECONDS", "28800"))
except ValueError:
    SESSION_TTL_SECONDS = 28800
```

```76:120:server/auth/sessions.py
def _sign(payload_b64: str) -> str:
    mac = hmac.new(_session_secret().encode(), payload_b64.encode(), hashlib.sha256)
    return _b64e(mac.digest())


def create_session(identity: dict, ttl_seconds: int | None = None) -> str:
    """Build a signed cookie value from an identity dict.

    ``identity`` should contain at least ``email``; ``tenant``, ``external_value``,
    ``display_name`` and ``role`` are carried through when present.
    """
    ttl = SESSION_TTL_SECONDS if ttl_seconds is None else ttl_seconds
    payload = {
        "email": identity.get("email"),
        "name": identity.get("display_name") or identity.get("name"),
        "tenant": identity.get("tenant"),
        "ext": identity.get("external_value"),
        "role": identity.get("role", "user"),
        "exp": int(time.time()) + int(ttl),
    }
    payload_b64 = _b64e(json.dumps(payload, separators=(",", ":")).encode())
    return f"{payload_b64}.{_sign(payload_b64)}"


def verify_session(cookie: str | None) -> dict | None:
    """Validate a cookie value and return a normalized identity dict, or None."""
    if not cookie or "." not in cookie:
        return None
    payload_b64, sig = cookie.rsplit(".", 1)
    if not hmac.compare_digest(sig, _sign(payload_b64)):
        return None
    try:
        data = json.loads(_b64d(payload_b64))
    except Exception:  # noqa: BLE001
        return None
    if int(data.get("exp", 0)) < int(time.time()):
        return None
    return {
        "email": data.get("email"),
        "display_name": data.get("name"),
        "tenant": data.get("tenant"),
        "external_value": data.get("ext"),
        "role": data.get("role", "user"),
        "exp": data.get("exp"),
    }
```

> The cookie is **signed, not encrypted** — the payload is readable (base64), but
> it **cannot be tampered with** without the secret. Never put anything secret in
> the identity payload; it only carries non-sensitive routing/scoping fields.

When the cookie is set at login, it's `HttpOnly`, `SameSite=Lax`, and `Secure`
when the request arrived over TLS (or when `AUTH_COOKIE_SECURE` forces it):

```133:163:server/auth/login.py
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
```

### The session-gate middleware — how routes are gated + `request.state.identity`

`SessionGateMiddleware` enforces the cookie on every non-public request. Key
behaviors:

- **No-op when `AUTH_ENABLED` is off.** If `AUTH_ENABLED` is unset it returns
  `False`, so the gate does nothing (identical to the Databricks-Apps behavior).
  **The code default is OFF**; `.env.example` ships `AUTH_ENABLED=true`.
- **Valid session →** decode identity, attach to `request.state.identity`, pass
  through.
- **No session + public path** (`/login`, `/logout`, `/favicon.ico`,
  `/api/health`, `/api/auth/*`, `/assets/*`, `/static/*`, static file
  extensions) → pass through.
- **No session + `/api/*` →** `401` JSON.
- **No session + HTML navigation →** `302` redirect to `/login?next=…`.

```47:94:server/auth/middleware.py
def _auth_enabled() -> bool:
    raw = os.environ.get("AUTH_ENABLED")
    if raw is None:
        return False
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _is_public(path: str) -> bool:
    if path in _ALLOW_EXACT:
        return True
    if any(path.startswith(p) for p in _ALLOW_PREFIX):
        return True
    if path.rsplit(".", 1)[-1:] and path.lower().endswith(_ALLOW_EXTENSIONS):
        return True
    return False


def _wants_html(request: Request) -> bool:
    if request.url.path.startswith("/api/"):
        return False
    accept = request.headers.get("accept", "")
    return "text/html" in accept or accept == "" or "*/*" in accept


class SessionGateMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # No-op when disabled — identical behavior to today's Databricks-Apps app.
        if not _auth_enabled():
            return await call_next(request)

        path = request.url.path
        identity = verify_session(request.cookies.get(SESSION_COOKIE))
        if identity:
            request.state.identity = identity
            return await call_next(request)

        # No valid session.
        if _is_public(path):
            return await call_next(request)

        if request.url.path.startswith("/api/"):
            return JSONResponse({"error": "not authenticated"}, status_code=401)

        if _wants_html(request):
            nxt = path + (f"?{request.url.query}" if request.url.query else "")
            return RedirectResponse(f"/login?next={nxt}", status_code=302)

        return JSONResponse({"error": "not authenticated"}, status_code=401)
```

The middleware and routers are wired in `app.py` — the gate is added as
middleware, and the auth router is mounted **without** the `/api` prefix so
`/login` and `/logout` are top-level, before the SPA catch-all:

```8:11:app.py
# White-label session gate. No-op when AUTH_ENABLED is unset/false, so the
# default Databricks-Apps behavior is unchanged.
from server.auth import SessionGateMiddleware, router as auth_router
app.add_middleware(SessionGateMiddleware)
```

```40:56:app.py
# Login/logout/identity routes. Mounted WITHOUT an /api prefix (so /login and
# /logout are top-level), and BEFORE the SPA catch-all so they aren't swallowed
# by the index.html fallback. The /api/auth/* routes are declared inside it too.
app.include_router(auth_router)

frontend_dir = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dir):
    assets_dir = os.path.join(frontend_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(frontend_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dir, "index.html"))
```

> **Serving the built frontend.** The Vite build output is expected at
> `frontend/dist`. `app.py` mounts `/assets` as static files and adds a catch-all
> that returns the requested file if it exists, else falls back to
> `index.html` (SPA routing). The Docker build produces `frontend/dist` in a
> separate stage and copies it into the runtime image (see
> [Running it with Docker](#running-it-with-docker)).

### The user directory — Lakebase, with JSON fallback

The user directory is the app's **own** login store, deliberately separate from
Databricks workspace identity. Each user maps to a `tenant` and an
`external_value` (the handle passed to the embed token for row scoping).

- **Lakebase backend** (Databricks managed Postgres) when `LAKEBASE_ENABLED` is
  true. The Postgres credential is a **short-lived OAuth credential minted via
  the app's Service-Principal-first workspace client** — no static DB password
  (see `server/lakebase.py`).
- **JSON fallback** when Lakebase is off — users load from `AUTH_USERS_FILE`
  (default `server/auth/users.seed.json`). Zero setup for demos.

```167:194:server/auth/users.py
def get_user(email: str) -> Optional[UserRow]:
    """Look up a user by email from Lakebase (if enabled) or the JSON fallback."""
    em = (email or "").strip().lower()
    if not em:
        return None
    if LAKEBASE_ENABLED:
        try:
            return _lakebase_get(em)
        except Exception as e:  # noqa: BLE001
            logger.warning("Lakebase lookup failed, using JSON fallback: %s", e)
    for u in _load_json_users():
        if u.email == em:
            return u
    return None


def verify_login(email: str, password: str) -> Optional[UserRow]:
    """Validate credentials; return the UserRow on success, else None."""
    user = get_user(email)
    if user and verify_password(password or "", user.password_hash):
        if LAKEBASE_ENABLED:
            try:
                _lakebase_touch(user.email)
            except Exception:  # noqa: BLE001
                pass
        return user
    return None
```

The Lakebase Postgres credential is minted through the shared connection layer,
which uses the same SP-first workspace client as the rest of the app — so it
works host-agnostically with no Databricks login:

```88:115:server/lakebase.py
def _mint_token() -> str:
    global _token, _token_exp
    with _lock:
        if _token and time.time() < _token_exp - 120:
            return _token
        w = _workspace_client()
        cred = None
        # Lakebase Autoscaling projects mint via the postgres service using the
        # endpoint resource path. This is the path proven against apex-edge.
        if LAKEBASE_ENDPOINT_PATH:
            try:
                cred = w.postgres.generate_database_credential(  # type: ignore[attr-defined]
                    endpoint=LAKEBASE_ENDPOINT_PATH
                )
            except Exception as e:  # noqa: BLE001
                logger.debug("postgres.generate_database_credential failed: %s", e)
        # Newer "Database Instances" API mints via instance_names.
        if cred is None:
            import uuid

            cred = w.database.generate_database_credential(  # type: ignore[attr-defined]
                request_id=str(uuid.uuid4()),
                instance_names=[LAKEBASE_INSTANCE_NAME],
            )
        _token = cred.token
        _token_exp = time.time() + 3000  # credentials last ~1h; refresh early
        logger.info("Minted Lakebase credential for %s", LAKEBASE_INSTANCE_NAME or PGHOST)
        return _token  # type: ignore[return-value]
```

To seed the Lakebase users table from the JSON seed file, run once after
provisioning Lakebase:

```bash
python -m server.auth.seed_users
```

It creates the table (`AUTH_USERS_TABLE`, default `apex_app_users`) and upserts
the sample users; it is a **no-op when `LAKEBASE_ENABLED` is false** (the JSON
fallback needs no seeding).

---

## Demo logins

When `LAKEBASE_ENABLED=false` (the default), the login store is
`server/auth/users.seed.json`. **All three sample users share the demo password
`apex`** (defined by the `demo_password` field in that file). The login page
renders clickable "chips" pre-filled with each email and the shared demo
password, so the team can sign in with one click.

| Display name | Email (username) | Password | Tenant | `external_value` | Role |
| --- | --- | --- | --- | --- | --- |
| Alice Chen | `alice@acmetravel.com` | `apex` | Acme Travel | `acme-travel` | user |
| Ben Ortiz | `ben@globex.com` | `apex` | Globex | `globex` | user |
| Dana Lee | `dana@advito.com` | `apex` | Advito (All) | `*` (all rows) | operator |

```1:29:server/auth/users.seed.json
{
  "_note": "Demo user directory for the white-label login layer (JSON fallback, used when LAKEBASE_ENABLED is false). All sample users share the demo password 'apex'. Password hashes are PBKDF2-HMAC-SHA256 (pbkdf2_sha256$iterations$salt_b64$hash_b64) generated via server.auth.sessions.hash_password.",
  "demo_password": "apex",
  "users": [
    {
      "email": "alice@acmetravel.com",
      "password_hash": "pbkdf2_sha256$200000$f6z8grNh51tm1ZRwb27oiA==$M1W5FVeDDIeie4/UZYb0lXZhRv13KYsqR4jfxSZicws=",
      "display_name": "Alice Chen",
      "tenant": "Acme Travel",
      "external_value": "acme-travel",
      "role": "user"
    },
    {
      "email": "ben@globex.com",
      "password_hash": "pbkdf2_sha256$200000$VlVEnp2/DLSzniRgPNRjmg==$pBPxITdNR5LuGDQaFcAgtO3lkFjK4tASkAReQ0nGstQ=",
      "display_name": "Ben Ortiz",
      "tenant": "Globex",
      "external_value": "globex",
      "role": "user"
    },
    {
      "email": "dana@advito.com",
      "password_hash": "pbkdf2_sha256$200000$fAc5OBfaZAOcBXvWy/FfHw==$DICXaHvpkXX3g9CRJ6as6phddg5cX0FpJt6ntNSfLxo=",
      "display_name": "Dana Lee",
      "tenant": "Advito (All)",
      "external_value": "*",
      "role": "operator"
    }
  ]
}
```

### Literal "log in with X" steps

1. Make sure `AUTH_ENABLED=true` in your `.env` (it is in `.env.example`).
2. Start the app and open `http://localhost:8000/` (or your `APP_PORT`). You'll
   be redirected to `/login`.
3. Either **click a sample-login chip** (auto-fills email + password), or type
   credentials manually:
   - **Acme Travel tenant** → email `alice@acmetravel.com`, password `apex`
   - **Globex tenant** → email `ben@globex.com`, password `apex`
   - **Advito operator (sees all rows,** `external_value=*`**)** → email
     `dana@advito.com`, password `apex`
4. Click **Sign in**. You land in the app with a signed `apex_session` cookie;
   the embedded dashboard is automatically row-scoped to that user's tenant.

> In Lakebase mode, the password is whatever was seeded — the seed script hashes
> the shared `demo_password` from the JSON unless a per-user `password_hash` is
> supplied. The demo-password hint chips only appear in JSON-fallback mode
> (`demo_password_hint()` returns `None` when Lakebase is enabled).

---

## Running it with Docker

Packaging lives at the repo root: `Dockerfile`, `docker-compose.yml`,
`.dockerignore`, `.env.example`. The image is a **two-stage build**: stage 1
builds the Vite/React SPA to `frontend/dist`; stage 2 runs FastAPI via uvicorn
and serves the SPA + API from **one process**.

```1:48:Dockerfile
# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────────────────────────────────
# Stage 1: build the Vite/React frontend → frontend/dist
# ──────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS frontend-build
WORKDIR /build/frontend

# Install deps first (cached layer keyed on lockfiles only)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Build the SPA
COPY frontend/ ./
RUN npm run build

# ──────────────────────────────────────────────────────────────────────────
# Stage 2: runtime — FastAPI app served by uvicorn
# ──────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_PORT=8000

WORKDIR /app

# Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY app.py ./
COPY server/ ./server/

# Built frontend from the frontend-build stage
COPY --from=frontend-build /build/frontend/dist ./frontend/dist

# Run as a non-root user
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Shell-form CMD so ${APP_PORT:-8000} is expanded at runtime.
CMD ["sh", "-c", "exec python -m uvicorn app:app --host 0.0.0.0 --port ${APP_PORT:-8000}"]
```

`docker-compose.yml` reads your `.env`, maps the host port from `APP_PORT`, and
adds a health check against `/api/health`:

```1:14:docker-compose.yml
services:
  apex:
    build: .
    env_file: .env
    # Container always listens on 8000; host port comes from APP_PORT.
    ports:
      - "${APP_PORT:-8000}:8000"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health', timeout=5).status == 200 else 1)"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
```

### Copy-paste steps

```bash
# 1) Create your env file from the template and fill it in.
cp .env.example .env
#    Set at minimum:
#      DATABRICKS_HOST, DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET  (your SP)
#      GENIE_SPACE_ID, DASHBOARD_URL                                    (data assets)
#      AUTH_SESSION_SECRET                                              (long random string)
#      AUTH_ENABLED=true                                                (branded login on)

# 2) Choose a login backend:
#      LAKEBASE_ENABLED=false  -> instant demo, uses server/auth/users.seed.json
#      LAKEBASE_ENABLED=true   -> fill PG* + LAKEBASE_*, then seed once:
#                                   python -m server.auth.seed_users

# 3) Build and run.
docker compose up --build

# 4) Open the app and sign in with a sample user (see Demo logins above).
open http://localhost:8000        # or your APP_PORT
```

### Environment variables

These are the variables required/used to run the container. Names are
authoritative against `.env.example`, `server/config.py`, `server/lakebase.py`,
and `server/auth/`.

| Variable | Required | Example (placeholder) | Purpose |
| --- | --- | --- | --- |
| `DATABRICKS_HOST` | **Yes** | `https://<your-workspace>.cloud.databricks.com` | Workspace URL for all Databricks API calls. |
| `DATABRICKS_CLIENT_ID` | **Yes** | *(SP OAuth client id)* | Service Principal (M2M) client id. Toggles `HAS_SP_CREDENTIALS`. |
| `DATABRICKS_CLIENT_SECRET` | **Yes** | *(SP OAuth secret)* | Service Principal secret. **Server-side only.** |
| `GENIE_SPACE_ID` | **Yes** | `01f127092d2219f3be10180d79b2ee5d` | Genie space backing Ask APEX / summaries. |
| `DASHBOARD_URL` | **Yes** | `https://<your-workspace>.cloud.databricks.com/embed/dashboardsv3/<dashboard-id>?o=<org-id>` | Embedded dashboard; the dashboard id + `o=` org are parsed from it. |
| `APP_PORT` | No (default `8000`) | `8000` | Host + container port. |
| `AUTH_ENABLED` | No (code default `false`; `.env.example` ships `true`) | `true` | Turns on the white-label session gate. |
| `AUTH_SESSION_SECRET` | **Yes** if auth on | `change-me-to-a-long-random-string` | HMAC key that signs session cookies. |
| `AUTH_SESSION_COOKIE` | No (default `apex_session`) | `apex_session` | Session cookie name. |
| `AUTH_SESSION_TTL_SECONDS` | No (default `28800`) | `28800` | Session lifetime (8h). |
| `AUTH_USERS_FILE` | Conditional | `server/auth/users.seed.json` | JSON user directory when Lakebase is off. |
| `AUTH_USERS_TABLE` | Conditional | `apex_app_users` | Lakebase users table name. |
| `AUTH_COOKIE_SECURE` | No | `true` | Force the `Secure` cookie flag (else inferred from TLS / `x-forwarded-proto`). |
| `LAKEBASE_ENABLED` | No (default `false`) | `false` | `true` → persist users/history/filters in Lakebase; `false` → JSON + in-memory. |
| `LAKEBASE_INSTANCE_NAME` | If Lakebase on | `apex` | Lakebase Autoscaling project / instance name. |
| `LAKEBASE_ENDPOINT_PATH` | If Lakebase on | `projects/<project-id>/branches/production/endpoints/primary` | Endpoint resource path used to mint the Postgres credential. |
| `LAKEBASE_PROFILE` | No | *(blank in prod)* | Local-dev CLI profile that mints the credential; blank → SP mints it. |
| `PGHOST` | If Lakebase on | `ep-xxxx.database.<region>.cloud.databricks.com` | Postgres endpoint host. |
| `PGPORT` | No (default `5432`) | `5432` | Postgres port. |
| `PGDATABASE` | No (default `databricks_postgres`) | `databricks_postgres` | Postgres database. |
| `PGUSER` | If Lakebase on | `<sp-client-id or user email>` | Postgres login identity. |
| `PGSSLMODE` | No (default `require`) | `require` | Postgres SSL mode. |

> For the full SP-setup checklist (UC `SELECT` grants, warehouse `CAN_USE`,
> dashboard `CAN_RUN` + `embed_credentials=false`, Genie space access, and
> granting the SP a Postgres role) see
> [`../architecture/external-hosting.md` §4](../architecture/external-hosting.md).

### How the SP identity powers all Databricks calls off-platform

When running outside Databricks, **every** Databricks API call is made **as the
Service Principal**. `get_workspace_client()` resolves SP creds first (M2M /
`client_credentials`), so the same code path works on Databricks Apps *and* any
container:

```54:75:server/config.py
def get_workspace_client() -> WorkspaceClient:
    """Workspace client that works inside Databricks Apps *and* on any external host.

    Resolution order:
      1. Service Principal (M2M / OAuth client_credentials) when client id/secret
         are set — the portable, host-agnostic path used for external hosting.
      2. Databricks Apps platform default auth (injected SP) when running in-app.
      3. Local PAT via the legacy ``token`` env var.
    """
    if HAS_SP_CREDENTIALS:
        return WorkspaceClient(
            host=WORKSPACE_URL,
            client_id=DATABRICKS_CLIENT_ID,
            client_secret=DATABRICKS_CLIENT_SECRET,
        )
    if IS_DATABRICKS_APP:
        return WorkspaceClient()
    return WorkspaceClient(
        host=WORKSPACE_URL,
        token=os.environ.get("token"),
    )
```

This SP client is what mints embed tokens, opens Genie MCP sessions, and mints
the short-lived Lakebase Postgres credential — all without any Databricks login.

---

## How identity → embed scoping

After login, the middleware sets `request.state.identity`. The embed-token route
uses it so **each tenant is automatically row-scoped** without the browser
passing anything: the session's `external_value` becomes the token's
`external_value`, and a stable `viewer_id` is derived from the session email.

```115:125:server/routes/embed.py
    did = dashboard_id or _DEFAULT_DASHBOARD_ID

    identity = getattr(request.state, "identity", None)
    if identity:
        # Session identity wins over the default viewer; a query-param override
        # (anything other than the default) is still honored.
        if viewer_id == "apex-viewer":
            viewer_id = identity.get("email") or identity.get("tenant") or viewer_id
        if external_value is None:
            external_value = identity.get("external_value")
```

`external_value` is the value a **Unity Catalog row filter** keys on — the real
security boundary — and it comes from the **server-side session**, never from
anything the browser can spoof. The full 3-step OAuth exchange, the `f_` filter
URL construction, and token refresh are owned by the embedding doc:
[`../architecture/aibi-embedding-filter-passing-workaround.md`](../architecture/aibi-embedding-filter-passing-workaround.md).
See also [`../architecture/external-hosting.md` §7](../architecture/external-hosting.md)
for the per-tenant isolation diagram.

---

## Security notes

- **SP secret stays server-side.** `DATABRICKS_CLIENT_SECRET` lives only in the
  container's env (inject from a secrets manager). The browser only ever
  receives the final **short-lived, scoped embed token** — never SP creds.
- **The browser never sees Databricks credentials.** The 3-step OAuth exchange
  runs entirely server-side; only the tightly-scoped, ~1h embed token reaches the
  iframe.
- **Session cookie is signed, `HttpOnly`, `SameSite=Lax`, `Secure` on TLS.** It's
  HMAC-SHA256-signed with `AUTH_SESSION_SECRET` (tamper-proof) but not encrypted,
  so it carries only non-sensitive scoping fields. Use a long random secret and
  rotate it. Cookie is `HttpOnly` so JS can't read it.
- **Passwords are never stored in plaintext.** PBKDF2-HMAC-SHA256, 200k
  iterations, per-user random salt, constant-time verify.
- **Terminate TLS in front of the container** (ALB / nginx / API gateway) so
  `Secure` cookies and the embed-token-in-URL are safe. Don't run plain HTTP in
  production.
- **Removing the login does not remove authorization.** Because queries run as
  the SP (`embed_credentials=false`), the SP still needs warehouse + UC `SELECT`,
  and UC row filters govern what each `external_value` can read.

---

## File map (real paths only)

| Path | Role |
| --- | --- |
| `server/auth/__init__.py` | Package exports: `router`, `SessionGateMiddleware`, `current_identity()`. |
| `server/auth/middleware.py` | Session-gate middleware; sets `request.state.identity`; no-op when `AUTH_ENABLED` off. |
| `server/auth/login.py` | `/login`, `/logout`, `/api/auth/me` routes + branded login HTML. |
| `server/auth/sessions.py` | PBKDF2 password hashing + HMAC-signed session cookie crypto. |
| `server/auth/users.py` | User directory: Lakebase backend + JSON fallback + `verify_login()`. |
| `server/auth/seed_users.py` | `python -m server.auth.seed_users` — seed Lakebase users table. |
| `server/auth/users.seed.json` | Demo user directory (JSON fallback); shared demo password `apex`. |
| `server/config.py` | `get_workspace_client()` / `get_sp_bearer()` — SP-first Databricks auth. |
| `server/lakebase.py` | Shared Lakebase connection + short-lived Postgres credential minting. |
| `server/routes/embed.py` | `/api/embed/token` — SP-minted scoped embed token; consumes session identity. |
| `app.py` | FastAPI entry: adds middleware, wires routers, serves `frontend/dist`. |
| `Dockerfile` | Two-stage build (Vite SPA → uvicorn/FastAPI runtime). |
| `docker-compose.yml` | Local/host run: env file, port mapping, `/api/health` check. |
| `.dockerignore` | Build-context excludes. |
| `.env.example` | Environment contract for external hosting. |
| `docs/architecture/external-hosting.md` | Authoritative self-hosting deep-dive (SP setup, full env, isolation). |
| `docs/architecture/aibi-embedding-filter-passing-workaround.md` | Embed-token exchange + `f_` filter passing (owns those details). |

> **Not in this branch:** there are **no `edge/` or `app-appkit` paths** tracked
> here. References to `edge/*` in module docstrings describe the historical
> source of the ported code, not files in this repo.
