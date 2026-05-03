-- Medrion — Initial Schema
-- Run this in the Supabase SQL Editor

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PHARMACIES
-- ============================================================
CREATE TABLE public.pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  responsible_name TEXT,
  responsible_email TEXT,
  phone TEXT,
  city TEXT,
  state TEXT,
  plan_seats INTEGER CHECK (plan_seats IN (10, 20, 30)),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'suspended', 'cancelled')),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  prescriptions_used_this_month INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS (extends auth.users)
-- ============================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'doctor' CHECK (role IN ('doctor', 'nutritionist', 'pharmacist', 'pharmacy_admin', 'admin')),
  crm TEXT,
  crm_state TEXT,
  specialty TEXT,
  phone TEXT,
  preferred_name TEXT,
  pharmacy_id UUID REFERENCES public.pharmacies(id),
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'suspended', 'cancelled')),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  trial_prescriptions_used INTEGER DEFAULT 0,
  pref_injectables BOOLEAN DEFAULT FALSE,
  pref_injectables_detail TEXT,
  pref_hormones BOOLEAN DEFAULT TRUE,
  pref_anabolics BOOLEAN DEFAULT FALSE,
  prescription_header JSONB,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, trial_ends_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- LEGAL ACCEPTANCES
-- ============================================================
CREATE TABLE public.legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('terms', 'privacy', 'eula', 'dpa')),
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  document_version TEXT DEFAULT 'v1.0'
);

-- ============================================================
-- PATIENTS
-- ============================================================
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE,
  gender TEXT CHECK (gender IN ('M', 'F', 'outro')),
  weight_kg DECIMAL(5,2),
  height_cm DECIMAL(5,2),
  main_complaints TEXT,
  therapeutic_objective TEXT,
  current_medications TEXT,
  lifestyle TEXT,
  doctor_notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRESCRIPTIONS
-- ============================================================
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'draft', 'final', 'error')),
  document_type TEXT DEFAULT 'medical_prescription' CHECK (document_type IN ('medical_prescription', 'nutritional_plan', 'pharmaceutical_prescription')),
  anamnesis_text TEXT,
  output_text TEXT,
  edited_output TEXT,
  docx_url TEXT,
  feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_comment TEXT,
  pharmacy_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXAM RESULTS
-- ============================================================
CREATE TABLE public.exam_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES public.prescriptions(id),
  input_method TEXT NOT NULL CHECK (input_method IN ('upload', 'structured', 'freetext')),
  raw_text TEXT,
  structured_data JSONB,
  file_url TEXT,
  file_type TEXT CHECK (file_type IN ('pdf', 'docx', 'jpg', 'png')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('payment_failed', 'trial_expiring', 'access_suspended', 'session_killed', 'invite', 'safety_alert', 'payment_confirmed', 'general')),
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PHARMACY INVITES
-- ============================================================
CREATE TABLE public.pharmacy_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACCESS LOGS
-- ============================================================
CREATE TABLE public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('login', 'logout', 'password_reset', '2fa_failed', 'signup')),
  ip_address TEXT,
  device_info TEXT,
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROTOCOL VERSIONS
-- ============================================================
CREATE TABLE public.protocol_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number TEXT NOT NULL,
  description TEXT,
  system_prompt_text TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  is_current BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES public.users(id),
  rolled_back_at TIMESTAMPTZ,
  rollback_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACTIVES (clinical assets bank)
-- ============================================================
CREATE TABLE public.actives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_name TEXT NOT NULL,
  generic_name TEXT,
  supplier TEXT CHECK (supplier IN ('Sovita', 'Galena', 'Fagron', 'Infinity', 'Florien', 'Outro')),
  category TEXT,
  subcategory TEXT,
  route TEXT CHECK (route IN ('oral', 'IM', 'EV', 'transdermico', 'sublingual', 'vaginal')),
  tni_zone TEXT CHECK (tni_zone IN ('Z1', 'Z2', 'Z3', 'RESTRITO')),
  mechanism TEXT,
  indications TEXT,
  dose_min TEXT,
  dose_max TEXT,
  dose_usual TEXT,
  posology TEXT,
  safety_alerts TEXT,
  contraindications TEXT,
  interactions TEXT,
  clinical_notes TEXT,
  last_reviewed_at DATE,
  review_source TEXT,
  allowed_professionals TEXT[] DEFAULT ARRAY['doctor'],
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'discontinued', 'archived')),
  discontinuation_reason TEXT,
  discontinued_at TIMESTAMPTZ,
  protocol_version_id UUID REFERENCES public.protocol_versions(id),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACTIVE CHANGES LOG
