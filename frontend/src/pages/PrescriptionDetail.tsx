import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { prescriptionsApi, patientsApi } from '../services/api'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import { Step3View } from './NewPrescription'
import type { Prescription, Patient } from '../types'

export default function PrescriptionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [prescription, setPrescription] = useState<Prescription | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const rx = await prescriptionsApi.getPrescription(id)
      setPrescription(rx)
      if (rx.patient_id) {
        const pt = await patientsApi.getPatient(rx.patient_id)
        setPatient(pt)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar prescricao'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <LoadingSpinner label="Carregando prescricao..." />
      </div>
    )
  }

  if (!prescription || !patient) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-500">Prescricao nao encontrada.</p>
        <Button className="mt-4" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <button
        onClick={() => navigate(`/pacientes/${patient.id}`)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {patient.name}
      </button>

      <Step3View
        prescription={prescription}
        patient={patient}
        onUpdate={setPrescription}
      />
    </div>
  )
}
