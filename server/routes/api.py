from fastapi import APIRouter, Request
from ..config import DASHBOARD_URL, MULTI_PAGE_DASHBOARD_URL, get_workspace_client

router = APIRouter()


def compute_initials(display_name: str) -> str:
    parts = (display_name or "").split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return (parts[0][0] if parts else "?").upper()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/config")
def get_config():
    return {
        "dashboardUrl": DASHBOARD_URL,
        "multiPageDashboardUrl": MULTI_PAGE_DASHBOARD_URL,
    }


@router.get("/me")
def get_me(request: Request):
    """Returns the authenticated user's info using OBO token."""
    try:
        w = get_workspace_client(request)
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
