import React, { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { usersApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { useToast } from '../components/ui/Toast'
import { UF_LIST, formatDate } from '../utils/format'
import type { PrescriptionHeader } from '../types'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
      {children}
    </h2>
  )
}

function Toggle({ checked, onChange, label, hint }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
          checked ? 'bg-primary' : 'bg-gray-300',
        ].join(' ')}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={[
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-6' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
    </div>
  )
}

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()

  // ── Section 1: Dados pessoais
  const [editPersonal, setEditPersonal] = useState(false)
  const [personal, setPersonal] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    specialty: profile?.specialty || '',
  })
  const [savingPersonal, setSavingPersonal] = useState(false)

  // ── Section 2: Cabeçalho
  const [editHeader, setEditHeader] = useState(false)
  const [header, setHeader] = useState<PrescriptionHeader>({
    name: profile?.prescription_header?.name || profile?.name || '',
    crm: profile?.prescription_header?.crm || profile?.crm || '',
    state: profile?.prescription_header?.state || profile?.crm_state || '',
    specialty: profile?.prescription_header?.specialty || profile?.specialty || '',
    address: profile?.prescription_header?.address || '',
    phone: profile?.prescription_header?.phone || profile?.phone || '',
    email: profile?.prescription_header?.email || profile?.email || '',
    logo_url: profile?.prescription_header?.logo_url || null,
  })
  const [savingHeader, setSavingHeader] = useState(false)

  // ── Section 3: Clinical prefs
  const [editPrefs, setEditPrefs] = useState(false)
  const [prefs, setPrefs] = useState({
    pref_injectables: profile?.pref_injectables ?? false,
    pref_injectables_detail: profile?.pref_injectables_detail || '',
    pref_hormones: profile?.pref_hormones ?? true,
    pref_anabolics: profile?.pref_anabolics ?? false,
  })
  const [savingPrefs, setSavingPrefs] = useState(false)

  if (!profile) return null

  const handleSavePersonal = async () => {
    setSavingPersonal(true)
    try {
      await usersApi.updateProfile(personal)
      await refreshProfile()
      setEditPersonal(false)
      toast.success('Dados pessoais atualizados!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSavingPersonal(false)
    }
  }

  const handleSaveHeader = async () => {
    setSavingHeader(true)
    try {
      await usersApi.updateProfile({ prescription_header: header })
      await refreshProfile()
      setEditHeader(false)
      toast.success('Cabecalho atualizado!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSavingHeader(false)
    }
  }

  const handleSavePrefs = async () => {
    setSavingPrefs(true)
    try {
      await usersApi.updateProfile(prefs)
      await refreshProfile()
      setEditPrefs(false)
      toast.success('Preferencias atualizadas!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSavingPrefs(false)
    }
  }

  const subscriptionLabels: Record<string, string> = {
    trial: 'Trial',
    active: 'Ativo',
    suspended: 'Suspenso',
    cancelled: 'Cancelado',
  }

  const subscriptionVariants: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    trial: 'info',
    active: 'success',
    suspended: 'danger',
    cancelled: 'danger',
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Perfil</h1>

      {/* Section 1: Dados pessoais */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Dados Pessoais</SectionTitle>
          {!editPersonal ? (
            <Button variant="outline" size="sm" onClick={() => {
              setPersonal({ name: profile.name, phone: profile.phone, specialty: profile.specialty })
              setEditPersonal(true)
            }}>
              Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditPersonal(false)}>Cancelar</Button>
              <Button size="sm" loading={savingPersonal} onClick={handleSavePersonal}>Salvar</Button>
            </div>
          )}
        </div>

        {editPersonal ? (
          <div className="space-y-4">
            <Input label="Nome" name="p_name" value={personal.name}
              onChange={e => setPersonal(p => ({ ...p, name: e.target.value }))} required />
            <Input label="Telefone" type="tel" name="p_phone" value={personal.phone}
              onChange={e => setPersonal(p => ({ ...p, phone: e.target.value }))} placeholder="(11) 99999-9999" />
            <Input label="Especialidade" name="p_specialty" value={personal.specialty}
              onChange={e => setPersonal(p => ({ ...p, specialty: e.target.value }))} />
          </div>
        ) : (
          <dl className="space-y-3">
            {[
              { label: 'Nome', value: profile.name },
              { label: 'E-mail', value: profile.email },
              { label: 'Telefone', value: profile.phone || '—' },
              { label: 'Especialidade', value: profile.specialty || '—' },
              { label: 'CRM', value: `${profile.crm}/${profile.crm_state}` },
            ].map(({ label, value }) => (
              <div key={label} className="grid grid-cols-3 gap-2">
                <dt className="text-xs font-medium text-gray-500">{label}</dt>
                <dd className="col-span-2 text-sm text-gray-800">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      {/* Section 2: Cabecalho da prescricao */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Cabecalho da Prescricao</SectionTitle>
          {!editHeader ? (
            <Button variant="outline" size="sm" onClick={() => setEditHeader(true)}>Editar</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditHeader(false)}>Cancelar</Button>
              <Button size="sm" loading={savingHeader} onClick={handleSaveHeader}>Salvar</Button>
            </div>
          )}
        </div>

        {editHeader ? (
          <div className="space-y-4">
            <Input label="Nome no cabecalho" name="h_name" value={header.name}
              onChange={e => setHeader(h => ({ ...h, name: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="CRM" name="h_crm" value={header.crm}
                onChange={e => setHeader(h => ({ ...h, crm: e.target.value }))} required />
              <Select label="UF" name="h_state" value={header.state}
                onChange={e => setHeader(h => ({ ...h, state: e.target.value }))} required>
                <option value="">UF</option>
                {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </Select>
            </div>
            <Input label="Especialidade" name="h_specialty" value={header.specialty}
              onChange={e => setHeader(h => ({ ...h, specialty: e.target.value }))} />
            <Input label="Endereco" name="h_address" value={header.address}
              onChange={e => setHeader(h => ({ ...h, address: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Telefone" type="tel" name="h_phone" value={header.phone}
                onChange={e => setHeader(h => ({ ...h, phone: e.target.value }))} />
              <Input label="E-mail" type="email" name="h_email" value={header.email}
                onChange={e => setHeader(h => ({ ...h, email: e.target.value }))} />
            </div>
          </div>
        ) : (
          <dl className="space-y-3">
            {[
              { label: 'Nome', value: header.name || '—' },
              { label: 'CRM/UF', value: header.crm && header.state ? `${header.crm}/${header.state}` : '—' },
              { label: 'Especialidade', value: header.specialty || '—' },
              { label: 'Endereco', value: header.address || '—' },
              { label: 'Telefone', value: header.phone || '—' },
              { label: 'E-mail', value: header.email || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="grid grid-cols-3 gap-2">
                <dt className="text-xs font-medium text-gray-500">{label}</dt>
                <dd className="col-span-2 text-sm text-gray-800">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      {/* Section 3: Preferencias clinicas */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Preferencias Clinicas</SectionTitle>
          {!editPrefs ? (
            <Button variant="outline" size="sm" onClick={() => setEditPrefs(true)}>Editar</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditPrefs(false)}>Cancelar</Button>
              <Button size="sm" loading={savingPrefs} onClick={handleSavePrefs}>Salvar</Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Toggle
            checked={prefs.pref_injectables}
            onChange={v => setPrefs(p => ({ ...p, pref_injectables: v }))}
            label="Trabalho com injetaveis IM/EV"
            hint="Prescricao de medicamentos injetaveis"
          />
          {prefs.pref_injectables && (
            <Input
              name="pref_injectables_detail"
              value={prefs.pref_injectables_detail}
              onChange={e => setPrefs(p => ({ ...p, pref_injectables_detail: e.target.value }))}
              placeholder="Quais modalidades? (vitaminas, hormonios, peptideos...)"
              disabled={!editPrefs}
            />
          )}
          <Toggle
            checked={prefs.pref_hormones}
            onChange={v => setPrefs(p => ({ ...p, pref_hormones: v }))}
            label="Prescrevo terapia hormonal"
            hint="TRT, TH feminina, hormonios bioidenticos"
          />
          <Toggle
            checked={prefs.pref_anabolics}
            onChange={v => setPrefs(p => ({ ...p, pref_anabolics: v }))}
            label="Prescrevo anabolizantes supervisionados"
            hint="Uso terapeutico supervisionado"
          />
          {prefs.pref_anabolics && (
            <div className="bg-danger-light border-l-4 border-danger p-3 rounded-r-lg">
              <p className="text-xs text-danger font-medium">
                Requer enquadramento legal rigoroso. Responsabilidade clinica e legal do medico.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Section 4: Conta */}
      <Card>
        <SectionTitle>Conta e Assinatura</SectionTitle>
        <dl className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <dt className="text-xs font-medium text-gray-500">Status</dt>
            <dd className="col-span-2">
              <Badge variant={subscriptionVariants[profile.subscription_status] || 'default'}>
                {subscriptionLabels[profile.subscription_status] || profile.subscription_status}
              </Badge>
            </dd>
          </div>
          {profile.subscription_status === 'trial' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-xs font-medium text-gray-500">Trial expira</dt>
                <dd className="col-span-2 text-sm text-gray-800">{formatDate(profile.trial_ends_at)}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-xs font-medium text-gray-500">Prescricoes usadas</dt>
                <dd className="col-span-2 text-sm text-gray-800">{profile.trial_prescriptions_used} de 3</dd>
              </div>
            </>
          )}
          <div className="grid grid-cols-3 gap-2">
            <dt className="text-xs font-medium text-gray-500">Plano</dt>
            <dd className="col-span-2 text-sm text-gray-800">
              {profile.subscription_status === 'active' ? 'Professional' : 'Trial gratuito'}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Section 5: LGPD */}
      <Card>
        <SectionTitle>LGPD e Privacidade</SectionTitle>
        <dl className="space-y-3 mb-4">
          <div className="grid grid-cols-3 gap-2">
            <dt className="text-xs font-medium text-gray-500">Aceite realizado</dt>
            <dd className="col-span-2 text-sm text-gray-800">{formatDate(profile.legal_accepted_at) || '—'}</dd>
          </div>
        </dl>
        <a
          href={`mailto:privacidade@medrion.com.br?subject=Solicitacao%20de%20exclusao%20de%20dados&body=Solicito%20a%20exclusao%20de%20meus%20dados%20da%20plataforma%20Medrion.%20E-mail%3A%20${encodeURIComponent(profile.email)}`}
          className="inline-flex items-center gap-1.5 text-sm text-danger hover:underline font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Solicitar exclusao de dados
        </a>
      </Card>
    </div>
  )
}
