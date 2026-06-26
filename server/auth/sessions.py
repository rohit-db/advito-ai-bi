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
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time

# --- env contract -----------------------------------------------------------
SESSION_COOKIE = os.environ.get("AUTH_SESSION_COOKIE", "apex_session").strip() or "apex_session"
try:
    SESSION_TTL_SECONDS = int(os.environ.get("AUTH_SESSION_TTL_SECONDS", "28800"))
except ValueError:
    SESSION_TTL_SECONDS = 28800

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


# ------------------------------------------------------------------ session
def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


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
