from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


class UserProfile(BaseModel):
    id: UUID
    email: str
    name: Optional[str] = None
    role: Optional[str] = "doctor"
    crm: Optional[str] = None
    crm_state: Optional[str] = None
    specialty: Optional[str] = None
    phone: Optional[str] = None
    subscription_status: Optional[str] = None
    trial_ends_at: Optional[datetime] = None
    trial_prescriptions_used: Optional[int] = 0
    pref_injectables: Optional[bool] = False
    pref_injectables_detail: Optional[str] = None
    pref_hormones: Optional[bool] = True
    pref_anabolics: Optional[bool] = False
    prescription_header: Optional[Dict[str, Any]] = None
    onboarding_completed: Optional[bool] = False


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    crm: Optional[str] = None
    crm_state: Optional[str] = None
    specialty: Optional[str] = None
    phone: Optional[str] = None
    pref_injectables: Optional[bool] = None
    pref_injectables_detail: Optional[str] = None
    pref_hormones: Optional[bool] = None
    pref_anabolics: Optional[bool] = None
    prescription_header: Optional[Dict[str, Any]] = None
    onboarding_completed: Optional[bool] = None


class OnboardingStep1(BaseModel):
    name: str
    crm: str
    crm_state: str
    specialty: str
    phone: Optional[str] = None
    preferred_name: Optional[str] = None
    pref_injectables: bool = False
    pref_injectables_detail: Optional[str] = None
    pref_hormones: bool = True
    pref_anabolics: bool = False


class OnboardingStep2(BaseModel):
    prescription_header: Dict[str, Any] = Field(
        ...,
        description=(
            "Keys: name, crm, state, specialty, address, phone, email, logo_url (optional)"
        ),
    )


class LegalAcceptance(BaseModel):
    document_types: List[str]


# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------


class PatientCreate(BaseModel):
    name: str
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    main_complaints: Optional[str] = None
    therapeutic_objective: Optional[str] = None
    current_medications: Optional[str] = None
    lifestyle: Optional[str] = None
    doctor_notes: Optional[str] = None


class PatientUpdate(BaseModel):
    name: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    main_complaints: Optional[str] = None
    therapeutic_objective: Optional[str] = None
    current_medications: Optional[str] = None
    lifestyle: Optional[str] = None
    doctor_notes: Optional[str] = None


class PatientResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    main_complaints: Optional[str] = None
    therapeutic_objective: Optional[str] = None
    current_medications: Optional[str] = None
    lifestyle: Optional[str] = None
    doctor_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    age: Optional[int] = None

    @field_validator("age", mode="before")
    @classmethod
    def compute_age(cls, v: Any, info: Any) -> Optional[int]:
        # age is computed from birth_date in the API layer; accept as-is here
        return v


# ---------------------------------------------------------------------------
# Exams
# ---------------------------------------------------------------------------


class ExamCreate(BaseModel):
    input_method: Literal["structured", "freetext"]
    raw_text: str
    patient_id: UUID


class ExamResponse(BaseModel):
    id: UUID
    patient_id: UUID
    input_method: Optional[str] = None
    raw_text: Optional[str] = None
    file_url: Optional[str] = None
    file_type: Optional[str] = None
    created_at: Optional[datetime] = None


class HematologicalPanel(BaseModel):
    hemoglobin: Optional[float] = None
    hematocrit: Optional[float] = None
    rbc: Optional[float] = None
    mcv: Optional[float] = None
    mch: Optional[float] = None
    mchc: Optional[float] = None
    rdw: Optional[float] = None
    wbc: Optional[float] = None
    neutrophils: Optional[float] = None
    lymphocytes: Optional[float] = None
    monocytes: Optional[float] = None
    eosinophils: Optional[float] = None
    basophils: Optional[float] = None
    platelets: Optional[float] = None


class MetabolicPanel(BaseModel):
    fasting_glucose: Optional[float] = None
    hba1c: Optional[float] = None
    insulin: Optional[float] = None
    homa_ir: Optional[float] = None
    uric_acid: Optional[float] = None


class LipidPanel(BaseModel):
    total_cholesterol: Optional[float] = None
    hdl: Optional[float] = None
    ldl: Optional[float] = None
    vldl: Optional[float] = None
    triglycerides: Optional[float] = None
    non_hdl: Optional[float] = None


class HormonalMalePanel(BaseModel):
    total_testosterone: Optional[float] = None
    free_testosterone: Optional[float] = None
    shbg: Optional[float] = None
    lh: Optional[float] = None
    fsh: Optional[float] = None
    estradiol: Optional[float] = None
    prolactin: Optional[float] = None
    dhea_s: Optional[float] = None
    igf1: Optional[float] = None
    gh: Optional[float] = None
    psa: Optional[float] = None


class HormonalFemalePanel(BaseModel):
    estradiol: Optional[float] = None
    progesterone: Optional[float] = None
    lh: Optional[float] = None
    fsh: Optional[float] = None
    prolactin: Optional[float] = None
    dhea_s: Optional[float] = None
    testosterone: Optional[float] = None
    shbg: Optional[float] = None
    amh: Optional[float] = None
    igf1: Optional[float] = None


