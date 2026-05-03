"""
Patient management routes for Medrion.
All routes require authentication. Ownership is always verified.
"""

from datetime import date, datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import db
from app.middleware.auth import get_current_user
from app.models.schemas import PatientCreate, PatientResponse, PatientUpdate

router = APIRouter(prefix="/patients", tags=["patients"])


def _calculate_age(birth_date: Any) -> Optional[int]:
    """Calculate age from a date or ISO string."""
    if not birth_date:
        return None
    try:
        if isinstance(birth_date, str):
            bd = date.fromisoformat(birth_date)
        else:
            bd = birth_date
        today = date.today()
        return (
            today.year
            - bd.year
            - ((today.month, today.day) < (bd.month, bd.day))
        )
    except Exception:
        return None


def _enrich_patient(patient: dict) -> dict:
    """Add computed 'age' field to a patient dict."""
    patient["age"] = _calculate_age(patient.get("birth_date"))
    return patient


def _verify_patient_ownership(patient_id: str, user_id: str) -> dict:
    """
    Fetch a patient and verify it belongs to user_id.
    Returns the patient dict or raises 404/403.
    """
    result = (
        db.table("patients")
        .select("*")
        .eq("id", patient_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found"
        )
    patient = result.data
    if str(patient.get("user_id")) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this patient",
        )
    return patient


@router.get("", response_model=list[PatientResponse])
async def list_patients(
    q: Optional[str] = Query(None, description="Search by patient name"),
    current_user: dict = Depends(get_current_user),
) -> Any:
    """List all patients belonging to the current doctor. Supports name search."""
    user_id = current_user["user_id"]
    query = (
        db.table("patients")
        .select("*")
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .order("name")
    )
    if q:
        query = query.ilike("name", f"%{q}%")

    result = query.execute()
    patients = result.data or []
    return [_enrich_patient(p) for p in patients]


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    data: PatientCreate,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """Create a new patient record owned by the current doctor."""
    user_id = current_user["user_id"]
    patient_data = data.model_dump(exclude_none=True)
    patient_data["user_id"] = user_id

    # Serialize date to ISO string if present
    if "birth_date" in patient_data and isinstance(patient_data["birth_date"], date):
        patient_data["birth_date"] = patient_data["birth_date"].isoformat()

    result = db.table("patients").insert(patient_data).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create patient",
        )
    return _enrich_patient(result.data[0])


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """Get a single patient by ID (only if owned by current doctor)."""
    patient = _verify_patient_ownership(patient_id, current_user["user_id"])
    return _enrich_patient(patient)


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: str,
    updates: PatientUpdate,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """Update a patient record (only if owned by current doctor)."""
    _verify_patient_ownership(patient_id, current_user["user_id"])

    update_data = updates.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update"
        )
    if "birth_date" in update_data and isinstance(update_data["birth_date"], date):
        update_data["birth_date"] = update_data["birth_date"].isoformat()
    update_data["updated_at"] = datetime.utcnow().isoformat()

    db.table("patients").update(update_data).eq("id", patient_id).execute()
    result = db.table("patients").select("*").eq("id", patient_id).single().execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update patient",
        )
    return _enrich_patient(result.data)


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
) -> None:
    """Soft-delete a patient (sets deleted_at timestamp, only if owned by current doctor)."""
    _verify_patient_ownership(patient_id, current_user["user_id"])

    db.table("patients").update(
        {"deleted_at": datetime.utcnow().isoformat()}
    ).eq("id", patient_id).execute()
