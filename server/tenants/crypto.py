"""AES-256-GCM encryption for Service Principal secrets at rest.

SP client secrets are stored in Lakebase (``apex_sp_credentials``). The key comes
from ``AES_KEY_BASE64`` (urlsafe-base64 of 32 raw bytes). When the key is unset
(local dev only), secrets are stored with a ``plain:`` marker and a warning is
logged so nothing silently ships to production unencrypted.

Wire format: ``base64(nonce[12] || ciphertext+tag)`` — or ``plain:<secret>``.
"""
from __future__ import annotations

import base64
import logging
import os
from typing import Optional

logger = logging.getLogger("server.tenants.crypto")

PLAIN_MARKER = "plain:"


def _key() -> Optional[bytes]:
    raw = os.environ.get("AES_KEY_BASE64")
    if not raw:
        return None
    return base64.urlsafe_b64decode(raw)


def encrypt(plaintext: str) -> str:
    """Encrypt a secret for storage. Falls back to a plaintext marker locally."""
    key = _key()
    if key is None:
        logger.warning(
            "AES_KEY_BASE64 unset — storing SP secret as plaintext (local-dev "
            "only). Set AES_KEY_BASE64 (see tenants.crypto.generate_key_base64) "
            "in any shared/production environment."
        )
        return PLAIN_MARKER + plaintext
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, plaintext.encode(), None)
    return base64.b64encode(nonce + ct).decode()


def decrypt(value: str) -> str:
    """Decrypt a stored secret (handles both encrypted and plaintext-marker)."""
    if value.startswith(PLAIN_MARKER):
        return value[len(PLAIN_MARKER):]
    key = _key()
    if key is None:
        raise RuntimeError(
            "Stored SP secret is encrypted but AES_KEY_BASE64 is unset"
        )
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    raw = base64.b64decode(value)
    nonce, ct = raw[:12], raw[12:]
    return AESGCM(key).decrypt(nonce, ct, None).decode()


def generate_key_base64() -> str:
    """Generate a fresh urlsafe-base64 AES-256 key for AES_KEY_BASE64."""
    return base64.urlsafe_b64encode(os.urandom(32)).decode()


if __name__ == "__main__":  # `python -m server.tenants.crypto` prints a new key
    print(generate_key_base64())
