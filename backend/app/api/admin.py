"""
Admin routes for Medrion.
All routes require role='admin'. Enforced via require_admin dependency.
"""

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import db
from app.middleware.auth import get_current_user, require_admin
from app.models.schemas import ActiveCreate, ActiveUpdate, UrgentAlertCreate

router = APIRouter(prefix="/admin", tags=["admin"])


def _get_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency: authenticated user with admin role."""
    return require_admin(current_user)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


@router.get("/users")
async def list_users(
    subscription_status: Optional[str] = Query(None),
    onboarding_completed: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _admin: dict = Depends(_get_admin_user),
) -> Any:
    """List all users with optional filters."""
    query = (
        db.table("users")
        .select("*")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if subscription_status:
        query = query.eq("subscription_status", subscription_status)
    if onboarding_completed is not None:
        query = query.eq("onboarding_completed", onboarding_completed)

    result = query.execute()
    return result.data or []


# ---------------------------------------------------------------------------
# Pharmacies
# ---------------------------------------------------------------------------


@router.get("/pharmacies")
async def list_pharmacies(
    _admin: dict = Depends(_get_admin_user),
) -> Any:
    """List all pharmacies."""
    result = (
        db.table("pharmacies")
        .select("*")
        .order("name")
        .execute()
    )
    return result.data or []


# ---------------------------------------------------------------------------
# Active Substances
# ---------------------------------------------------------------------------


@router.get("/actives")
async def list_actives(
    status_filter: Optional[str] = Query(None, alias="status"),
    category: Optional[str] = Query(None),
    _admin: dict = Depends(_get_admin_user),
) -> Any:
    """List all active substances with optional filters."""
    query = db.table("actives").select("*").order("name")
    if status_filter:
        query = query.eq("status", status_filter)
    if category:
        query = query.eq("category", category)

    result = query.execute()
    return result.data or []


@router.post("/actives", status_code=status.HTTP_201_CREATED)
async def create_active(
    data: ActiveCreate,
    _admin: dict = Depends(_get_admin_user),
) -> Any:
    """Create a new active substance."""
    active_data = data.model_dump(exclude_none=True)
    active_data.setdefault("status", "draft")

    result = db.table("actives").insert(active_data).select().single().execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create active substance",
        )
    return result.data


@router.put("/actives/{active_id}")
async def update_active(
    active_id: str,
    data: ActiveUpdate,
    _admin: dict = Depends(_get_admin_user),
) -> Any:
    """Update an active substance record."""
    existing = (
        db.table("actives").select("id").eq("id", active_id).single().execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Active substance not found"
        )

    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update"
        )
    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = (
        db.table("actives")
        .update(update_data)
        .eq("id", active_id)
        .select()
        .single()
        .execute()
    )
    return result.data


@router.post("/actives/{active_id}/publish")
async def publish_active(
    active_id: str,
    admin: dict = Depends(_get_admin_user),
) -> Any:
    """Publish an active substance (set status to 'active') and log the change."""
    existing = (
        db.table("actives").select("*").eq("id", active_id).single().execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Active substance not found"
        )

    result = (
        db.table("actives")
        .update(
            {
                "status": "active",
                "updated_at": datetime.utcnow().isoformat(),
            }
        )
        .eq("id", active_id)
        .select()
        .single()
        .execute()
    )

    # Log the change
    try:
        db.table("active_changes_log").insert(
            {
                "active_id": active_id,
                "changed_by": admin["user_id"],
                "previous_status": existing.data.get("status"),
                "new_status": "active",
                "action": "publish",
                "changed_at": datetime.utcnow().isoformat(),
            }
        ).execute()
    except Exception:
        pass  # Log failure is non-fatal

    return result.data


@router.post("/actives/{active_id}/discontinue")
async def discontinue_active(
    active_id: str,
    admin: dict = Depends(_get_admin_user),
) -> Any:
    """Discontinue an active substance (set status to 'discontinued') and log the change."""
    existing = (
        db.table("actives").select("*").eq("id", active_id).single().execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Active substance not found"
        )

    result = (
        db.table("actives")
        .update(
            {
                "status": "discontinued",
                "updated_at": datetime.utcnow().isoformat(),
            }
        )
        .eq("id", active_id)
        .select()
        .single()
        .execute()
    )

    # Log the change
    try:
        db.table("active_changes_log").insert(
            {
                "active_id": active_id,
                "changed_by": admin["user_id"],
                "previous_status": existing.data.get("status"),
                "new_status": "discontinued",
                "action": "discontinue",
                "changed_at": datetime.utcnow().isoformat(),
            }
        ).execute()
    except Exception:
        pass  # Log failure is non-fatal

    return result.data


# ---------------------------------------------------------------------------
# Urgent Safety Alerts
# ---------------------------------------------------------------------------


@router.get("/alerts")
async def list_alerts(
    resolved: Optional[bool] = Query(None),
    _admin: dict = Depends(_get_admin_user),
) -> Any:
    """List all urgent safety alerts."""
    query = (
        db.table("safety_alerts_urgent")
        .select("*")
        .order("created_at", desc=True)
    )
    if resolved is not None:
        query = query.eq("resolved", resolved)

    result = query.execute()
    return result.data or []


@router.post("/alerts", status_code=status.HTTP_201_CREATED)
async def create_alert(
    data: UrgentAlertCreate,
    admin: dict = Depends(_get_admin_user),
) -> Any:
    """Create a new urgent safety alert."""
    alert_data = data.model_dump(exclude_none=True)
    alert_data["created_by"] = admin["user_id"]
    alert_data["resolved"] = False

    result = (
        db.table("safety_alerts_urgent")
        .insert(alert_data)
        .select()
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create alert",
        )
    return result.data


@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    admin: dict = Depends(_get_admin_user),
) -> Any:
    """Mark an urgent safety alert as resolved."""
    existing = (
        db.table("safety_alerts_urgent")
        .select("id")
        .eq("id", alert_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found"
        )

    result = (
        db.table("safety_alerts_urgent")
        .update(
            {
                "resolved": True,
                "resolved_by": admin["user_id"],
                "resolved_at": datetime.utcnow().isoformat(),
            }
        )
        .eq("id", alert_id)
        .select()
        .single()
        .execute()
    )
    return result.data


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


@router.get("/stats")
async def get_stats(
    _admin: dict = Depends(_get_admin_user),
) -> dict:
    """Return basic platform metrics."""
    try:
        users_result = db.table("users").select("id", count="exact").execute()
        user_count = users_result.count or 0
    except Exception:
        user_count = 0

    try:
        prescriptions_result = (
            db.table("prescriptions").select("id", count="exact").execute()
        )
        prescription_count = prescriptions_result.count or 0
    except Exception:
        prescription_count = 0

    try:
        patients_result = (
            db.table("patients")
            .select("id", count="exact")
            .is_("deleted_at", "null")
            .execute()
        )
        patient_count = patients_result.count or 0
    except Exception:
        patient_count = 0

    try:
        trial_result = (
            db.table("users")
            .select("id", count="exact")
            .eq("subscription_status", "trial")
            .execute()
        )
        trial_count = trial_result.count or 0
    except Exception:
        trial_count = 0

    try:
        paid_result = (
            db.table("users")
            .select("id", count="exact")
            .eq("subscription_status", "active")
            .execute()
        )
        paid_count = paid_result.count or 0
    except Exception:
        paid_count = 0

    try:
        final_prescriptions_result = (
            db.table("prescriptions")
            .select("id", count="exact")
            .eq("status", "final")
            .execute()
        )
        final_prescription_count = final_prescriptions_result.count or 0
    except Exception:
        final_prescription_count = 0

    return {
        "users": {
            "total": user_count,
            "trial": trial_count,
            "paid": paid_count,
        },
        "prescriptions": {
            "total": prescription_count,
            "final": final_prescription_count,
        },
        "patients": {
            "total": patient_count,
        },
    }
