import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  session: Session | null
  loading: boolean
  role: string | null
  roleLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  role: null,
  roleLoading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(() => localStorage.getItem('user-role'))
  const [roleLoading, setRoleLoading] = useState(() => !localStorage.getItem('user-role'))

  const lastFetchedUserId = useRef<string | null>(null)

  /** Fetch role from profiles table for the given user id */
  async function fetchRole(userId: string, silent = false) {
    if (!silent) {
      setRoleLoading(true)
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Role fetch error:', error.message)
        setRole(null)
        localStorage.removeItem('user-role')
      } else {
        const fetchedRole = data?.role ?? null
        setRole(fetchedRole)
        if (fetchedRole) {
          localStorage.setItem('user-role', fetchedRole)
        } else {
          localStorage.removeItem('user-role')
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching role:', err)
      setRole(null)
      localStorage.removeItem('user-role')
    } finally {
      setRoleLoading(false)
    }
  }

  async function signOut() {
    setLoading(true)
    setRoleLoading(true)
    try {
      await supabase.auth.signOut()
    } finally {
      setSession(null)
      setRole(null)
      localStorage.removeItem('user-role')
      lastFetchedUserId.current = null
      setLoading(false)
      setRoleLoading(false)
    }
  }

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      if (session?.user) {
        lastFetchedUserId.current = session.user.id
        const cached = localStorage.getItem('user-role')
        fetchRole(session.user.id, !!cached)
      } else {
        localStorage.removeItem('user-role')
        setRole(null)
        setRoleLoading(false)
      }
    })

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)

      if (newSession?.user) {
        if (lastFetchedUserId.current !== newSession.user.id) {
          lastFetchedUserId.current = newSession.user.id
          const cached = localStorage.getItem('user-role')
          fetchRole(newSession.user.id, !!cached)
        } else {
          // Same user session, no need to show loading spinner or re-fetch role from database
          setRoleLoading(false)
        }
      } else {
        lastFetchedUserId.current = null
        setRole(null)
        localStorage.removeItem('user-role')
        setRoleLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, loading, role, roleLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
