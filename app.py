from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

app = FastAPI(title="APEX - Advito Practice Exchange")

# White-label session gate. No-op when AUTH_ENABLED is unset/false, so the
# default Databricks-Apps behavior is unchanged.
from server.auth import SessionGateMiddleware, router as auth_router
app.add_middleware(SessionGateMiddleware)

from server.routes.api import router as api_router
app.include_router(api_router, prefix="/api")

from server.routes.genie_mcp import router as genie_mcp_router
app.include_router(genie_mcp_router, prefix="/api")

from server.routes.embed import router as embed_router
app.include_router(embed_router, prefix="/api")

# Conversation history + user filter preferences, persisted in Lakebase.
from server.routes.apex import router as apex_router
app.include_router(apex_router, prefix="/api/apex")


@app.on_event("startup")
def _ensure_lakebase_schema() -> None:
    """Best-effort creation of the persistence tables. Never blocks startup —
    if Lakebase is off or unreachable the app falls back to in-memory behavior."""
    try:
        from server import persistence

        persistence.ensure_schema()
    except Exception as exc:  # noqa: BLE001
        import logging

        logging.getLogger("app").warning("Lakebase schema init skipped: %s", exc)

# Login/logout/identity routes. Mounted WITHOUT an /api prefix (so /login and
# /logout are top-level), and BEFORE the SPA catch-all so they aren't swallowed
# by the index.html fallback. The /api/auth/* routes are declared inside it too.
app.include_router(auth_router)

frontend_dir = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dir):
    assets_dir = os.path.join(frontend_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(frontend_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dir, "index.html"))
