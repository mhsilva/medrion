import React, { useState, useEffect, useRef } from 'react'
import { pharmacyApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import type { Pharmacy, PharmacyDoctor, PharmacyPrescription } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Metrics row ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-primary mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [tab, setTab] = useState<'single' | 'bulk'>('single')
  const [email, setEmail] = useState('')
  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSingle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      toast.error('E-mail inválido')
      return
    }
    setLoading(true)
    try {
      const res = await pharmacyApi.inviteDoctor(email.trim())
      if (res.status === 'already_pending') {
        toast.error('Já existe um convite pendente para este e-mail')
      } else {
        toast.success('Convite enviado com sucesso!')
        onInvited()
        onClose()
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar convite')
    } finally {
      setLoading(false)
    }
  }

  const handleBulk = async (e: React.FormEvent) => {
    e.preventDefault()
    const emails = csvText
      .split(/[\n,;]/)
      .map(e => e.trim())
      .filter(e => e && /\S+@\S+\.\S+/.test(e))

    if (emails.length === 0) {
      toast.error('Nenhum e-mail válido encontrado')
      return
    }
    setLoading(true)
    try {
      const res = await pharmacyApi.inviteBulk(emails)
      const invited = res.results.filter(r => r.status === 'invited').length
      const pending = res.results.filter(r => r.status === 'already_pending').length
      toast.success(`${invited} convite(s) enviado(s)${pending > 0 ? `. ${pending} já tinham convite pendente.` : ''}`)
      onInvited()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar convites')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setCsvText(ev.target?.result as string)
    reader.readAsText(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-semibold text-gray-900">Convidar médico</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="flex border-b">
          {(['single', 'bulk'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors
                ${tab === t ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'single' ? 'Convidar um médico' : 'Convidar em massa'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'single' ? (
            <form onSubmit={handleSingle} className="space-y-4">
              <Input
                label="E-mail do médico"
                type="email"
                placeholder="medico@clinica.com.br"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <Button type="submit" fullWidth loading={loading}>Enviar convite</Button>
            </form>
          ) : (
            <form onSubmit={handleBulk} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cole os e-mails (um por linha, vírgula ou ponto-e-vírgula)
                </label>
                <textarea
                  rows={6}
                  placeholder="medico1@clinica.com.br&#10;medico2@clinica.com.br"
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="text-center text-sm text-gray-400">ou</div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  onClick={() => fileRef.current?.click()}
                >
                  Importar CSV
                </Button>
              </div>
              <Button type="submit" fullWidth loading={loading}>
                Enviar convites
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Doctors tab ─────────────────────────────────────────────────────────────

function DoctorsTab({
  doctors,
  loading,
  onRemove,
  onRefresh,
}: {
  doctors: PharmacyDoctor[]
  loading: boolean
  onRemove: (id: string) => void
  onRefresh: () => void
}) {
  const [showInvite, setShowInvite] = useState(false)

  const statusLabel = (s: string | null) => {
    if (!s) return { text: 'Sem plano', cls: 'bg-gray-100 text-gray-600' }
    const map: Record<string, { text: string; cls: string }> = {
      active: { text: 'Ativo', cls: 'bg-green-100 text-green-700' },
      trial: { text: 'Trial', cls: 'bg-blue-100 text-blue-700' },
      suspended: { text: 'Suspenso', cls: 'bg-red-100 text-red-700' },
      cancelled: { text: 'Cancelado', cls: 'bg-gray-100 text-gray-500' },
    }
    return map[s] ?? { text: s, cls: 'bg-gray-100 text-gray-600' }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button onClick={() => setShowInvite(true)}>
          + Convidar médico
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Carregando...</div>
      ) : doctors.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">Nenhum médico ainda</p>
          <p className="text-sm mt-1">Convide médicos para começar a usar a plataforma</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Médico</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Último acesso</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cadastro</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {doctors.map(d => {
                const st = statusLabel(d.subscription_status)
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{d.name || '—'}</p>
                      <p className="text-gray-400 text-xs">{d.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDateTime(d.last_login_at)}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                        {st.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onRemove(d.id)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        Remover acesso
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={onRefresh}
        />
      )}
    </div>
  )
}

// ─── Prescriptions tab ───────────────────────────────────────────────────────

function PrescriptionsTab({
  prescriptions,
  loading,
}: {
  prescriptions: PharmacyPrescription[]
  loading: boolean
}) {
  const statusLabel = (s: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      final: { text: 'Finalizada', cls: 'bg-green-100 text-green-700' },
      draft: { text: 'Rascunho', cls: 'bg-yellow-100 text-yellow-700' },
      generating: { text: 'Gerando', cls: 'bg-blue-100 text-blue-700' },
    }
    return map[s] ?? { text: s, cls: 'bg-gray-100 text-gray-600' }
  }

  if (loading) return <div className="text-center py-10 text-gray-400">Carregando...</div>

  if (prescriptions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg">Nenhuma prescrição ainda</p>
        <p className="text-sm mt-1">As prescrições dos médicos vinculados aparecerão aqui</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Paciente</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {prescriptions.map(p => {
            const st = statusLabel(p.status)
            return (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {p.patients?.name || '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDateTime(p.created_at)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                    {st.text}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {p.docx_url && (
                    <a
                      href={p.docx_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Baixar
                    </a>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = 'doctors' | 'prescriptions'

export default function PharmacyDashboard() {
  const { profile, signOut } = useAuth()
  const toast = useToast()

  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null)
  const [doctors, setDoctors] = useState<PharmacyDoctor[]>([])
  const [prescriptions, setPrescriptions] = useState<PharmacyPrescription[]>([])
  const [tab, setTab] = useState<Tab>('doctors')
  const [loadingPharmacy, setLoadingPharmacy] = useState(true)
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false)

  useEffect(() => {
    pharmacyApi.getMyPharmacy()
      .then(setPharmacy)
      .catch(() => toast.error('Erro ao carregar dados da farmácia'))
      .finally(() => setLoadingPharmacy(false))

    fetchDoctors()
  }, [])

  useEffect(() => {
    if (tab === 'prescriptions' && prescriptions.length === 0) {
      setLoadingPrescriptions(true)
      pharmacyApi.getPrescriptions()
        .then(setPrescriptions)
        .catch(() => toast.error('Erro ao carregar prescrições'))
        .finally(() => setLoadingPrescriptions(false))
    }
  }, [tab])

  const fetchDoctors = () => {
    setLoadingDoctors(true)
    pharmacyApi.getDoctors()
      .then(setDoctors)
      .catch(() => toast.error('Erro ao carregar médicos'))
      .finally(() => setLoadingDoctors(false))
  }

  const handleRemoveDoctor = async (doctorId: string) => {
    if (!confirm('Tem certeza que deseja remover o acesso deste médico?')) return
    try {
      await pharmacyApi.removeDoctor(doctorId)
      setDoctors(prev => prev.filter(d => d.id !== doctorId))
      toast.success('Acesso removido')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover médico')
    }
  }

  const seatsTotal = pharmacy?.plan_seats ?? 0
  const seatsUsed = doctors.length
  const seatsFree = Math.max(0, seatsTotal - seatsUsed)

  return (
    <div className="min-h-screen bg-bg-secondary">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold text-primary">Medrion</span>
            {!loadingPharmacy && pharmacy && (
              <span className="text-sm text-gray-500 border-l border-gray-200 pl-4">
                {pharmacy.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{profile?.email}</span>
            <button
              onClick={signOut}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard label="Seats contratados" value={seatsTotal} sub="Plano atual" />
          <MetricCard label="Seats ocupados" value={seatsUsed} sub="Médicos ativos" />
          <MetricCard
            label="Seats disponíveis"
            value={seatsFree}
            sub={seatsFree === 0 ? 'Plano cheio' : 'Disponíveis para convite'}
          />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200">
            {([
              { key: 'doctors', label: 'Médicos' },
              { key: 'prescriptions', label: 'Prescrições' },
            ] as { key: Tab; label: string }[]).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-6 py-4 text-sm font-medium transition-colors
                  ${tab === t.key
                    ? 'text-primary border-b-2 border-primary bg-blue-50/30'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {t.label}
                {t.key === 'doctors' && doctors.length > 0 && (
                  <span className="ml-2 bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5">
                    {doctors.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-6">
            {tab === 'doctors' && (
              <DoctorsTab
                doctors={doctors}
                loading={loadingDoctors}
                onRemove={handleRemoveDoctor}
                onRefresh={fetchDoctors}
              />
            )}
            {tab === 'prescriptions' && (
              <PrescriptionsTab
                prescriptions={prescriptions}
                loading={loadingPrescriptions}
              />
            )}
          </div>
        </div>

        {/* Pagamento placeholder */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Pagamento</h3>
          <p className="text-sm text-gray-500">
            A gestão de assinatura e pagamentos estará disponível em breve.
          </p>
        </div>
      </main>
    </div>
  )
}
