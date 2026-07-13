"""Live headline KPIs for the landing page.

Runs a small ``MEASURE()`` query against the ``travel_metrics`` metric view AS
the logged-in tenant's Service Principal — so the *same* Unity Catalog row filter
that scopes the embedded dashboards and Genie also scopes these numbers — falling
back to the app Service Principal when no tenant is resolved.

Fails soft on purpose: any misconfiguration or query error returns
``{"ok": false}`` with HTTP 200 so the landing page simply hides the KPI strip
instead of hard-failing.
"""
from __future__ import annotations

import logging
import os
import re

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..config import UC_CATALOG, UC_SCHEMA, get_sp_bearer

logger = logging.getLogger("server.routes.kpis")

router = APIRouter()

# The metric view backing the KPIs. Defaults to <catalog>.<schema>.travel_metrics
# and can be overridden with KPI_METRIC_VIEW.
_METRIC_VIEW = (
    os.environ.get("KPI_METRIC_VIEW")
    or (f"{UC_CATALOG}.{UC_SCHEMA}.travel_metrics" if UC_CATALOG and UC_SCHEMA else "")
).strip()

# metric-view measure  ->  response key
_MEASURES = [
    ("gross_spend_usd", "spend"),
    ("total_emissions_advito", "emissions"),
    ("traveler_count", "travelers"),
    ("component_count", "trips"),
]

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _valid_date(value: str, fallback: str) -> str:
    """Only allow plain ISO dates through to the SQL (guards against injection)."""
    return value if _DATE_RE.match(value or "") else fallback


def _resolve_token(request: Request) -> str | None:
    """Prefer the logged-in tenant SP token (row-scoped), else the app SP token."""
    try:
        from ..tenants.resolver import resolve_tenant_sp

        resolved = resolve_tenant_sp(request)
        if resolved:
            return resolved[0]
    except Exception:  # noqa: BLE001 - never block KPIs on the isolation layer
        pass
    return get_sp_bearer()


def _measure_row(token: str, date_from: str, date_to: str) -> dict:
    from ..tenants.unity_catalog import run_sql_as

    select = ", ".join(f"MEASURE({m}) AS {k}" for m, k in _MEASURES)
    sql = (
        f"SELECT {select} FROM {_METRIC_VIEW} "
        f"WHERE travel_start_date BETWEEN '{date_from}' AND '{date_to}'"
    )
    rows = run_sql_as(token, sql)
    values = rows[0] if rows else []
    out: dict = {}
    for i, (_, key) in enumerate(_MEASURES):
        raw = values[i] if i < len(values) else None
        try:
            out[key] = float(raw) if raw not in (None, "") else None
        except (TypeError, ValueError):
            out[key] = None
    return out


def _monthly_trend(token: str, date_from: str, date_to: str) -> list[dict]:
    """Monthly spend + emissions across the window (row-scoped by the SP token)."""
    from ..tenants.unity_catalog import run_sql_as

    sql = (
        "SELECT date_format(travel_start_date, 'yyyy-MM') AS month, "
        "MEASURE(gross_spend_usd) AS spend, "
        "MEASURE(total_emissions_advito) AS emissions "
        f"FROM {_METRIC_VIEW} "
        f"WHERE travel_start_date BETWEEN '{date_from}' AND '{date_to}' "
        "GROUP BY 1 ORDER BY 1"
    )
    out: list[dict] = []
    for row in run_sql_as(token, sql):
        month = row[0] if len(row) > 0 else None
        if not month:
            continue

        def _num(idx: int) -> float | None:
            try:
                raw = row[idx] if idx < len(row) else None
                return float(raw) if raw not in (None, "") else None
            except (TypeError, ValueError):
                return None

        out.append({"month": month, "spend": _num(1), "emissions": _num(2)})
    return out


@router.get("/kpis")
def kpis(
    request: Request,
    current_from: str = "2025-01-01",
    current_to: str = "2025-12-31",
    previous_from: str = "2024-01-01",
    previous_to: str = "2024-12-31",
) -> JSONResponse:
    """Return current + previous-period headline metrics for the landing page."""
    if not _METRIC_VIEW:
        return JSONResponse({"ok": False, "error": "metric view not configured"})

    token = _resolve_token(request)
    if not token:
        return JSONResponse({"ok": False, "error": "no credentials"})

    cf = _valid_date(current_from, "2025-01-01")
    ct = _valid_date(current_to, "2025-12-31")
    pf = _valid_date(previous_from, "2024-01-01")
    pt = _valid_date(previous_to, "2024-12-31")

    try:
        current = _measure_row(token, cf, ct)
        previous = _measure_row(token, pf, pt)
        return JSONResponse({"ok": True, "current": current, "previous": previous})
    except Exception as e:  # noqa: BLE001
        logger.warning("kpi query failed: %s", e)
        return JSONResponse({"ok": False, "error": str(e)})


@router.get("/kpis/trend")
def kpis_trend(
    request: Request,
    date_from: str = "2025-01-01",
    date_to: str = "2025-12-31",
) -> JSONResponse:
    """Return monthly spend + emissions for the landing-page trend charts."""
    if not _METRIC_VIEW:
        return JSONResponse({"ok": False, "error": "metric view not configured"})

    token = _resolve_token(request)
    if not token:
        return JSONResponse({"ok": False, "error": "no credentials"})

    df = _valid_date(date_from, "2025-01-01")
    dt = _valid_date(date_to, "2025-12-31")

    try:
        return JSONResponse({"ok": True, "series": _monthly_trend(token, df, dt)})
    except Exception as e:  # noqa: BLE001
        logger.warning("kpi trend query failed: %s", e)
        return JSONResponse({"ok": False, "error": str(e)})
