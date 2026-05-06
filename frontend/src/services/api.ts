import { supabase } from './supabase'
import type {
  User,
  Patient,
  ExamResult,
  Prescription,
  Notification,
  OnboardingStep1Data,
  OnboardingStep2Data,
  ChatMessage,
  Pharmacy,
  PharmacyDoctor,
  PharmacyPrescription,
  InviteValidateResponse,
} from '../types'

function normalizeApiUrl(raw: string | undefined): string {
  if (!raw) return ''
  const url = raw.trim().replace(/\/$/, '')
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL as string | undefined)

const SESSION_KEY = 'medrion.session_id'

export function setSessionId(id: string | null): void {
  if (id) localStorage.setItem(SESSION_KEY, id)
  else localStorage.removeItem(SESSION_KEY)
}

export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const sessionId = getSessionId()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!API_URL) throw new Error('VITE_API_URL não configurado')

  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  })

  if (!res.ok) {
    let errorMessage = `Erro ${res.status}`
    try {
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const body = await res.json()
        errorMessage = body.detail || body.message || errorMessage
      }
    } catch {
      // ignore parse error
    }
    throw new Error(errorMessage)
  }

  if (res.status === 204) return undefined as T

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('Resposta inesperada do servidor')
  }

  return res.json() as Promise<T>
}

// ─── Users ───────────────────────────────────────────────────────────────────

