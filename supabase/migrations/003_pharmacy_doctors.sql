-- Pharmacy–Doctor seat links
-- A doctor can belong to at most one pharmacy at a time (UNIQUE on doctor_id).
CREATE TABLE IF NOT EXISTS public.pharmacy_doctors (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  doctor_id   UUID NOT NULL REFERENCES public.users(id)     ON DELETE CASCADE,
  status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_doctors_pharmacy_id
  ON public.pharmacy_doctors(pharmacy_id);
