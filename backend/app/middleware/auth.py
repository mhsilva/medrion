from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.database import db

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        response = db.auth.get_user(token)
        supabase_user = response.user
        if not supabase_user:
            raise credentials_exception
    except Exception:
        raise credentials_exception

    user_id = supabase_user.id
    email = supabase_user.email or ""

    try:
        result = (
            db.table("users")
            .select(
                "id, email, role, subscription_status, trial_ends_at, "
                "trial_prescriptions_used, onboarding_completed, "
                "current_session_id, last_login_at, mfa_verified_at"
            )
            .eq("id", user_id)
            .single()
            .execute()
        )
        user_row = result.data
    except Exception:
        user_row = None

    role = "doctor"
    if user_row:
        role = user_row.get("role", "doctor")

    return {
        "user_id": user_id,
        "email": email,
        "role": role,
        "db_row": user_row,
    }


async def get_authenticated_session(
    current_user: dict = Depends(get_current_user),
    x_session_id: str = Header(default=""),
) -> dict:
    """
    Like get_current_user but also enforces:
    - single-session: X-Session-Id header must match users.current_session_id
    - MFA: last_login_at must not exceed mfa_verified_at

    Endpoints that bootstrap the session (POST /auth/start-session,
    /auth/verify-otp, /auth/resend-otp) keep using get_current_user directly.
    """
    db_row = current_user.get("db_row") or {}

    stored_session = db_row.get("current_session_id")
    if stored_session and stored_session != x_session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão encerrada. Faça login novamente.",
            headers={"X-Reason": "session-mismatch"},
        )

    # Lazy import to avoid circular reference at import time
    from app.services import auth_service

    if auth_service.is_mfa_pending(db_row):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verificação por código pendente",
            headers={"X-Reason": "mfa-required"},
        )

    return current_user


async def require_admin(current_user: dict = Depends(get_authenticated_session)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def require_active_subscription(current_user: dict = Depends(get_authenticated_session)) -> dict:
    """
    Blocks doctors with subscription_status='suspended' or 'cancelled' from
    consuming protected resources. Trial without prescriptions remaining is also
    blocked. Admins and pharmacy_admins are not blocked here.
    """
    role = current_user.get("role")
    if role in ("admin", "pharmacy_admin"):
        return current_user

    db_row = current_user.get("db_row") or {}
    sub_status = db_row.get("subscription_status")
    if sub_status in ("suspended", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Acesso suspenso por falta de pagamento",
        )

    if sub_status == "trial":
        used = db_row.get("trial_prescriptions_used") or 0
        if used >= 3:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Limite do trial atingido. Ative seu plano para continuar.",
            )

    return current_user