export const usersApi = {
  getProfile: () => request<User>('/users/me'),

  updateProfile: (data: Partial<User>) =>
    request<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  onboardingStep1: (data: OnboardingStep1Data) =>
    request<User>('/users/onboarding/step1', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  onboardingStep2: (data: OnboardingStep2Data) =>
    request<User>('/users/onboarding/step2', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  completeOnboarding: () =>
    request<User>('/users/onboarding/complete', { method: 'POST' }),

  acceptLegal: (types: string[]) =>
    request<{ accepted_at: string }>('/users/legal/accept', {
      method: 'POST',
      body: JSON.stringify({ types }),
    }),

  setAccountType: (account_type: 'doctor' | 'pharmacy') =>
    request<{ role: string }>('/users/account-type', {
      method: 'POST',
      body: JSON.stringify({ account_type }),
    }),
}

// ─── Patients ─────────────────────────────────────────────────────────────────

export const patientsApi = {
  getPatients: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : ''
    return request<Patient[]>(`/patients${qs}`)
  },

  createPatient: (data: Partial<Patient>) =>
    request<Patient>('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPatient: (id: string) => request<Patient>(`/patients/${id}`),

  updatePatient: (id: string, data: Partial<Patient>) =>
    request<Patient>(`/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deletePatient: (id: string) =>
    request<void>(`/patients/${id}`, { method: 'DELETE' }),
}

// ─── Exams ────────────────────────────────────────────────────────────────────

export const examsApi = {
  getExams: (patientId: string) =>
    request<ExamResult[]>(`/exams/${patientId}`),

  createExam: (data: {
    patient_id: string
    input_method: 'form' | 'text'
    raw_text?: string
    structured_data?: Record<string, unknown>
  }) =>
    request<ExamResult>('/exams', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  uploadExamFile: async (
    file: File,
    patientId: string
  ): Promise<{ exam: ExamResult; extracted_text: string }> => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    const formData = new FormData()
    formData.append('file', file)
    formData.append('patient_id', patientId)

    const res = await fetch(`${API_URL}/exams/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    if (!res.ok) {
      let msg = `Erro ${res.status}`
      try {
        const body = await res.json()
        msg = body.detail || body.message || msg
      } catch {}
      throw new Error(msg)
    }

    return res.json()
  },

  confirmExam: (data: {
    patient_id: string
    raw_text: string
    file_url?: string
    file_type?: string
  }) =>
    request<ExamResult>('/exams/confirm', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// ─── Prescriptions ────────────────────────────────────────────────────────────

export const prescriptionsApi = {
  getPrescriptions: (patientId: string) =>
    request<Prescription[]>(`/prescriptions?patient_id=${patientId}`),

  generatePrescription: (data: {
    patient_id: string
    extra_context?: string
  }) =>
    request<Prescription>('/prescriptions/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePrescription: (id: string, data: Partial<Prescription>) =>
    request<Prescription>(`/prescriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  finalizePrescription: (id: string) =>
    request<Prescription>(`/prescriptions/${id}/finalize`, {
      method: 'POST',
    }),

  submitFeedback: (
    id: string,
    data: { rating: number; comment?: string }
  ) =>
    request<{ ok: boolean }>(`/prescriptions/${id}/feedback`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  downloadPrescription: async (id: string): Promise<Blob> => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    const res = await fetch(`${API_URL}/prescriptions/${id}/download`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!res.ok) throw new Error(`Erro ao baixar prescrição: ${res.status}`)
    return res.blob()
  },

  sendChat: (id: string, message: string, currentText?: string) =>
    request<{ new_text: string; history: ChatMessage[] }>(
      `/prescriptions/${id}/chat`,
      {
        method: 'POST',
        body: JSON.stringify({ content: message, current_text: currentText }),
      }
    ),

  getPrescription: (id: string) =>
    request<Prescription>(`/prescriptions/${id}`),

  getDiscontinuedActives: (id: string) =>
    request<{ id: string; commercial_name: string; discontinuation_reason?: string; discontinued_at?: string }[]>(
      `/prescriptions/${id}/discontinued-actives`
    ),
}

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsApi = {
  getNotifications: () => request<Notification[]>('/notifications'),

  markAsRead: (id: string) =>
    request<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),

  markAllAsRead: () =>
    request<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }),
}

// ─── Pharmacy ─────────────────────────────────────────────────────────────────

export const pharmacyApi = {
  onboardingStep1: (data: {
    name: string
    cnpj: string
    responsible_name: string
    responsible_email: string
    phone: string
  }) =>
    request<Pharmacy>('/pharmacies/onboarding/step1', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  onboardingStep2: (document_types: string[]) =>
    request<{ accepted_at: string }>('/pharmacies/onboarding/step2', {
      method: 'POST',
      body: JSON.stringify({ document_types }),
    }),

  getMyPharmacy: () => request<Pharmacy>('/pharmacies/me'),

  updateMyPharmacy: (data: Partial<Pharmacy>) =>
    request<Pharmacy>('/pharmacies/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getDoctors: () => request<PharmacyDoctor[]>('/pharmacies/me/doctors'),

  removeDoctor: (userId: string) =>
    request<void>(`/pharmacies/me/doctors/${userId}`, { method: 'DELETE' }),

  inviteDoctor: (email: string) =>
    request<{ email: string; status: string }>('/pharmacies/me/invite', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  inviteBulk: (emails: string[]) =>
    request<{ results: { email: string; status: string }[]; total: number }>(
      '/pharmacies/me/invite/bulk',
      { method: 'POST', body: JSON.stringify({ emails }) }
    ),

  getPrescriptions: () =>
    request<PharmacyPrescription[]>('/pharmacies/me/prescriptions'),

  validateInvite: (token: string) =>
    request<InviteValidateResponse>(`/invites/validate/${token}`),

  acceptInvite: (token: string) =>
    request<{ status: string; pharmacy_id: string }>(`/invites/accept/${token}`, {
      method: 'POST',
    }),

  downloadPrescription: async (prescriptionId: string): Promise<Blob> => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    const res = await fetch(`${API_URL}/pharmacies/me/prescriptions/${prescriptionId}/download`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    if (!res.ok) throw new Error(`Erro ao baixar: ${res.status}`)
    return res.blob()
  },

  sendPrescriptionEmail: (prescriptionId: string, toEmail: string) =>
    request<{ status: string; to: string }>(`/pharmacies/me/prescriptions/${prescriptionId}/send-email`, {
      method: 'POST',
      body: JSON.stringify({ to_email: toEmail }),
    }),
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string
  email: string
  name?: string | null
  role: string
  crm?: string | null
  crm_state?: string | null
  specialty?: string | null
  subscription_status: string
  trial_ends_at?: string | null
  created_at: string
  last_login_at?: string | null
}

export interface AdminPharmacy {
  id: string
  name: string
  cnpj: string
  responsible_name?: string | null
  responsible_email?: string | null
  plan_seats: number | null
  subscription_status: string
  seats_used?: number
  created_at: string
}

export interface AdminStats {
  users: { total: number; trial: number; active: number; suspended: number; cancelled: number; new_30d: number }
  pharmacies: { total: number; active: number; suspended: number }
  prescriptions: { total: number; final: number }
  patients: number
}

export interface Active {
  id: string
  commercial_name: string
  generic_name?: string | null
  supplier?: string | null
  category?: string | null
  subcategory?: string | null
  route?: string | null
  tni_zone?: string | null
  mechanism?: string | null
  indications?: string | null
  dose_min?: string | null
  dose_max?: string | null
  dose_usual?: string | null
  posology?: string | null
  safety_alerts?: string | null
  contraindications?: string | null
  interactions?: string | null
  clinical_notes?: string | null
  last_reviewed_at?: string | null
  review_source?: string | null
  status: 'draft' | 'active' | 'discontinued' | 'archived'
  discontinuation_reason?: string | null
  discontinued_at?: string | null
  created_at: string
}

export interface UrgentAlert {
  id: string
  title: string
  description: string
  source?: string | null
  severity?: 'critical' | 'high' | 'medium' | null
  status: 'draft' | 'active' | 'resolved'
  show_on_login: boolean
  active_id?: string | null
  created_at: string
}

export interface ProtocolVersion {
  id: string
  version_number: string
  description?: string | null
  system_prompt_text?: string | null
  status: 'draft' | 'active' | 'archived'
  is_current: boolean
  published_at?: string | null
  rolled_back_at?: string | null
  rollback_reason?: string | null
  created_at: string
}

export interface ActivesAnalytics {
  period_days: number
  total_uses: number
  top: { active_id: string; commercial_name: string; supplier: string | null; category: string | null; count: number }[]
  by_supplier: { supplier: string; count: number }[]
  by_category: { category: string; count: number }[]
  never_prescribed: { id: string; commercial_name: string }[]
}

async function downloadBlob(path: string, filename: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}${path}`, { headers })
  if (!res.ok) throw new Error(`Erro ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const adminApi = {
  stats: () => request<AdminStats>('/admin/stats'),

  listUsers: (params?: { search?: string; subscription_status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.subscription_status) qs.set('subscription_status', params.subscription_status)
    return request<AdminUser[]>(`/admin/users${qs.toString() ? `?${qs}` : ''}`)
  },

  suspendUser: (id: string) => request<{ ok: boolean }>(`/admin/users/${id}/suspend`, { method: 'POST' }),
  reactivateUser: (id: string) => request<{ ok: boolean }>(`/admin/users/${id}/reactivate`, { method: 'POST' }),
  deleteUser: (id: string) => request<{ ok: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),
  exportUsers: () => downloadBlob('/admin/users/export/csv', `medrion_users_${new Date().toISOString().slice(0, 10)}.csv`),

  listPharmacies: () => request<AdminPharmacy[]>('/admin/pharmacies'),
  suspendPharmacy: (id: string) => request<{ ok: boolean }>(`/admin/pharmacies/${id}/suspend`, { method: 'POST' }),
  reactivatePharmacy: (id: string) => request<{ ok: boolean }>(`/admin/pharmacies/${id}/reactivate`, { method: 'POST' }),
  exportPharmacies: () => downloadBlob('/admin/pharmacies/export/csv', `medrion_pharmacies_${new Date().toISOString().slice(0, 10)}.csv`),

  listActives: (params?: { status?: string; supplier?: string; category?: string; route?: string; search?: string }) => {
    const qs = new URLSearchParams()
    Object.entries(params || {}).forEach(([k, v]) => v && qs.set(k, v as string))
    return request<Active[]>(`/admin/actives${qs.toString() ? `?${qs}` : ''}`)
  },
  getActive: (id: string) => request<Active>(`/admin/actives/${id}`),
  createActive: (data: Partial<Active>) => request<Active>('/admin/actives', { method: 'POST', body: JSON.stringify(data) }),
  updateActive: (id: string, data: Partial<Active> & { change_reason?: string }) =>
    request<Active>(`/admin/actives/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  publishActive: (id: string) => request<Active>(`/admin/actives/${id}/publish`, { method: 'POST' }),
  discontinueActive: (id: string, reason: string) =>
    request<Active>(`/admin/actives/${id}/discontinue`, { method: 'POST', body: JSON.stringify({ reason }) }),
  listActiveChanges: (id: string) =>
    request<{ id: string; change_type: string; field_changed?: string; old_value?: string; new_value?: string; change_reason?: string; created_at: string; users?: { name?: string; email?: string } }[]>(`/admin/actives/${id}/changes`),
  previewActive: (id: string, test_anamnesis: string) =>
    request<{ output: string }>(`/admin/actives/${id}/preview`, { method: 'POST', body: JSON.stringify({ test_anamnesis }) }),
  exportActives: () => downloadBlob('/admin/actives/export/csv', `medrion_ativos_${new Date().toISOString().slice(0, 10)}.csv`),

  importActives: async (file: File) => {
    const headers = await getAuthHeaders()
    delete (headers as Record<string, string>)['Content-Type']
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API_URL}/admin/actives/import/csv`, { method: 'POST', headers, body: fd })
    if (!res.ok) throw new Error(`Erro ${res.status}`)
    return res.json() as Promise<{ imported: number; skipped: number; duplicates: number }>
  },

  listAlerts: (status?: string) =>
    request<UrgentAlert[]>(`/admin/alerts${status ? `?status=${status}` : ''}`),
  createAlert: (data: Partial<UrgentAlert>) =>
    request<UrgentAlert>('/admin/alerts', { method: 'POST', body: JSON.stringify(data) }),
  resolveAlert: (id: string) => request<UrgentAlert>(`/admin/alerts/${id}/resolve`, { method: 'PUT' }),
  deleteAlert: (id: string) => request<{ ok: boolean }>(`/admin/alerts/${id}`, { method: 'DELETE' }),

  listProtocolVersions: () => request<ProtocolVersion[]>('/admin/protocol-versions'),
  createProtocolVersion: (data: { version_number: string; description: string; system_prompt_text: string }) =>
    request<ProtocolVersion>('/admin/protocol-versions', { method: 'POST', body: JSON.stringify(data) }),
  publishProtocolVersion: (id: string) =>
    request<ProtocolVersion>(`/admin/protocol-versions/${id}/publish`, { method: 'POST' }),
  rollbackProtocolVersion: (id: string, reason: string) =>
    request<ProtocolVersion>(`/admin/protocol-versions/${id}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  activesAnalytics: (days = 30) =>
    request<ActivesAnalytics>(`/admin/analytics/actives?days=${days}`),

  listAccessLogs: (limit = 100) =>
    request<{ id: string; user_id: string; event_type: string; ip_address?: string; device_info?: string; created_at: string; users?: { email?: string; name?: string } }[]>(`/admin/access-logs?limit=${limit}`),
}

// ─── Doctor-side alerts (login banner) ────────────────────────────────────────

export const alertsApi = {
  getPending: () =>
    request<{ id: string; title: string; description: string; severity?: string; source?: string }[]>('/users/me/pending-alerts'),
  acknowledge: (id: string) =>
    request<{ ok: boolean }>(`/users/me/alerts/${id}/acknowledge`, { method: 'POST' }),
}

// ─── LGPD export ──────────────────────────────────────────────────────────────

export const lgpdApi = {
  exportMyData: () =>
    downloadBlob('/users/me/export', `medrion_meus_dados_${new Date().toISOString().slice(0, 10)}.csv`),
}

// ─── Auth (2FA + sessão única) ───────────────────────────────────────────────

export const authApi = {
  startSession: () =>
    request<{ session_id: string; mfa_required: boolean }>('/auth/start-session', {
      method: 'POST',
    }),

  verifyOtp: (code: string) =>
    request<{ ok: boolean; message: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  resendOtp: () =>
    request<{ ok: boolean }>('/auth/resend-otp', { method: 'POST' }),
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export const billingApi = {
  doctorCheckout: () =>
    request<{ url: string; session_id: string }>('/billing/doctor/checkout', {
      method: 'POST',
    }),

  pharmacyCheckout: (plan_seats: 10 | 20 | 30) =>
    request<{ url: string; session_id: string }>('/billing/pharmacy/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan_seats }),
    }),

  portal: () =>
    request<{ url: string }>('/billing/portal', {
      method: 'POST',
    }),
}

// ─── Prescription Header logo upload ─────────────────────────────────────────

export const uploadLogo = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error('Arquivo muito grande. Máximo: 2MB'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsDataURL(file)
  })
}
