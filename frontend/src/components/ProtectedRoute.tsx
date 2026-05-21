import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PageLoader } from './ui/LoadingSpinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: Array<'doctor' | 'admin' | 'pharmacy_admin'>
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, profile, loading, profileLoading, mfaRequired } = useAuth()
  const location = useLocation()

  if (loading || profileLoading) return <PageLoader />

  if (!session) return <Navigate to="/login" replace />

  if (mfaRequired && location.pathname !== '/verificar-codigo') {
    return <Navigate to="/verificar-codigo" replace />
  }

  if (profile && !profile.onboarding_completed) {
    const onboardingPath =
      profile.role === 'pharmacy_admin' ? '/onboarding/farmacia' : '/onboarding'
    if (location.pathname !== onboardingPath) {
      return <Navigate to={onboardingPath} replace />
    }
  }

  if (profile && profile.subscription_status === 'suspended' && location.pathname !== '/pagamento-pendente') {
    return <Navigate to="/pagamento-pendente" replace />
  }

  if (
    profile?.role === 'pharmacy_admin' &&
    profile?.subscription_status === 'trial' &&
    profile?.onboarding_completed &&
    location.pathname !== '/onboarding/farmacia'
  ) {
    return <Navigate to="/onboarding/farmacia" replace />
  }

  if (
    profile?.role === 'doctor' &&
    profile?.subscription_status === 'trial' &&
    profile?.trial_ends_at &&
    new Date(profile.trial_ends_at) < new Date() &&
    location.pathname !== '/checkout'
  ) {
    return <Navigate to="/checkout" replace />
  }

  // pharmacy_admin sem onboarding completo pode chegar em /onboarding/farmacia — ok
  // pharmacy_admin com onboarding completo tentando acessar rotas de médico → redireciona
  if (profile?.role === 'pharmacy_admin' && allowedRoles && !allowedRoles.includes('pharmacy_admin')) {
    return <Navigate to="/farmacia/dashboard" replace />
  }

  // doctor tentando acessar rotas de farmácia → redireciona
  if (profile?.role === 'doctor' && allowedRoles && !allowedRoles.includes('doctor')) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
