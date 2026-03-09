import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Buses from './pages/Buses'
import RoutesPage from './pages/RoutesPage'
import Trips from './pages/Trips'
import Drivers from './pages/Drivers'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/buses" element={<Buses />} />
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/drivers" element={<Drivers />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
