import React, { useState, useEffect, useRef } from 'react'
import { pharmacyApi, notificationsApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import type { Pharmacy, PharmacyDoctor, PharmacyPrescription, Notification } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isToday(iso: string) {
  const d = new Date(iso)
  const t = new Date()
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Notification bell ────────────────────────────────────────────────────────

function parseInviteMessage(raw: string): { text: string; token: string } | null {
  try {
    const p = JSON.parse(raw)
    if (p.text && p.token) return p
  } catch {}
  return null
}

function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    notificationsApi.getNotifications()
      .then(data => setNotifications(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = notifications.filter(n => !n.read).length

  const markRead = async (id: string) => {
    await notificationsApi.markAsRead(id).catch(() => {})
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        aria-label="Notificações"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Notificações</h3>
            <button onClick={() => setOpen(false)} className="text-xs text-primary hover:underline">Fechar</button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhuma notificação</p>
            ) : notifications.map(n => {
              const invite = n.type === 'invite' ? parseInviteMessage(n.message) : null
              return (
                <div key={n.id} className={['px-4 py-3 border-b border-gray-50', !n.read ? 'bg-blue-50/40' : ''].join(' ')}>
                  <p className="text-sm text-gray-700">{invite ? invite.text : n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(n.created_at)}</p>
                  {!n.read && (
                    <button onClick={() => markRead(n.id)} className="text-xs text-gray-400 hover:underline mt-1">
                      Dispensar
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-primary mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Invite modal ─────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [tab, setTab] = useState<'single' | 'bulk'>('single')
  const [email, setEmail] = useState('')
  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSingle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) { toast.error('E-mail inválido'); return }
    setLoading(true)
    try {
      const res = await pharmacyApi.inviteDoctor(email.trim())
      if (res.status === 'already_pending') toast.error('Já existe um convite pendente para este e-mail')
      else { toast.success('Convite enviado!'); onInvited(); onClose() }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar convite')
    } finally { setLoading(false) }
  }

  const handleBulk = async (e: React.FormEvent) => {
    e.preventDefault()
    const emails = csvText.split(/[\n,;]/).map(e => e.trim()).filter(e => e && /\S+@\S+\.\S+/.test(e))
    if (emails.length === 0) { toast.error('Nenhum e-mail válido'); return }
    setLoading(true)
    try {
      const res = await pharmacyApi.inviteBulk(emails)
      const invited = res.results.filter(r => r.status === 'invited').length
      const pending = res.results.filter(r => r.status === 'already_pending').length
      toast.success(`${invited} convite(s) enviado(s)${pending > 0 ? `. ${pending} já pendentes.` : ''}`)
      onInvited(); onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar convites')
    } finally { setLoading(false) }
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
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'single' ? 'Um médico' : 'Em massa'}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === 'single' ? (
            <form onSubmit={handleSingle} className="space-y-4">
              <Input label="E-mail do médico" type="email" placeholder="medico@clinica.com.br"
                value={email} onChange={e => setEmail(e.target.value)} required />
              <Button type="submit" fullWidth loading={loading}>Enviar convite</Button>
            </form>
          ) : (
            <form onSubmit={handleBulk} className="space-y-4">
              <textarea rows={5} placeholder="medico1@clinica.com.br&#10;medico2@clinica.com.br"
                value={csvText} onChange={e => setCsvText(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              <div className="text-center text-sm text-gray-400">ou</div>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setCsvText(ev.target?.result as string); r.readAsText(f) }} />
              <Button type="button" variant="outline" fullWidth onClick={() => fileRef.current?.click()}>Importar CSV</Button>
              <Button type="submit" fullWidth loading={loading}>Enviar convites</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Doctors panel ────────────────────────────────────────────────────────────

function DoctorsPanel({
  doctors,
  loading,
  selected,
  onSelect,
  onRemove,
  onRefresh,
}: {
  doctors: PharmacyDoctor[]
  loading: boolean
  selected: PharmacyDoctor | null
  onSelect: (d: PharmacyDoctor | null) => void
  onRemove: (id: string) => void
  onRefresh: () => void
}) {
  const [showInvite, setShowInvite] = useState(false)

  const statusBadge = (s: string | null) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      trial: 'bg-blue-100 text-blue-700',
      suspended: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-500',
    }
    return { cls: map[s ?? ''] ?? 'bg-gray-100 text-gray-500', text: s === 'active' ? 'Ativo' : s === 'trial' ? 'Trial' : s === 'suspended' ? 'Suspenso' : s === 'cancelled' ? 'Cancelado' : 'Sem plano' }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">
          Médicos
          {doctors.length > 0 && <span className="ml-2 bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5">{doctors.length}</span>}
        </h2>
        <Button size="sm" onClick={() => setShowInvite(true)}>+ Convidar</Button>
      </div>

      <div className="overflow-y-auto flex-1" style={{ maxHeight: 480 }}>
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-8">Carregando...</p>
        ) : doctors.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Nenhum médico ainda</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {doctors.map(d => {
              const st = statusBadge(d.subscription_status)
              const isSelected = selected?.id === d.id
              return (
                <li
                  key={d.id}
                  onClick={() => onSelect(isSelected ? null : d)}
                  className={[
                    'px-4 py-3 cursor-pointer transition-colors group',
                    isSelected ? 'bg-primary/5 border-l-2 border-primary' : 'hover:bg-gray-50 border-l-2 border-transparent',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{d.name || '—'}</p>
                      <p className="text-xs text-gray-400 truncate">{d.email}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Últ. acesso: {formatDateTime(d.last_login_at)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.text}</span>
                      <button
                        onClick={e => { e.stopPropagation(); onRemove(d.id) }}
                        className="text-[10px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvited={onRefresh} />}
    </div>
  )
}

// ─── Prescriptions panel ──────────────────────────────────────────────────────

function PrescriptionsPanel({
  prescriptions,
  doctors,
  loading,
  selectedDoctor,
  pharmacyEmail,
}: {
  prescriptions: PharmacyPrescription[]
  doctors: PharmacyDoctor[]
  loading: boolean
  selectedDoctor: PharmacyDoctor | null
  pharmacyEmail: string | null
}) {
  const toast = useToast()
  const [downloading, setDownloading] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)

  const doctorMap = new Map(doctors.map(d => [d.id, d.name || d.email]))

  const filtered = selectedDoctor
    ? prescriptions.filter(p => p.user_id === selectedDoctor.id)
    : prescriptions.filter(p => isToday(p.created_at))

  const title = selectedDoctor
    ? `Prescrições — ${selectedDoctor.name || selectedDoctor.email}`
    : 'Prescrições do dia'

  const handleDownload = async (p: PharmacyPrescription) => {
    setDownloading(p.id)
    try {
      const blob = await pharmacyApi.downloadPrescription(p.id)
      const patient = p.patients?.name || 'paciente'
      downloadBlob(blob, `Prescricao_${patient.replace(/\s+/g, '_')}_${p.id.slice(0, 8)}.docx`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao baixar')
    } finally {
      setDownloading(null)
    }
  }

  const handleSendEmail = async (p: PharmacyPrescription) => {
    setSending(p.id)
    try {
      const res = await pharmacyApi.sendPrescriptionEmail(p.id)
      toast.success(`Enviado para ${res.to}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar e-mail')
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
          {pharmacyEmail && (
            <p className="text-xs text-gray-400 mt-0.5">E-mail destino: <span className="text-gray-600">{pharmacyEmail}</span></p>
          )}
        </div>
        <span className="text-xs text-gray-400">{filtered.length} prescrição(ões)</span>
      </div>

      <div className="overflow-y-auto flex-1" style={{ maxHeight: 480 }}>
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-8">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">
            {selectedDoctor ? 'Nenhuma prescrição finalizada' : 'Nenhuma prescrição finalizada hoje'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filtered.map(p => (
              <li key={p.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{p.patients?.name || '—'}</p>
                    {!selectedDoctor && (
                      <p className="text-xs text-gray-500">{doctorMap.get(p.user_id) || '—'}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {selectedDoctor ? formatDateTime(p.created_at) : formatTime(p.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDownload(p)}
                      disabled={downloading === p.id}
                      className="text-xs text-primary hover:underline disabled:opacity-50 font-medium"
                    >
                      {downloading === p.id ? '...' : 'Baixar'}
                    </button>
                    <button
                      onClick={() => handleSendEmail(p)}
                      disabled={sending === p.id}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
                    >
                      {sending === p.id ? '...' : '📧 E-mail'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PharmacyDashboard() {
  const { profile, signOut } = useAuth()
  const toast = useToast()

  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null)
  const [doctors, setDoctors] = useState<PharmacyDoctor[]>([])
  const [prescriptions, setPrescriptions] = useState<PharmacyPrescription[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<PharmacyDoctor | null>(null)
  const [loadingPharmacy, setLoadingPharmacy] = useState(true)
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(true)

  useEffect(() => {
    pharmacyApi.getMyPharmacy()
      .then(setPharmacy)
      .catch(() => toast.error('Erro ao carregar farmácia'))
      .finally(() => setLoadingPharmacy(false))

    fetchDoctors()

    pharmacyApi.getPrescriptions()
      .then(setPrescriptions)
      .catch(() => toast.error('Erro ao carregar prescrições'))
      .finally(() => setLoadingPrescriptions(false))
  }, [])

  const fetchDoctors = () => {
    setLoadingDoctors(true)
    pharmacyApi.getDoctors()
      .then(setDoctors)
      .catch(() => toast.error('Erro ao carregar médicos'))
      .finally(() => setLoadingDoctors(false))
  }

  const handleRemoveDoctor = async (doctorId: string) => {
    if (!confirm('Remover o acesso deste médico?')) return
    try {
      await pharmacyApi.removeDoctor(doctorId)
      setDoctors(prev => prev.filter(d => d.id !== doctorId))
      if (selectedDoctor?.id === doctorId) setSelectedDoctor(null)
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
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold text-primary">Medrion</span>
            {!loadingPharmacy && pharmacy && (
              <span className="text-sm text-gray-500 border-l border-gray-200 pl-4">{pharmacy.name}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="text-sm text-gray-500 hidden sm:block">{profile?.email}</span>
            <button onClick={signOut} className="text-sm text-gray-500 hover:text-gray-700 underline">Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard label="Seats contratados" value={seatsTotal} sub="Plano atual" />
          <MetricCard label="Seats ocupados" value={seatsUsed} sub="Médicos ativos" />
          <MetricCard label="Seats disponíveis" value={seatsFree} sub={seatsFree === 0 ? 'Plano cheio' : 'Disponíveis'} />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <DoctorsPanel
              doctors={doctors}
              loading={loadingDoctors}
              selected={selectedDoctor}
              onSelect={setSelectedDoctor}
              onRemove={handleRemoveDoctor}
              onRefresh={fetchDoctors}
            />
          </div>
          <div className="lg:col-span-3">
            <PrescriptionsPanel
              prescriptions={prescriptions}
              doctors={doctors}
              loading={loadingPrescriptions}
              selectedDoctor={selectedDoctor}
              pharmacyEmail={pharmacy?.responsible_email ?? null}
            />
          </div>
        </div>

        {/* Pagamento placeholder */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Pagamento</h3>
          <p className="text-sm text-gray-500">Gestão de assinatura disponível em breve.</p>
        </div>
      </main>
    </div>
  )
}
