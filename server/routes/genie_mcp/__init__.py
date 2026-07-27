"""Genie MCP route package.

Re-exports ``router`` so ``from server.routes.genie_mcp import router`` keeps
working unchanged after the split from a single module into a package.

The text-only ask -> poll -> answer lifecycle lives in ``routes.py``; the
interactive MCP **App View** (``view_ask``) proxy lives in ``app_view.py``. Both
sets of routes are merged onto the single exported ``router``.
"""

from .routes import router
from .app_view import router as app_view_router

router.include_router(app_view_router)

__all__ = ["router"]
