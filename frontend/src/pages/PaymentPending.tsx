import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { billingApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'

export default function PaymentPending() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  const handlePortal = async () => {
    setLoading(true)
    try {
      const { url } = await billingApi.portal()
      window.location.href = url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao abrir portal')
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-card w-full max-w-md p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso suspenso</h1>
        <p className="text-gray-600 text-sm mb-6">
          Identificamos uma falha no pagamento da sua assinatura. Para retomar o acesso ao Medrion, atualize seu meio de pagamento.
        </p>
        {profile?.email && (
          <p className="text-xs text-gray-500 mb-6">Conta: {profile.email}</p>
        )}
        <Button onClick={handlePortal} fullWidth size="lg" loading={loading}>
          Atualizar pagamento
        </Button>
        <button
          onClick={handleLogout}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700"
        >
          Sair da conta
        </button>
      </div>
    </div>
  )
}
