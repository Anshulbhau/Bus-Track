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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>
  if (!session) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
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
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
