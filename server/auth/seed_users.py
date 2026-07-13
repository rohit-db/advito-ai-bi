"""Create the user table in Lakebase and seed the sample logins.

Run once after provisioning Lakebase and filling the PG* / LAKEBASE_* env vars:

    python -m server.auth.seed_users

It reads the sample users (and the shared demo password) from
``AUTH_USERS_FILE`` (default ``server/auth/users.seed.json``) and upserts them
into the ``AUTH_USERS_TABLE`` (default ``apex_app_users``).

No-op with a message when ``LAKEBASE_ENABLED`` is false — the JSON fallback
directory needs no seeding.

Mirrors ``edge/seed_users.py``.
"""
from __future__ import annotations

import json
from pathlib import Path

from . import users as users_repo
from .sessions import hash_password


def main() -> None:
    if not users_repo.LAKEBASE_ENABLED:
        print("LAKEBASE_ENABLED is not set — nothing to seed. "
              "The app uses the JSON fallback directory "
              f"({users_repo.USERS_FILE}) when Lakebase is disabled.")
        return

    raw = json.loads(Path(users_repo.USERS_FILE).read_text())
    demo_pw = raw.get("demo_password") if isinstance(raw, dict) else None
    sample = raw.get("users", raw) if isinstance(raw, dict) else raw

    print(f"Seeding Lakebase instance '{users_repo.LAKEBASE_INSTANCE_NAME}' "
          f"({users_repo.PGHOST}) table '{users_repo.USERS_TABLE}' as "
          f"{users_repo.PGUSER} ...")
    users_repo.ensure_schema()

    count = 0
    for u in sample:
        # Prefer an existing password_hash; otherwise hash the shared demo password.
        pw_hash = u.get("password_hash") or (hash_password(demo_pw) if demo_pw else None)
        if not pw_hash:
            print(f"  ! skipping {u.get('email')} — no password_hash and no demo_password")
            continue
        users_repo._lakebase_upsert(users_repo.UserRow(
            email=str(u["email"]).strip().lower(),
            password_hash=pw_hash,
            display_name=u.get("display_name", u["email"]),
            tenant=u.get("tenant", ""),
            tenant_id=u.get("tenant_id") or u.get("external_value", "*"),
            role=u.get("role", "user"),
        ))
        count += 1

    rows = users_repo._lakebase_list()
    print(f"Seeded {count} users; directory now has {len(rows)}:")
    for r in rows:
        print(f"  - {r.email:28} {r.tenant:16} tenant_id={r.tenant_id} role={r.role}")


if __name__ == "__main__":
    main()
