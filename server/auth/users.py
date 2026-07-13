"""User directory for the white-label login layer.

This is the app's *own* user directory — the customer-facing login store,
deliberately separate from Databricks workspace identity. Each user maps to a
display ``tenant`` name and a ``tenant_id`` join key that selects the per-tenant
Service Principal in ``apex_client_registry``.

Two backends:
  * **Lakebase** (Databricks managed Postgres) when ``LAKEBASE_ENABLED`` is true.
    Lakebase auth is OAuth — the Postgres "password" is a short-lived database
    credential minted from a Databricks identity. We mint it through the same
    Service-Principal-first client used by the rest of the app
    (``server.config.get_workspace_client()``), so it works host-agnostically via
    SP M2M with no Databricks login.
  * **JSON fallback** when Lakebase is off — users are loaded from a JSON file
    (``AUTH_USERS_FILE``, default ``server/auth/users.seed.json``). This lets the
    app run with zero Lakebase setup for quick demos.

Ported from ``edge/db.py`` + ``edge/users.py``.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .sessions import verify_password
from ..lakebase import (
    LAKEBASE_ENABLED,
    LAKEBASE_INSTANCE_NAME,
    PGHOST,
    PGUSER,
    connection as _connection,
)

logger = logging.getLogger("server.auth.users")


# --- env contract -----------------------------------------------------------
USERS_TABLE = os.environ.get("AUTH_USERS_TABLE", "apex_app_users").strip() or "apex_app_users"
_DEFAULT_USERS_FILE = str(Path(__file__).resolve().parent / "users.seed.json")
USERS_FILE = os.environ.get("AUTH_USERS_FILE", _DEFAULT_USERS_FILE).strip() or _DEFAULT_USERS_FILE


@dataclass(frozen=True)
class UserRow:
    email: str
    password_hash: str
    display_name: str
    tenant: str
    tenant_id: str
    role: str = "user"


# ============================================================ Lakebase backend
# Connection + credential minting live in ``server.lakebase`` (shared with the
# conversation-history / filter-preference persistence layer).

SCHEMA_SQL = f"""
CREATE TABLE IF NOT EXISTS {USERS_TABLE} (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    -- pbkdf2_sha256$<iterations>$<salt_b64>$<hash_b64>
    password_hash   TEXT NOT NULL,
    display_name    VARCHAR(255) NOT NULL,
    tenant          VARCHAR(255) NOT NULL,
    tenant_id       VARCHAR(255) NOT NULL DEFAULT '*',
    role            VARCHAR(50)  NOT NULL DEFAULT 'user',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_{USERS_TABLE}_email ON {USERS_TABLE}(email);
"""

_COLS = "email, password_hash, display_name, tenant, tenant_id, role"


def _row(r) -> UserRow:
    return UserRow(
        email=r[0], password_hash=r[1], display_name=r[2],
        tenant=r[3], tenant_id=r[4], role=r[5],
    )


_MIGRATE_EXTERNAL_VALUE_SQL = f"""
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = '{USERS_TABLE}'
      AND column_name = 'external_value'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = '{USERS_TABLE}'
      AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE {USERS_TABLE} RENAME COLUMN external_value TO tenant_id;
  END IF;
END $$;
"""


def ensure_schema() -> None:
    with _connection() as conn:
        conn.execute(SCHEMA_SQL)
        conn.execute(_MIGRATE_EXTERNAL_VALUE_SQL)
        conn.commit()


def _lakebase_get(email: str) -> Optional[UserRow]:
    with _connection() as conn:
        cur = conn.execute(
            f"SELECT {_COLS} FROM {USERS_TABLE} WHERE LOWER(email) = LOWER(%s)",
            (email,),
        )
        row = cur.fetchone()
        return _row(row) if row else None


def _lakebase_list() -> list[UserRow]:
    with _connection() as conn:
        cur = conn.execute(f"SELECT {_COLS} FROM {USERS_TABLE} ORDER BY email")
        return [_row(r) for r in cur.fetchall()]


def _lakebase_upsert(u: UserRow) -> None:
    with _connection() as conn:
        conn.execute(
            f"INSERT INTO {USERS_TABLE} "
            "(email, password_hash, display_name, tenant, tenant_id, role) "
            "VALUES (%s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (email) DO UPDATE SET "
            "  password_hash = EXCLUDED.password_hash, "
            "  display_name  = EXCLUDED.display_name, "
            "  tenant        = EXCLUDED.tenant, "
            "  tenant_id     = EXCLUDED.tenant_id, "
            "  role          = EXCLUDED.role",
            (u.email.lower(), u.password_hash, u.display_name, u.tenant,
             u.tenant_id, u.role),
        )
        conn.commit()


def _lakebase_touch(email: str) -> None:
    with _connection() as conn:
        conn.execute(
            f"UPDATE {USERS_TABLE} SET last_login_at = NOW() "
            "WHERE LOWER(email) = LOWER(%s)",
            (email,),
        )
        conn.commit()


# ============================================================ JSON fallback
_json_cache: list[UserRow] | None = None


def _load_json_users() -> list[UserRow]:
    global _json_cache
    if _json_cache is not None:
        return _json_cache
    rows: list[UserRow] = []
    try:
        raw = json.loads(Path(USERS_FILE).read_text())
        for u in raw.get("users", raw if isinstance(raw, list) else []):
            rows.append(UserRow(
                email=str(u["email"]).strip().lower(),
                password_hash=u["password_hash"],
                display_name=u.get("display_name", u["email"]),
                tenant=u.get("tenant", ""),
                tenant_id=u.get("tenant_id") or u.get("external_value", "*"),
                role=u.get("role", "user"),
            ))
    except FileNotFoundError:
        logger.warning("AUTH_USERS_FILE not found at %s — no fallback users.", USERS_FILE)
    except Exception as e:  # noqa: BLE001
        logger.warning("Failed to load AUTH_USERS_FILE %s: %s", USERS_FILE, e)
    _json_cache = rows
    return rows


# ============================================================ public directory
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


def list_logins() -> list[dict]:
    """Sample logins for the login page chips: ``{name, tenant, email}``.

    The per-user password is intentionally NOT included (it lives only as a
    hash). For demo convenience the shared demo password (if any) is exposed
    separately via :func:`demo_password_hint`.
    """
    rows: list[UserRow] = []
    if LAKEBASE_ENABLED:
        try:
            rows = _lakebase_list()
        except Exception as e:  # noqa: BLE001
            logger.warning("Lakebase list failed, using JSON fallback: %s", e)
    if not rows:
        rows = _load_json_users()
    return [
        {"name": r.display_name, "tenant": r.tenant, "email": r.email}
        for r in rows
    ]


def demo_password_hint() -> str | None:
    """The shared demo password documented in the JSON seed (``demo_password``),
    used to pre-fill the login chips. Returns None when not in JSON-demo mode."""
    if LAKEBASE_ENABLED:
        return None
    try:
        raw = json.loads(Path(USERS_FILE).read_text())
        if isinstance(raw, dict):
            hint = raw.get("demo_password")
            return str(hint) if hint else None
    except Exception:  # noqa: BLE001
        return None
    return None


# ============================================================ operator CRUD
def list_users() -> list[UserRow]:
    """Return every login user (Lakebase when enabled, else JSON fallback)."""
    if LAKEBASE_ENABLED:
        try:
            ensure_schema()
            return _lakebase_list()
        except Exception as e:  # noqa: BLE001
            logger.warning("Lakebase user list failed, using JSON fallback: %s", e)
    return _load_json_users()


def save_user(user: UserRow) -> None:
    """Create or update a login user. Requires Lakebase."""
    if not LAKEBASE_ENABLED:
        raise RuntimeError("User management requires LAKEBASE_ENABLED=true")
    ensure_schema()
    _lakebase_upsert(user)


def delete_user(email: str) -> None:
    """Remove a login user. Requires Lakebase."""
    if not LAKEBASE_ENABLED:
        raise RuntimeError("User management requires LAKEBASE_ENABLED=true")
    em = (email or "").strip().lower()
    if not em:
        raise ValueError("email is required")
    ensure_schema()
    with _connection() as conn:
        conn.execute(
            f"DELETE FROM {USERS_TABLE} WHERE LOWER(email) = LOWER(%s)",
            (em,),
        )
        conn.commit()


def lakebase_writable() -> bool:
    from ..lakebase import enabled

    return enabled()
