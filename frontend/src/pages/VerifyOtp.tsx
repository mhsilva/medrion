import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'

export default function VerifyOtp() {
  const { user, mfaRequired, markMfaVerified } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(60)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    if (!mfaRequired) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, mfaRequired, navigate])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (resendCountdown <= 0) return
    const t = setInterval(() => setResendCountdown(v => Math.max(0, v - 1)), 1000)
    return () => clearInterval(t)
  }, [resendCountdown])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) {
      toast.error('Digite o código de 6 dígitos')
      return
    }
    setLoading(true)
    try {
      await authApi.verifyOtp(code)
      markMfaVerified()
      toast.success('Acesso liberado')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Código inválido')
      setCode('')
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    try {
      await authApi.resendOtp()
      toast.success('Novo código enviado para seu e-mail')
      setResendCountdown(60)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reenviar')
    }
  }

  return (
    <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-card w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-primary">Verificação de acesso</h1>
          <p className="text-sm text-gray-500 mt-2">
            Enviamos um código de 6 dígitos para{' '}
            <span className="font-medium text-gray-700">{user?.email}</span>
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full text-center text-3xl font-mono tracking-[0.5em] py-4 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none"
          />
          <Button type="submit" fullWidth size="lg" loading={loading} disabled={code.length !== 6}>
            Verificar
          </Button>
        </form>

        <div className="text-center mt-6">
          {resendCountdown > 0 ? (
            <p className="text-xs text-gray-500">
              Reenviar código em {resendCountdown}s
            </p>
          ) : (
            <button
              onClick={handleResend}
              className="text-sm text-primary hover:underline font-medium"
            >
              Reenviar código
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          O código expira em 10 minutos. Não compartilhe com ninguém.
        </p>
      </div>
    </div>
  )
}
