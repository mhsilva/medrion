import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { patientsApi, prescriptionsApi } from '../services/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useToast } from '../components/ui/Toast'
import { getGreeting, formatDate, calcAge } from '../utils/format'
import type { Patient, Prescription } from '../types'

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-primary">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </Card>
  )
}

interface PatientWithPrescriptions extends Patient {
  prescriptions?: Prescription[]
}

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [patients, setPatients] = useState<PatientWithPrescriptions[]>([])
  const [loading, setLoading] = useState(true)
  const [prescriptionCount, setPrescriptionCount] = useState(0)
  const [lastPrescriptionDate, setLastPrescriptionDate] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const pts = await patientsApi.getPatients()
        // Get prescriptions for last 5 patients
        const recent = pts.slice(0, 5)
        const withPrescriptions = await Promise.all(
          recent.map(async p => {
            try {
              const prescriptions = await prescriptionsApi.getPrescriptions(p.id)
              return { ...p, prescriptions }
            } catch {
              return { ...p, prescriptions: [] }
            }
          })
        )
        setPatients(withPrescriptions)

        // Count prescriptions this month
        const now = new Date()
        let totalThisMonth = 0
        let lastDate: string | null = null

        for (const p of withPrescriptions) {
          const presc = p.prescriptions || []
          for (const rx of presc) {
            const d = new Date(rx.created_at)
            if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
              totalThisMonth++
            }
            if (!lastDate || rx.created_at > lastDate) {
              lastDate = rx.created_at
            }
          }
        }

        setPrescriptionCount(totalThisMonth)
        setLastPrescriptionDate(lastDate)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar dados'
        toast.error(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, []) // toast excluído intencionalmente — referência instável causava loop

  const greeting = getGreeting()
  const doctorName = profile?.name?.split(' ')[0] || 'Doutor(a)'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}, Dr(a). {doctorName}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button onClick={() => navigate('/pacientes/novo')} size="lg">
          + Novo paciente
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Total de pacientes"
          value={loading ? '—' : patients.length}
          sub="cadastrados na plataforma"
        />
        <MetricCard
          label="Prescricoes este mes"
          value={loading ? '—' : prescriptionCount}
          sub={`em ${new Date().toLocaleDateString('pt-BR', { month: 'long' })}`}
        />
        <MetricCard
          label="Ultima prescricao"
          value={loading ? '—' : formatDate(lastPrescriptionDate)}
          sub={lastPrescriptionDate ? '' : 'Nenhuma ainda'}
        />
      </div>

      {/* Recent patients */}
      <Card padding="none">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Pacientes recentes</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/pacientes')}>
            Ver todos
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner label="Carregando pacientes..." />
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-16 h-16 bg-bg-secondary rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Nenhum paciente cadastrado</p>
              <p className="text-xs text-gray-400 mt-1">Comece cadastrando seu primeiro paciente</p>
            </div>
            <Button onClick={() => navigate('/pacientes/novo')}>
              + Novo paciente
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {patients.map(patient => {
              const age = calcAge(patient.birth_date)
              const lastPrx = patient.prescriptions?.[0]
              return (
                <div key={patient.id} className="flex items-center justify-between px-6 py-4 hover:bg-bg-secondary transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{patient.name}</p>
                    <p className="text-xs text-gray-500">
                      {age !== null ? `${age} anos` : '—'}
                      {lastPrx ? ` · Última prescricao: ${formatDate(lastPrx.created_at)}` : ' · Sem prescricoes'}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/pacientes/${patient.id}`)}
                  >
                    Ver
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
