from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.database import db
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def get_notifications(current_user: dict = Depends(get_current_user)) -> list:
    user_id = current_user["user_id"]
    result = (
        db.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .eq("read", False)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    user_id = current_user["user_id"]
    result = (
        db.table("notifications")
        .update({"read": True})
        .eq("id", notification_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)) -> dict:
    user_id = current_user["user_id"]
    db.table("notifications").update({"read": True}).eq("user_id", user_id).execute()
    return {"ok": True}
