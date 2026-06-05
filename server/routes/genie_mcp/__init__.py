"""Genie MCP route package.

Re-exports ``router`` so ``from server.routes.genie_mcp import router`` keeps
working unchanged after the split from a single module into a package.
"""

from .routes import router

__all__ = ["router"]
