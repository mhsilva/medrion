"""
Pharmacy routes for Medrion.
Routes for pharmacy_admin users and public invite validation.
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Any
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from app.database import db
from app.middleware.auth import get_current_user
from app.services.docx_service import generate_docx
from app.services.email_service import send_prescription_to_pharmacy
from app.models.schemas import (
    PharmacyOnboardingStep1,
    PharmacyOnboardingStep2,
    PharmacyResponse,
    PharmacyDoctorResponse,
    PharmacyInviteCreate,
    PharmacyBulkInviteCreate,
    InviteValidateResponse,
)
from app.services.email_service import send_pharmacy_invite_email

router = APIRouter(prefix="/pharmacies", tags=["pharmacies"])
invites_router = APIRouter(prefix="/invites", tags=["invites"])


def _require_pharmacy_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") not in ("pharmacy_admin", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores de farmácia",
        )
    return current_user


# ---------------------------------------------------------------------------
# Onboarding
# ---------------------------------------------------------------------------


@router.post("/onboarding/step1")
async def pharmacy_onboarding_step1(
    data: PharmacyOnboardingStep1,
    current_user: dict = Depends(get_current_user),
) -> Any:
    user_id = current_user["user_id"]

    existing_pharmacy = (
        db.table("pharmacies")
        .select("id")
        .eq("cnpj", data.cnpj)
        .execute()
    )
    if existing_pharmacy.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CNPJ já cadastrado",
        )

    db.table("pharmacies").insert(
        {
            "name": data.name,
            "cnpj": data.cnpj,
            "responsible_name": data.responsible_name,
            "responsible_email": data.responsible_email,
            "phone": data.phone,
            "subscription_status": "active",
            "plan_seats": 10,
        }
    ).execute()

    pharmacy_result = (
        db.table("pharmacies").select("*").eq("cnpj", data.cnpj).single().execute()
    )

    if not pharmacy_result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar farmácia",
        )

    pharmacy_id = pharmacy_result.data["id"]

    db.table("users").update(
        {"pharmacy_id": pharmacy_id, "role": "pharmacy_admin"}
    ).eq("id", user_id).execute()

    return pharmacy_result.data


@router.post("/onboarding/step2")
async def pharmacy_onboarding_step2(
    data: PharmacyOnboardingStep2,
    current_user: dict = Depends(get_current_user),
) -> Any:
    user_id = current_user["user_id"]
    now = datetime.now(timezone.utc).isoformat()

    records = [
        {
            "user_id": user_id,
            "document_type": doc_type,
            "accepted_at": now,
        }
        for doc_type in data.document_types
    ]
    db.table("legal_acceptances").insert(records).execute()

    db.table("users").update({"onboarding_completed": True}).eq("id", user_id).execute()

    return {"accepted_at": now}


# ---------------------------------------------------------------------------
# Pharmacy profile
# ---------------------------------------------------------------------------


@router.get("/me", response_model=PharmacyResponse)
async def get_my_pharmacy(
    current_user: dict = Depends(_require_pharmacy_admin),
) -> Any:
    user_id = current_user["user_id"]

    user_result = db.table("users").select("pharmacy_id").eq("id", user_id).single().execute()
    pharmacy_id = user_result.data and user_result.data.get("pharmacy_id")
    if not pharmacy_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmácia não encontrada")

    result = db.table("pharmacies").select("*").eq("id", pharmacy_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmácia não encontrada")
    return result.data


@router.put("/me", response_model=PharmacyResponse)
async def update_my_pharmacy(
    data: dict,
    current_user: dict = Depends(_require_pharmacy_admin),
) -> Any:
    user_id = current_user["user_id"]
    user_result = db.table("users").select("pharmacy_id").eq("id", user_id).single().execute()
    pharmacy_id = user_result.data and user_result.data.get("pharmacy_id")
    if not pharmacy_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmácia não encontrada")

    allowed = {"name", "responsible_name", "responsible_email", "phone"}
    update_data = {k: v for k, v in data.items() if k in allowed}
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nenhum campo para atualizar")

    db.table("pharmacies").update(update_data).eq("id", pharmacy_id).execute()
    result = db.table("pharmacies").select("*").eq("id", pharmacy_id).single().execute()
    return result.data


# ---------------------------------------------------------------------------
# Doctors management
# ---------------------------------------------------------------------------


@router.get("/me/doctors")
async def list_pharmacy_doctors(
    current_user: dict = Depends(_require_pharmacy_admin),
) -> Any:
    user_id = current_user["user_id"]
    user_result = db.table("users").select("pharmacy_id").eq("id", user_id).single().execute()
    pharmacy_id = user_result.data and user_result.data.get("pharmacy_id")
    if not pharmacy_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmácia não encontrada")

    links = db.table("pharmacy_doctors").select("doctor_id").eq("pharmacy_id", pharmacy_id).eq("status", "active").execute()
    doctor_ids = [r["doctor_id"] for r in (links.data or [])]
    if not doctor_ids:
        return []
    result = (
        db.table("users")
        .select("id, name, email, subscription_status, last_login_at, created_at")
        .in_("id", doctor_ids)
        .order("name")
        .execute()
    )
    return result.data or []


@router.delete("/me/doctors/{doctor_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_pharmacy_doctor(
    doctor_user_id: str,
    current_user: dict = Depends(_require_pharmacy_admin),
) -> None:
    user_id = current_user["user_id"]
    user_result = db.table("users").select("pharmacy_id").eq("id", user_id).single().execute()
    pharmacy_id = user_result.data and user_result.data.get("pharmacy_id")
    if not pharmacy_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmácia não encontrada")

    link = db.table("pharmacy_doctors").select("id").eq("pharmacy_id", pharmacy_id).eq("doctor_id", doctor_user_id).eq("status", "active").execute()
    if not link.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Médico não encontrado nesta farmácia")

    db.table("pharmacy_doctors").update({"status": "removed"}).eq("pharmacy_id", pharmacy_id).eq("doctor_id", doctor_user_id).execute()


# ---------------------------------------------------------------------------
# Invites
# ---------------------------------------------------------------------------


def _get_pharmacy_id(user_id: str) -> str:
    user_result = db.table("users").select("pharmacy_id").eq("id", user_id).single().execute()
    pharmacy_id = user_result.data and user_result.data.get("pharmacy_id")
    if not pharmacy_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmácia não encontrada")
    return pharmacy_id


def _create_invite(pharmacy_id: str, pharmacy_name: str, email: str) -> dict:
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    existing = (
        db.table("pharmacy_invites")
        .select("id, status")
        .eq("pharmacy_id", pharmacy_id)
        .eq("email", email)
        .eq("status", "pending")
        .execute()
    )
    if existing.data:
        return {"email": email, "status": "already_pending"}

    db.table("pharmacy_invites").insert(
        {
            "pharmacy_id": pharmacy_id,
            "email": email,
            "token": token,
            "status": "pending",
            "expires_at": expires_at,
        }
    ).execute()

    try:
        send_pharmacy_invite_email(email, pharmacy_name, token)
    except Exception:
        pass

    existing_user = db.table("users").select("id").eq("email", email).execute()
    if existing_user.data:
        db.table("notifications").insert({
            "user_id": existing_user.data[0]["id"],
            "type": "invite",
            "message": json.dumps({
                "text": f"A farmácia {pharmacy_name} te convidou para colaborar na plataforma.",
                "token": token,
            }),
            "read": False,
        }).execute()

    return {"email": email, "status": "invited", "token": token}


@router.post("/me/invite")
async def invite_doctor(
    data: PharmacyInviteCreate,
    current_user: dict = Depends(_require_pharmacy_admin),
) -> Any:
    user_id = current_user["user_id"]
    pharmacy_id = _get_pharmacy_id(user_id)

    pharmacy = db.table("pharmacies").select("name").eq("id", pharmacy_id).single().execute()
    pharmacy_name = pharmacy.data["name"] if pharmacy.data else "Farmácia"

    return _create_invite(pharmacy_id, pharmacy_name, data.email.lower().strip())


@router.post("/me/invite/bulk")
async def invite_doctors_bulk(
    data: PharmacyBulkInviteCreate,
    current_user: dict = Depends(_require_pharmacy_admin),
) -> Any:
    user_id = current_user["user_id"]
    pharmacy_id = _get_pharmacy_id(user_id)

    pharmacy = db.table("pharmacies").select("name").eq("id", pharmacy_id).single().execute()
    pharmacy_name = pharmacy.data["name"] if pharmacy.data else "Farmácia"

    results = []
    for email in data.emails:
        email = email.lower().strip()
        if not email:
            continue
        result = _create_invite(pharmacy_id, pharmacy_name, email)
        results.append(result)

    return {"results": results, "total": len(results)}


@router.get("/me/prescriptions")
async def list_pharmacy_prescriptions(
    current_user: dict = Depends(_require_pharmacy_admin),
) -> Any:
    user_id = current_user["user_id"]
    pharmacy_id = _get_pharmacy_id(user_id)

    links = db.table("pharmacy_doctors").select("doctor_id").eq("pharmacy_id", pharmacy_id).eq("status", "active").execute()
    doctor_ids = [r["doctor_id"] for r in (links.data or [])]
    if not doctor_ids:
        return []

    result = (
        db.table("prescriptions")
        .select("id, patient_id, user_id, status, created_at, docx_url, patients(name)")
        .in_("user_id", doctor_ids)
        .eq("status", "final")
        .order("created_at", desc=True)
        .limit(500)
        .execute()
    )
    return result.data or []


@router.get("/me/prescriptions/{prescription_id}/download")
async def download_pharmacy_prescription(
    prescription_id: str,
    current_user: dict = Depends(_require_pharmacy_admin),
) -> Any:
    user_id = current_user["user_id"]
    pharmacy_id = _get_pharmacy_id(user_id)

    prescription_result = (
        db.table("prescriptions").select("*").eq("id", prescription_id).single().execute()
    )
    if not prescription_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescrição não encontrada")
    prescription = prescription_result.data

    link = db.table("pharmacy_doctors").select("id").eq("pharmacy_id", pharmacy_id).eq("doctor_id", prescription["user_id"]).execute()
    if not link.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")

    doctor_result = (
        db.table("users")
        .select("name, crm, crm_state, specialty, prescription_header")
        .eq("id", prescription["user_id"])
        .single()
        .execute()
    )
    if not doctor_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Médico não encontrado")

    prescription_text = prescription.get("edited_output") or prescription.get("output_text") or ""
    if not prescription_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prescrição sem conteúdo")

    doctor_data = doctor_result.data
    prescription_header = doctor_data.get("prescription_header") or {
        "name": doctor_data.get("name", ""),
        "crm": doctor_data.get("crm", ""),
        "state": doctor_data.get("crm_state", ""),
        "specialty": doctor_data.get("specialty", ""),
    }

    patient: dict = {}
    if prescription.get("patient_id"):
        p_result = db.table("patients").select("name, birth_date").eq("id", prescription["patient_id"]).single().execute()
        if p_result.data:
            patient = p_result.data
            from datetime import date
            birth_date = patient.get("birth_date")
            if birth_date:
                try:
                    bd = date.fromisoformat(str(birth_date))
                    today = date.today()
                    patient["age"] = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
                except Exception:
                    patient["age"] = None

    docx_bytes = generate_docx(prescription_text, prescription_header, patient)
    patient_name = (patient.get("name") or "paciente").replace(" ", "_")
    filename = f"Prescricao_{patient_name}_{prescription_id[:8]}.docx"

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/me/prescriptions/{prescription_id}/send-email")
async def send_prescription_email(
    prescription_id: str,
    current_user: dict = Depends(_require_pharmacy_admin),
) -> Any:
    user_id = current_user["user_id"]
    pharmacy_id = _get_pharmacy_id(user_id)

    pharmacy_result = db.table("pharmacies").select("*").eq("id", pharmacy_id).single().execute()
    if not pharmacy_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmácia não encontrada")
    pharmacy = pharmacy_result.data

    prescription_result = (
        db.table("prescriptions").select("*").eq("id", prescription_id).single().execute()
    )
    if not prescription_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescrição não encontrada")
    prescription = prescription_result.data

    link = db.table("pharmacy_doctors").select("id").eq("pharmacy_id", pharmacy_id).eq("doctor_id", prescription["user_id"]).execute()
    if not link.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")

    doctor_result = (
        db.table("users")
        .select("name, crm, crm_state, specialty, prescription_header")
        .eq("id", prescription["user_id"])
        .single()
        .execute()
    )
    if not doctor_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Médico não encontrado")

    prescription_text = prescription.get("edited_output") or prescription.get("output_text") or ""
    if not prescription_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prescrição sem conteúdo")

    doctor_data = doctor_result.data
    prescription_header = doctor_data.get("prescription_header") or {
        "name": doctor_data.get("name", ""),
        "crm": doctor_data.get("crm", ""),
        "state": doctor_data.get("crm_state", ""),
        "specialty": doctor_data.get("specialty", ""),
    }

    patient: dict = {}
    if prescription.get("patient_id"):
        p_result = db.table("patients").select("name, birth_date").eq("id", prescription["patient_id"]).single().execute()
        if p_result.data:
            patient = p_result.data

    docx_bytes = generate_docx(prescription_text, prescription_header, patient)
    patient_name = patient.get("name") or "Paciente"
    to_email = pharmacy.get("responsible_email") or ""

    if not to_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Farmácia sem e-mail cadastrado")

    send_prescription_to_pharmacy(to_email, docx_bytes, patient_name)

    db.table("prescriptions").update(
        {"pharmacy_notified_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", prescription_id).execute()

    return {"status": "sent", "to": to_email}


# ---------------------------------------------------------------------------
# Public invite validation + acceptance
# ---------------------------------------------------------------------------


@invites_router.get("/validate/{token}", response_model=InviteValidateResponse)
async def validate_invite(token: str) -> Any:
    result = (
        db.table("pharmacy_invites")
        .select("*, pharmacies(name)")
        .eq("token", token)
        .eq("status", "pending")
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Convite inválido ou expirado",
        )

    invite = result.data
    expires_at = invite.get("expires_at")
    if expires_at:
        from datetime import datetime as dt
        exp = dt.fromisoformat(expires_at.replace("Z", "+00:00"))
        if dt.now(timezone.utc) > exp:
            db.table("pharmacy_invites").update({"status": "expired"}).eq("token", token).execute()
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Convite expirado",
            )

    pharmacy_name = ""
    if invite.get("pharmacies"):
        pharmacy_name = invite["pharmacies"].get("name", "")

    return {
        "email": invite["email"],
        "pharmacy_name": pharmacy_name,
        "pharmacy_id": invite["pharmacy_id"],
        "token": token,
    }


@invites_router.post("/accept/{token}")
async def accept_invite(
    token: str,
    current_user: dict = Depends(get_current_user),
) -> Any:
    user_id = current_user["user_id"]

    result = (
        db.table("pharmacy_invites")
        .select("*")
        .eq("token", token)
        .eq("status", "pending")
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Convite inválido ou expirado",
        )

    invite = result.data

    user = db.table("users").select("email").eq("id", user_id).single().execute()
    if not user.data or user.data["email"].lower() != invite["email"].lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este convite pertence a outro e-mail",
        )

    db.table("pharmacy_doctors").upsert(
        {"pharmacy_id": invite["pharmacy_id"], "doctor_id": user_id, "status": "active"},
        on_conflict="pharmacy_id,doctor_id",
    ).execute()

    db.table("users").update({"subscription_status": "active"}).eq("id", user_id).execute()

    db.table("pharmacy_invites").update({"status": "accepted"}).eq("token", token).execute()

    return {"status": "accepted", "pharmacy_id": invite["pharmacy_id"]}
