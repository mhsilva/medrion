"""
Authentication routes for Medrion.

Approach:
- Supabase Auth issues JWTs as usual (email/password or Google OAuth).
- After a successful Supabase login, the frontend calls POST /auth/start-session.
  This endpoint:
    1. issues a fresh server session_id (single-session enforcement)
    2. generates a 6-digit OTP, emails it (Resend)
    3. marks last_login_at and clears mfa_verified_at via the same flow
- Frontend collects the OTP and calls POST /auth/verify-otp. On success the
  user's mfa_verified_at is set to NOW() and the middleware unblocks them.
- POST /auth/resend-otp issues a new code (rate-limited by lockout window).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.database import db
from app.middleware.auth import get_current_user
from app.services import auth_service
from app.services.email_service import send_otp_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/start-session")
async def start_session(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Called by the frontend immediately after Supabase auth completes.
    Issues a new session_id and emails a fresh OTP.
    """
    user_id = current_user["user_id"]
    email = current_user.get("email") or ""

    session_id = auth_service.issue_session(user_id)

    code = auth_service.generate_otp_for_user(user_id)
    if code is None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Conta temporariamente bloqueada por excesso de tentativas. Aguarde 30 minutos.",
        )
    if email:
        try:
            send_otp_email(email, code)
        except Exception:
            pass

    return {"session_id": session_id, "mfa_required": True}


@router.post("/verify-otp")
async def verify_otp(
    payload: dict[str, Any],
    current_user: dict = Depends(get_current_user),
    x_session_id: str = Header(default=""),
) -> dict:
    code = (payload.get("code") or "").strip()
    if not code or len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código inválido")

    user_id = current_user["user_id"]
    if not auth_service.session_matches(user_id, x_session_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida")

    ok, msg = auth_service.verify_otp_for_user(user_id, code)
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=msg)
    return {"ok": True, "message": msg}


@router.post("/resend-otp")
async def resend_otp(
    current_user: dict = Depends(get_current_user),
    x_session_id: str = Header(default=""),
) -> dict:
    user_id = current_user["user_id"]
    if not auth_service.session_matches(user_id, x_session_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida")

    code = auth_service.generate_otp_for_user(user_id)
    if code is None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Aguarde antes de solicitar um novo código",
        )

    user_row = db.table("users").select("email").eq("id", user_id).single().execute().data
    email = user_row and user_row.get("email")
    if email:
        try:
            send_otp_email(email, code)
        except Exception:
            pass
    return {"ok": True}
