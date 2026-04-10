import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { useBuses } from '../hooks/useSupabase'

type LocationMap = Record<string, {
  lat: number
  lng: number
  speed: number | null
  recorded_at: string
}>

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

export default function LiveMap() {
  const { data: buses } = useBuses()
  const [locations, setLocations] = useState<LocationMap>({})
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const mapCenter = getMapCenter()

  useEffect(() => {
    async function fetchLatestLocations() {
      const { data } = await supabase
        .from('vehicle_locations')
        .select('vehicle_id, latitude, longitude, speed, recorded_at')
        .order('recorded_at', { ascending: false })

      if (data) {
        const map: LocationMap = {}
        for (const loc of data) {
          if (!map[loc.vehicle_id]) {
            map[loc.vehicle_id] = {
              lat: loc.latitude,
              lng: loc.longitude,
              speed: loc.speed,
              recorded_at: loc.recorded_at,
            }
          }
        }
        setLocations(map)
        if (data.length > 0) setLastUpdate(new Date())
      }
    }

    fetchLatestLocations()

    // Real-time subscription for new location pings
    const channel = supabase
      .channel('bus_locations_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vehicle_locations' }, (payload: any) => {
        const loc = payload.new
        setLocations(prev => ({
          ...prev,
          [loc.vehicle_id]: {
            lat: loc.latitude,
            lng: loc.longitude,
            speed: loc.speed,
            recorded_at: loc.recorded_at,
          },
        }))
        setLastUpdate(new Date())
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const activeBuses = buses.filter(b => locations[b.id])
  const totalLocations = Object.keys(locations).length

  return (
    <>
      <div className="page-header">
        <div className="page-header__left">
          <h2>Live Map</h2>
          <p>Real-time bus tracking across the transit network</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: totalLocations > 0 ? 'var(--color-success)' : 'var(--color-text-muted)',
            display: 'inline-block',
            boxShadow: totalLocations > 0 ? '0 0 6px var(--color-success)' : 'none',
          }} />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Waiting for data…'}
          </span>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card stat-card--accent">
          <div className="stat-card__header"><div className="stat-card__icon">🚌</div></div>
          <div className="stat-card__value">{buses.length}</div>
          <div className="stat-card__label">Total Fleet</div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-card__header"><div className="stat-card__icon">📍</div></div>
          <div className="stat-card__value">{totalLocations}</div>
          <div className="stat-card__label">Broadcasting Location</div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-card__header"><div className="stat-card__icon">📡</div></div>
          <div className="stat-card__value">{buses.length - totalLocations}</div>
          <div className="stat-card__label">Offline</div>
        </div>
      </div>

      <div className="glass-panel">
        <div className="glass-panel__header">
          <h3 className="glass-panel__title">Transit Network Map</h3>
          <span style={{
            fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
            background: 'var(--color-bg-glass)', padding: '4px 10px',
            borderRadius: 20, border: '1px solid var(--color-border)',
          }}>
            OpenStreetMap · Live
          </span>
        </div>
        <div style={{ height: 500, position: 'relative' }}>
          <MapContainer
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={mapCenter.zoom}
            style={{ height: '100%', width: '100%' }}
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
                    <div style={{ minWidth: 160 }}>
                      <strong style={{ fontSize: 14 }}>🚌 {bus.vehicle_number}</strong>
                      <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6, color: '#444' }}>
                        <div>Driver: <strong>{(bus as any).profiles?.name ?? 'Unassigned'}</strong></div>
                        <div>Speed: <strong>{loc.speed != null ? `${loc.speed} km/h` : 'N/A'}</strong></div>
                        <div>Updated: {new Date(loc.recorded_at).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>

          {totalLocations === 0 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(11,15,26,0.75)', zIndex: 500, gap: 12,
              pointerEvents: 'none',
            }}>
              <span style={{ fontSize: '2.5rem' }}>📡</span>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                No bus locations available yet
              </p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                Locations will appear once drivers start broadcasting
              </p>
            </div>
          )}
        </div>
      </div>

      {activeBuses.length > 0 && (
        <div className="glass-panel" style={{ marginTop: 24 }}>
          <div className="glass-panel__header">
            <h3 className="glass-panel__title">Active Buses</h3>
            <span style={{
              background: 'var(--color-success-glow)', color: 'var(--color-success)',
              fontSize: 'var(--font-size-xs)', fontWeight: 600,
              padding: '3px 10px', borderRadius: 20,
            }}>
              {activeBuses.length} online
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Bus</th>
                <th>Driver</th>
                <th>Speed</th>
                <th>Coordinates</th>
                <th>Last Update</th>
              </tr>
            </thead>
            <tbody>
              {activeBuses.map(bus => {
                const loc = locations[bus.id]
                return (
                  <tr key={bus.id}>
                    <td>{bus.vehicle_number}</td>
                    <td>{(bus as any).profiles?.name ?? <span style={{ color: 'var(--color-text-muted)' }}>Unassigned</span>}</td>
                    <td>{loc.speed != null ? `${loc.speed} km/h` : '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                    </td>
                    <td>{new Date(loc.recorded_at).toLocaleTimeString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
