from fastapi import APIRouter
from ..config import get_workspace_client
from .. import assets as assets_registry

router = APIRouter()


def compute_initials(display_name: str) -> str:
    parts = (display_name or "").split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return (parts[0][0] if parts else "?").upper()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/me")
def get_me():
    try:
        w = get_workspace_client()
        me = w.current_user.me()
        display_name = me.display_name or ""
        email = me.user_name or ""
        return {
            "displayName": display_name,
            "email": email,
            "initials": compute_initials(display_name),
        }
    except Exception:
        return {
            "displayName": "Demo User",
            "email": "demo@advito.com",
            "initials": "DU",
        }


@router.get("/assets")
def get_assets():
    """Resolved dashboard asset registry (seed today; Lakebase override in PR3b).

    Readable by any authenticated session — the frontend RegistryProvider fetches
    this at boot. Fail-soft: returns an empty registry rather than erroring.
    """
    return assets_registry.load_registry()
