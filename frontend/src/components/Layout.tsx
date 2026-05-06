import React, { useState, useEffect, useRef } from 'react'
import { Sidebar, MobileMenuButton } from './Sidebar'
import { useAuth } from '../hooks/useAuth'
import { notificationsApi, pharmacyApi } from '../services/api'
import type { Notification } from '../types'
import { differenceInDays, formatDate } from '../utils/format'
import { useToast } from './ui/Toast'
import { SafetyAlertBanner } from './SafetyAlertBanner'

function BellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function parseInviteMessage(raw: string): { text: string; token: string } | null {
  try {
    const parsed = JSON.parse(raw)
    if (parsed.text && parsed.token) return parsed as { text: string; token: string }
  } catch {}
  return null
}

function NotificationsPanel({
  notifications,
  onMarkRead,
  onAcceptInvite,
  onClose,
}: {
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onAcceptInvite: (token: string, notifId: string) => Promise<void>
  onClose: () => void
}) {
  const [accepting, setAccepting] = useState<string | null>(null)

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-card-hover border border-gray-100 z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Notificações</h3>
        <button onClick={onClose} className="text-xs text-primary hover:underline">Fechar</button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">Nenhuma notificação</p>
        ) : (
          notifications.map(n => {
            const invite = n.type === 'invite' ? parseInviteMessage(n.message) : null
            const displayText = invite ? invite.text : n.message

            return (
              <div
                key={n.id}
                className={['px-4 py-3 border-b border-gray-50', !n.read ? 'bg-blue-50/30' : ''].join(' ')}
              >
                <p className="text-sm text-gray-700">{displayText}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(n.created_at)}</p>
                {!n.read && (
                  <div className="flex gap-2 mt-2">
                    {invite && (
                      <button
                        onClick={async () => {
                          setAccepting(n.id)
                          await onAcceptInvite(invite.token, n.id)
                          setAccepting(null)
                        }}
                        disabled={accepting === n.id}
                        className="text-xs bg-primary text-white px-3 py-1 rounded hover:bg-primary/90 disabled:opacity-60"
                      >
                        {accepting === n.id ? 'Aceitando...' : 'Aceitar convite'}
                      </button>
                    )}
                    <button
                      onClick={() => onMarkRead(n.id)}
                      className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
                    >
                      Dispensar
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function TrialBanner({ profile }: { profile: NonNullable<ReturnType<typeof useAuth>['profile']> }) {
  const daysLeft = profile.trial_ends_at
    ? Math.max(0, differenceInDays(new Date(profile.trial_ends_at), new Date()))
    : 0

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-center gap-2 text-xs text-primary">
      <InfoIcon />
      <span>
        Seu trial encerra em <strong>{daysLeft} dias</strong>
        {' '}·{' '}
        <strong>{profile.trial_prescriptions_used} de 3</strong> prescrições usadas
      </span>
    </div>
  )
}

function SuspensionBanner() {
  return (
    <div className="bg-danger text-white px-4 py-2 flex items-center justify-center gap-2 text-xs">
      <InfoIcon />
      <span>
        Sua conta está suspensa. Para reativar, entre em contato com o suporte.
      </span>
    </div>
  )
}

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    notificationsApi
      .getNotifications()
      .then(data => setNotifications(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch {}
  }

  const handleAcceptInvite = async (token: string, notifId: string) => {
    try {
      await pharmacyApi.acceptInvite(token)
      await notificationsApi.markAsRead(notifId)
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n))
      await refreshProfile()
      toast.success('Convite aceito! Bem-vindo à farmácia.')
      setShowNotifications(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aceitar convite')
    }
  }

  return (
    <div className="min-h-screen bg-bg-secondary">
      <SafetyAlertBanner />
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className="lg:pl-60 flex flex-col min-h-screen">
        {/* Banners */}
        {profile?.subscription_status === 'trial' && <TrialBanner profile={profile} />}
        {profile?.subscription_status === 'suspended' && <SuspensionBanner />}

        {/* Top bar (mobile + notifications) */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between lg:justify-end sticky top-0 z-20">
          <MobileMenuButton onClick={() => setMobileOpen(true)} />

          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(v => !v)}
              className="relative p-2 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              aria-label="Notificações"
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <NotificationsPanel
                notifications={notifications}
                onMarkRead={handleMarkRead}
                onAcceptInvite={handleAcceptInvite}
                onClose={() => setShowNotifications(false)}
              />
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
