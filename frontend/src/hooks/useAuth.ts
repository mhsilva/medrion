import { useState, useEffect, useCallback } from 'react'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'
import { usersApi } from '../services/api'
import type { User } from '../types'

interface AuthState {
  user: SupabaseUser | null
  profile: User | null
  session: Session | null
  loading: boolean
  profileLoading: boolean
}

interface AuthActions {
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export function useAuth(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    profileLoading: false,
  })

  const fetchProfile = useCallback(async () => {
    setState(prev => ({ ...prev, profileLoading: true }))
    try {
      const profile = await usersApi.getProfile()
      setState(prev => ({ ...prev, profile, profileLoading: false }))
    } catch {
      setState(prev => ({ ...prev, profile: null, profileLoading: false }))
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    await fetchProfile()
  }, [fetchProfile])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
        loading: false,
      }))
      if (session) {
        fetchProfile()
      }
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
          loading: false,
        }))
        if (session) {
          fetchProfile()
        } else {
          setState(prev => ({ ...prev, profile: null }))
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
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) throw new Error(error.message)
  }

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    })
    if (error) throw new Error(error.message)
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
    setState(prev => ({ ...prev, user: null, profile: null, session: null }))
  }

  return {
    ...state,
    signInWithEmail,
    signInWithGoogle,
    signUpWithEmail,
    signOut,
    refreshProfile,
  }
}
