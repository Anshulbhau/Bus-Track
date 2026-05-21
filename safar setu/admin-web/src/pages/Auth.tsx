import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AccessDenied from '../components/AccessDenied'

export default function Auth() {
  const { session, loading, role, roleLoading } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Theme ──────────────────────────────────────
  const [isLight, setIsLight] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('app-theme')
    if (saved === 'light') {
      setIsLight(true)
      document.documentElement.classList.add('theme-light')
    }
  }, [])

  const toggleTheme = () => {
    const newLight = !isLight
    setIsLight(newLight)
    if (newLight) {
      document.documentElement.classList.add('theme-light')
      localStorage.setItem('app-theme', 'light')
    } else {
      document.documentElement.classList.remove('theme-light')
      localStorage.setItem('app-theme', 'dark')
    }
  }

  // Still determining session state — don't flash the form
  if (loading) return null

  // If there's an active session + role is resolved…
  if (session && !roleLoading) {
    if (role === 'admin') {
      // Admin: redirect to dashboard
      return <Navigate to="/" replace />
    } else {
      // Non-admin: show access denied (which also signs them out)
      return <AccessDenied />
    }
  }

  // Session exists but role is still loading — wait silently
  if (session && roleLoading) return null

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setError(null)

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      // On success the onAuthStateChange listener in AuthContext will
      // update session + trigger fetchRole, causing this component to
      // re-render and hit one of the guards above.
    } else {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: 'admin' } },
      })
      if (signUpError) {
        setError(signUpError.message)
      } else {
        setError('Check your email for the confirmation link.')
      }
    }

    setFormLoading(false)
  }

  return (
    <div
      className="auth-container"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-primary)',
        position: 'relative',
      }}
    >
      {/* Theme Toggle Button */}
      <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
        <button
          className="header__icon-btn"
          title="Toggle Theme"
          onClick={toggleTheme}
          style={{
            background: 'var(--color-bg-glass)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-bg-hover)'
            e.currentTarget.style.color = 'var(--color-text-primary)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--color-bg-glass)'
            e.currentTarget.style.color = 'var(--color-text-secondary)'
          }}
        >
          {isLight ? '🌙' : '☀️'}
        </button>
      </div>

      <div
        className="glass-panel"
        style={{ width: '100%', maxWidth: '400px', padding: '32px' }}
      >
        <h2
          style={{
            marginBottom: '24px',
            textAlign: 'center',
            color: 'var(--color-text-primary)',
          }}
        >
          {isLogin ? 'Admin Sign In' : 'Admin Sign Up'}
        </h2>

        {error && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-danger)',
              color: 'white',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleAuth}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              style={{ width: '100%' }}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%' }}
            />
          </div>
          <button
            type="submit"
            className="btn btn--primary"
            style={{ marginTop: '8px', width: '100%' }}
            disabled={formLoading}
          >
            {formLoading ? 'Processing…' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <p
          style={{
            marginTop: '24px',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: '14px',
          }}
        >
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setIsLogin(!isLogin)
              setError(null)
            }}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  )
}
