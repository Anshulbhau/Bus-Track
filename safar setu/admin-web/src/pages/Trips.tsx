import { useState } from 'react'
import { useTrips, useBuses, useRoutes, useDrivers } from '../hooks/useSupabase'
import { insertTrip, updateTrip, deleteTrip } from '../lib/api'
import Modal from '../components/Modal'
import { supabase } from '../lib/supabase'

async function getRouteDurationMinutes(routeId: string): Promise<number> {
  const { data, error } = await supabase
    .from('route_stops')
    .select('avg_travel_time_minutes')
    .eq('route_id', routeId)
  
  if (error || !data) return 0
  return data.reduce((sum, stop) => sum + Number(stop.avg_travel_time_minutes || 0), 0)
}

async function validateTrip(
  vehicleId: string,
  status: string,
  startTimeStr: string,
  excludeTripId: string | null = null
): Promise<{ isValid: boolean; message?: string }> {
  // 1. Fetch running trips for this vehicle
  const { data: runningTrips, error: fetchError } = await supabase
    .from('trips')
    .select('id, start_time, route_id')
    .eq('vehicle_id', vehicleId)
    .eq('status', 'running')

  if (fetchError) {
    return { isValid: false, message: `Validation error: ${fetchError.message}` }
  }

  // Filter out the trip currently being edited
  const otherRunningTrips = runningTrips
    ? runningTrips.filter((t) => t.id !== excludeTripId)
    : []

  if (otherRunningTrips.length > 0) {
    if (status === 'running') {
      return { isValid: false, message: 'This bus is currently running another trip.' }
    }

    if (status === 'scheduled') {
      const scheduledStartTime = new Date(startTimeStr).getTime()
      
      for (const runningTrip of otherRunningTrips) {
        const routeDuration = await getRouteDurationMinutes(runningTrip.route_id)
        const runningStart = new Date(runningTrip.start_time).getTime()
        const expectedArrival = runningStart + routeDuration * 60 * 1000

        if (scheduledStartTime <= expectedArrival) {
          return { isValid: false, message: 'This bus is already occupied during the selected time.' }
        }
      }
    }
  }

  return { isValid: true }
}

