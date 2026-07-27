"""Fail-soft loader for the shared brand.config.json.

The SAME brand.config.json the React app consumes drives the server-rendered
login page (server/auth/login.py) and the FastAPI app title, so the login screen
always matches the app. Missing/unreadable config falls back to built-in
defaults — never raises (AGENTS.md fail-soft invariant).
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger("server.brand")

# Repo root = parent of the server/ package dir.
_BRAND_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "brand.config.json")

DEFAULT_BRAND: dict[str, Any] = {
    "identity": {
        "appName": "APEX",
        "shortName": "APEX",
        "tagline": "Travel Intelligence",
        "logo": "/brand/logo.svg",
        "logoMark": "/brand/mark.svg",
        "favicon": "/brand/favicon.svg",
    },
    "colors": {
        "primary": "#4f46e5",
        "primaryDark": "#3730a3",
        "primaryLight": "#e0e7ff",
        "accent": "#6366f1",
        "sidebarFrom": "#211d52",
        "sidebarVia": "#2d2a6e",
        "sidebarTo": "#16142e",
        "bg": "#f8fafc",
        "border": "#e2e8f0",
    },
    "typography": {"fontSans": "Inter, system-ui, -apple-system, sans-serif"},
}


def load_brand() -> dict[str, Any]:
    """Return the parsed brand config, or DEFAULT_BRAND if unreadable."""
    try:
        with open(_BRAND_PATH, encoding="utf-8") as fh:
            data = json.load(fh)
        # Shallow-merge over defaults so a partial config still works.
        merged = {**DEFAULT_BRAND, **data}
        for key in ("identity", "colors", "typography"):
            merged[key] = {**DEFAULT_BRAND[key], **(data.get(key) or {})}
        return merged
    except Exception as exc:  # noqa: BLE001 — fail soft
        logger.warning("brand.config.json unreadable (%s); using defaults", exc)
        return DEFAULT_BRAND


def brand_color(name: str) -> str:
    """One brand color hex by semantic name, falling back to the default."""
    return load_brand()["colors"].get(name, DEFAULT_BRAND["colors"].get(name, "#4f46e5"))
