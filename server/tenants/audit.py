"""Admin activity feed for tenant lifecycle operations (Lakebase).

Every onboard / rotate / deactivate / reactivate / delete (and their grant
side-effects) writes a row to ``apex_tenant_audit`` so the operator console can
render a "who did what, when, and did it succeed" feed per tenant and globally.

Mirrors the graceful-degradation contract of :mod:`server.persistence`: when
Lakebase is disabled every function is a no-op (writes) or returns ``[]``
(reads), so the app keeps working on the JSON-only demo path.
"""
from __future__ import annotations

import logging
from typing import Optional

from ..lakebase import connection, enabled

logger = logging.getLogger("server.tenants.audit")

AUDIT_TABLE = "apex_tenant_audit"

SCHEMA_SQL = f"""
CREATE TABLE IF NOT EXISTS {AUDIT_TABLE} (
    id          SERIAL PRIMARY KEY,
    tenant_id   VARCHAR(255),
    actor       VARCHAR(255),
    action      VARCHAR(64)  NOT NULL,
    sp_app_id   VARCHAR(255),
    status      VARCHAR(32)  NOT NULL DEFAULT 'ok',
    detail      TEXT,
    latency_ms  INTEGER,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_{AUDIT_TABLE}_tenant
    ON {AUDIT_TABLE}(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_{AUDIT_TABLE}_created
    ON {AUDIT_TABLE}(created_at DESC);
"""

_COLS = "id, tenant_id, actor, action, sp_app_id, status, detail, latency_ms, created_at"


def _row(r) -> dict:
    return {
        "id": r[0],
        "tenant_id": r[1],
        "actor": r[2],
        "action": r[3],
        "sp_app_id": r[4],
        "status": r[5],
        "detail": r[6],
        "latency_ms": r[7],
        "created_at": r[8].isoformat() if r[8] else None,
    }


def ensure_schema() -> None:
    """Create the audit table if it doesn't exist (best-effort)."""
    if not enabled():
        return
    with connection() as conn:
        conn.execute(SCHEMA_SQL)
        conn.commit()
    logger.info("Tenant audit schema ensured")


def log(
    action: str,
    *,
    tenant_id: Optional[str] = None,
    actor: Optional[str] = None,
    sp_app_id: Optional[str] = None,
    status: str = "ok",
    detail: Optional[str] = None,
    latency_ms: Optional[int] = None,
) -> None:
    """Append one audit row (no-op when Lakebase is disabled)."""
    if not enabled():
        return
    try:
        with connection() as conn:
            conn.execute(
                f"""
                INSERT INTO {AUDIT_TABLE}
                    (tenant_id, actor, action, sp_app_id, status, detail, latency_ms)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (tenant_id, actor, action, sp_app_id, status or "ok", detail, latency_ms),
            )
            conn.commit()
    except Exception as e:  # noqa: BLE001 - auditing must never break the caller
        logger.warning("audit log failed for action=%s: %s", action, e)


def history(tenant_id: str, limit: int = 50) -> list[dict]:
    """Return recent audit rows for a single tenant, newest first."""
    if not enabled():
        return []
    with connection() as conn:
        cur = conn.execute(
            f"""
            SELECT {_COLS} FROM {AUDIT_TABLE}
            WHERE tenant_id = %s
            ORDER BY created_at DESC, id DESC
            LIMIT %s
            """,
            (tenant_id, int(limit)),
        )
        return [_row(r) for r in cur.fetchall()]


def recent(limit: int = 20) -> list[dict]:
    """Return the most recent audit rows across all tenants, newest first."""
    if not enabled():
        return []
    with connection() as conn:
        cur = conn.execute(
            f"""
            SELECT {_COLS} FROM {AUDIT_TABLE}
            ORDER BY created_at DESC, id DESC
            LIMIT %s
            """,
            (int(limit),),
        )
        return [_row(r) for r in cur.fetchall()]
