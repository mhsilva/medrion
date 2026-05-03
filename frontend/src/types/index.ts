export interface User {
  id: string
  email: string
  name: string
  role: 'doctor' | 'admin'
  crm: string
  crm_state: string
  specialty: string
  phone: string
  subscription_status: 'trial' | 'active' | 'suspended' | 'cancelled'
  trial_ends_at: string | null
  trial_prescriptions_used: number
  pref_injectables: boolean
  pref_injectables_detail: string | null
  pref_hormones: boolean
  pref_anabolics: boolean
  prescription_header: PrescriptionHeader | null
  onboarding_completed: boolean
  legal_accepted_at?: string | null
  created_at?: string
}

export interface Patient {
  id: string
  user_id: string
  name: string
  birth_date: string
  gender: 'Masculino' | 'Feminino' | 'Outro'
  weight_kg: number | null
  height_cm: number | null
  main_complaints: string | null
  therapeutic_objective: string | null
  current_medications: string | null
  lifestyle: string | null
  doctor_notes: string | null
  created_at: string
  updated_at: string
  age?: number
  last_prescription_at?: string | null
}

export interface ExamResult {
  id: string
  patient_id: string
  input_method: 'upload' | 'form' | 'text'
  raw_text: string | null
  file_url: string | null
  file_type: string | null
  created_at: string
  structured_data?: Record<string, unknown> | null
}

export type PrescriptionStatus = 'generating' | 'draft' | 'final' | 'error'

export interface Prescription {
  id: string
  patient_id: string
  user_id: string
  status: PrescriptionStatus
  output_text: string | null
  edited_output: string | null
  docx_url: string | null
  feedback_rating: number | null
  feedback_comment?: string | null
  extra_context?: string | null
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: 'info' | 'warning' | 'success' | 'error'
  message: string
  read: boolean
  created_at: string
}

export interface PrescriptionHeader {
  name: string
  crm: string
  state: string
  specialty: string
  address: string
  phone: string
  email: string
  logo_url?: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface ExamPanel {
  label: string
  key: string
  fields: ExamField[]
}

export interface ExamField {
  key: string
  label: string
  unit?: string
}

export interface OnboardingStep1Data {
  name: string
  crm: string
  crm_state: string
  specialty: string
  phone: string
  pref_injectables: boolean
  pref_injectables_detail: string
  pref_hormones: boolean
  pref_anabolics: boolean
}

export interface OnboardingStep2Data {
  prescription_header: PrescriptionHeader
}

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese'
