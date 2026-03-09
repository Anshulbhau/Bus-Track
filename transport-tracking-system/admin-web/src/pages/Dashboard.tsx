import StatCard from '../components/StatCard'
import { useDashboardStats, useTrips } from '../hooks/useSupabase'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const { stats, loading: statsLoading } = useDashboardStats()
  const { data: trips, loading: tripsLoading } = useTrips()
  const navigate = useNavigate()

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
            <div className="map-container">
              <div className="map-container__grid"></div>
              <div className="map-dot" style={{ top: '30%', left: '25%' }}></div>
              <div className="map-dot" style={{ top: '55%', left: '60%' }}></div>
              <div className="map-dot" style={{ top: '40%', left: '75%' }}></div>
              <div className="map-container__icon">🗺️</div>
              <div className="map-container__text">
                Connect a map provider (Mapbox / Google Maps) to see live fleet positions
              </div>
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
                        <strong>{trip.buses?.bus_number ?? 'Unknown Bus'}</strong>{' '}
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
                    <td>{trip.buses?.bus_number ?? '—'}</td>
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
