from fastapi import APIRouter
from ..config import DASHBOARD_URL

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/config")
def get_config():
    return {"dashboardUrl": DASHBOARD_URL}
