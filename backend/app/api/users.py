"""
User profile and onboarding routes for Medrion.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import db
from app.middleware.auth import get_current_user
from app.models.schemas import (
    LegalAcceptance,
    OnboardingStep1,
    OnboardingStep2,
    UserProfile,
    UserProfileUpdate,
)
from app.services.email_service import send_welcome_email

router = APIRouter(prefix="/me", tags=["users"])

# ---------------------------------------------------------------------------
# Webhook for Supabase Auth (called on user signup)
# ---------------------------------------------------------------------------

webhook_router = APIRouter(prefix="/webhook", tags=["webhooks"])


@webhook_router.post("/auth")
async def supabase_auth_webhook(payload: dict[str, Any]) -> dict:
    """
    Called by Supabase Auth hook when a new user signs up.
    Creates the corresponding record in public.users.
    """
    event_type = payload.get("type")
    record = payload.get("record", {})

    if event_type != "INSERT" or not record:
        return {"status": "ignored"}

    user_id = record.get("id")
    email = record.get("email", "")

    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing user id")

    # Check if record already exists (idempotent)
    existing = (
        db.table("users")
        .select("id")
        .eq("id", user_id)
        .execute()
    )
    if existing.data:
        return {"status": "already_exists"}

    db.table("users").insert(
        {
            "id": user_id,
            "email": email,
            "role": "doctor",
            "subscription_status": "trial",
            "trial_prescriptions_used": 0,
            "onboarding_completed": False,
        }
    ).execute()

    send_welcome_email(email, "Médico")
    return {"status": "created"}


# ---------------------------------------------------------------------------
# User profile routes
# ---------------------------------------------------------------------------


@router.get("", response_model=UserProfile)
async def get_my_profile(current_user: dict = Depends(get_current_user)) -> Any:
    """Return current authenticated user's profile."""
    user_id = current_user["user_id"]
    result = (
        db.table("users")
        .select("*")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
        )
    return result.data


@router.put("", response_model=UserProfile)
async def update_my_profile(
    updates: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """Update current user's profile."""
    user_id = current_user["user_id"]
    update_data = updates.model_dump(exclude_none=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update"
        )

    result = (
        db.table("users")
        .update(update_data)
        .eq("id", user_id)
        .select()
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return result.data


# ---------------------------------------------------------------------------
# Onboarding routes
# ---------------------------------------------------------------------------


@router.post("/onboarding/step1", response_model=UserProfile)
async def onboarding_step1(
    data: OnboardingStep1,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """
    Save step 1 of onboarding: personal and professional data, preferences.
    """
    user_id = current_user["user_id"]
    update_data = {
        "name": data.name,
        "crm": data.crm,
        "crm_state": data.crm_state,
        "specialty": data.specialty,
        "pref_injectables": data.pref_injectables,
        "pref_hormones": data.pref_hormones,
        "pref_anabolics": data.pref_anabolics,
    }
    if data.phone:
        update_data["phone"] = data.phone
    if data.preferred_name:
        update_data["preferred_name"] = data.preferred_name
    if data.pref_injectables_detail:
        update_data["pref_injectables_detail"] = data.pref_injectables_detail

    result = (
        db.table("users")
        .update(update_data)
        .eq("id", user_id)
        .select()
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return result.data


@router.post("/onboarding/step2", response_model=UserProfile)
async def onboarding_step2(
    data: OnboardingStep2,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """
    Save step 2 of onboarding: prescription header configuration.
    """
    user_id = current_user["user_id"]
    result = (
        db.table("users")
        .update({"prescription_header": data.prescription_header})
        .eq("id", user_id)
        .select()
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return result.data


@router.post("/onboarding/complete", response_model=UserProfile)
async def onboarding_complete(
    current_user: dict = Depends(get_current_user),
) -> Any:
    """
    Mark onboarding as complete. Sets trial_ends_at to now + 7 days.
    """
    user_id = current_user["user_id"]
    trial_ends_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    result = (
        db.table("users")
        .update(
            {
                "onboarding_completed": True,
                "trial_ends_at": trial_ends_at,
                "subscription_status": "trial",
                "trial_prescriptions_used": 0,
            }
        )
        .eq("id", user_id)
        .select()
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return result.data


# ---------------------------------------------------------------------------
# Legal acceptance
# ---------------------------------------------------------------------------


@router.post("/legal-acceptance")
async def record_legal_acceptance(
    data: LegalAcceptance,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Record acceptance of legal documents (terms, privacy policy, etc.).
    Stores one row per document type with timestamp.
    """
    user_id = current_user["user_id"]
    records = [
        {
            "user_id": user_id,
            "document_type": doc_type,
            "accepted_at": datetime.now(timezone.utc).isoformat(),
        }
        for doc_type in data.document_types
    ]

    db.table("legal_acceptances").insert(records).execute()
    return {"status": "accepted", "document_types": data.document_types}


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------


@router.get("/notifications")
async def get_notifications(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Return unread notifications for current user."""
    user_id = current_user["user_id"]
    result = (
        db.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .eq("read", False)
        .order("created_at", desc=True)
        .execute()
    )
    return {"notifications": result.data or []}


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Mark a notification as read (only if it belongs to the current user)."""
    user_id = current_user["user_id"]
    result = (
        db.table("notifications")
        .update({"read": True})
        .eq("id", notification_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return {"status": "read"}
