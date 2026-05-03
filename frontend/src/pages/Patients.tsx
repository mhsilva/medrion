import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { patientsApi } from '../services/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useToast } from '../components/ui/Toast'
import { calcAge, formatDate, truncate } from '../utils/format'
import type { Patient } from '../types'

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const toast = useToast()

  const loadPatients = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const data = await patientsApi.getPatients(q)
      setPatients(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar pacientes'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, []) // toast excluído intencionalmente — referência instável causava loop

  useEffect(() => {
    loadPatients()
  }, [loadPatients])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPatients(search || undefined)
    }, 350)
    return () => clearTimeout(timer)
  }, [search, loadPatients])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
        <Button onClick={() => navigate('/pacientes/novo')}>
          + Novo paciente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar paciente..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner label="Carregando pacientes..." />
        </div>
      ) : patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-20 h-20 bg-bg-secondary rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-base font-medium text-gray-700">
              {search ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {search ? `Sem resultados para "${search}"` : 'Comece cadastrando seu primeiro paciente'}
            </p>
          </div>
          {!search && (
            <Button onClick={() => navigate('/pacientes/novo')}>
              + Novo paciente
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map(patient => {
            const age = calcAge(patient.birth_date)
            return (
              <Card
                key={patient.id}
                className="hover:shadow-card-hover transition-shadow"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-gray-900 truncate">{patient.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {age !== null ? `${age} anos` : '—'}
                        {patient.gender ? ` · ${patient.gender}` : ''}
                      </p>
                    </div>
                  </div>

                  {patient.therapeutic_objective && (
                    <p className="text-xs text-gray-600 flex-1 mb-3 line-clamp-2">
                      {truncate(patient.therapeutic_objective, 80)}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      {patient.last_prescription_at
                        ? `Presc.: ${formatDate(patient.last_prescription_at)}`
                        : 'Sem prescricoes'}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/pacientes/${patient.id}`)}
                    >
                      Ver paciente
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
