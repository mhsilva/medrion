from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.config import settings
from app.database import db

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Validate Supabase JWT Bearer token and return user dict with
    user_id, email, and role fetched from public.users.
    """
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError:
        raise credentials_exception

    user_id: str = payload.get("sub")
    email: str = payload.get("email", "")

    if not user_id:
        raise credentials_exception

    # Fetch role from public.users table
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
    """Require the authenticated user to have role='admin'."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
