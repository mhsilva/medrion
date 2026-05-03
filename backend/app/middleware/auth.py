from fastapi import Depends, HTTPException, status
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
            .select("id, email, role, subscription_status, trial_ends_at, trial_prescriptions_used, onboarding_completed")
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


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
