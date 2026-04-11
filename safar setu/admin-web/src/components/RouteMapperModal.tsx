import { useState, useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useRouteStopsDetailed } from '../hooks/useSupabase'
import { insertStop, insertRouteStop, deleteRouteStop } from '../lib/api'

const stopIcon = new L.DivIcon({
  className: 'custom-stop-marker',
  html: `<div style="background:var(--color-primary);color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 5px rgba(0,0,0,0.5);border:2px solid white;font-size:12px;font-weight:bold;">S</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
})

const newStopIcon = new L.DivIcon({
  className: 'custom-stop-marker',
  html: `<div style="background:#10b981;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px rgba(16,185,129,0.6);border:2px solid white;font-size:14px;font-weight:bold;cursor:grab;">+</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
})

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

function DraggableMarker({ position, onDragEnd }: {
  position: [number, number]
  onDragEnd: (lat: number, lng: number) => void
}) {
  const markerRef = useRef<L.Marker>(null)
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current
        if (marker) {
          const latlng = marker.getLatLng()
          onDragEnd(latlng.lat, latlng.lng)
        }
      },
    }),
    [onDragEnd],
  )

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={newStopIcon}
    >
      <Popup>Drag to adjust position</Popup>
    </Marker>
  )
}

interface RouteMapperModalProps {
  routeId: string | null
  open: boolean
  onClose: () => void
}

export default function RouteMapperModal({ routeId, open, onClose }: RouteMapperModalProps) {
  const { data: routeStops, loading, refetch } = useRouteStopsDetailed(routeId || '')
  
  const [form, setForm] = useState({ stop_name: '', lat: '', lng: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (open && routeId) refetch()
  }, [open, routeId, refetch])

  if (!open || !routeId) return null

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleAddStop(e: React.FormEvent) {
    e.preventDefault()
    if (!form.lat || !form.lng || !form.stop_name) return

    setSaving(true)
    // 1. Create the stop
    const { data: newStop, error: stopError } = await insertStop({
      stop_name: form.stop_name,
      latitude: Number(form.lat),
      longitude: Number(form.lng)
    })

    if (stopError || !newStop) {
      showToast(stopError?.message || 'Error creating stop', 'error')
      setSaving(false)
      return
    }

    // 2. Link it to the route
    const nextOrder = (routeStops?.length || 0) + 1
    const { error: linkError } = await insertRouteStop({
      route_id: routeId!,
      stop_id: newStop.id,
      stop_order: nextOrder
    })

    setSaving(false)
    if (linkError) {
      showToast(linkError.message, 'error')
    } else {
      showToast('Stop added successfully!')
      setForm({ stop_name: '', lat: '', lng: '' })
      refetch()
    }
  }

  async function handleDeleteRouteStop(id: string) {
    if (!confirm('Remove this stop from the route?')) return
    const { error } = await deleteRouteStop(id)
    if (error) showToast(error.message, 'error')
    else {
      showToast('Stop removed!')
      refetch()
    }
  }

  // Calculate default map center based on existing stops, or fallback
  const fallbackCenter: [number, number] = [32.7266, 74.8570]
  const center: [number, number] = routeStops?.length && routeStops[0].stops
    ? [routeStops[0].stops.latitude, routeStops[0].stops.longitude]
    : fallbackCenter

  // Prepare line coordinates
  const polylinePositions: [number, number][] = (routeStops || [])
    .filter(rs => rs.stops)
    .map(rs => [rs.stops.latitude, rs.stops.longitude])

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} style={{ display: 'flex' }} />
      <div className="modal-content" style={{ display: 'block', maxWidth: '1000px', width: '90%', padding: '24px' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Map & Stops Management</h2>
          <button className="btn btn--ghost btn--sm" onClick={onClose} style={{ fontSize: '1.5rem', padding: '0 8px' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: '24px', height: '600px' }}>
          
          {/* Left Panel - Stops List & Form */}
          <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            <div style={{ background: 'var(--color-bg-glass)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '1rem' }}>Add New Stop</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                Click the map to place a stop, then <strong>drag the marker</strong> to adjust. You can also type coordinates manually.
              </p>
              
              <form onSubmit={handleAddStop} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.85rem' }}>Stop Name</label>
                  <input required placeholder="e.g. Central Station" value={form.stop_name} onChange={e => setForm(f => ({ ...f, stop_name: e.target.value }))} style={{ padding: '8px', fontSize: '0.9rem' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                    <label style={{ fontSize: '0.85rem' }}>Latitude</label>
                    <input required type="number" step="any" value={form.lat} placeholder="e.g. 32.7266" onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} style={{ padding: '8px', fontSize: '0.9rem' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                    <label style={{ fontSize: '0.85rem' }}>Longitude</label>
                    <input required type="number" step="any" value={form.lng} placeholder="e.g. 74.8570" onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} style={{ padding: '8px', fontSize: '0.9rem' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn--ghost" onClick={() => setForm({ stop_name: '', lat: '', lng: '' })} disabled={!form.lat && !form.stop_name} style={{ flex: '1' }}>
                    Clear
                  </button>
                  <button type="submit" className="btn btn--primary" disabled={saving || !form.lat} style={{ flex: '2' }}>
                    {saving ? 'Adding...' : 'Add Stop'}
                  </button>
                </div>
              </form>
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Sequence of Stops</h3>
              {loading ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Loading stops...</p>
              ) : routeStops?.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>No stops added yet.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {routeStops.map((rs: any, index: number) => (
                    <li key={rs.id} style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'var(--color-bg-glass)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            {index + 1}
                          </span>
                          <span style={{ fontWeight: '500', fontSize: '0.95rem' }}>{rs.stops?.stop_name}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                          Lat: {rs.stops?.latitude?.toFixed(4)} • Lng: {rs.stops?.longitude?.toFixed(4)}
                        </div>
                      </div>
                      <button className="btn btn--danger btn--sm" style={{ padding: '4px 8px' }} onClick={() => handleDeleteRouteStop(rs.id)}>×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right Panel - Map */}
          <div style={{ flex: 1, borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
              <MapEvents onMapClick={(lat, lng) => setForm(f => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }))} />
              
              {routeStops?.filter((rs:any) => rs.stops).map((rs: any, index: number) => (
                <Marker key={rs.id} position={[rs.stops.latitude, rs.stops.longitude]} icon={stopIcon}>
                  <Popup>
                    <strong>{index + 1}. {rs.stops.stop_name}</strong>
                  </Popup>
                </Marker>
              ))}

              {polylinePositions.length > 1 && (
                <Polyline positions={polylinePositions} color="var(--color-primary)" weight={4} opacity={0.7} />
              )}
              
              {/* Draggable tentative marker for new stop */}
              {form.lat && form.lng && !isNaN(Number(form.lat)) && !isNaN(Number(form.lng)) && (
                <DraggableMarker
                  position={[Number(form.lat), Number(form.lng)]}
                  onDragEnd={(lat, lng) => setForm(f => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }))}
                />
              )}
            </MapContainer>
          </div>

        </div>

        {toast && (
          <div className={`toast toast--${toast.type}`} style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}>
            {toast.msg}
          </div>
        )}
      </div>
    </>
  )
}
