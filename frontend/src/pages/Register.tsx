import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usersApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import { UF_LIST } from '../utils/format'

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

interface FormData {
  name: string
  email: string
  password: string
  crm: string
  crm_state: string
  specialty: string
  phone: string
}

interface FormErrors {
  name?: string
  email?: string
  password?: string
  crm?: string
  crm_state?: string
  specialty?: string
}

export default function Register() {
  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    crm: '',
    crm_state: '',
    specialty: '',
    phone: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const { signUpWithEmail, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validate = (): boolean => {
    const errs: FormErrors = {}
    if (!form.name.trim()) errs.name = 'Nome obrigatório'
    if (!form.email.trim()) errs.email = 'E-mail obrigatório'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'E-mail inválido'
    if (!form.password) errs.password = 'Senha obrigatória'
    else if (form.password.length < 6) errs.password = 'Mínimo 6 caracteres'
    if (!form.crm.trim()) errs.crm = 'CRM obrigatório'
    if (!form.crm_state) errs.crm_state = 'Estado obrigatório'
    if (!form.specialty.trim()) errs.specialty = 'Especialidade obrigatória'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await signUpWithEmail(form.email, form.password, form.name)
      // Create profile on backend
      await usersApi.updateProfile({
        name: form.name,
        crm: form.crm,
        crm_state: form.crm_state,
        specialty: form.specialty,
        phone: form.phone,
      })
      toast.success('Conta criada com sucesso!')
      navigate('/onboarding')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conta'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao entrar com Google'
      toast.error(msg)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-card w-full max-w-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Medrion</h1>
          <p className="text-sm text-gray-500 mt-1">Crie sua conta para comecar</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            label="Nome completo"
            name="name"
            placeholder="Dr. João Silva"
            value={form.name}
            onChange={set('name')}
            error={errors.name}
            required
          />

          <Input
            label="E-mail profissional"
            type="email"
            name="email"
            placeholder="seu@email.com"
            value={form.email}
            onChange={set('email')}
            error={errors.email}
            required
            autoComplete="email"
          />

          <Input
            label="Senha"
            type="password"
            name="password"
            placeholder="Mínimo 6 caracteres"
            value={form.password}
            onChange={set('password')}
            error={errors.password}
            required
            autoComplete="new-password"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="CRM"
              name="crm"
              placeholder="123456"
              value={form.crm}
              onChange={set('crm')}
              error={errors.crm}
              required
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
              {UF_LIST.map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </Select>
          </div>

          <Input
            label="Especialidade"
            name="specialty"
            placeholder="Medicina do Esporte"
            value={form.specialty}
            onChange={set('specialty')}
            error={errors.specialty}
            required
          />

          <Input
            label="Telefone"
            type="tel"
            name="phone"
            placeholder="(11) 99999-9999"
            value={form.phone}
            onChange={set('phone')}
          />

          <Button type="submit" fullWidth loading={loading} size="lg">
            Criar conta
          </Button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs text-gray-400">
            <span className="bg-white px-3">ou</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          fullWidth
          size="lg"
          loading={googleLoading}
          onClick={handleGoogle}
        >
          <GoogleIcon />
          Cadastrar com Google
        </Button>

        <p className="text-center text-sm text-gray-500 mt-6">
          Ja tem conta?{' '}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
