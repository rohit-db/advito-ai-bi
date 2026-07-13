"""Unity Catalog ``sp_tenant_mapping`` CRUD + tenant-isolation verification.

The ``sp_tenant_mapping`` Delta table maps each tenant Service Principal
(``sp_app_id``) to its ``tenant_id``. A UC row-filter function joins governed
tables against this mapping keyed on ``session_user()``, so a query run AS a
tenant SP only ever sees that tenant's rows.

This module owns two responsibilities:
  * **mapping CRUD** — insert / (de)activate / delete rows, executed as the
    workspace admin via the SQL Statement Execution API
    (``runtime.admin_client().statement_execution``).
  * **verification** — run ``SELECT DISTINCT tenant_id`` AS each tenant SP (via a
    minted M2M token against the REST Statement Execution API) and assert the SP
    only sees its own ``tenant_id``.

All mapping mutations require ``UC_CATALOG`` / ``UC_SCHEMA``. When those are
unset :func:`fq` raises a clear :class:`RuntimeError`; callers (``service.py``)
catch and log it so onboarding still succeeds without UC configured.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Optional

import requests

from ..config import (
    MAPPING_ACTIVE_COLUMN,
    MAPPING_TABLE,
    MAPPING_TENANT_COLUMN,
    MAPPING_TS_COLUMN,
    MAPPING_USER_COLUMN,
    TENANT_COLUMN,
    UC_CATALOG,
    UC_SCHEMA,
    WORKSPACE_URL,
)
from . import registry, runtime
from .registry import TenantRow

logger = logging.getLogger("server.tenants.unity_catalog")

# The mapping table + its column shape are configurable so this app can either
# create its own ``sp_tenant_mapping`` or REUSE an existing customer filter table
# (e.g. Advito's ``user_client_access(user_email, client_id, granted_at)``).
mapping_table_name = MAPPING_TABLE
_USER_COL = MAPPING_USER_COLUMN
_TENANT_COL = MAPPING_TENANT_COLUMN
_ACTIVE_COL = MAPPING_ACTIVE_COLUMN or None
_TS_COL = MAPPING_TS_COLUMN or None


# ----------------------------------------------------------------- helpers
def fq(name: str) -> str:
    """Fully-qualify a bare table name as ``catalog.schema.name``.

    Names that are already qualified (contain a ``.``, e.g. a fully-qualified
    ``VERIFY_TABLE``) are returned unchanged. Bare names require UC_CATALOG /
    UC_SCHEMA — without a governed catalog/schema UC row-filter isolation is
    impossible, so this raises a clear error.
    """
    if "." in name:
        return name
    if not UC_CATALOG or not UC_SCHEMA:
        raise RuntimeError(
            "UC row-filter isolation requires UC_CATALOG and UC_SCHEMA to be set "
            "(mapping table + governed tables live there). Set them in the env "
            "to enable the tenant mapping and verification."
        )
    return f"{UC_CATALOG}.{UC_SCHEMA}.{name}"


def _admin_sql(statement: str) -> list:
    """Execute a statement AS the workspace admin; return ``result.data_array``.

    Used for mapping mutations and admin-side reads. Best-effort: raises on a
    FAILED statement so callers can log the error.
    """
    w = runtime.admin_client()
    resp = w.statement_execution.execute_statement(
        warehouse_id=runtime.warehouse_id(),
        catalog=UC_CATALOG,
        schema=UC_SCHEMA,
        statement=statement,
        wait_timeout="30s",
    )
    resp = _wait_for_admin(w, resp)
    state = _state_str(getattr(getattr(resp, "status", None), "state", None))
    if state and state not in ("SUCCEEDED",):
        detail = _error_detail(resp)
        raise RuntimeError(f"admin SQL statement {state}: {detail}")
    result = getattr(resp, "result", None)
    return list(getattr(result, "data_array", None) or [])


def _wait_for_admin(w, resp):
    """Poll a statement-execution response until it leaves PENDING/RUNNING."""
    for _ in range(60):
        state = _state_str(getattr(getattr(resp, "status", None), "state", None))
        if state not in ("PENDING", "RUNNING"):
            return resp
        statement_id = getattr(resp, "statement_id", None)
        if not statement_id:
            return resp
        time.sleep(1)
        resp = w.statement_execution.get_statement(statement_id)
    return resp


def _state_str(state) -> Optional[str]:
    if state is None:
        return None
    return getattr(state, "value", None) or str(state)


def _error_detail(resp) -> str:
    status = getattr(resp, "status", None)
    err = getattr(status, "error", None)
    if err is None:
        return "unknown error"
    return getattr(err, "message", None) or str(err)


# ----------------------------------------------------------------- mapping CRUD
def insert_mapping(sp_app_id: str, tenant_id: str) -> None:
    """Upsert a mapping row for a tenant SP (dedupe by the user/identity column).

    Writes the configured columns only, so it works against both this app's
    ``sp_tenant_mapping(sp_app_id, tenant_id, active)`` and an existing customer
    table such as ``user_client_access(user_email, client_id, granted_at)``.
    """
    table = fq(mapping_table_name)
    _admin_sql(f"DELETE FROM {table} WHERE {_USER_COL} = '{sp_app_id}'")
    cols = [_USER_COL, _TENANT_COL]
    vals = [f"'{sp_app_id}'", f"'{tenant_id}'"]
    if _ACTIVE_COL:
        cols.append(_ACTIVE_COL)
        vals.append("true")
    if _TS_COL:
        cols.append(_TS_COL)
        vals.append("current_timestamp()")
    _admin_sql(
        f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(vals)})"
    )


def deactivate_mapping(sp_app_id: str) -> None:
    """Disable a mapping: flip ``active`` if the table has it, else delete the row."""
    table = fq(mapping_table_name)
    if _ACTIVE_COL:
        _admin_sql(
            f"UPDATE {table} SET {_ACTIVE_COL} = false WHERE {_USER_COL} = '{sp_app_id}'"
        )
    else:
        _admin_sql(f"DELETE FROM {table} WHERE {_USER_COL} = '{sp_app_id}'")


def activate_mapping(sp_app_id: str, tenant_id: Optional[str] = None) -> None:
    """Re-enable a mapping: flip ``active`` if present, else re-insert the row."""
    table = fq(mapping_table_name)
    if _ACTIVE_COL:
        _admin_sql(
            f"UPDATE {table} SET {_ACTIVE_COL} = true WHERE {_USER_COL} = '{sp_app_id}'"
        )
    elif tenant_id:
        insert_mapping(sp_app_id, tenant_id)


def delete_mapping(sp_app_id: str) -> None:
    table = fq(mapping_table_name)
    _admin_sql(f"DELETE FROM {table} WHERE {_USER_COL} = '{sp_app_id}'")


# ----------------------------------------------------------------- run-as-SP
def run_sql_as(token: str, sql: str) -> list:
    """Execute a SQL statement AS a tenant SP token; return ``data_array``.

    Uses the REST Statement Execution API directly so the query runs under the
    supplied bearer token (not the admin client), which is what makes
    ``session_user()`` resolve to the tenant SP.
    """
    base = (WORKSPACE_URL or "").rstrip("/")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body = {
        "warehouse_id": runtime.warehouse_id(),
        "statement": sql,
        "wait_timeout": "30s",
    }
    resp = requests.post(
        f"{base}/api/2.0/sql/statements", headers=headers, json=body, timeout=60
    )
    if resp.status_code not in (200, 202):
        raise RuntimeError(
            f"statement execution failed ({resp.status_code}): {resp.text[:300]}"
        )
    payload = resp.json()

    # Poll while PENDING / RUNNING.
    for _ in range(60):
        state = (payload.get("status") or {}).get("state")
        if state not in ("PENDING", "RUNNING"):
            break
        statement_id = payload.get("statement_id")
        if not statement_id:
            break
        time.sleep(1)
        poll = requests.get(
            f"{base}/api/2.0/sql/statements/{statement_id}",
            headers=headers,
            timeout=60,
        )
        if poll.status_code != 200:
            raise RuntimeError(
                f"statement poll failed ({poll.status_code}): {poll.text[:300]}"
            )
        payload = poll.json()

    state = (payload.get("status") or {}).get("state")
    if state and state != "SUCCEEDED":
        err = (payload.get("status") or {}).get("error") or {}
        raise RuntimeError(
            f"statement {state}: {err.get('message') or err or 'unknown error'}"
        )
    return (payload.get("result") or {}).get("data_array") or []


# ----------------------------------------------------------------- verification
def _default_target(target_table: Optional[str]) -> str:
    return target_table or os.environ.get("VERIFY_TABLE", "").strip() or mapping_table_name


def verify_tenant(row: TenantRow, target_table: Optional[str] = None) -> dict:
    """Run isolation checks AS a tenant SP and report what it can see.

    Returns ``{tenant_id, display_name, passed, distinct_tenant_ids,
    session_user, visible_row_count?, error?}``. Any exception is captured into
    ``error`` (and ``passed=False``) rather than raised.
    """
    target = _default_target(target_table)
    out: dict = {
        "tenant_id": row.tenant_id,
        "display_name": row.display_name,
        "passed": False,
        "distinct_tenant_ids": [],
        "session_user": None,
    }
    try:
        table = fq(target)
        secret = runtime.secret_for_sp(row.sp_app_id)
        if not secret:
            raise RuntimeError(
                f"no stored SP secret for tenant {row.tenant_id} ({row.sp_app_id})"
            )
        token = runtime.minter().get_token(row.sp_app_id, secret)

        distinct_rows = run_sql_as(
            token, f"SELECT DISTINCT {TENANT_COLUMN} FROM {table}"
        )
        distinct_ids = [r[0] for r in distinct_rows if r]
        out["distinct_tenant_ids"] = distinct_ids
        out["visible_row_count"] = len(distinct_rows)

        user_rows = run_sql_as(token, "SELECT session_user()")
        if user_rows and user_rows[0]:
            out["session_user"] = user_rows[0][0]

        out["passed"] = distinct_ids == [row.tenant_id]
    except Exception as e:  # noqa: BLE001
        logger.warning("verify_tenant failed for %s: %s", row.tenant_id, e)
        out["error"] = str(e)
    return out


def verify_all(target_table: Optional[str] = None) -> list[dict]:
    """Verify isolation for every active tenant in the registry."""
    results: list[dict] = []
    for row in registry.list_tenants():
        if row.status != "active":
            continue
        results.append(verify_tenant(row, target_table))
    return results
