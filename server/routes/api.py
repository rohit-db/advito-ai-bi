from fastapi import APIRouter
from ..config import get_workspace_client

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
