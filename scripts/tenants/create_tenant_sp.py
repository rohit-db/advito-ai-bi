#!/usr/bin/env python3
"""CLI wrapper to onboard a per-tenant Service Principal.

A thin operator convenience over the admin UI: it creates a dedicated workspace
Service Principal for a tenant, mints its OAuth secret, registers it in Lakebase,
and writes the ``sp_tenant_mapping`` row that the UC row filter joins on. The
generated ``client_id`` / ``client_secret`` are printed ONCE — Databricks will
not show the secret again, so capture it immediately.

This delegates to ``server.tenants.service.onboard(tenant_id, display_name,
genie_space_id)`` (falling back to ``server.tenants.sp_lifecycle.onboard_sp`` if
the orchestration module isn't present yet). Requires a workspace-admin identity
(set TENANTS_ADMIN_PROFILE) and Lakebase enabled.

Usage:
    python scripts/tenants/create_tenant_sp.py \\
        --tenant-id acme-travel \\
        --display-name "Acme Travel" \\
        --genie-space-id 01f1270...
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Make the app's ``server`` package importable (repo root is two levels up).
_REPO = Path(__file__).resolve().parents[2]
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Onboard a per-tenant Service Principal (prints secret once).",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument(
        "--tenant-id",
        required=True,
        help="tenant id == the white-label user's external_value (e.g. acme-travel)",
    )
    p.add_argument(
        "--display-name",
        required=True,
        help="human-friendly tenant name for the registry",
    )
    p.add_argument(
        "--genie-space-id",
        default=None,
        help="optional per-tenant Genie space id",
    )
    return p.parse_args(argv)


def _onboard(tenant_id: str, display_name: str, genie_space_id: str | None) -> dict:
    """Call the onboarding orchestrator, tolerating either module layout."""
    try:
        from server.tenants import service

        return service.onboard(tenant_id, display_name, genie_space_id)
    except (ImportError, AttributeError):
        from server.tenants import sp_lifecycle

        return sp_lifecycle.onboard_sp(tenant_id, display_name, genie_space_id)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)

    result = _onboard(args.tenant_id, args.display_name, args.genie_space_id)

    client_id = result.get("sp_app_id") or result.get("client_id")
    client_secret = result.get("client_secret")

    print(f"\nOnboarded tenant '{args.tenant_id}':")
    print(f"  sp_display_name : {result.get('sp_display_name')}")
    print(f"  client_id       : {client_id}")
    print(f"  client_secret   : {client_secret}")
    print(
        "\n!! WARNING: the client_secret is shown ONCE and cannot be retrieved "
        "again.\n"
        "   Store it securely now (it is also encrypted at rest in the "
        "registry).\n"
        "   Next: run scripts/tenants/verify_isolation.py to confirm the tenant "
        "sees only its own rows."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
