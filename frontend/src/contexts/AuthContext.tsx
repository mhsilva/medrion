import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'
import { usersApi, authApi, setSessionId, getSessionId } from '../services/api'
import type { User } from '../types'

interface AuthState {
  user: SupabaseUser | null
  profile: User | null
  session: Session | null
  loading: boolean
  profileLoading: boolean
  mfaRequired: boolean
}

interface AuthActions {
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  startSession: () => Promise<void>
  markMfaVerified: () => void
}

const AuthContext = createContext<(AuthState & AuthActions) | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    profileLoading: false,
    mfaRequired: false,
  })

  // tracks which user ID we already fetched — prevents duplicate calls
  const fetchedForRef = useRef<string | null>(null)

  const fetchProfile = useCallback(async (userId: string) => {
    if (fetchedForRef.current === userId) return
    fetchedForRef.current = userId
    setState(prev => ({ ...prev, profileLoading: true }))
    try {
      const profile = await usersApi.getProfile()
      setState(prev => ({ ...prev, profile, profileLoading: false }))
    } catch {
      setState(prev => ({ ...prev, profile: null, profileLoading: false }))
    }
  }, [])

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on mount — use it as the
    // single source of truth so we don't double-fetch with getSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
          loading: false,
        }))

        if (session) {
          fetchProfile(session.user.id)
          // SIGNED_IN: brand-new login → kick off server session + OTP
          if (event === 'SIGNED_IN' && !getSessionId()) {
            authApi.startSession()
              .then(({ session_id, mfa_required }) => {
                setSessionId(session_id)
                setState(prev => ({ ...prev, mfaRequired: mfa_required }))
              })
              .catch(() => {/* falhou — frontend trata via redirect */})
          }
        } else if (event === 'SIGNED_OUT') {
          fetchedForRef.current = null
          setSessionId(null)
          setState(prev => ({ ...prev, profile: null, mfaRequired: false }))
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) throw new Error(error.message)
  }

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) throw new Error(error.message)
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
    setState(prev => ({ ...prev, user: null, profile: null, session: null }))
  }

  return (
    <AuthContext.Provider value={{
      ...state,
      signInWithEmail,
      signInWithGoogle,
      signUpWithEmail,
      signOut,
      refreshProfile: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          fetchedForRef.current = null
          await fetchProfile(session.user.id)
        }
      },
      startSession: async () => {
        const { session_id, mfa_required } = await authApi.startSession()
        setSessionId(session_id)
        setState(prev => ({ ...prev, mfaRequired: mfa_required }))
      },
      markMfaVerified: () => {
        setState(prev => ({ ...prev, mfaRequired: false }))
      },
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
