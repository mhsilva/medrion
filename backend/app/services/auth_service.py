"""
Authentication helpers for Medrion.

- 2FA via email (OTP): generation, hashing, verification, rate-limiting
- Single-session enforcement: per-user current_session_id
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.database import db

OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_LOCK_MINUTES = 30


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_locked(row: dict) -> bool:
    locked_until = row.get("locked_until")
    if not locked_until:
        return False
    try:
        ts = datetime.fromisoformat(str(locked_until).replace("Z", "+00:00"))
        return _now() < ts
    except Exception:
        return False


def generate_otp_for_user(user_id: str) -> Optional[str]:
    """
    Generates a fresh 6-digit OTP for a user, stores its hash,
    and returns the plain code (caller emails it to the user).
    Returns None if the user is currently locked out.
    """
    last = (
        db.table("otp_codes")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if last.data and _is_locked(last.data[0]):
        return None

    code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = (_now() + timedelta(minutes=OTP_TTL_MINUTES)).isoformat()

    db.table("otp_codes").insert({
        "user_id": user_id,
        "code_hash": _hash_code(code),
        "attempts": 0,
        "expires_at": expires_at,
    }).execute()

    return code


def verify_otp_for_user(user_id: str, code: str) -> tuple[bool, str]:
    """
    Verifies the most recent OTP for the user. Returns (ok, message).
    On success: sets users.mfa_verified_at = NOW() and consumes the code.
    On failure: increments attempts and locks the account after OTP_MAX_ATTEMPTS.
    """
    last = (
        db.table("otp_codes")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not last.data:
        return False, "Nenhum código gerado para esta conta."

    row = last.data[0]
    if row.get("consumed_at"):
        return False, "Código já utilizado."
    if _is_locked(row):
        return False, f"Muitas tentativas. Aguarde {OTP_LOCK_MINUTES} minutos."

    expires_at = row.get("expires_at")
    try:
        exp = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
    except Exception:
        return False, "Código inválido."
    if _now() > exp:
        return False, "Código expirado. Solicite um novo."

    if _hash_code(code) != row["code_hash"]:
        attempts = (row.get("attempts") or 0) + 1
        update = {"attempts": attempts}
        if attempts >= OTP_MAX_ATTEMPTS:
            update["locked_until"] = (_now() + timedelta(minutes=OTP_LOCK_MINUTES)).isoformat()
        db.table("otp_codes").update(update).eq("id", row["id"]).execute()
        remaining = max(0, OTP_MAX_ATTEMPTS - attempts)
        if remaining == 0:
            return False, f"Muitas tentativas. Conta bloqueada por {OTP_LOCK_MINUTES} minutos."
        return False, f"Código incorreto. {remaining} tentativa(s) restante(s)."

    db.table("otp_codes").update({"consumed_at": _now().isoformat()}).eq("id", row["id"]).execute()
    db.table("users").update({"mfa_verified_at": _now().isoformat()}).eq("id", user_id).execute()
    return True, "Código verificado."


# ---------------------------------------------------------------------------
# Single-session enforcement
# ---------------------------------------------------------------------------


def issue_session(user_id: str) -> str:
    """
    Generates a new session id, stores it in users.current_session_id,
    and updates last_login_at. Returns the session id (frontend stores
    it and sends as the X-Session-Id header).
    """
    sid = secrets.token_urlsafe(24)
    now = _now().isoformat()
    db.table("users").update({
        "current_session_id": sid,
        "last_login_at": now,
    }).eq("id", user_id).execute()
    return sid


def session_matches(user_id: str, session_id: str) -> bool:
    if not session_id:
        return False
    row = db.table("users").select("current_session_id").eq("id", user_id).single().execute().data
    if not row:
        return False
    stored = row.get("current_session_id")
    return bool(stored) and stored == session_id


def is_mfa_pending(db_row: dict) -> bool:
    """
    Returns True when the current login still needs OTP verification.
    last_login_at > mfa_verified_at (or mfa_verified_at is null).
    """
    last_login = db_row.get("last_login_at")
    mfa_at = db_row.get("mfa_verified_at")
    if not last_login:
        return False  # first request after signup, before any login event
    if not mfa_at:
        return True
    try:
        ll = datetime.fromisoformat(str(last_login).replace("Z", "+00:00"))
        mv = datetime.fromisoformat(str(mfa_at).replace("Z", "+00:00"))
    except Exception:
        return True
    return ll > mv
