import { useEffect, useState } from 'react'
import { alertsApi } from '../services/api'
import { Button } from './ui/Button'

interface PendingAlert {
  id: string
  title: string
  description: string
  severity?: string
  source?: string
}

export function SafetyAlertBanner() {
  const [alerts, setAlerts] = useState<PendingAlert[]>([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    alertsApi.getPending().then(setAlerts).catch(() => {})
  }, [])

  if (alerts.length === 0 || current >= alerts.length) return null

  const alert = alerts[current]

  const handleAcknowledge = async () => {
    setLoading(true)
    try {
      await alertsApi.acknowledge(alert.id)
      setCurrent(c => c + 1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-lg shadow-card max-w-lg w-full p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">⚠</span>
          <h2 className="text-lg font-bold text-danger">Alerta clínico importante</h2>
          {alert.severity && (
            <span className={`text-xs px-2 py-0.5 rounded uppercase font-medium ${
              alert.severity === 'critical' ? 'bg-danger text-white' :
              alert.severity === 'high' ? 'bg-orange-500 text-white' : 'bg-yellow-400 text-gray-900'
            }`}>
              {alert.severity}
            </span>
          )}
        </div>
        <h3 className="font-semibold text-gray-900 mb-2">{alert.title}</h3>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{alert.description}</p>
        {alert.source && (
          <p className="text-xs text-gray-500 mt-3">Fonte: {alert.source}</p>
        )}
        <div className="mt-6 flex justify-end">
          <Button onClick={handleAcknowledge} loading={loading}>
            Li e estou ciente
          </Button>
        </div>
        {alerts.length > 1 && (
          <p className="text-xs text-gray-400 text-center mt-3">
            Alerta {current + 1} de {alerts.length}
          </p>
        )}
      </div>
    </div>
  )
}
