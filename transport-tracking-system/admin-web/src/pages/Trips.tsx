import { useState } from 'react'
import { useTrips, useBuses, useRoutes, useDrivers } from '../hooks/useSupabase'
import { insertTrip, updateTrip, deleteTrip } from '../lib/api'
import Modal from '../components/Modal'

export default function Trips() {
  const { data: trips, loading, error, refetch } = useTrips()
  const { data: buses } = useBuses()
  const { data: routes } = useRoutes()
  const { data: drivers } = useDrivers()

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ bus_id: '', route_id: '', driver_id: '', start_time: '', status: 'scheduled' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function openAdd() {
    setEditId(null)
    setForm({ bus_id: '', route_id: '', driver_id: '', start_time: '', status: 'scheduled' })
    setModalOpen(true)
  }

  function openEdit(trip: any) {
    setEditId(trip.id)
    setForm({
      bus_id: trip.bus_id,
      route_id: trip.route_id,
      driver_id: trip.driver_id,
      start_time: trip.start_time?.slice(0, 16) ?? '',
      status: trip.status,
    })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      bus_id: form.bus_id,
      route_id: form.route_id,
      driver_id: form.driver_id,
      start_time: form.start_time,
      status: form.status,
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
    const { error } = await updateTrip(id, { status: 'running' })
    if (error) showToast(error.message, 'error')
    else { showToast('Trip started!'); refetch() }
  }

  const running = trips.filter((t) => t.status === 'running').length
  const scheduled = trips.filter((t) => t.status === 'scheduled').length
  const completed = trips.filter((t) => t.status === 'completed').length

  const filtered = statusFilter === 'all' ? trips : trips.filter((t) => t.status === statusFilter)

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
          <h3 className="glass-panel__title">All Trips</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
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
                <th>Start Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No trips found</td></tr>
              ) : filtered.map((trip) => (
                <tr key={trip.id}>
                  <td>{trip.buses?.bus_number ?? '—'}</td>
                  <td>{trip.routes?.route_name ?? '—'}</td>
                  <td>{trip.profiles?.name ?? '—'}</td>
                  <td>{new Date(trip.start_time).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</td>
                  <td>
                    <span className={`status-badge status-badge--${trip.status}`}>
                      <span className="status-badge__dot"></span> {trip.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {trip.status === 'scheduled' && (
                        <button className="btn btn--ghost btn--sm" onClick={() => markRunning(trip.id)} style={{ color: 'var(--color-success)' }}>▶ Start</button>
                      )}
                      {trip.status === 'running' && (
                        <button className="btn btn--ghost btn--sm" onClick={() => markComplete(trip.id)} style={{ color: 'var(--color-warning)' }}>✓ Complete</button>
                      )}
                      <button className="btn btn--ghost btn--sm" onClick={() => openEdit(trip)}>Edit</button>
                      <button className="btn btn--danger btn--sm" onClick={() => handleDelete(trip.id)}>Delete</button>
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
              <label htmlFor="trip_bus">Bus</label>
              <select id="trip_bus" required value={form.bus_id} onChange={(e) => setForm({ ...form, bus_id: e.target.value })}>
                <option value="">— Select Bus —</option>
                {buses.map((b) => (
                  <option key={b.id} value={b.id}>{b.bus_number}</option>
                ))}
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
              <label htmlFor="trip_driver">Driver</label>
              <select id="trip_driver" required value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}>
                <option value="">— Select Driver —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name ?? d.phone ?? d.id}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="trip_status">Status</label>
              <select id="trip_status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="scheduled">Scheduled</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="trip_start">Start Time</label>
            <input id="trip_start" type="datetime-local" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
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
