import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../services/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'

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

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const { signInWithEmail, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const validate = () => {
    const errs: typeof errors = {}
    if (!email) errs.email = 'E-mail obrigatório'
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'E-mail inválido'
    if (!password) errs.password = 'Senha obrigatória'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await signInWithEmail(email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao entrar'
      toast.error(msg.includes('Invalid') ? 'E-mail ou senha incorretos.' : msg)
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

  const handleForgotPassword = async () => {
    if (!email) {
      setErrors({ email: 'Digite seu e-mail para redefinir a senha' })
      return
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setResetSent(true)
      toast.success('Link de redefinição enviado para seu e-mail.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar e-mail'
      toast.error(msg)
    }
  }

  return (
    <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-card w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Medrion</h1>
          <p className="text-sm text-gray-500 mt-1">Prescrições inteligentes para médicos</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            label="E-mail"
            type="email"
            name="email"
            placeholder="seu@email.com"
            value={email}
            onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })) }}
            error={errors.email}
            required
            autoComplete="email"
          />

          <Input
            label="Senha"
            type="password"
            name="password"
            placeholder="••••••••"
            value={password}
            onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
            error={errors.password}
            required
            autoComplete="current-password"
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs text-primary hover:underline"
            >
              {resetSent ? 'E-mail enviado!' : 'Esqueci minha senha'}
            </button>
          </div>

          <Button type="submit" fullWidth loading={loading} size="lg">
            Entrar
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
          Entrar com Google
        </Button>

        <p className="text-center text-sm text-gray-500 mt-6">
          Ainda nao tem conta?{' '}
          <Link to="/cadastro" className="text-primary font-medium hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  )
}