class ThyroidPanel(BaseModel):
    tsh: Optional[float] = None
    t4_free: Optional[float] = None
    t3_free: Optional[float] = None
    t4_total: Optional[float] = None
    t3_total: Optional[float] = None
    anti_tpo: Optional[float] = None
    anti_tg: Optional[float] = None


class VitaminsMineralsPanel(BaseModel):
    vitamin_d: Optional[float] = None
    vitamin_b12: Optional[float] = None
    folate: Optional[float] = None
    ferritin: Optional[float] = None
    serum_iron: Optional[float] = None
    transferrin_saturation: Optional[float] = None
    magnesium: Optional[float] = None
    zinc: Optional[float] = None
    copper: Optional[float] = None
    selenium: Optional[float] = None
    calcium: Optional[float] = None
    phosphorus: Optional[float] = None
    potassium: Optional[float] = None
    sodium: Optional[float] = None


class HepaticPanel(BaseModel):
    ast: Optional[float] = None
    alt: Optional[float] = None
    ggt: Optional[float] = None
    alkaline_phosphatase: Optional[float] = None
    total_bilirubin: Optional[float] = None
    direct_bilirubin: Optional[float] = None
    albumin: Optional[float] = None
    total_protein: Optional[float] = None


class RenalPanel(BaseModel):
    creatinine: Optional[float] = None
    urea: Optional[float] = None
    uric_acid: Optional[float] = None
    egfr: Optional[float] = None
    cystatin_c: Optional[float] = None


class InflammationPanel(BaseModel):
    crp: Optional[float] = None
    hs_crp: Optional[float] = None
    esr: Optional[float] = None
    il6: Optional[float] = None
    tnf_alpha: Optional[float] = None
    fibrinogen: Optional[float] = None
    homocysteine: Optional[float] = None


class StructuredExam(BaseModel):
    hematological: Optional[HematologicalPanel] = None
    metabolic: Optional[MetabolicPanel] = None
    lipid: Optional[LipidPanel] = None
    hormonal_male: Optional[HormonalMalePanel] = None
    hormonal_female: Optional[HormonalFemalePanel] = None
    thyroid: Optional[ThyroidPanel] = None
    vitamins_minerals: Optional[VitaminsMineralsPanel] = None
    hepatic: Optional[HepaticPanel] = None
    renal: Optional[RenalPanel] = None
    inflammation: Optional[InflammationPanel] = None


# ---------------------------------------------------------------------------
# Prescriptions
# ---------------------------------------------------------------------------


class PrescriptionCreate(BaseModel):
    patient_id: UUID
    additional_context: str = ""


class PrescriptionUpdate(BaseModel):
    edited_output: str


class PrescriptionResponse(BaseModel):
    id: UUID
    patient_id: UUID
    user_id: UUID
    status: Optional[str] = None
    output_text: Optional[str] = None
    edited_output: Optional[str] = None
    docx_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class FeedbackSubmit(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str = ""


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    content: str
    current_text: str | None = None


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------


class ActiveCreate(BaseModel):
    name: str
    category: Optional[str] = None
    route: Optional[str] = None
    zone: Optional[str] = None
    description: Optional[str] = None
    typical_dose: Optional[str] = None
    contraindications: Optional[str] = None
    alerts: Optional[str] = None
    status: Optional[str] = "draft"


class ActiveUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    route: Optional[str] = None
    zone: Optional[str] = None
    description: Optional[str] = None
    typical_dose: Optional[str] = None
    contraindications: Optional[str] = None
    alerts: Optional[str] = None
    status: Optional[str] = None


class UrgentAlertCreate(BaseModel):
    title: str
    description: str
    source: Optional[str] = None
    severity: Optional[str] = None
    show_on_login: bool = False
    active_id: Optional[UUID] = None


# ---------------------------------------------------------------------------
# Pharmacy
# ---------------------------------------------------------------------------


class PharmacyOnboardingStep1(BaseModel):
    name: str
    cnpj: str
    responsible_name: str
    responsible_email: str
    phone: str


class PharmacyOnboardingStep2(BaseModel):
    document_types: List[str]


class PharmacyResponse(BaseModel):
    id: UUID
    name: str
    cnpj: str
    responsible_name: Optional[str] = None
    responsible_email: Optional[str] = None
    phone: Optional[str] = None
    plan_seats: Optional[int] = None
    subscription_status: Optional[str] = None
    created_at: Optional[datetime] = None


class PharmacyInviteCreate(BaseModel):
    email: str


class PharmacyBulkInviteCreate(BaseModel):
    emails: List[str]


class PharmacyDoctorResponse(BaseModel):
    id: UUID
    name: Optional[str] = None
    email: str
    subscription_status: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class InviteValidateResponse(BaseModel):
    email: str
    pharmacy_name: str
    pharmacy_id: UUID
    token: str
