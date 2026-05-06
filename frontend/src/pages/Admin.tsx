import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import {
  adminApi,
  type AdminUser,
  type AdminPharmacy,
  type AdminStats,
  type Active,
  type UrgentAlert,
  type ActivesAnalytics,
  type ProtocolVersion,
} from '../services/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { useToast } from '../components/ui/Toast'
import { formatDate } from '../utils/format'

const tabs = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/medicos', label: 'Médicos' },
  { to: '/admin/farmacias', label: 'Farmácias' },
  { to: '/admin/ativos', label: 'Ativos' },
  { to: '/admin/alertas', label: 'Alertas' },
  { to: '/admin/protocolo', label: 'Protocolo' },
  { to: '/admin/analytics', label: 'Analytics' },
  { to: '/admin/logs', label: 'Logs' },
]

export default function Admin() {
  return (
    <div className="min-h-screen bg-bg-secondary">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/admin" className="text-xl font-bold text-primary">
            Medrion · Admin
          </Link>
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            Voltar ao app →
          </Link>
        </div>
        <nav className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route index element={<DashboardTab />} />
          <Route path="medicos" element={<DoctorsTab />} />
          <Route path="farmacias" element={<PharmaciesTab />} />
          <Route path="ativos" element={<ActivesTab />} />
          <Route path="ativos/:id" element={<ActiveDetail />} />
          <Route path="alertas" element={<AlertsTab />} />
          <Route path="protocolo" element={<ProtocolTab />} />
          <Route path="analytics" element={<AnalyticsTab />} />
          <Route path="logs" element={<LogsTab />} />
        </Routes>
      </main>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Dashboard tab
// ────────────────────────────────────────────────────────────────────────────

function DashboardTab() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const toast = useToast()

  useEffect(() => {
    adminApi.stats().then(setStats).catch(err =>
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar stats')
    )
  }, [toast])

  if (!stats) return <p className="text-sm text-gray-500">Carregando…</p>

  const cards = [
    { label: 'Médicos totais', value: stats.users.total },
    { label: 'Trial ativos', value: stats.users.trial },
    { label: 'Médicos pagos', value: stats.users.active },
    { label: 'Suspensos', value: stats.users.suspended, danger: true },
    { label: 'Novos (30d)', value: stats.users.new_30d },
    { label: 'Farmácias', value: stats.pharmacies.total },
    { label: 'Prescrições totais', value: stats.prescriptions.total },
    { label: 'Prescrições finalizadas', value: stats.prescriptions.final },
    { label: 'Pacientes', value: stats.patients },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <Card key={c.label} className="p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">{c.label}</p>
          <p className={`text-2xl font-bold mt-1 ${c.danger ? 'text-danger' : 'text-gray-900'}`}>{c.value}</p>
        </Card>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Doctors tab
// ────────────────────────────────────────────────────────────────────────────

function DoctorsTab() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminApi.listUsers({ search: search || undefined, subscription_status: filter || undefined })
      setUsers(res.filter(u => u.role === 'doctor' || u.role === 'admin'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao listar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [filter])

  const handleSuspend = async (id: string) => {
    if (!confirm('Suspender este médico?')) return
    await adminApi.suspendUser(id)
    toast.success('Médico suspenso')
    load()
  }

  const handleReactivate = async (id: string) => {
    await adminApi.reactivateUser(id)
    toast.success('Reativado')
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este usuário (irreversível)?')) return
    await adminApi.deleteUser(id)
    toast.success('Apagado')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input label="Buscar" value={search} onChange={e => setSearch(e.target.value)} placeholder="email, nome ou CRM" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Status</label>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="border border-gray-300 rounded px-2 py-2 text-sm">
            <option value="">Todos</option>
            <option value="trial">Trial</option>
            <option value="active">Ativo</option>
            <option value="suspended">Suspenso</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <Button onClick={load} variant="outline">Buscar</Button>
        <Button onClick={() => adminApi.exportUsers()} variant="outline">Exportar CSV</Button>
      </div>

      <Card>
        {loading ? <p className="p-4 text-sm text-gray-500">Carregando…</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="p-2">Nome</th>
                <th className="p-2">Email</th>
                <th className="p-2">CRM</th>
                <th className="p-2">Status</th>
                <th className="p-2">Cadastro</th>
                <th className="p-2">Último login</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-medium">{u.name || '—'}</td>
                  <td className="p-2 text-gray-600">{u.email}</td>
                  <td className="p-2 text-gray-600">{u.crm ? `${u.crm}/${u.crm_state || ''}` : '—'}</td>
                  <td className="p-2"><Badge variant={u.subscription_status === 'suspended' ? 'danger' : u.subscription_status === 'active' ? 'success' : 'default'}>{u.subscription_status}</Badge></td>
                  <td className="p-2 text-gray-500 text-xs">{formatDate(u.created_at)}</td>
                  <td className="p-2 text-gray-500 text-xs">{formatDate(u.last_login_at)}</td>
                  <td className="p-2 text-right">
                    {u.subscription_status === 'suspended' ? (
                      <Button size="sm" variant="outline" onClick={() => handleReactivate(u.id)}>Reativar</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleSuspend(u.id)}>Suspender</Button>
                    )}
                    <Button size="sm" variant="danger" onClick={() => handleDelete(u.id)} className="ml-2">Apagar</Button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-gray-400 text-sm">Nenhum médico encontrado</td></tr>}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Pharmacies tab
// ────────────────────────────────────────────────────────────────────────────

function PharmaciesTab() {
  const [items, setItems] = useState<AdminPharmacy[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    try { setItems(await adminApi.listPharmacies()) } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => adminApi.exportPharmacies()} variant="outline">Exportar CSV</Button>
      </div>
      <Card>
        {loading ? <p className="p-4 text-sm text-gray-500">Carregando…</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="p-2">Nome</th>
                <th className="p-2">CNPJ</th>
                <th className="p-2">Pacote</th>
                <th className="p-2">Seats</th>
                <th className="p-2">Status</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-medium">{p.name}</td>
                  <td className="p-2 text-gray-600 font-mono">{p.cnpj}</td>
                  <td className="p-2">{p.plan_seats || '—'}</td>
                  <td className="p-2">{p.seats_used ?? 0} / {p.plan_seats ?? '?'}</td>
                  <td className="p-2"><Badge variant={p.subscription_status === 'suspended' ? 'danger' : 'success'}>{p.subscription_status}</Badge></td>
                  <td className="p-2 text-right">
                    {p.subscription_status === 'suspended'
                      ? <Button size="sm" variant="outline" onClick={async () => { await adminApi.reactivatePharmacy(p.id); load() }}>Reativar</Button>
                      : <Button size="sm" variant="outline" onClick={async () => { await adminApi.suspendPharmacy(p.id); load() }}>Suspender</Button>
                    }
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-400 text-sm">Nenhuma farmácia</td></tr>}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Actives tab + detail
// ────────────────────────────────────────────────────────────────────────────

function ActivesTab() {
  const [items, setItems] = useState<Active[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const toast = useToast()
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      setItems(await adminApi.listActives({ search: search || undefined, status: statusFilter || undefined }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [statusFilter])

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await adminApi.importActives(file)
      toast.success(`Importados ${result.imported}, ignorados ${result.skipped}, duplicados ${result.duplicates}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na importação')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input label="Buscar" value={search} onChange={e => setSearch(e.target.value)} placeholder="nome comercial ou genérico" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-300 rounded px-2 py-2 text-sm">
            <option value="">Todos</option>
            <option value="active">Ativo</option>
            <option value="draft">Rascunho</option>
            <option value="discontinued">Descontinuado</option>
            <option value="archived">Arquivado</option>
          </select>
        </div>
        <Button onClick={load} variant="outline">Buscar</Button>
        <Button onClick={() => adminApi.exportActives()} variant="outline">Exportar CSV</Button>
        <label className="cursor-pointer inline-flex items-center px-4 py-2 text-sm border border-primary text-primary rounded hover:bg-primary/5">
          Importar CSV
          <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
        </label>
        <Button onClick={() => navigate('/admin/ativos/new')}>+ Novo ativo</Button>
      </div>

      <Card>
        {loading ? <p className="p-4 text-sm text-gray-500">Carregando…</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="p-2">Nome comercial</th>
                <th className="p-2">Fornecedor</th>
                <th className="p-2">Categoria</th>
                <th className="p-2">Rota</th>
                <th className="p-2">Status</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(a => (
                <tr key={a.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/ativos/${a.id}`)}>
                  <td className="p-2 font-medium">{a.commercial_name}</td>
                  <td className="p-2 text-gray-600">{a.supplier || '—'}</td>
                  <td className="p-2 text-gray-600">{a.category || '—'}</td>
                  <td className="p-2 text-gray-600">{a.route || '—'}</td>
                  <td className="p-2">
                    <Badge variant={a.status === 'active' ? 'success' : a.status === 'discontinued' ? 'danger' : 'default'}>
                      {a.status}
                    </Badge>
                  </td>
                  <td className="p-2 text-right text-xs text-gray-400">→</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-400 text-sm">Nenhum ativo</td></tr>}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

const ACTIVE_FIELD_GROUPS = [
  { title: 'Identificação', fields: ['commercial_name', 'generic_name', 'supplier', 'category', 'subcategory', 'route', 'tni_zone'] },
  { title: 'Clínico', fields: ['mechanism', 'indications', 'dose_min', 'dose_max', 'dose_usual', 'posology'] },
  { title: 'Segurança', fields: ['safety_alerts', 'contraindications', 'interactions'] },
  { title: 'Interno (não enviado à IA)', fields: ['clinical_notes', 'review_source', 'last_reviewed_at'] },
] as const

const FIELD_LABEL: Record<string, string> = {
  commercial_name: 'Nome comercial', generic_name: 'Nome genérico', supplier: 'Fornecedor',
  category: 'Categoria', subcategory: 'Subcategoria', route: 'Via', tni_zone: 'Zona TNI',
  mechanism: 'Mecanismo de ação', indications: 'Indicações', dose_min: 'Dose mínima',
  dose_max: 'Dose máxima', dose_usual: 'Dose usual', posology: 'Posologia',
  safety_alerts: 'Alertas de segurança', contraindications: 'Contraindicações',
  interactions: 'Interações medicamentosas', clinical_notes: 'Notas clínicas internas',
  review_source: 'Fonte da revisão', last_reviewed_at: 'Última revisão',
}

const ROUTES = ['oral', 'IM', 'EV', 'transdermico', 'sublingual', 'vaginal']
const SUPPLIERS = ['Sovita', 'Galena', 'Fagron', 'Infinity', 'Florien', 'Outro']
const TNI_ZONES = ['Z1', 'Z2', 'Z3', 'RESTRITO']

function ActiveDetail() {
  const navigate = useNavigate()
  const isNew = window.location.pathname.endsWith('/new')
  const id = isNew ? null : window.location.pathname.split('/').pop()!
  const [active, setActive] = useState<Active | null>(isNew ? null : null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewAnamnesis, setPreviewAnamnesis] = useState('')
  const [previewOutput, setPreviewOutput] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [changeReason, setChangeReason] = useState('')
  const [changes, setChanges] = useState<Awaited<ReturnType<typeof adminApi.listActiveChanges>>>([])
  const toast = useToast()

  useEffect(() => {
    if (isNew) { setLoading(false); return }
    adminApi.getActive(id!).then(a => {
      setActive(a)
      setForm(Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v == null ? '' : String(v)])))
    }).catch(err => toast.error(err instanceof Error ? err.message : 'Erro')).finally(() => setLoading(false))
    adminApi.listActiveChanges(id!).then(setChanges).catch(() => {})
  }, [id, isNew, toast])

  if (loading) return <p className="text-sm text-gray-500">Carregando…</p>

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isNew) {
        const created = await adminApi.createActive(form as Partial<Active>)
        toast.success('Rascunho salvo')
        navigate(`/admin/ativos/${created.id}`)
      } else {
        await adminApi.updateActive(id!, { ...(form as Partial<Active>), change_reason: changeReason || undefined })
        toast.success('Salvo')
        const refreshed = await adminApi.getActive(id!)
        setActive(refreshed)
        setChangeReason('')
        adminApi.listActiveChanges(id!).then(setChanges)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  const handlePublish = async () => {
    if (!active) return
    if (active.status === 'active' && !confirm('Republicar com as alterações atuais?')) return
    if (active.status !== 'active' && !confirm('Publicar este ativo? Ele aparecerá nas próximas prescrições.')) return
    await adminApi.publishActive(id!)
    toast.success('Publicado')
    setActive(await adminApi.getActive(id!))
  }

  const handleDiscontinue = async () => {
    const reason = prompt('Motivo da descontinuação:')
    if (!reason) return
    await adminApi.discontinueActive(id!, reason)
    toast.success('Descontinuado')
    setActive(await adminApi.getActive(id!))
  }

  const handlePreview = async () => {
    if (!previewAnamnesis.trim()) { toast.error('Insira uma anamnese de teste'); return }
    setPreviewLoading(true)
    try {
      const { output } = await adminApi.previewActive(id!, previewAnamnesis)
      setPreviewOutput(output)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro') }
    finally { setPreviewLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/ativos" className="text-sm text-gray-500 hover:text-gray-700">← Ativos</Link>
          <h1 className="text-2xl font-bold mt-1">{isNew ? 'Novo ativo' : active?.commercial_name || '—'}</h1>
          {active && (
            <Badge variant={active.status === 'active' ? 'success' : active.status === 'discontinued' ? 'danger' : 'default'}>
              {active.status}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} loading={saving}>Salvar rascunho</Button>
          {!isNew && <Button variant="outline" onClick={() => setShowPreview(true)}>Pré-visualizar</Button>}
          {!isNew && <Button onClick={handlePublish}>Publicar</Button>}
          {!isNew && active?.status === 'active' && <Button variant="danger" onClick={handleDiscontinue}>Descontinuar</Button>}
        </div>
      </div>

      {ACTIVE_FIELD_GROUPS.map(group => (
        <Card key={group.title}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">{group.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.fields.map(f => (
              <div key={f}>
                <label className="text-xs text-gray-500 block mb-1">{FIELD_LABEL[f] || f}</label>
                {f === 'supplier' ? (
                  <select value={form[f] || ''} onChange={e => setForm({ ...form, [f]: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-2 text-sm">
                    <option value="">—</option>
                    {SUPPLIERS.map(s => <option key={s}>{s}</option>)}
                  </select>
                ) : f === 'route' ? (
                  <select value={form[f] || ''} onChange={e => setForm({ ...form, [f]: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-2 text-sm">
                    <option value="">—</option>
                    {ROUTES.map(r => <option key={r}>{r}</option>)}
                  </select>
                ) : f === 'tni_zone' ? (
                  <select value={form[f] || ''} onChange={e => setForm({ ...form, [f]: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-2 text-sm">
                    <option value="">—</option>
                    {TNI_ZONES.map(z => <option key={z}>{z}</option>)}
                  </select>
                ) : ['mechanism', 'indications', 'posology', 'safety_alerts', 'contraindications', 'interactions', 'clinical_notes'].includes(f) ? (
                  <textarea value={form[f] || ''} onChange={e => setForm({ ...form, [f]: e.target.value })} rows={3} className="w-full border border-gray-300 rounded px-2 py-2 text-sm" />
                ) : (
                  <input value={form[f] || ''} onChange={e => setForm({ ...form, [f]: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-2 text-sm" />
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}

      {!isNew && active?.status === 'active' && (
        <Card>
          <label className="text-xs text-gray-500 block mb-1">Justificativa da alteração (obrigatória ao editar ativo publicado)</label>
          <input value={changeReason} onChange={e => setChangeReason(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-2 text-sm" />
        </Card>
      )}

      {!isNew && changes.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Histórico de alterações</h2>
          <ul className="space-y-2">
            {changes.map(c => (
              <li key={c.id} className="text-sm border-l-2 border-gray-200 pl-3">
                <p className="font-medium">{c.change_type}{c.field_changed ? ` · ${c.field_changed}` : ''}</p>
                {c.old_value !== undefined && c.new_value !== undefined && c.field_changed && (
                  <p className="text-xs text-gray-500">
                    <span className="line-through">{c.old_value || '∅'}</span> → <span className="text-gray-700">{c.new_value || '∅'}</span>
                  </p>
                )}
                {c.change_reason && <p className="text-xs text-gray-500 italic">"{c.change_reason}"</p>}
                <p className="text-xs text-gray-400">{c.users?.email || '—'} · {formatDate(c.created_at)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Pré-visualização</h2>
            <textarea value={previewAnamnesis} onChange={e => setPreviewAnamnesis(e.target.value)} placeholder="Anamnese de teste — paciente hipotético…" rows={4} className="w-full border border-gray-300 rounded px-2 py-2 text-sm mb-3" />
            <Button onClick={handlePreview} loading={previewLoading}>Gerar pré-visualização</Button>
            {previewOutput && (
              <>
                <p className="mt-4 text-xs bg-yellow-50 border border-yellow-200 rounded p-2 text-yellow-800">⚠ Esta é uma pré-visualização. O ativo ainda não está disponível na plataforma.</p>
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 rounded p-3 mt-2">{previewOutput}</pre>
                <div className="mt-4 flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowPreview(false)}>Voltar e ajustar</Button>
                  <Button onClick={async () => { await handlePublish(); setShowPreview(false) }}>Aprovar e publicar</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Alerts tab
// ────────────────────────────────────────────────────────────────────────────

function AlertsTab() {
  const [alerts, setAlerts] = useState<UrgentAlert[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', source: 'FDA', severity: 'high', show_on_login: true })
  const toast = useToast()

  const load = () => adminApi.listAlerts().then(setAlerts).catch(err => toast.error(err instanceof Error ? err.message : 'Erro'))
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  const handleCreate = async () => {
    try {
      await adminApi.createAlert(form as Partial<UrgentAlert>)
      toast.success('Alerta criado')
      setShowForm(false)
      setForm({ title: '', description: '', source: 'FDA', severity: 'high', show_on_login: true })
      load()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro') }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(s => !s)}>+ Novo alerta urgente</Button>
      </div>

      {showForm && (
        <Card>
          <div className="space-y-3">
            <Input label="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <div>
              <label className="text-xs text-gray-500 block mb-1">Descrição</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} className="w-full border border-gray-300 rounded px-2 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fonte</label>
                <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-2 text-sm">
                  {['FDA', 'ANVISA', 'CFM', 'Literatura', 'Outro'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Severidade</label>
                <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-2 text-sm">
                  <option value="critical">Crítico</option>
                  <option value="high">Alto</option>
                  <option value="medium">Médio</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.show_on_login} onChange={e => setForm({ ...form, show_on_login: e.target.checked })} />
              Exibir banner bloqueante no próximo acesso dos médicos
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleCreate}>Criar alerta</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {alerts.map(a => (
          <Card key={a.id} className={a.severity === 'critical' ? 'border-l-4 border-danger' : ''}>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold flex items-center gap-2">
                  {a.title}
                  {a.severity && <Badge variant={a.severity === 'critical' ? 'danger' : a.severity === 'high' ? 'warning' : 'default'}>{a.severity}</Badge>}
                  <Badge variant={a.status === 'resolved' ? 'success' : 'default'}>{a.status}</Badge>
                </p>
                <p className="text-sm text-gray-600 mt-1">{a.description}</p>
                <p className="text-xs text-gray-400 mt-2">{a.source} · {formatDate(a.created_at)}{a.show_on_login && a.status === 'active' ? ' · banner ativo' : ''}</p>
              </div>
              <div className="flex gap-2">
                {a.status === 'active' && <Button size="sm" variant="outline" onClick={async () => { await adminApi.resolveAlert(a.id); load() }}>Resolver</Button>}
                <Button size="sm" variant="danger" onClick={async () => { if (confirm('Apagar?')) { await adminApi.deleteAlert(a.id); load() } }}>Apagar</Button>
              </div>
            </div>
          </Card>
        ))}
        {alerts.length === 0 && <p className="text-sm text-gray-500 text-center p-8">Nenhum alerta cadastrado</p>}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Protocol tab
// ────────────────────────────────────────────────────────────────────────────

function ProtocolTab() {
  const [versions, setVersions] = useState<ProtocolVersion[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ version_number: '', description: '', system_prompt_text: '' })
  const toast = useToast()

  const load = () => adminApi.listProtocolVersions().then(setVersions).catch(err => toast.error(err instanceof Error ? err.message : 'Erro'))
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  const handleCreate = async () => {
    try {
      await adminApi.createProtocolVersion(form)
      toast.success('Versão criada (rascunho)')
      setShowForm(false)
      setForm({ version_number: '', description: '', system_prompt_text: '' })
      load()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro') }
  }

  const handlePublish = async (id: string) => {
    if (!confirm('Publicar esta versão? A versão atual será arquivada.')) return
    await adminApi.publishProtocolVersion(id)
    toast.success('Publicada')
    load()
  }

  const handleRollback = async (id: string) => {
    const reason = prompt('Motivo do rollback:')
    if (!reason) return
    await adminApi.rollbackProtocolVersion(id, reason)
    toast.success('Rollback executado')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(s => !s)}>+ Nova versão</Button>
      </div>

      {showForm && (
        <Card>
          <div className="space-y-3">
            <Input label="Número da versão" placeholder="1.2" value={form.version_number} onChange={e => setForm({ ...form, version_number: e.target.value })} />
            <Input label="Descrição das mudanças" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <div>
              <label className="text-xs text-gray-500 block mb-1">System prompt completo</label>
              <textarea value={form.system_prompt_text} onChange={e => setForm({ ...form, system_prompt_text: e.target.value })} rows={20} className="w-full border border-gray-300 rounded px-2 py-2 text-sm font-mono" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleCreate}>Salvar como rascunho</Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="p-2">Versão</th>
              <th className="p-2">Descrição</th>
              <th className="p-2">Status</th>
              <th className="p-2">Publicada em</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {versions.map(v => (
              <tr key={v.id} className="border-b">
                <td className="p-2 font-bold">{v.version_number}{v.is_current && ' ★'}</td>
                <td className="p-2 text-gray-600">{v.description}</td>
                <td className="p-2"><Badge variant={v.status === 'active' ? 'success' : 'default'}>{v.status}</Badge></td>
                <td className="p-2 text-xs text-gray-500">{formatDate(v.published_at)}</td>
                <td className="p-2 text-right">
                  {v.status === 'draft' && <Button size="sm" onClick={() => handlePublish(v.id)}>Publicar</Button>}
                  {v.status === 'archived' && <Button size="sm" variant="outline" onClick={() => handleRollback(v.id)}>Reverter</Button>}
                </td>
              </tr>
            ))}
            {versions.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-400 text-sm">Nenhuma versão criada</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Analytics tab
// ────────────────────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<ActivesAnalytics | null>(null)
  const toast = useToast()

  useEffect(() => {
    adminApi.activesAnalytics(days)
      .then(setData)
      .catch(err => toast.error(err instanceof Error ? err.message : 'Erro'))
  }, [days, toast])

  const max = useMemo(() => Math.max(1, ...(data?.top.map(t => t.count) || [0])), [data])

  if (!data) return <p className="text-sm text-gray-500">Carregando…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Analytics de ativos</h1>
        <div>
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm">
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={180}>Últimos 180 dias</option>
          </select>
        </div>
      </div>

      <Card>
        <p className="text-xs text-gray-500 uppercase">Total de prescrições contabilizadas</p>
        <p className="text-3xl font-bold">{data.total_uses}</p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Top 20 ativos</h2>
        <ul className="space-y-1">
          {data.top.map(t => (
            <li key={t.active_id} className="flex items-center gap-2 text-sm">
              <span className="w-48 truncate">{t.commercial_name}</span>
              <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${(t.count / max) * 100}%` }} />
              </div>
              <span className="w-12 text-right text-gray-600">{t.count}</span>
            </li>
          ))}
          {data.top.length === 0 && <li className="text-gray-400 text-sm">Nenhum dado no período</li>}
        </ul>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Por fornecedor</h2>
          <ul className="space-y-1 text-sm">
            {data.by_supplier.map(s => (
              <li key={s.supplier} className="flex justify-between"><span>{s.supplier}</span><span className="font-medium">{s.count}</span></li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Por categoria</h2>
          <ul className="space-y-1 text-sm">
            {data.by_category.map(c => (
              <li key={c.category} className="flex justify-between"><span>{c.category}</span><span className="font-medium">{c.count}</span></li>
            ))}
          </ul>
        </Card>
      </div>

      {data.never_prescribed.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Ativos nunca prescritos no período ({data.never_prescribed.length})</h2>
          <ul className="text-sm space-y-1">
            {data.never_prescribed.slice(0, 30).map(a => <li key={a.id}>{a.commercial_name}</li>)}
          </ul>
        </Card>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Logs tab
// ────────────────────────────────────────────────────────────────────────────

function LogsTab() {
  const [logs, setLogs] = useState<Awaited<ReturnType<typeof adminApi.listAccessLogs>>>([])
  const toast = useToast()

  useEffect(() => {
    adminApi.listAccessLogs(200).then(setLogs).catch(err => toast.error(err instanceof Error ? err.message : 'Erro'))
  }, [toast])

  return (
    <Card>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b">
            <th className="p-2">Quando</th>
            <th className="p-2">Evento</th>
            <th className="p-2">Usuário</th>
            <th className="p-2">IP</th>
            <th className="p-2">Dispositivo</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(l => (
            <tr key={l.id} className="border-b">
              <td className="p-2 text-xs text-gray-500">{formatDate(l.created_at)}</td>
              <td className="p-2"><Badge>{l.event_type}</Badge></td>
              <td className="p-2 text-gray-600">{l.users?.email || l.user_id}</td>
              <td className="p-2 font-mono text-xs">{l.ip_address || '—'}</td>
              <td className="p-2 text-xs text-gray-500">{l.device_info || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
