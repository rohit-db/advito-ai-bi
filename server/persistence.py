"""Lakebase-backed persistence for conversation history and filter preferences.

This is the "Databricks is all you need" story made concrete: the same managed
Postgres (Lakebase) that holds the white-label user directory also stores

  * **conversation history** — every Genie MCP thread, per user, replayable from
    the left rail, and
  * **user filter preferences** — each viewer's saved dashboard filter selection,
    restored on their next visit.

All rows are scoped by ``user_email`` (the white-label session identity), so one
tenant never sees another's threads or filter state. When Lakebase is disabled
or unreachable every function degrades gracefully (returns empty / no-op) so the
app still runs against the JSON-only demo path.

Tables (created lazily by :func:`ensure_schema`):
  * ``apex_conversations`` — one row per thread.
  * ``apex_messages``      — ordered messages; structured Genie output in JSONB.
  * ``apex_filter_prefs``  — one row per (user, dashboard) filter selection.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from .lakebase import connection, enabled

logger = logging.getLogger("server.persistence")

CONVERSATIONS_TABLE = "apex_conversations"
MESSAGES_TABLE = "apex_messages"
FILTER_PREFS_TABLE = "apex_filter_prefs"

DEFAULT_TITLE = "New conversation"

SCHEMA_SQL = f"""
CREATE TABLE IF NOT EXISTS {CONVERSATIONS_TABLE} (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email  VARCHAR(255) NOT NULL,
    tenant      VARCHAR(255) NOT NULL DEFAULT '',
    mode        VARCHAR(32)  NOT NULL DEFAULT 'space',
    title       TEXT         NOT NULL DEFAULT '{DEFAULT_TITLE}',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_{CONVERSATIONS_TABLE}_user
    ON {CONVERSATIONS_TABLE}(user_email, updated_at DESC);

CREATE TABLE IF NOT EXISTS {MESSAGES_TABLE} (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES {CONVERSATIONS_TABLE}(id) ON DELETE CASCADE,
    seq             INTEGER NOT NULL,
    role            VARCHAR(16) NOT NULL,
    content         TEXT NOT NULL DEFAULT '',
    payload         JSONB NOT NULL DEFAULT '{{}}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_{MESSAGES_TABLE}_conv
    ON {MESSAGES_TABLE}(conversation_id, seq);

CREATE TABLE IF NOT EXISTS {FILTER_PREFS_TABLE} (
    user_email   VARCHAR(255) NOT NULL,
    dashboard_id VARCHAR(255) NOT NULL,
    filters      JSONB NOT NULL DEFAULT '{{}}'::jsonb,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_email, dashboard_id)
);
"""


def _json(value: Any):
    """Wrap a Python object for a JSONB parameter."""
    from psycopg.types.json import Json

    return Json(value if value is not None else {})


def ensure_schema() -> None:
    """Create the persistence tables if they don't exist (best-effort)."""
    if not enabled():
        return
    with connection() as conn:
        conn.execute(SCHEMA_SQL)
        conn.commit()
    logger.info("Lakebase persistence schema ensured")


# ============================================================ conversations
def list_conversations(user_email: str) -> list[dict]:
    if not enabled():
        return []
    with connection() as conn:
        cur = conn.execute(
            f"""
            SELECT c.id::text, c.title, c.mode, c.created_at, c.updated_at,
                   COUNT(m.id) AS message_count
            FROM {CONVERSATIONS_TABLE} c
            LEFT JOIN {MESSAGES_TABLE} m ON m.conversation_id = c.id
            WHERE c.user_email = %s
            GROUP BY c.id, c.title, c.mode, c.created_at, c.updated_at
            ORDER BY c.updated_at DESC
            """,
            (user_email,),
        )
        rows = cur.fetchall()
    return [
        {
            "id": r[0],
            "title": r[1],
            "mode": r[2],
            "created_at": r[3].isoformat() if r[3] else None,
            "updated_at": r[4].isoformat() if r[4] else None,
            "message_count": int(r[5]),
        }
        for r in rows
    ]


def create_conversation(
    user_email: str, tenant: str = "", mode: str = "space", title: str = DEFAULT_TITLE
) -> dict:
    if not enabled():
        raise RuntimeError("Lakebase is not enabled")
    with connection() as conn:
        cur = conn.execute(
            f"""
            INSERT INTO {CONVERSATIONS_TABLE} (user_email, tenant, mode, title)
            VALUES (%s, %s, %s, %s)
            RETURNING id::text, title, mode, created_at, updated_at
            """,
            (user_email, tenant or "", mode or "space", title or DEFAULT_TITLE),
        )
        r = cur.fetchone()
        conn.commit()
    return {
        "id": r[0],
        "title": r[1],
        "mode": r[2],
        "created_at": r[3].isoformat() if r[3] else None,
        "updated_at": r[4].isoformat() if r[4] else None,
    }


def _owns(conn, conversation_id: str, user_email: str) -> bool:
    cur = conn.execute(
        f"SELECT 1 FROM {CONVERSATIONS_TABLE} WHERE id = %s AND user_email = %s",
        (conversation_id, user_email),
    )
    return cur.fetchone() is not None


def get_conversation(conversation_id: str, user_email: str) -> Optional[dict]:
    """Return the conversation with its ordered messages, or None if not owned."""
    if not enabled():
        return None
    with connection() as conn:
        cur = conn.execute(
            f"""
            SELECT id::text, title, mode, created_at, updated_at
            FROM {CONVERSATIONS_TABLE}
            WHERE id = %s AND user_email = %s
            """,
            (conversation_id, user_email),
        )
        head = cur.fetchone()
        if not head:
            return None
        cur = conn.execute(
            f"""
            SELECT role, content, payload
            FROM {MESSAGES_TABLE}
            WHERE conversation_id = %s
            ORDER BY seq ASC
            """,
            (conversation_id,),
        )
        msg_rows = cur.fetchall()
    messages = []
    for role, content, payload in msg_rows:
        p = payload if isinstance(payload, dict) else (json.loads(payload) if payload else {})
        messages.append({"role": role, "content": content, **p})
    return {
        "id": head[0],
        "title": head[1],
        "mode": head[2],
        "created_at": head[3].isoformat() if head[3] else None,
        "updated_at": head[4].isoformat() if head[4] else None,
        "messages": messages,
    }


def _next_seq(conn, conversation_id: str) -> int:
    cur = conn.execute(
        f"SELECT COALESCE(MAX(seq), 0) + 1 FROM {MESSAGES_TABLE} WHERE conversation_id = %s",
        (conversation_id,),
    )
    return int(cur.fetchone()[0])


def _insert_message(conn, conversation_id: str, role: str, content: str, payload: dict) -> None:
    seq = _next_seq(conn, conversation_id)
    conn.execute(
        f"""
        INSERT INTO {MESSAGES_TABLE} (conversation_id, seq, role, content, payload)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (conversation_id, seq, role, content or "", _json(payload)),
    )


def save_turn(
    conversation_id: str,
    user_email: str,
    user_text: str,
    assistant: dict,
) -> dict:
    """Persist one user→assistant turn and bump the conversation.

    ``assistant`` is the structured Genie message (steps, sql, toolCalls, table,
    deepLink, status, error, content). Sets the conversation title from the first
    user message when it's still the default placeholder.
    """
    if not enabled():
        return {"ok": False, "persisted": False}
    assistant = assistant or {}
    assistant_content = str(assistant.get("content", "") or "")
    assistant_payload = {
        k: assistant.get(k)
        for k in ("steps", "sql", "toolCalls", "table", "deepLink", "status", "error")
        if assistant.get(k) is not None
    }
    with connection() as conn:
        if not _owns(conn, conversation_id, user_email):
            return {"ok": False, "persisted": False, "error": "not found"}
        _insert_message(conn, conversation_id, "user", user_text, {})
        _insert_message(conn, conversation_id, "assistant", assistant_content, assistant_payload)
        # Title from the first user message if still the placeholder.
        new_title = (user_text or "").strip().replace("\n", " ")
        if len(new_title) > 80:
            new_title = new_title[:77] + "…"
        conn.execute(
            f"""
            UPDATE {CONVERSATIONS_TABLE}
            SET updated_at = NOW(),
                title = CASE WHEN title = %s AND %s <> '' THEN %s ELSE title END
            WHERE id = %s
            """,
            (DEFAULT_TITLE, new_title, new_title, conversation_id),
        )
        conn.commit()
    return {"ok": True, "persisted": True, "title": new_title or DEFAULT_TITLE}


def rename_conversation(conversation_id: str, user_email: str, title: str) -> bool:
    if not enabled():
        return False
    with connection() as conn:
        cur = conn.execute(
            f"UPDATE {CONVERSATIONS_TABLE} SET title = %s WHERE id = %s AND user_email = %s",
            (title or DEFAULT_TITLE, conversation_id, user_email),
        )
        conn.commit()
        return cur.rowcount > 0


def delete_conversation(conversation_id: str, user_email: str) -> bool:
    if not enabled():
        return False
    with connection() as conn:
        cur = conn.execute(
            f"DELETE FROM {CONVERSATIONS_TABLE} WHERE id = %s AND user_email = %s",
            (conversation_id, user_email),
        )
        conn.commit()
        return cur.rowcount > 0


# ============================================================ filter preferences
def get_filter_prefs(user_email: str, dashboard_id: str) -> Optional[dict]:
    if not enabled():
        return None
    with connection() as conn:
        cur = conn.execute(
            f"SELECT filters FROM {FILTER_PREFS_TABLE} WHERE user_email = %s AND dashboard_id = %s",
            (user_email, dashboard_id),
        )
        row = cur.fetchone()
    if not row:
        return None
    filters = row[0]
    return filters if isinstance(filters, dict) else (json.loads(filters) if filters else None)


def put_filter_prefs(user_email: str, dashboard_id: str, filters: dict) -> bool:
    if not enabled():
        return False
    with connection() as conn:
        conn.execute(
            f"""
            INSERT INTO {FILTER_PREFS_TABLE} (user_email, dashboard_id, filters, updated_at)
            VALUES (%s, %s, %s, NOW())
            ON CONFLICT (user_email, dashboard_id)
            DO UPDATE SET filters = EXCLUDED.filters, updated_at = NOW()
            """,
            (user_email, dashboard_id, _json(filters or {})),
        )
        conn.commit()
    return True


def healthcheck() -> dict:
    from .lakebase import healthcheck as _hc

    ok, detail = _hc()
    return {"ok": ok, "detail": detail}
