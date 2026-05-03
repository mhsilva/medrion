"""
Exam upload and management routes for Medrion.
Supports PDF extraction (PyMuPDF), image OCR (Claude Haiku), and DOCX parsing.
"""

import io
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.database import db
from app.middleware.auth import get_current_user
from app.models.schemas import ExamCreate, ExamResponse
from app.services.anthropic_service import extract_text_from_image
from app.services.storage_service import get_signed_url, upload_exam_file

router = APIRouter(prefix="/exams", tags=["exams"])

SUPPORTED_IMAGE_TYPES = {
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/png": "image/png",
    "image/gif": "image/gif",
    "image/webp": "image/webp",
}


def _verify_patient_belongs_to_user(patient_id: str, user_id: str) -> dict:
    """Verify the patient belongs to the current user."""
    result = (
        db.table("patients")
        .select("id, user_id")
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


def _extract_pdf_text(file_bytes: bytes) -> str:
    """Extract text from a PDF using PyMuPDF."""
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text = "\n".join([page.get_text() for page in doc])
        doc.close()
        return text.strip()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to extract PDF text: {exc}",
        )


def _extract_docx_text(file_bytes: bytes) -> str:
    """Extract text from a DOCX file."""
    try:
        from docx import Document

        doc = Document(io.BytesIO(file_bytes))
        text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        return text.strip()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to extract DOCX text: {exc}",
        )


@router.get("/{patient_id}", response_model=list[ExamResponse])
async def list_exams(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """List all exams for a patient (verifies ownership)."""
    _verify_patient_belongs_to_user(patient_id, current_user["user_id"])

    result = (
        db.table("exam_results")
        .select("*")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True)
        .execute()
    )
    exams = result.data or []

    # Enrich with signed URLs if file_url is a storage path
    enriched = []
    for exam in exams:
        if exam.get("file_url") and not exam["file_url"].startswith("http"):
            try:
                exam["file_url"] = get_signed_url(exam["file_url"])
            except Exception:
                pass
        enriched.append(exam)
    return enriched


@router.post("", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
async def create_exam(
    data: ExamCreate,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """Create an exam record from freetext or structured input."""
    _verify_patient_belongs_to_user(str(data.patient_id), current_user["user_id"])

    exam_record = {
        "patient_id": str(data.patient_id),
        "input_method": data.input_method,
        "raw_text": data.raw_text,
    }

    result = db.table("exam_results").insert(exam_record).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create exam",
        )
    return result.data[0]


@router.post("/upload")
async def upload_exam_file_endpoint(
    file: UploadFile = File(...),
    patient_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Upload an exam file (PDF, image, or DOCX) and extract its text.
    Returns extracted text for doctor confirmation before saving.
    Does NOT save the exam yet — call /confirm to persist.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided"
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file"
        )

    content_type = file.content_type or ""
    filename_lower = (file.filename or "").lower()
    extracted_text = ""
    file_type = ""

    # PDF extraction via PyMuPDF
    if "pdf" in content_type or filename_lower.endswith(".pdf"):
        extracted_text = _extract_pdf_text(file_bytes)
        file_type = "pdf"

    # Image OCR via Claude Haiku
    elif content_type in SUPPORTED_IMAGE_TYPES or any(
        filename_lower.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".gif", ".webp")
    ):
        mime = SUPPORTED_IMAGE_TYPES.get(content_type, "image/jpeg")
        extracted_text = await extract_text_from_image(file_bytes, mime)
        file_type = "image"

    # DOCX text extraction
    elif "wordprocessingml" in content_type or filename_lower.endswith(".docx"):
        extracted_text = _extract_docx_text(file_bytes)
        file_type = "docx"

    else:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {content_type}",
        )

    # Upload file to storage
    storage_path: Optional[str] = None
    if patient_id:
        try:
            _verify_patient_belongs_to_user(patient_id, current_user["user_id"])
            storage_path = upload_exam_file(file_bytes, file.filename, patient_id)
        except HTTPException:
            raise
        except Exception:
            pass  # storage failure is non-fatal at this stage

    return {
        "extracted_text": extracted_text,
        "file_type": file_type,
        "storage_path": storage_path,
        "filename": file.filename,
    }


@router.post("/confirm", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
async def confirm_exam(
    body: dict,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """
    Confirm and save a previously extracted exam text as an exam record.
    Expects: patient_id, raw_text, file_type (optional), storage_path (optional).
    """
    patient_id = body.get("patient_id")
    raw_text = body.get("raw_text", "").strip()
    file_type = body.get("file_type")
    storage_path = body.get("storage_path")

    if not patient_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="patient_id is required"
        )
    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="raw_text is required"
        )

    _verify_patient_belongs_to_user(patient_id, current_user["user_id"])

    exam_record: dict = {
        "patient_id": patient_id,
        "input_method": "freetext",
        "raw_text": raw_text,
    }
    if file_type:
        mime_map = {
            "application/pdf": "pdf",
            "image/jpeg": "image", "image/jpg": "image",
            "image/png": "image", "image/gif": "image", "image/webp": "image",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        }
        exam_record["file_type"] = mime_map.get(file_type, file_type)
    if storage_path:
        exam_record["file_url"] = storage_path

    result = db.table("exam_results").insert(exam_record).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save exam",
        )
    return result.data[0]


@router.get("/detail/{exam_id}", response_model=ExamResponse)
async def get_exam(
    exam_id: str,
    current_user: dict = Depends(get_current_user),
) -> Any:
    """Get a specific exam by ID (verifies patient ownership)."""
    result = (
        db.table("exam_results").select("*").eq("id", exam_id).single().execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found"
        )
    exam = result.data
    # Verify patient ownership
    _verify_patient_belongs_to_user(exam["patient_id"], current_user["user_id"])

    # Enrich with signed URL if needed
    if exam.get("file_url") and not exam["file_url"].startswith("http"):
        try:
            exam["file_url"] = get_signed_url(exam["file_url"])
        except Exception:
            pass
    return exam
