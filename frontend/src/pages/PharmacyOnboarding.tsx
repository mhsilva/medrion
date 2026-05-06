import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pharmacyApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'

type Step = 1 | 2 | 3

interface Step1Data {
  name: string
  cnpj: string
  responsible_name: string
  responsible_email: string
  phone: string
}

function formatCNPJ(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function ProgressBar({ step }: { step: Step }) {
  const steps = ['Dados da farmácia', 'Documentos legais', 'Ativar plano']
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const num = i + 1
        const done = step > num
        const active = step === num
        return (
          <React.Fragment key={num}>
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${done ? 'bg-primary text-white' : active ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}
              >
                {done ? '✓' : num}
              </div>
              <span className={`text-xs mt-1 whitespace-nowrap ${active ? 'text-primary font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 ${done ? 'bg-primary' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function Step1Form({ onNext }: { onNext: (data: Step1Data) => void }) {
  const [form, setForm] = useState<Step1Data>({
    name: '', cnpj: '', responsible_name: '', responsible_email: '', phone: '',
  })
  const [errors, setErrors] = useState<Partial<Step1Data>>({})
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const set = (field: keyof Step1Data) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value
    if (field === 'cnpj') val = formatCNPJ(val)
    setForm(prev => ({ ...prev, [field]: val }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validate = () => {
    const errs: Partial<Step1Data> = {}
    if (!form.name.trim()) errs.name = 'Razão social obrigatória'
    if (!form.cnpj.trim() || form.cnpj.replace(/\D/g, '').length !== 14) errs.cnpj = 'CNPJ inválido'
    if (!form.responsible_name.trim()) errs.responsible_name = 'Nome do responsável obrigatório'
    if (!form.responsible_email.trim() || !/\S+@\S+\.\S+/.test(form.responsible_email))
      errs.responsible_email = 'E-mail inválido'
    if (!form.phone.trim()) errs.phone = 'Telefone obrigatório'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await pharmacyApi.onboardingStep1({
        ...form,
        cnpj: form.cnpj.replace(/\D/g, ''),
      })
      onNext(form)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar dados')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Input
        label="Razão social"
        placeholder="Farmácia Exemplo Ltda"
        value={form.name}
        onChange={set('name')}
        error={errors.name}
        required
      />
      <Input
        label="CNPJ"
        placeholder="00.000.000/0001-00"
        value={form.cnpj}
        onChange={set('cnpj')}
        error={errors.cnpj}
        required
      />
      <Input
        label="Nome do responsável"
        placeholder="João Silva"
        value={form.responsible_name}
        onChange={set('responsible_name')}
        error={errors.responsible_name}
        required
      />
      <Input
        label="E-mail do responsável"
        type="email"
        placeholder="responsavel@farmacia.com.br"
        value={form.responsible_email}
        onChange={set('responsible_email')}
        error={errors.responsible_email}
        required
      />
      <Input
        label="Telefone"
        type="tel"
        placeholder="(11) 99999-9999"
        value={form.phone}
        onChange={set('phone')}
        error={errors.phone}
        required
      />
      <Button type="submit" fullWidth size="lg" loading={loading}>
        Continuar
      </Button>
    </form>
  )
}

function Step2Form({ onNext }: { onNext: () => void }) {
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accepted) {
      toast.error('Você precisa aceitar os documentos para continuar')
      return
    }
    setLoading(true)
    try {
      await pharmacyApi.onboardingStep2(['terms', 'privacy', 'eula', 'dpa'])
      onNext()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar aceite')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm text-gray-700">
        <p className="font-medium text-gray-900">Documentos obrigatórios:</p>
        {[
          'Termos de Uso (v1.0)',
          'Política de Privacidade — LGPD (v1.0)',
          'Contrato de Licença de Software — EULA (v1.0)',
          'DPA — Data Processing Agreement (v1.0)',
        ].map(doc => (
          <div key={doc} className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>{doc}</span>
          </div>
        ))}
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={e => setAccepted(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary"
        />
        <span className="text-sm text-gray-700">
          Li e aceito os Termos de Uso, Política de Privacidade, EULA e DPA em nome desta farmácia.
        </span>
      </label>

      <Button type="submit" fullWidth size="lg" loading={loading} disabled={!accepted}>
        Aceitar e continuar
      </Button>
    </form>
  )
}

function Step3Placeholder({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="text-center space-y-6 py-4">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Farmácia cadastrada com sucesso!</h3>
        <p className="text-gray-500 mt-2 text-sm">
          Sua farmácia está pronta. A ativação do plano de assinaturas será disponibilizada em breve.
        </p>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 text-left">
        <p className="font-medium mb-1">O que você pode fazer agora:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Convidar médicos para a plataforma</li>
          <li>Acompanhar as prescrições geradas</li>
          <li>Gerenciar o acesso da sua equipe</li>
        </ul>
      </div>
      <Button onClick={onFinish} fullWidth size="lg">
        Acessar painel da farmácia
      </Button>
    </div>
  )
}

export default function PharmacyOnboarding() {
  const [step, setStep] = useState<Step>(1)
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()

  const handleStep1Done = () => setStep(2)
  const handleStep2Done = () => setStep(3)
  const handleFinish = async () => {
    await refreshProfile()
    navigate('/farmacia/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-card w-full max-w-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Medrion</h1>
          <p className="text-sm text-gray-500 mt-1">Cadastro de farmácia</p>
        </div>

        <ProgressBar step={step} />

        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados da farmácia</h2>
            <Step1Form onNext={handleStep1Done} />
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Documentos legais</h2>
            <Step2Form onNext={handleStep2Done} />
          </>
        )}
        {step === 3 && <Step3Placeholder onFinish={handleFinish} />}
      </div>
    </div>
  )
}
