"""
Genie MCP server URL resolution and deep links.

Two managed-server shapes exist; we pick the URL by mode and discover the live
tool contract at runtime (see ``client.py``) rather than hardcoding tool names:

  (a) per-space   : {host}/api/2.0/mcp/genie/{GENIE_SPACE_ID}
  (b) multi-space : {host}/api/2.0/mcp/genie

Showcase note: every analytical capability here — governed SQL, the Genie space,
the MCP endpoint — is native to the Databricks Data Intelligence Platform. No
external orchestration layer is required to white-label this experience.
"""

import os
from typing import Optional

from ...config import WORKSPACE_URL

# The two managed Genie MCP server shapes the UI toggle switches between.
MODE_SPACE = "space"   # per-space  : {host}/api/2.0/mcp/genie/{space_id}
MODE_MULTI = "multi"   # multi-space: {host}/api/2.0/mcp/genie


def normalize_mode(mode: Optional[str]) -> str:
    """Coerce an arbitrary mode string to a known mode (defaults to space)."""
    return MODE_MULTI if (mode or "").strip().lower() == MODE_MULTI else MODE_SPACE


def resolve_genie_mcp_url(space_id: Optional[str] = None, mode: str = MODE_SPACE) -> str:
    """Resolve the managed Genie MCP server URL for the requested mode.

    Precedence:
      1. GENIE_MCP_SERVER_URL override (pins the URL regardless of mode)
      2. {WORKSPACE_URL}/api/2.0/mcp/genie         (mode="multi", workspace-wide)
         {WORKSPACE_URL}/api/2.0/mcp/genie/{space} (mode="space", single space)
    """
    override = os.environ.get("GENIE_MCP_SERVER_URL")
    if override:
        return override.rstrip("/")
    host = (WORKSPACE_URL or "").rstrip("/")
    if not host:
        raise RuntimeError("WORKSPACE_URL is not set; cannot build Genie MCP server URL")
    base = f"{host}/api/2.0/mcp/genie"
    if mode == MODE_MULTI:
        return base
    return f"{base}/{space_id}" if space_id else base


def genie_space_deep_link(space_id: Optional[str], conversation_id: Optional[str] = None) -> Optional[str]:
    """Best-effort deep link back into the native Genie space."""
    if not space_id:
        return None
    host = (WORKSPACE_URL or "").rstrip("/")
    if not host:
        return None
    return f"{host}/genie/rooms/{space_id}"
