import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usersApi, uploadLogo } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input, Select, PhoneInput } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import { UF_LIST } from '../utils/format'
import type { PrescriptionHeader } from '../types'

const TOTAL_STEPS = 4

// ─── Step 0 — account type selector (Google OAuth users) ─────────────────────

function Step0({
  onDoctor,
  onPharmacy,
}: {
  onDoctor: () => void
  onPharmacy: () => void
}) {
  const [loading, setLoading] = useState<'doctor' | 'pharmacy' | null>(null)
  const toast = useToast()

  const handleSelect = async (type: 'doctor' | 'pharmacy') => {
    setLoading(type)
    try {
      await usersApi.setAccountType(type)
      if (type === 'pharmacy') onPharmacy()
      else onDoctor()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao configurar conta')
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6 py-2">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Como você vai usar o Medrion?</h2>
        <p className="text-sm text-gray-500">Escolha seu perfil para continuar</p>
      </div>
      <div className="grid gap-4">
        <button
          type="button"
          onClick={() => handleSelect('doctor')}
          disabled={!!loading}
          className="flex items-center gap-4 p-5 border-2 border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left disabled:opacity-60"
        >
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Sou médico</p>
            <p className="text-sm text-gray-500 mt-0.5">Gero e gerencio prescrições para meus pacientes</p>
          </div>
          {loading === 'doctor' && (
            <svg className="animate-spin w-5 h-5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => handleSelect('pharmacy')}
          disabled={!!loading}
          className="flex items-center gap-4 p-5 border-2 border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left disabled:opacity-60"
        >
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Represento uma farmácia</p>
            <p className="text-sm text-gray-500 mt-0.5">Gerencio médicos parceiros e acompanho prescrições</p>
          </div>
          {loading === 'pharmacy' && (
            <svg className="animate-spin w-5 h-5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <React.Fragment key={step}>
            <div
              className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all',
                active ? 'bg-primary text-white' : done ? 'bg-success text-white' : 'bg-gray-200 text-gray-500',
              ].join(' ')}
            >
              {done ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step
              )}
            </div>
            {step < TOTAL_STEPS && (
              <div className={['h-0.5 w-10 transition-all', done ? 'bg-success' : 'bg-gray-200'].join(' ')} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Step 1 ──────────────────────────────────────────────────────────────────

interface Step1Data {
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

function Step1({ onNext }: { onNext: (data: Step1Data) => Promise<void> }) {
  const { profile } = useAuth()
  const [form, setForm] = useState<Step1Data>({
    name: profile?.name || '',
    crm: profile?.crm || '',
    crm_state: profile?.crm_state || '',
    specialty: profile?.specialty || '',
    phone: profile?.phone || '',
    pref_injectables: profile?.pref_injectables ?? false,
    pref_injectables_detail: profile?.pref_injectables_detail || '',
    pref_hormones: profile?.pref_hormones ?? true,
    pref_anabolics: profile?.pref_anabolics ?? false,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof Step1Data, string>>>({})
  const [loading, setLoading] = useState(false)

  const set = (field: keyof Step1Data) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const toggle = (field: 'pref_injectables' | 'pref_hormones' | 'pref_anabolics') => () => {
    setForm(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const validate = (): boolean => {
    const errs: typeof errors = {}
    if (!form.name.trim()) errs.name = 'Nome obrigatório'
    if (!form.crm.trim()) errs.crm = 'CRM obrigatório'
    if (!form.crm_state) errs.crm_state = 'Estado obrigatório'
    if (!form.specialty.trim()) errs.specialty = 'Especialidade obrigatória'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await onNext(form)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Perfil e Preferências Clínicas</h2>
        <p className="text-sm text-gray-500">Confirme seus dados e configure suas preferências</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Input
          label="Nome completo / Como prefere ser chamado(a)?"
          name="name"
          value={form.name}
          onChange={set('name')}
          error={errors.name}
          required
          placeholder="Dr. João Silva"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="CRM"
            name="crm"
            value={form.crm}
            onChange={set('crm')}
            error={errors.crm}
            required
            placeholder="123456"
          />
          <Select
            label="Estado do CRM"
            name="crm_state"
            value={form.crm_state}
            onChange={set('crm_state')}
            error={errors.crm_state}
            required
          >
            <option value="">Selecione</option>
            {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </Select>
        </div>

        <Input
          label="Especialidade"
          name="specialty"
          value={form.specialty}
          onChange={set('specialty')}
          error={errors.specialty}
          required
          placeholder="Medicina do Esporte"
        />

        <PhoneInput
          label="Telefone"
          name="phone"
          value={form.phone}
          onChange={v => setForm(prev => ({ ...prev, phone: v }))}
        />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Preferências Clínicas</h3>
        <div className="space-y-4">
          {/* Injetáveis */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-800">Trabalho com injetáveis IM/EV</p>
                <p className="text-xs text-gray-500">Prescrição de medicamentos injetáveis</p>
              </div>
              <button
                type="button"
                onClick={toggle('pref_injectables')}
                className={[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
                  form.pref_injectables ? 'bg-primary' : 'bg-gray-300',
                ].join(' ')}
                role="switch"
                aria-checked={form.pref_injectables}
              >
                <span
                  className={[
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
                    form.pref_injectables ? 'translate-x-6' : 'translate-x-1',
                  ].join(' ')}
                />
              </button>
            </div>
            {form.pref_injectables && (
              <Input
                name="pref_injectables_detail"
                value={form.pref_injectables_detail}
                onChange={set('pref_injectables_detail')}
                placeholder="Quais modalidades você aplica? (ex: vitaminas, hormônios, peptídeos)"
              />
            )}
          </div>

          {/* Hormonal */}
          <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-800">Prescrevo terapia hormonal</p>
              <p className="text-xs text-gray-500">TRT, TH feminina, hormônios bioidênticos</p>
            </div>
            <button
              type="button"
              onClick={toggle('pref_hormones')}
              className={[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
                form.pref_hormones ? 'bg-primary' : 'bg-gray-300',
              ].join(' ')}
              role="switch"
              aria-checked={form.pref_hormones}
            >
              <span
                className={[
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
                  form.pref_hormones ? 'translate-x-6' : 'translate-x-1',
                ].join(' ')}
              />
            </button>
          </div>

          {/* Anabolizantes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-800">Prescrevo anabolizantes supervisionados</p>
                <p className="text-xs text-gray-500">Uso terapêutico supervisionado</p>
              </div>
              <button
                type="button"
                onClick={toggle('pref_anabolics')}
                className={[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
                  form.pref_anabolics ? 'bg-primary' : 'bg-gray-300',
                ].join(' ')}
                role="switch"
                aria-checked={form.pref_anabolics}
              >
                <span
                  className={[
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
                    form.pref_anabolics ? 'translate-x-6' : 'translate-x-1',
                  ].join(' ')}
                />
              </button>
            </div>
            {form.pref_anabolics && (
              <div className="bg-danger-light border-l-4 border-danger p-3 rounded-r-lg">
                <p className="text-xs text-danger font-medium">
                  Atencao: A prescricao de anabolizantes requer enquadramento legal rigoroso (Lei 9.965/2000).
                  O Medrion auxilia na documentacao, mas a responsabilidade clinica e legal e inteiramente do medico.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleNext} loading={loading} size="lg">
          Continuar
        </Button>
      </div>
    </div>
  )
}

// ─── Step 2 ──────────────────────────────────────────────────────────────────

function Step2({
  onNext,
  onBack,
  step1Data,
}: {
  onNext: (data: PrescriptionHeader) => Promise<void>
  onBack: () => void
  step1Data: Step1Data | null
}) {
  const { profile } = useAuth()
  const [form, setForm] = useState<PrescriptionHeader>({
    name: step1Data?.name || profile?.name || '',
    crm: step1Data?.crm || profile?.crm || '',
    state: step1Data?.crm_state || profile?.crm_state || '',
    specialty: step1Data?.specialty || profile?.specialty || '',
    address: '',
    phone: step1Data?.phone || profile?.phone || '',
    email: profile?.email || '',
    logo_url: null,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof PrescriptionHeader, string>>>({})
  const [loading, setLoading] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const set = (field: keyof PrescriptionHeader) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, logo_url: 'Máximo 2MB' }))
      return
    }
    try {
      const base64 = await uploadLogo(file)
      setForm(prev => ({ ...prev, logo_url: base64 }))
      setLogoPreview(base64)
    } catch {}
  }

  const validate = (): boolean => {
    const errs: typeof errors = {}
    if (!form.name.trim()) errs.name = 'Nome obrigatório'
    if (!form.crm.trim()) errs.crm = 'CRM obrigatório'
    if (!form.state) errs.state = 'UF obrigatório'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await onNext(form)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Cabecalho da Prescricao</h2>
        <p className="text-sm text-gray-500">Estes dados aparecerao nos arquivos .docx gerados</p>
      </div>

      <div className="space-y-4">
        <Input
          label="Nome no cabecalho"
          name="header_name"
          value={form.name}
          onChange={set('name')}
          error={errors.name}
          required
          placeholder="Dr. João Silva"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="CRM"
            name="header_crm"
            value={form.crm}
            onChange={set('crm')}
            error={errors.crm}
            required
          />
          <Select
            label="UF"
            name="header_state"
            value={form.state}
            onChange={set('state')}
            error={errors.state}
            required
          >
            <option value="">UF</option>
            {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </Select>
        </div>

        <Input
          label="Especialidade"
          name="header_specialty"
          value={form.specialty}
          onChange={set('specialty')}
          placeholder="Medicina do Esporte"
        />

        <Input
          label="Endereco do consultorio"
          name="header_address"
          value={form.address}
          onChange={set('address')}
          placeholder="Rua das Flores, 123 - Sala 45, São Paulo/SP"
        />

        <div className="grid grid-cols-2 gap-3">
          <PhoneInput
            label="Telefone de contato"
            name="header_phone"
            value={form.phone}
            onChange={v => setForm(prev => ({ ...prev, phone: v }))}
          />
          <Input
            label="E-mail de contato"
            type="email"
            name="header_email"
            value={form.email}
            onChange={set('email')}
            placeholder="contato@clinica.com"
          />
        </div>

        {/* Logo upload */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Logo do consultorio <span className="text-gray-400 font-normal">(opcional, max 2MB)</span>
          </label>
          <div className="flex items-center gap-4">
            {logoPreview && (
              <img src={logoPreview} alt="Logo preview" className="h-16 w-16 object-contain rounded border border-gray-200" />
            )}
            <label className="cursor-pointer bg-bg-secondary hover:bg-gray-200 transition-colors text-sm text-gray-700 px-4 py-2 rounded border border-dashed border-gray-300">
              {logoPreview ? 'Trocar imagem' : 'Escolher arquivo'}
              <input
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleLogoChange}
              />
            </label>
          </div>
          {errors.logo_url && <p className="text-xs text-danger">{errors.logo_url}</p>}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          Voltar
        </Button>
        <Button onClick={handleNext} loading={loading} size="lg">
          Continuar
        </Button>
      </div>
    </div>
  )
}

// ─── Step 3 ──────────────────────────────────────────────────────────────────

function LegalModal({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-card-hover w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Este documento estabelece os termos e condicoes de uso da plataforma Medrion.
            Ao utilizar nossos servicos, voce concorda com todas as disposicoes aqui contidas.
            O Medrion e uma plataforma de apoio a decisao medica. As decisoes clinicas finais
            e a responsabilidade legal sao sempre do medico prescritor habilitado pelo CRM.
            Os dados dos pacientes sao tratados em conformidade com a LGPD (Lei 13.709/2018).
            Para duvidas, entre em contato atraves do suporte.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-gray-100">
          <Button fullWidth onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}

function Step3({
  onNext,
  onBack,
}: {
  onNext: () => Promise<void>
  onBack: () => void
}) {
  const [accepted, setAccepted] = useState(false)
  const [modal, setModal] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const docs = [
    { key: 'terms', label: 'Termos de Uso' },
    { key: 'privacy', label: 'Politica de Privacidade' },
    { key: 'eula', label: 'EULA' },
  ]

  const handleNext = async () => {
    if (!accepted) return
    setLoading(true)
    try {
      await onNext()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {modal && <LegalModal title={docs.find(d => d.key === modal)?.label || ''} onClose={() => setModal(null)} />}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Aceite Legal</h2>
        <p className="text-sm text-gray-500">Leia e aceite os documentos para continuar</p>
      </div>

      <div className="space-y-3">
        {docs.map(doc => (
          <div key={doc.key} className="flex items-center justify-between p-4 bg-bg-secondary rounded-lg">
            <span className="text-sm font-medium text-gray-800">{doc.label}</span>
            <button
              type="button"
              onClick={() => setModal(doc.key)}
              className="text-sm text-primary hover:underline font-medium"
            >
              Ler documento
            </button>
          </div>
        ))}
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={e => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
        />
        <span className="text-sm text-gray-700">
          Li e aceito os{' '}
          <button type="button" onClick={() => setModal('terms')} className="text-primary hover:underline">Termos de Uso</button>
          {', '}
          <button type="button" onClick={() => setModal('privacy')} className="text-primary hover:underline">Politica de Privacidade</button>
          {' e '}
          <button type="button" onClick={() => setModal('eula')} className="text-primary hover:underline">EULA</button>
        </span>
      </label>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          Voltar
        </Button>
        <Button onClick={handleNext} loading={loading} disabled={!accepted} size="lg">
          Continuar
        </Button>
      </div>
    </div>
  )
}

// ─── Step 4 ──────────────────────────────────────────────────────────────────

function Step4({ onBack: _onBack }: { onBack: () => void }) {
  const navigate = useNavigate()

  const cards = [
    {
      title: 'Cadastre o paciente',
      desc: 'Adicione nome, dados clinicos, queixas e objetivo terapeutico.',
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      title: 'Insira anamnese e exames',
      desc: 'Envie laudos, preencha o formulario estruturado ou cole texto livre.',
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: 'Gere a prescricao',
      desc: 'A IA analisa todos os dados e monta as 11 secoes da prescricao.',
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Como funciona</h2>
        <p className="text-sm text-gray-500">Tres passos simples para gerar prescricoes completas</p>
      </div>

      <div className="grid gap-4">
        {cards.map((card, i) => (
          <div key={i} className="flex items-start gap-4 p-4 bg-bg-secondary rounded-lg">
            <div className="flex-shrink-0 w-10 h-10 bg-white rounded-lg shadow-card flex items-center justify-center">
              {card.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{card.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 pt-2">
        <Button size="lg" fullWidth onClick={() => navigate('/pacientes/novo')}>
          Cadastrar meu primeiro paciente
        </Button>
        <Button variant="ghost" size="lg" fullWidth onClick={() => navigate('/dashboard')}>
          Ir para o painel
        </Button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | null>(null)
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null)
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    if (!profile) return
    if (profile.role === 'pharmacy_admin') {
      navigate('/onboarding/farmacia', { replace: true })
      return
    }
    setStep(prev => prev === null ? (profile.crm ? 1 : 0) : prev)
  }, [profile, navigate])

  const handleStep1 = async (data: Parameters<typeof usersApi.onboardingStep1>[0]) => {
    try {
      await usersApi.onboardingStep1(data)
      setStep1Data(data as Step1Data)
      setStep(2)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar dados'
      toast.error(msg)
      throw err
    }
  }

  const handleStep2 = async (data: PrescriptionHeader) => {
    try {
      await usersApi.onboardingStep2({ prescription_header: data })
      setStep(3)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar cabecalho'
      toast.error(msg)
      throw err
    }
  }

  const handleStep3 = async () => {
    try {
      await usersApi.acceptLegal(['terms', 'privacy', 'eula'])
      await usersApi.completeOnboarding()
      await refreshProfile()
      setStep(4)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar aceite'
      toast.error(msg)
      throw err
    }
  }

  if (step === null) {
    return (
      <div className="min-h-screen bg-bg-secondary flex items-center justify-center">
        <div className="text-gray-400 text-sm">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-card w-full max-w-lg p-8">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-primary">Medrion</h1>
        </div>
        {step > 0 && (
          <>
            <p className="text-center text-xs text-gray-400 mb-6">Passo {step} de {TOTAL_STEPS}</p>
            <StepIndicator current={step} />
          </>
        )}

        {step === 0 && (
          <Step0
            onDoctor={() => setStep(1)}
            onPharmacy={() => navigate('/onboarding/farmacia', { replace: true })}
          />
        )}
        {step === 1 && <Step1 onNext={handleStep1} />}
        {step === 2 && <Step2 onNext={handleStep2} onBack={() => setStep(1)} step1Data={step1Data} />}
        {step === 3 && <Step3 onNext={handleStep3} onBack={() => setStep(2)} />}
        {step === 4 && <Step4 onBack={() => setStep(3)} />}
      </div>
    </div>
  )
}
