"""
Prescription generation and management routes for Medrion.
Handles AI generation, DOCX export, feedback, and chat-based updates.
"""

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import db
from app.middleware.auth import get_current_user
from app.models.schemas import (
    ChatMessage,
    FeedbackSubmit,
    PrescriptionCreate,
    PrescriptionResponse,
    PrescriptionUpdate,
)
from app.services.anthropic_service import generate_prescription
from app.services.docx_service import generate_docx
from app.services.storage_service import get_signed_url, upload_docx

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])

TRIAL_PRESCRIPTION_LIMIT = 3


def _verify_patient_belongs_to_user(patient_id: str, user_id: str) -> dict:
    """Verify the patient belongs to the current user."""
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
    if str(result.data.get("user_id")) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this patient",
        )
    return result.data


def _verify_prescription_ownership(prescription_id: str, user_id: str) -> dict:
    """Fetch a prescription and verify ownership."""
    result = (
        db.table("prescriptions")
        .select("*")
        .eq("id", prescription_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Prescription not found"
        )
    if str(result.data.get("user_id")) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this prescription",
        )
    return result.data


def _check_trial_limit(user_row: Optional[dict]) -> None:
    if not user_row:
        return
    subscription_status = user_row.get("subscription_status", "")
    if subscription_status not in ("trial",):
        return

    trial_ends_at = user_row.get("trial_ends_at")
    if trial_ends_at:
        from datetime import datetime, timezone
        ends = datetime.fromisoformat(trial_ends_at.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > ends:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Trial period expired. Please upgrade your subscription.",
            )

    used = user_row.get("trial_prescriptions_used", 0) or 0
    if used >= TRIAL_PRESCRIPTION_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Trial limit reached ({TRIAL_PRESCRIPTION_LIMIT} prescriptions). "
                "Please upgrade your subscription."
            ),
        )


def _increment_trial_usage(user_id: str) -> None:
    db.rpc("increment_trial_prescriptions", {"p_user_id": user_id}).execute()


@router.get("", response_model=list[PrescriptionResponse])
async def list_prescriptions(
    patient_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
) -> Any:
    """List prescriptions for a given patient (or all for the current doctor)."""
    user_id = current_user["user_id"]
    query = (
        db.table("prescriptions")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
    )
    if patient_id:
        _verify_patient_belongs_to_user(patient_id, user_id)
        query = query.eq("patient_id", patient_id)

    result = query.execute()
    return result.data or []


@router.get("/{prescription_id}", response_model=PrescriptionResponse)
async def get_prescription(
    prescription_id: str,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """Get a single prescription by ID."""
    return _verify_prescription_ownership(prescription_id, current_user["user_id"])


@router.post(
    "/generate", response_model=PrescriptionResponse, status_code=status.HTTP_201_CREATED
)
async def generate_new_prescription(
    data: PrescriptionCreate,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """
    Generate a new AI prescription for a patient.
    Checks and enforces trial limits before generation.
    """
    user_id = current_user["user_id"]
    user_row = current_user.get("db_row")

    # 1. Enforce trial limit BEFORE generating
    _check_trial_limit(user_row)

    # 2. Verify patient ownership and fetch full data
    patient = _verify_patient_belongs_to_user(str(data.patient_id), user_id)

    # 3. Fetch recent exams for this patient (last 5)
    exams_result = (
        db.table("exams")
        .select("*")
        .eq("patient_id", str(data.patient_id))
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )
    exams = exams_result.data or []

    # 4. Fetch previous prescriptions for context
    history_result = (
        db.table("prescriptions")
        .select("output_text, edited_output, created_at")
        .eq("patient_id", str(data.patient_id))
        .eq("status", "final")
        .order("created_at", desc=True)
        .limit(3)
        .execute()
    )
    history = history_result.data or []

    # 5. Fetch active substances from DB
    actives_result = (
        db.table("actives").select("*").eq("status", "active").execute()
    )
    actives = actives_result.data or []

    # 6. Build doctor prefs
    doctor_prefs = {
        "injectables": (user_row or {}).get("pref_injectables", False),
        "injectables_detail": (user_row or {}).get("pref_injectables_detail", ""),
        "hormones": (user_row or {}).get("pref_hormones", True),
        "anabolics": (user_row or {}).get("pref_anabolics", False),
    }

    # 7. Compute patient age for context
    from datetime import date

    birth_date = patient.get("birth_date")
    age = None
    if birth_date:
        try:
            bd = date.fromisoformat(str(birth_date))
            today = date.today()
            age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
        except Exception:
            pass
    patient["age"] = age

    # 8. Create prescription record with status='generating'
    prescription_insert = {
        "patient_id": str(data.patient_id),
        "user_id": user_id,
        "status": "generating",
        "output_text": None,
    }
    insert_result = (
        db.table("prescriptions")
        .insert(prescription_insert)
        .select()
        .single()
        .execute()
    )
    if not insert_result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create prescription record",
        )
    prescription_id = insert_result.data["id"]

    # 9. Generate with Claude
    try:
        output_text = await generate_prescription(
            patient_data=patient,
            exams=exams,
            history=history,
            actives=actives,
            doctor_prefs=doctor_prefs,
            additional_context=data.additional_context,
        )
    except Exception as exc:
        # Mark as failed
        db.table("prescriptions").update({"status": "failed"}).eq(
            "id", prescription_id
        ).execute()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {exc}",
        )

    # 10. Update prescription with output
    update_result = (
        db.table("prescriptions")
        .update(
            {
                "output_text": output_text,
                "status": "draft",
                "updated_at": datetime.utcnow().isoformat(),
            }
        )
        .eq("id", prescription_id)
        .select()
        .single()
        .execute()
    )

    # 11. Increment trial usage
    if (user_row or {}).get("subscription_status") == "trial":
        _increment_trial_usage(user_id)

    return update_result.data


