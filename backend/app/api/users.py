"""
User profile and onboarding routes for Medrion.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import db
from app.middleware.auth import get_current_user
from app.models.schemas import (
    OnboardingStep1,
    OnboardingStep2,
    UserProfile,
    UserProfileUpdate,
)
from app.services.email_service import send_welcome_email

router = APIRouter(prefix="/users", tags=["users"])

# ---------------------------------------------------------------------------
# Webhook for Supabase Auth (called on user signup)
# ---------------------------------------------------------------------------

webhook_router = APIRouter(prefix="/webhook", tags=["webhooks"])


@webhook_router.post("/auth")
async def supabase_auth_webhook(payload: dict[str, Any]) -> dict:
    event_type = payload.get("type")
    record = payload.get("record", {})

    if event_type != "INSERT" or not record:
        return {"status": "ignored"}

    user_id = record.get("id")
    email = record.get("email", "")

    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing user id")

    existing = db.table("users").select("id").eq("id", user_id).execute()
    if existing.data:
        return {"status": "already_exists"}

    db.table("users").insert({
        "id": user_id,
        "email": email,
        "role": "doctor",
        "subscription_status": "trial",
        "trial_prescriptions_used": 0,
        "onboarding_completed": False,
    }).execute()

    send_welcome_email(email, "Médico")
    return {"status": "created"}


# ---------------------------------------------------------------------------
# User profile
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserProfile)
async def get_my_profile(current_user: dict = Depends(get_current_user)) -> Any:
    user_id = current_user["user_id"]
    result = db.table("users").select("*").eq("id", user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    return result.data


@router.patch("/me", response_model=UserProfile)
async def update_my_profile(
    updates: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
) -> Any:
    user_id = current_user["user_id"]
    update_data = updates.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    result = (
        db.table("users").update(update_data).eq("id", user_id).select().single().execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return result.data


# ---------------------------------------------------------------------------
# Onboarding
# ---------------------------------------------------------------------------

@router.post("/onboarding/step1", response_model=UserProfile)
async def onboarding_step1(
    data: OnboardingStep1,
    current_user: dict = Depends(get_current_user),
) -> Any:
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
        db.table("users").update(update_data).eq("id", user_id).select().single().execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return result.data


@router.post("/onboarding/step2", response_model=UserProfile)
async def onboarding_step2(
    data: OnboardingStep2,
    current_user: dict = Depends(get_current_user),
) -> Any:
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return result.data


@router.post("/onboarding/complete", response_model=UserProfile)
async def onboarding_complete(current_user: dict = Depends(get_current_user)) -> Any:
    user_id = current_user["user_id"]
    trial_ends_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    result = (
        db.table("users")
        .update({
            "onboarding_completed": True,
            "trial_ends_at": trial_ends_at,
            "subscription_status": "trial",
            "trial_prescriptions_used": 0,
        })
        .eq("id", user_id)
        .select()
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return result.data


# ---------------------------------------------------------------------------
# Legal acceptance
# ---------------------------------------------------------------------------

@router.post("/legal/accept")
async def record_legal_acceptance(
    payload: dict[str, Any],
    current_user: dict = Depends(get_current_user),
) -> dict:
    user_id = current_user["user_id"]
    types = payload.get("types", [])
    if not types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No document types provided")
    records = [
        {
            "user_id": user_id,
            "document_type": doc_type,
            "accepted_at": datetime.now(timezone.utc).isoformat(),
        }
        for doc_type in types
    ]
    db.table("legal_acceptances").insert(records).execute()
    return {"accepted_at": datetime.now(timezone.utc).isoformat()}