export default function Trips() {
  const { data: trips, loading, error, refetch } = useTrips()
  const { data: buses } = useBuses()
  const { data: routes } = useRoutes()
  const { data: drivers } = useDrivers()

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ vehicle_id: '', route_id: '', driver_id: '', start_time: '', status: 'scheduled', direction: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [directionFilter, setDirectionFilter] = useState<string>('all')

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function openAdd() {
    setEditId(null)
    setForm({ vehicle_id: '', route_id: '', driver_id: '', start_time: '', status: 'scheduled', direction: '' })
    setModalOpen(true)
  }

  function openEdit(trip: any) {
    setEditId(trip.id)
    setForm({
      vehicle_id: trip.vehicle_id,
      route_id: trip.route_id,
      driver_id: trip.driver_id,
      start_time: trip.start_time?.slice(0, 16) ?? '',
      status: trip.status,
      direction: trip.direction || '',
    })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    // Run validations before inserting/updating
    const validation = await validateTrip(form.vehicle_id, form.status, form.start_time, editId)
    if (!validation.isValid) {
      showToast(validation.message || 'Validation failed', 'error')
      setSaving(false)
      return
    }

    if (!form.direction) {
      showToast('Please select a trip direction', 'error')
      setSaving(false)
      return
    }

    const payload = {
      vehicle_id: form.vehicle_id,
      route_id: form.route_id,
      driver_id: form.driver_id,
      start_time: form.start_time,
      status: form.status,
      direction: form.direction,
    }
    const { error } = editId
      ? await updateTrip(editId, payload)
      : await insertTrip(payload)

    setSaving(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast(editId ? 'Trip updated!' : 'Trip scheduled!')
      setModalOpen(false)
      refetch()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this trip?')) return
    const { error } = await deleteTrip(id)
    if (error) showToast(error.message, 'error')
    else { showToast('Trip deleted!'); refetch() }
  }

  async function markComplete(id: string) {
    const { error } = await updateTrip(id, { status: 'completed', end_time: new Date().toISOString() })
    if (error) showToast(error.message, 'error')
    else { showToast('Trip marked as completed!'); refetch() }
  }

  async function markRunning(id: string) {
    const tripToStart = trips.find((t) => t.id === id)
    if (!tripToStart) return

    setSaving(true)
    const validation = await validateTrip(tripToStart.vehicle_id, 'running', tripToStart.start_time, id)
    if (!validation.isValid) {
      showToast(validation.message || 'Validation failed', 'error')
      setSaving(false)
      return
    }

    const { error } = await updateTrip(id, { status: 'running' })
    setSaving(false)
    if (error) showToast(error.message, 'error')
    else { showToast('Trip started!'); refetch() }
  }

  async function startReturnJourney(trip: any) {
    setSaving(true)
    // Complete the current trip first
    const { error: completeError } = await updateTrip(trip.id, { status: 'completed', end_time: new Date().toISOString() })
    if (completeError) {
      showToast(completeError.message, 'error')
      setSaving(false)
      return
    }

    // Now validate if there is any OTHER running trip (excluding this just-completed one)
    const validation = await validateTrip(trip.vehicle_id, 'running', new Date().toISOString(), trip.id)
    if (!validation.isValid) {
      showToast(validation.message || 'Validation failed', 'error')
      setSaving(false)
      return
    }

    // Create a new return trip with reversed direction
    const newDirection = (trip.direction || 'onward') === 'onward' ? 'backward' : 'onward'
    const { error } = await insertTrip({
      vehicle_id: trip.vehicle_id,
      route_id: trip.route_id,
      driver_id: trip.driver_id,
      start_time: new Date().toISOString(),
      status: 'running',
      direction: newDirection,
    } as any)
    setSaving(false)
    if (error) showToast(error.message, 'error')
    else { showToast(`Return journey started! (${newDirection === 'backward' ? '↩ Backward' : '→ Onward'})`); refetch() }
  }

  const running = trips.filter((t) => t.status === 'running').length
  const scheduled = trips.filter((t) => t.status === 'scheduled').length
  const completed = trips.filter((t) => t.status === 'completed').length

  const filtered = trips.filter((t) => {
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter
    const matchesDirection = directionFilter === 'all' || t.direction === directionFilter
    return matchesStatus && matchesDirection
  })

  const runningVehicleIds = new Set(
    trips
      .filter((t) => t.status === 'running')
      .map((t) => t.vehicle_id)
  )

  return (
    <>
      <div className="page-header">
        <div className="page-header__left">
          <h2>Trip Management</h2>
          <p>Schedule, monitor, and review all transit trips</p>
        </div>
        <button className="btn btn--primary" id="btn-schedule-trip" onClick={openAdd}>
          + Schedule Trip
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-card--success">
          <div className="stat-card__header"><div className="stat-card__icon">🟢</div></div>
          <div className="stat-card__value">{loading ? '—' : running}</div>
          <div className="stat-card__label">Running Now</div>
        </div>
        <div className="stat-card stat-card--info">
          <div className="stat-card__header"><div className="stat-card__icon">🕐</div></div>
          <div className="stat-card__value">{loading ? '—' : scheduled}</div>
          <div className="stat-card__label">Scheduled</div>
        </div>
        <div className="stat-card stat-card--accent">
          <div className="stat-card__header"><div className="stat-card__icon">✅</div></div>
          <div className="stat-card__value">{loading ? '—' : completed}</div>
          <div className="stat-card__label">Completed</div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-card__header"><div className="stat-card__icon">📊</div></div>
          <div className="stat-card__value">{loading ? '—' : trips.length}</div>
          <div className="stat-card__label">Total Trips</div>
        </div>
      </div>

      <div className="glass-panel">
        <div className="glass-panel__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h3 className="glass-panel__title" style={{ margin: 0 }}>All Trips</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '16px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 6px rgba(239, 68, 68, 0.5)' }} /> Running
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 6px rgba(34, 197, 94, 0.5)' }} /> Free to go
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Direction Filter Dropdown */}
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              className="btn btn--ghost"
              style={{
                padding: '6px 14px',
                background: 'var(--color-bg-glass)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">All Directions</option>
              <option value="onward">Onward</option>
              <option value="backward">Backward</option>
            </select>

            {(['all', 'running', 'scheduled', 'completed'] as const).map((s) => (
              <button
                key={s}
                className={`btn btn--ghost`}
                style={{ padding: '6px 14px', ...(statusFilter === s ? { borderColor: 'var(--color-accent)', color: 'var(--color-accent-light)' } : {}) }}
                onClick={() => setStatusFilter(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="glass-panel__body"><p style={{ color: 'var(--color-danger)' }}>Error: {error}</p></div>}

        {loading ? (
          <div className="glass-panel__body"><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Loading trips…</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Bus</th>
                <th>Route</th>
                <th>Driver</th>
                <th>Direction</th>
                <th>Start Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No trips found</td></tr>
              ) : filtered.map((trip) => (
                <tr key={trip.id}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: runningVehicleIds.has(trip.vehicle_id) ? '#ef4444' : '#22c55e',
                          display: 'inline-block',
                          boxShadow: runningVehicleIds.has(trip.vehicle_id)
                            ? '0 0 8px rgba(239, 68, 68, 0.6)'
                            : '0 0 8px rgba(34, 197, 94, 0.6)'
                        }}
                        title={runningVehicleIds.has(trip.vehicle_id) ? 'Bus is currently running a trip' : 'Bus is free to go'}
                      />
                      {trip.vehicles?.vehicle_number ?? '—'}
                    </span>
                  </td>
                  <td>{trip.routes?.route_name ?? '—'}</td>
                  <td>{trip.profiles?.name ?? '—'}</td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', borderRadius: 12, fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      background: trip.direction === 'backward' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: trip.direction === 'backward' ? '#a855f7' : '#3b82f6',
                    }}>
                      {trip.direction === 'backward' ? '↩ Backward' : '→ Onward'}
                    </span>
                  </td>
                  <td>{new Date(trip.start_time).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</td>
                  <td>
                    <span className={`status-badge status-badge--${trip.status}`}>
                      <span className="status-badge__dot"></span> {trip.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {trip.status === 'scheduled' && (
                        <button className="btn btn--ghost btn--sm" onClick={() => markRunning(trip.id)} disabled={saving} style={{ color: 'var(--color-success)' }}>▶ Start</button>
                      )}
                      {trip.status === 'running' && (
                        <>
                          <button className="btn btn--ghost btn--sm" onClick={() => startReturnJourney(trip)} disabled={saving} style={{ color: 'var(--color-info, #3b82f6)' }}>↩ Return Journey</button>
                          <button className="btn btn--ghost btn--sm" onClick={() => markComplete(trip.id)} disabled={saving} style={{ color: 'var(--color-warning)' }}>✓ Complete</button>
                        </>
                      )}
                      <button className="btn btn--ghost btn--sm" onClick={() => openEdit(trip)} disabled={saving}>Edit</button>
                      <button className="btn btn--danger btn--sm" onClick={() => handleDelete(trip.id)} disabled={saving}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Trip' : 'Schedule New Trip'} width="540px">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="trip_bus" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Vehicle</span>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'normal', color: 'var(--color-text-muted)', display: 'inline-flex', gap: '8px' }}>
                  <span>🔴 Running</span>
                  <span>🟢 Free</span>
                </span>
              </label>
              <select id="trip_bus" required value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
                <option value="">— Select Vehicle —</option>
                {buses.map((b) => {
                  const isRunning = runningVehicleIds.has(b.id)
                  return (
                    <option key={b.id} value={b.id}>
                      {isRunning ? '🔴' : '🟢'} {b.vehicle_number} {isRunning ? '(Running)' : '(Free to go)'}
                    </option>
                  )
                })}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="trip_route">Route</label>
              <select id="trip_route" required value={form.route_id} onChange={(e) => setForm({ ...form, route_id: e.target.value })}>
                <option value="">— Select Route —</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>{r.route_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="trip_direction">Trip Direction</label>
              <select id="trip_direction" required value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                <option value="">— Select Direction —</option>
                <option value="onward">Onward</option>
                <option value="backward">Backward</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="trip_driver">Driver</label>
              <select id="trip_driver" required value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}>
                <option value="">— Select Driver —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name ?? d.phone ?? d.id}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="trip_status">Status</label>
              <select id="trip_status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="scheduled">Scheduled</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="trip_start">Start Time</label>
              <input id="trip_start" type="datetime-local" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : editId ? 'Update Trip' : 'Schedule Trip'}</button>
          </div>
        </form>
      </Modal>

      {toast && <div className={`toast toast--${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