@router.put("/{prescription_id}", response_model=PrescriptionResponse)
async def update_prescription(
    prescription_id: str,
    updates: PrescriptionUpdate,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """Save doctor's manual edits to a prescription."""
    _verify_prescription_ownership(prescription_id, current_user["user_id"])

    result = (
        db.table("prescriptions")
        .update(
            {
                "edited_output": updates.edited_output,
                "updated_at": datetime.utcnow().isoformat(),
            }
        )
        .eq("id", prescription_id)
        .select()
        .single()
        .execute()
    )
    return result.data


@router.post("/{prescription_id}/finalize", response_model=PrescriptionResponse)
async def finalize_prescription(
    prescription_id: str,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """Mark a prescription as final (locked for download/sending)."""
    _verify_prescription_ownership(prescription_id, current_user["user_id"])

    result = (
        db.table("prescriptions")
        .update(
            {
                "status": "final",
                "updated_at": datetime.utcnow().isoformat(),
            }
        )
        .eq("id", prescription_id)
        .select()
        .single()
        .execute()
    )
    return result.data


@router.post("/{prescription_id}/feedback")
async def submit_feedback(
    prescription_id: str,
    feedback: FeedbackSubmit,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Submit rating and optional comment for a prescription."""
    prescription = _verify_prescription_ownership(
        prescription_id, current_user["user_id"]
    )

    db.table("prescription_feedback").insert(
        {
            "prescription_id": prescription_id,
            "user_id": current_user["user_id"],
            "patient_id": prescription.get("patient_id"),
            "rating": feedback.rating,
            "comment": feedback.comment,
        }
    ).execute()

    return {"status": "submitted", "rating": feedback.rating}


@router.get("/{prescription_id}/download")
async def download_prescription(
    prescription_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Generate a .docx file for the prescription, upload to storage, and return a signed URL.
    Uses edited_output if available, otherwise output_text.
    """
    user_id = current_user["user_id"]
    prescription = _verify_prescription_ownership(prescription_id, user_id)

    prescription_text = prescription.get("edited_output") or prescription.get("output_text") or ""
    if not prescription_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prescription has no content to export",
        )

    # Fetch doctor header info
    user_result = (
        db.table("users")
        .select("name, crm, crm_state, specialty, prescription_header")
        .eq("id", user_id)
        .single()
        .execute()
    )
    user_data = user_result.data or {}
    prescription_header = user_data.get("prescription_header") or {
        "name": user_data.get("name", ""),
        "crm": user_data.get("crm", ""),
        "state": user_data.get("crm_state", ""),
        "specialty": user_data.get("specialty", ""),
    }

    # Fetch patient info
    patient_id = prescription.get("patient_id")
    patient: dict = {}
    if patient_id:
        p_result = (
            db.table("patients")
            .select("name, birth_date")
            .eq("id", patient_id)
            .single()
            .execute()
        )
        if p_result.data:
            patient = p_result.data
            # Compute age
            from datetime import date

            birth_date = patient.get("birth_date")
            if birth_date:
                try:
                    bd = date.fromisoformat(str(birth_date))
                    today = date.today()
                    patient["age"] = (
                        today.year
                        - bd.year
                        - ((today.month, today.day) < (bd.month, bd.day))
                    )
                except Exception:
                    patient["age"] = None

    # Generate DOCX bytes
    docx_bytes = generate_docx(prescription_text, prescription_header, patient)

    # Upload to storage
    patient_name = (patient.get("name") or "paciente").replace(" ", "_")
    filename = f"Prescricao_{patient_name}_{prescription_id[:8]}.docx"
    storage_path = upload_docx(docx_bytes, filename, user_id)

    # Update prescription with docx_url
    db.table("prescriptions").update(
        {"docx_url": storage_path, "updated_at": datetime.utcnow().isoformat()}
    ).eq("id", prescription_id).execute()

    # Return signed URL
    signed_url = get_signed_url(storage_path)
    return {"download_url": signed_url, "filename": filename}


@router.post("/{prescription_id}/chat", response_model=PrescriptionResponse)
async def chat_update_prescription(
    prescription_id: str,
    message: ChatMessage,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """
    Continue the prescription conversation (MODO ATUALIZAÇÃO).
    Appends user message to conversation history and generates updated output.
    """
    user_id = current_user["user_id"]
    prescription = _verify_prescription_ownership(prescription_id, user_id)
    user_row = current_user.get("db_row")

    patient_id = prescription.get("patient_id")
    patient: dict = {}
    if patient_id:
        p_result = (
            db.table("patients")
            .select("*")
            .eq("id", patient_id)
            .single()
            .execute()
        )
        patient = p_result.data or {}

    # Fetch conversation history from conversations table
    conv_result = (
        db.table("conversations")
        .select("*")
        .eq("prescription_id", prescription_id)
        .order("created_at", desc=False)
        .execute()
    )
    conv_rows = conv_result.data or []
    conversation: list[dict] = []

    # Build initial context from original prescription if no history
    if not conv_rows:
        original_text = prescription.get("edited_output") or prescription.get("output_text") or ""
        if original_text:
            conversation.append(
                {
                    "role": "assistant",
                    "content": original_text,
                }
            )
    else:
        for row in conv_rows:
            conversation.append({"role": row["role"], "content": row["content"]})

    # Append the new user message
    conversation.append({"role": "user", "content": message.content})

    # Fetch actives
    actives_result = (
        db.table("actives").select("*").eq("status", "active").execute()
    )
    actives = actives_result.data or []

    doctor_prefs = {
        "injectables": (user_row or {}).get("pref_injectables", False),
        "injectables_detail": (user_row or {}).get("pref_injectables_detail", ""),
        "hormones": (user_row or {}).get("pref_hormones", True),
        "anabolics": (user_row or {}).get("pref_anabolics", False),
    }

    # Generate updated output with full conversation context
    from datetime import date

    birth_date = patient.get("birth_date")
    age = None
    if birth_date:
        try:
            bd = date.fromisoformat(str(birth_date))
            today = date.today()
            age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
        except Exception:
            pass
    patient["age"] = age

    new_output = await generate_prescription(
        patient_data=patient,
        exams=[],
        history=[],
        actives=actives,
        doctor_prefs=doctor_prefs,
        conversation=conversation,
    )

    # Save conversation rows
    db.table("conversations").insert(
        {"prescription_id": prescription_id, "role": "user", "content": message.content}
    ).execute()
    db.table("conversations").insert(
        {"prescription_id": prescription_id, "role": "assistant", "content": new_output}
    ).execute()

    # Update prescription with new output
    result = (
        db.table("prescriptions")
        .update(
            {
                "edited_output": new_output,
                "updated_at": datetime.utcnow().isoformat(),
            }
        )
        .eq("id", prescription_id)
        .select()
        .single()
        .execute()
    )
    return result.data
