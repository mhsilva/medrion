"""
Supabase Storage service for Medrion.
Handles uploading and generating signed URLs for prescription DOCX files and exam uploads.
"""

import uuid
from datetime import datetime

from app.database import db


def upload_docx(file_bytes: bytes, filename: str, user_id: str) -> str:
    """
    Upload a DOCX file to the 'prescriptions' Supabase Storage bucket.

    Args:
        file_bytes: Raw bytes of the .docx file.
        filename: Desired filename (without path).
        user_id: The authenticated doctor's user ID.

    Returns:
        The storage path (relative to bucket root).
    """
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    path = f"{user_id}/{timestamp}_{unique_id}_{filename}"

    db.storage.from_("prescriptions").upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    )
    return path


def get_signed_url(path: str, expires_in: int = 3600) -> str:
    """
    Generate a signed URL for a file in Supabase Storage.

    Args:
        path: The storage path (as returned by upload functions).
        expires_in: Seconds until the URL expires (default 1 hour).

    Returns:
        A signed URL string.
    """
    # Determine bucket from path prefix convention
    if path.startswith("exams/") or path.startswith("uploads/"):
        bucket = "uploads"
    else:
        bucket = "prescriptions"

    response = db.storage.from_(bucket).create_signed_url(path, expires_in)
    return response.get("signedURL") or response.get("signed_url") or ""


def upload_exam_file(file_bytes: bytes, filename: str, patient_id: str) -> str:
    """
    Upload an exam file (PDF, image, DOCX) to the 'uploads' Supabase Storage bucket.

    Args:
        file_bytes: Raw bytes of the file.
        filename: Original filename.
        patient_id: The patient's UUID.

    Returns:
        The storage path (relative to bucket root).
    """
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    safe_name = filename.replace(" ", "_")
    path = f"exams/{patient_id}/{timestamp}_{unique_id}_{safe_name}"

    # Determine content type from extension
    lower = filename.lower()
    if lower.endswith(".pdf"):
        content_type = "application/pdf"
    elif lower.endswith(".docx"):
        content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif lower.endswith(".png"):
        content_type = "image/png"
    elif lower.endswith(".jpg") or lower.endswith(".jpeg"):
        content_type = "image/jpeg"
    elif lower.endswith(".gif"):
        content_type = "image/gif"
    elif lower.endswith(".webp"):
        content_type = "image/webp"
    else:
        content_type = "application/octet-stream"

    db.storage.from_("uploads").upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": content_type},
    )
    return path
