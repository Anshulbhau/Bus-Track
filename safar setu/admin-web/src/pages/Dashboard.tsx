import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import StatCard from '../components/StatCard'
import { useDashboardStats, useTrips, useBuses } from '../hooks/useSupabase'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type LocationMap = Record<string, { lat: number; lng: number; speed: number | null; recorded_at: string }>

function getMapCenter() {
  try {
    const saved = localStorage.getItem('transit_map_center')
    if (saved) return JSON.parse(saved) as { lat: number; lng: number; zoom: number }
  } catch { /* ignore */ }
  return { lat: 32.7266, lng: 74.8570, zoom: 12 }
}

const busIcon = new L.DivIcon({
  className: 'custom-bus-marker',
  html: `<div style="background:var(--color-primary);color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(0,0,0,0.5);border:2px solid white;font-size:18px;">🚌</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18]
})

export default function Dashboard() {
  const { stats, loading: statsLoading } = useDashboardStats()
  const { data: trips, loading: tripsLoading } = useTrips()
  const { data: buses } = useBuses()
  const navigate = useNavigate()
  const [locations, setLocations] = useState<LocationMap>({})
  const mapCenter = getMapCenter()

  useEffect(() => {
    supabase
      .from('vehicle_locations')
      .select('vehicle_id, latitude, longitude, speed, recorded_at')
      .order('recorded_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return
        const map: LocationMap = {}
        for (const loc of data) {
          if (!map[loc.vehicle_id]) {
            map[loc.vehicle_id] = { lat: loc.latitude, lng: loc.longitude, speed: loc.speed, recorded_at: loc.recorded_at }
          }
        }
        setLocations(map)
      })

    const channel = supabase
      .channel('dashboard_vehicle_locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_locations' }, (payload: any) => {
        const loc = payload.new || payload.old
        if (!loc || !loc.vehicle_id) return
        setLocations(prev => ({
          ...prev,
          [loc.vehicle_id]: { lat: loc.latitude, lng: loc.longitude, speed: loc.speed, recorded_at: loc.recorded_at },
        }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h2>Overview</h2>
          <p>Real-time snapshot of your transit network</p>
        </div>
        <button className="btn btn--primary" id="btn-new-trip" onClick={() => navigate('/trips')}>
          + New Trip
        </button>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <StatCard
          icon="🚌"
          label="Total Buses"
          value={statsLoading ? '—' : stats.totalBuses}
          variant="accent"
        />
        <StatCard
          icon="🟢"
          label="Active Trips"
          value={statsLoading ? '—' : stats.activeTrips}
          variant="success"
        />
        <StatCard
          icon="🗺️"
          label="Routes"
          value={statsLoading ? '—' : stats.totalRoutes}
          variant="info"
        />
        <StatCard
          icon="👤"
          label="Registered Drivers"
          value={statsLoading ? '—' : stats.driversOnline}
          variant="warning"
        />
      </div>

      {/* Live Map + Activity Feed */}
      <div className="two-col">
        {/* Map */}
        <div className="glass-panel">
          <div className="glass-panel__header">
            <h3 className="glass-panel__title">Live Fleet Map</h3>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)' }}>
              ● Live
            </span>
          </div>
          <div className="glass-panel__body" style={{ padding: 0 }}>
            <div style={{ height: 340, position: 'relative' }}>
              <MapContainer
                center={[mapCenter.lat, mapCenter.lng]}
                zoom={mapCenter.zoom}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {buses.map(bus => {
                  const loc = locations[bus.id]
                  if (!loc) return null
                  return (
                    <Marker key={bus.id} position={[loc.lat, loc.lng]} icon={busIcon}>
                      <Popup>
                        <strong>🚌 {bus.vehicle_number}</strong>
                        <div style={{ fontSize: 12, marginTop: 4, color: '#555' }}>
                          <div>Driver: {(bus as any).profiles?.name ?? 'Unassigned'}</div>
                          <div>Speed: {loc.speed != null ? `${loc.speed} km/h` : 'N/A'}</div>
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
              </MapContainer>
              {Object.keys(locations).length === 0 && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(11,15,26,0.7)', zIndex: 500, gap: 8, pointerEvents: 'none',
                }}>
                  <span style={{ fontSize: '2rem' }}>📡</span>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center' }}>
                    No buses broadcasting yet
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-panel">
          <div className="glass-panel__header">
            <h3 className="glass-panel__title">Recent Activity</h3>
            <button className="btn btn--ghost" style={{ padding: '6px 14px' }}>
              View All
            </button>
          </div>
          <div className="glass-panel__body">
            <div className="activity-list">
              {tripsLoading ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Loading activity…</p>
              ) : trips.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No trips yet. Schedule one to get started!</p>
              ) : (
                trips.slice(0, 5).map((trip) => (
                  <div className="activity-item" key={trip.id}>
                    <div className="activity-item__icon">
                      {trip.status === 'running' ? '🚌' : trip.status === 'completed' ? '✅' : '🕐'}
                    </div>
                    <div className="activity-item__content">
                      <div className="activity-item__text">
                        <strong>{trip.vehicles?.vehicle_number ?? 'Unknown Bus'}</strong>{' '}
                        {trip.status === 'running' ? 'is on' : trip.status === 'completed' ? 'completed' : 'is scheduled for'}{' '}
                        <strong>{trip.routes?.route_name ?? 'Unknown Route'}</strong>
                        {trip.profiles?.name ? ` — Driver: ${trip.profiles.name}` : ''}
                      </div>
                      <div className="activity-item__time">
                        {new Date(trip.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trips Table */}
      <div className="glass-panel">
        <div className="glass-panel__header">
          <h3 className="glass-panel__title">All Trips</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn--ghost" style={{ padding: '6px 14px' }}>Filter</button>
            <button className="btn btn--ghost" style={{ padding: '6px 14px' }}>Export</button>
          </div>
        </div>
        {tripsLoading ? (
          <div className="glass-panel__body">
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Loading trips…</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Bus</th>
                <th>Route</th>
                <th>Driver</th>
                <th>Started</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {trips.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No trips found</td></tr>
              ) : (
                trips.map((trip) => (
                  <tr key={trip.id}>
                    <td>{trip.vehicles?.vehicle_number ?? '—'}</td>
                    <td>{trip.routes?.route_name ?? '—'}</td>
                    <td>{trip.profiles?.name ?? '—'}</td>
                    <td>{new Date(trip.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <span className={`status-badge status-badge--${trip.status}`}>
                        <span className="status-badge__dot"></span> {trip.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
