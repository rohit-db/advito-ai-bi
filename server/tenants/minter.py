"""Per-Service-Principal OAuth (M2M) token minting with an in-memory cache.

Each tenant SP gets its own short-lived ``all-apis`` token, minted from the
workspace OIDC endpoint via client-credentials. Tokens are cached per client_id
and refreshed 5 minutes before expiry. This is what lets Genie MCP / embed /
warehouse SQL run *as the tenant SP* so ``session_user()`` resolves to that SP.
"""
from __future__ import annotations

import logging
import threading
import time

import requests

logger = logging.getLogger("server.tenants.minter")


class TokenMinter:
    def __init__(self, host: str):
        self.host = (host or "").rstrip("/")
        self._cache: dict[str, tuple[str, float]] = {}
        self._lock = threading.Lock()

    def get_token(self, client_id: str, client_secret: str) -> str:
        now = time.time()
        with self._lock:
            cached = self._cache.get(client_id)
            if cached and cached[1] - 300 > now:
                return cached[0]
        token, expires_in = self._fetch(client_id, client_secret)
        with self._lock:
            self._cache[client_id] = (token, now + expires_in)
        return token

    def invalidate(self, client_id: str) -> None:
        with self._lock:
            self._cache.pop(client_id, None)

    def _fetch(self, client_id: str, client_secret: str) -> tuple[str, int]:
        logger.info("Minting OAuth token for SP client_id=%s", client_id)
        resp = requests.post(
            f"{self.host}/oidc/v1/token",
            data={"grant_type": "client_credentials", "scope": "all-apis"},
            auth=(client_id, client_secret),
            timeout=30,
        )
        if resp.status_code != 200:
            raise RuntimeError(
                f"OAuth token mint failed ({resp.status_code}): {resp.text[:300]}"
            )
        body = resp.json()
        return body["access_token"], int(body.get("expires_in", 3600))
