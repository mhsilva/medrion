import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { billingApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'

export default function Checkout() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (params.get('status') === 'cancelled') {
      toast.info('Checkout cancelado. Você pode tentar novamente quando quiser.')
    }
  }, [params, toast])

  const handleStart = async () => {
    setLoading(true)
    try {
      const { url } = await billingApi.doctorCheckout()
      window.location.href = url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao iniciar checkout')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-card w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-primary">Plano Medrion</h1>
          <p className="text-sm text-gray-500 mt-1">Médico direto · trial de 7 dias</p>
        </div>

        <div className="bg-bg-secondary rounded-lg p-5 mb-6">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-3xl font-bold text-gray-900">R$ 497</span>
            <span className="text-sm text-gray-500">/mês</span>
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span className="text-success">✓</span>
              <span>7 dias de trial gratuito (até 3 prescrições)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-success">✓</span>
              <span>Cartão obrigatório, cobrança só após o trial</span>
            </li>
            <li className="flex gap-2">
              <span className="text-success">✓</span>
              <span>Cancele a qualquer momento</span>
            </li>
          </ul>
        </div>

        <Button onClick={handleStart} fullWidth size="lg" loading={loading}>
          Continuar para o pagamento
        </Button>

        <button
          onClick={() => navigate('/dashboard')}
          className="block mx-auto mt-4 text-sm text-gray-500 hover:text-gray-700"
        >
          Voltar
        </button>

        <p className="text-xs text-gray-400 text-center mt-6">
          Pagamento processado pela Stripe. Você será redirecionado para a página segura.
        </p>
      </div>
    </div>
  )
}
