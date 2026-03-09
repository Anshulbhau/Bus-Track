import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

type AuthContextType = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  supabaseClient: SupabaseClient | null
  sendEmailCode: (email: string) => Promise<{ error: string | null }>
  verifyEmailCode: (email: string, code: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  supabaseClient: null,
  sendEmailCode: async () => ({ error: null }),
  verifyEmailCode: async () => ({ error: null }),
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
    name: 'Driver',
    role: 'driver',
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchOrCreateProfile(session.user.id).then(setProfile)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      if (session) {
        const p = await fetchOrCreateProfile(session.user.id)
        setProfile(p)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const sendEmailCode = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    return { error: error?.message ?? null }
  }

  const verifyEmailCode = async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
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
        sendEmailCode,
        verifyEmailCode,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
