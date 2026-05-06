-- Medrion — Phase 2 Migration: Security + Phase 1 column fixes
-- Run after 001_initial_schema.sql
-- Idempotent (safe to run multiple times).

-- ============================================================
-- finalized_at on prescriptions (STATUS_FASE2 menciona)
-- ============================================================
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

-- ============================================================
-- current_session_id on users (single-session enforcement)
-- ============================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS current_session_id TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Marks the time of the most recent verified 2FA challenge.
-- Middleware compares last_login_at vs mfa_verified_at to block
-- requests until OTP is confirmed for the current session.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMPTZ;

-- ============================================================
-- OTP codes for 2FA via email
-- ============================================================
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id ON public.otp_codes(user_id, created_at DESC);

-- Enforce: at most 1 active (unconsumed and unexpired) OTP per user
-- (cleanup happens via TTL or on new code generation)
