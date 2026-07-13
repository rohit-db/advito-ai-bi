"""Tenant → Service Principal registry, backed by Lakebase.

Two tables (created lazily by :func:`ensure_schema`):
  * ``apex_client_registry`` — one row per tenant, mapping ``tenant_id`` to a
    dedicated Service Principal (``sp_app_id``) + optional per-tenant Genie space.
  * ``apex_sp_credentials``  — the SP's OAuth client_secret, AES-GCM encrypted.

``tenant_id`` is the SAME value as the white-label user's ``external_value``
(e.g. "acme-travel"), so a logged-in user resolves to their SP directly.

Everything degrades gracefully when Lakebase is disabled (returns empty / None),
so the app still runs on the single-app-SP path before any tenant is onboarded.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from ..lakebase import connection, enabled
from . import crypto

logger = logging.getLogger("server.tenants.registry")

CLIENT_REGISTRY_TABLE = "apex_client_registry"
SP_CREDENTIALS_TABLE = "apex_sp_credentials"

SCHEMA_SQL = f"""
CREATE TABLE IF NOT EXISTS {CLIENT_REGISTRY_TABLE} (
    id              SERIAL PRIMARY KEY,
    tenant_id       VARCHAR(255) UNIQUE NOT NULL,
    display_name    VARCHAR(255) NOT NULL,
    sp_app_id       VARCHAR(255) UNIQUE NOT NULL,
    sp_display_name VARCHAR(255) NOT NULL,
    genie_space_id  VARCHAR(255),
    status          VARCHAR(50)  NOT NULL DEFAULT 'active',
    metadata        JSONB        NOT NULL DEFAULT '{{}}'::jsonb,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_{CLIENT_REGISTRY_TABLE}_tenant
    ON {CLIENT_REGISTRY_TABLE}(tenant_id);

CREATE TABLE IF NOT EXISTS {SP_CREDENTIALS_TABLE} (
    sp_app_id        VARCHAR(255) PRIMARY KEY,
    secret_encrypted TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at       TIMESTAMPTZ
);
"""

_COLS = (
    "tenant_id, display_name, sp_app_id, sp_display_name, status, "
    "genie_space_id, metadata, created_at, updated_at"
)


@dataclass(frozen=True)
class TenantRow:
    tenant_id: str
    display_name: str
    sp_app_id: str
    sp_display_name: str
    status: str
    genie_space_id: Optional[str]
    metadata: dict
    created_at: datetime
    updated_at: datetime


def _row(r) -> TenantRow:
    return TenantRow(
        tenant_id=r[0],
        display_name=r[1],
        sp_app_id=r[2],
        sp_display_name=r[3],
        status=r[4],
        genie_space_id=r[5],
        metadata=r[6] or {},
        created_at=r[7],
        updated_at=r[8],
    )


def ensure_schema() -> None:
    """Create the registry tables if they don't exist (best-effort)."""
    if not enabled():
        return
    with connection() as conn:
        conn.execute(SCHEMA_SQL)
        conn.commit()
    logger.info("Tenant registry schema ensured")


# ============================================================ tenant CRUD
def insert_tenant(
    *,
    tenant_id: str,
    display_name: str,
    sp_app_id: str,
    sp_display_name: str,
    genie_space_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    from psycopg.types.json import Json

    with connection() as conn:
        conn.execute(
            f"""
            INSERT INTO {CLIENT_REGISTRY_TABLE}
                (tenant_id, display_name, sp_app_id, sp_display_name,
                 genie_space_id, metadata)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (tenant_id) DO UPDATE SET
                display_name    = EXCLUDED.display_name,
                sp_app_id       = EXCLUDED.sp_app_id,
                sp_display_name = EXCLUDED.sp_display_name,
                genie_space_id  = EXCLUDED.genie_space_id,
                metadata        = EXCLUDED.metadata,
                status          = 'active',
                updated_at      = NOW()
            """,
            (tenant_id, display_name, sp_app_id, sp_display_name,
             genie_space_id, Json(metadata or {})),
        )
        conn.commit()


def get_tenant(tenant_id: str) -> Optional[TenantRow]:
    if not enabled() or not tenant_id:
        return None
    with connection() as conn:
        cur = conn.execute(
            f"SELECT {_COLS} FROM {CLIENT_REGISTRY_TABLE} WHERE tenant_id = %s",
            (tenant_id,),
        )
        row = cur.fetchone()
    return _row(row) if row else None


def list_tenants() -> list[TenantRow]:
    if not enabled():
        return []
    with connection() as conn:
        cur = conn.execute(
            f"SELECT {_COLS} FROM {CLIENT_REGISTRY_TABLE} ORDER BY created_at DESC"
        )
        return [_row(r) for r in cur.fetchall()]


def set_tenant_status(tenant_id: str, status: str) -> None:
    with connection() as conn:
        conn.execute(
            f"UPDATE {CLIENT_REGISTRY_TABLE} SET status = %s, updated_at = NOW() "
            "WHERE tenant_id = %s",
            (status, tenant_id),
        )
        conn.commit()


def delete_tenant(tenant_id: str) -> None:
    with connection() as conn:
        conn.execute(
            f"DELETE FROM {CLIENT_REGISTRY_TABLE} WHERE tenant_id = %s",
            (tenant_id,),
        )
        conn.commit()


# ============================================================ credential CRUD
def put_secret(sp_app_id: str, secret: str) -> None:
    """Encrypt + upsert an SP client secret (sets rotated_at on conflict)."""
    enc = crypto.encrypt(secret)
    with connection() as conn:
        conn.execute(
            f"""
            INSERT INTO {SP_CREDENTIALS_TABLE} (sp_app_id, secret_encrypted)
            VALUES (%s, %s)
            ON CONFLICT (sp_app_id) DO UPDATE SET
                secret_encrypted = EXCLUDED.secret_encrypted,
                rotated_at       = NOW()
            """,
            (sp_app_id, enc),
        )
        conn.commit()


def get_secret(sp_app_id: str) -> Optional[str]:
    """Return the decrypted SP client secret, or None if not stored."""
    if not enabled() or not sp_app_id:
        return None
    with connection() as conn:
        cur = conn.execute(
            f"SELECT secret_encrypted FROM {SP_CREDENTIALS_TABLE} WHERE sp_app_id = %s",
            (sp_app_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    return crypto.decrypt(row[0])


def delete_secret(sp_app_id: str) -> None:
    with connection() as conn:
        conn.execute(
            f"DELETE FROM {SP_CREDENTIALS_TABLE} WHERE sp_app_id = %s",
            (sp_app_id,),
        )
        conn.commit()