-- ============================================================
CREATE TABLE public.active_changes_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_id UUID NOT NULL REFERENCES public.actives(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.users(id),
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'published', 'discontinued', 'archived', 'rollback')),
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAFETY ALERTS URGENT
-- ============================================================
CREATE TABLE public.safety_alerts_urgent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_id UUID REFERENCES public.actives(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT CHECK (source IN ('FDA', 'ANVISA', 'CFM', 'Literatura', 'Outro')),
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium')),
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'resolved')),
  show_on_login BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id)
);

-- ============================================================
-- ACTIVE PREVIEW SESSIONS
-- ============================================================
CREATE TABLE public.active_preview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_id UUID NOT NULL REFERENCES public.actives(id) ON DELETE CASCADE,
  test_anamnesis TEXT,
  api_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- ============================================================
-- ACTIVE USAGE STATS
-- ============================================================
CREATE TABLE public.active_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_id UUID NOT NULL REFERENCES public.actives(id) ON DELETE CASCADE,
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_patients_user_id ON public.patients(user_id);
CREATE INDEX idx_patients_deleted ON public.patients(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_prescriptions_patient_id ON public.prescriptions(patient_id);
CREATE INDEX idx_prescriptions_user_id ON public.prescriptions(user_id);
CREATE INDEX idx_exam_results_patient_id ON public.exam_results(patient_id);
CREATE INDEX idx_conversations_prescription_id ON public.conversations(prescription_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id, read);
CREATE INDEX idx_actives_status ON public.actives(status);
CREATE INDEX idx_actives_category ON public.actives(category);
CREATE INDEX idx_active_usage_stats_active ON public.active_usage_stats(active_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patients_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER prescriptions_updated_at BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER actives_updated_at BEFORE UPDATE ON public.actives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_alerts_urgent ENABLE ROW LEVEL SECURITY;

-- Users: can read/update own profile
CREATE POLICY "users_own" ON public.users
  FOR ALL USING (auth.uid() = id);

-- Patients: own patients only
CREATE POLICY "patients_own" ON public.patients
  FOR ALL USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Prescriptions: own prescriptions only
CREATE POLICY "prescriptions_own" ON public.prescriptions
  FOR ALL USING (auth.uid() = user_id);

-- Exam results: via patient ownership
CREATE POLICY "exams_own" ON public.exam_results
  FOR ALL USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

-- Conversations: via prescription ownership
CREATE POLICY "conversations_own" ON public.conversations
  FOR ALL USING (
    prescription_id IN (SELECT id FROM public.prescriptions WHERE user_id = auth.uid())
  );

-- Notifications: own only
CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

-- Legal acceptances: own only
CREATE POLICY "legal_own" ON public.legal_acceptances
  FOR ALL USING (auth.uid() = user_id);

-- Actives: everyone can read active ones
CREATE POLICY "actives_read" ON public.actives
  FOR SELECT USING (status = 'active');

-- Safety alerts: everyone authenticated can read active ones
CREATE POLICY "alerts_read" ON public.safety_alerts_urgent
  FOR SELECT USING (status = 'active' AND auth.uid() IS NOT NULL);

-- Pharmacy invites: pharmacy admin or the invited email
CREATE POLICY "invites_pharmacy_admin" ON public.pharmacy_invites
  FOR ALL USING (
    pharmacy_id IN (
      SELECT id FROM public.pharmacies WHERE id = (
        SELECT pharmacy_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- ============================================================
-- STORAGE BUCKETS (run via Supabase dashboard or API)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('prescriptions', 'prescriptions', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);
