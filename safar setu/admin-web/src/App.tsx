import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Buses from './pages/Buses'
import RoutesPage from './pages/RoutesPage'
import Trips from './pages/Trips'
import Drivers from './pages/Drivers'
import LiveMap from './pages/LiveMap'
import Settings from './pages/Settings'
import AuditLogs from './pages/AuditLogs'
import Auth from './pages/Auth'
import AccessDenied from './components/AccessDenied'
import { AuthProvider, useAuth } from './context/AuthContext'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#f1f5f9', fontFamily: 'monospace' }}>
          <h2 style={{ color: '#ef4444', marginBottom: 16 }}>Render Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#94a3b8' }}>
            {(this.state.error as Error).message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

/** Full-screen loading spinner shown while auth / role is being determined */
function AuthLoading({ message }: { message: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: '16px',
        backgroundColor: 'var(--color-bg-primary)',
      }}
    >
      {/* Animated ring */}
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '3px solid rgba(99,102,241,0.15)',
          borderTopColor: 'rgb(99,102,241)',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/**
 * Guards admin routes:
 *  1. Waits for session + role to be resolved.
 *  2. Redirects unauthenticated users to /auth.
 *  3. Shows the AccessDenied screen for authenticated non-admin users
 *     (and signs them out immediately so the session doesn't persist).
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, role, roleLoading } = useAuth()

  // Step 1 – wait for session
  if (loading) return <AuthLoading message="Authenticating…" />

  // Step 2 – not logged in at all → go to login
  if (!session) return <Navigate to="/auth" replace />

  // Step 3 – session exists but role hasn't resolved yet
  if (roleLoading) return <AuthLoading message="Verifying permissions…" />

  // Step 4 – logged in but NOT an admin → show access denied
  if (role !== 'admin') return <AccessDenied />

  // Step 5 – all good, render the protected page
  return <>{children}</>
}

function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<AdminRoute><Layout /></AdminRoute>}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/buses" element={<Buses />} />
              <Route path="/routes" element={<RoutesPage />} />
              <Route path="/trips" element={<Trips />} />
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/live-map" element={<LiveMap />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </AuthProvider>
  )
}

export default App
