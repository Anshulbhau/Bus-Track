import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Auth() {
  const { session } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session) {
    return <Navigate to="/" replace />
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
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

    setLoading(false)
  }

  return (
    <div className="auth-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
        <h2 style={{ marginBottom: '24px', textAlign: 'center', color: 'var(--color-text-primary)' }}>
          {isLogin ? 'Admin Sign In' : 'Admin Sign Up'}
        </h2>
        {error && <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: 'var(--color-danger)', color: 'white', fontSize: '14px' }}>{error}</div>}
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          <button type="submit" className="btn btn--primary" style={{ marginTop: '8px', width: '100%' }} disabled={loading}>
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>
        <p style={{ marginTop: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => { setIsLogin(!isLogin); setError(null) }}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  )
}
