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
} from '../types'

const API_URL = import.meta.env.VITE_API_URL as string || 'http://localhost:8000'

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
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
      const body = await res.json()
      errorMessage = body.detail || body.message || errorMessage
    } catch {
      // ignore parse error
    }
    throw new Error(errorMessage)
  }

  if (res.status === 204) return undefined as T
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
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
}

// ─── Exams ────────────────────────────────────────────────────────────────────

export const examsApi = {
  getExams: (patientId: string) =>
    request<ExamResult[]>(`/patients/${patientId}/exams`),

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
    request<Prescription[]>(`/patients/${patientId}/prescriptions`),

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
      method: 'PATCH',
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

  sendChat: (id: string, message: string) =>
    request<{ message: ChatMessage; history: ChatMessage[] }>(
      `/prescriptions/${id}/chat`,
      {
        method: 'POST',
        body: JSON.stringify({ message }),
      }
    ),

  getPrescription: (id: string) =>
    request<Prescription>(`/prescriptions/${id}`),
}

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsApi = {
  getNotifications: () => request<Notification[]>('/notifications'),

  markAsRead: (id: string) =>
    request<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),

  markAllAsRead: () =>
    request<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }),
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
