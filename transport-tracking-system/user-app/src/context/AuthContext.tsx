import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User, SupabaseClient } from '@supabase/supabase-js'
import * as Linking from 'expo-linking'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

type AuthContextType = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  supabaseClient: SupabaseClient | null
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  supabaseClient: null,
  signInWithPassword: async () => ({ error: null }),
  signUpWithPassword: async () => ({ error: null }),
  signOut: async () => {},
})

async function fetchOrCreateProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!error && data) return data as Profile

  const { error: insertError } = await supabase.from('profiles').upsert({
    id: userId,
    name: 'Passenger',
    role: 'passenger',
  })

  if (!insertError) {
    const { data: newProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return (newProfile as Profile) ?? null
  }

  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Handle deep links for magic link auth
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const { hostname, queryParams } = Linking.parse(url)
      if (hostname === 'callback' || queryParams?.access_token) {
        // Session will be automatically detected by Supabase
        // since we set detectSessionInUrl: true
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchOrCreateProfile(session.user.id).then(setProfile)
      setLoading(false)
    })

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      if (session) {
        const p = await fetchOrCreateProfile(session.user.id)
        setProfile(p)
      } else {
        setProfile(null)
      }
    })

    return () => {
      subscription.remove()
      authSubscription.unsubscribe()
    }
  }, [])

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    return { error: error?.message ?? null }
  }

  const signUpWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: undefined,
      },
    })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        supabaseClient: session ? supabase : null,
        signInWithPassword,
        signUpWithPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
