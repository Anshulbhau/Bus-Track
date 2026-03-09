import { useState } from 'react'
import { useRoutes } from '../hooks/useSupabase'
import { insertRoute, updateRoute, deleteRoute } from '../lib/api'
import Modal from '../components/Modal'

export default function RoutesPage() {
  const { data: routes, loading, error, refetch } = useRoutes()

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ route_name: '', start_location: '', end_location: '', distance_km: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function openAdd() {
    setEditId(null)
    setForm({ route_name: '', start_location: '', end_location: '', distance_km: '' })
    setModalOpen(true)
  }

  function openEdit(route: any) {
    setEditId(route.id)
    setForm({
      route_name: route.route_name,
      start_location: route.start_location,
      end_location: route.end_location,
      distance_km: String(route.distance_km),
    })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      route_name: form.route_name,
      start_location: form.start_location,
      end_location: form.end_location,
      distance_km: Number(form.distance_km),
    }
    const { error } = editId
      ? await updateRoute(editId, payload)
      : await insertRoute(payload)

    setSaving(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast(editId ? 'Route updated!' : 'Route created!')
      setModalOpen(false)
      refetch()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this route? All associated route_stops will also be affected.')) return
    const { error } = await deleteRoute(id)
    if (error) showToast(error.message, 'error')
    else { showToast('Route deleted!'); refetch() }
  }

  const totalDistance = routes.reduce((sum, r) => sum + (r.distance_km ?? 0), 0)

  return (
    <>
      <div className="page-header">
        <div className="page-header__left">
          <h2>Route Management</h2>
          <p>Define and manage bus routes across the city</p>
        </div>
        <button className="btn btn--primary" id="btn-add-route" onClick={openAdd}>
          + Create Route
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-card--info">
          <div className="stat-card__header"><div className="stat-card__icon">🗺️</div></div>
          <div className="stat-card__value">{loading ? '—' : routes.length}</div>
          <div className="stat-card__label">Total Routes</div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-card__header"><div className="stat-card__icon">📏</div></div>
          <div className="stat-card__value">{loading ? '—' : `${totalDistance.toFixed(1)} km`}</div>
          <div className="stat-card__label">Total Distance</div>
        </div>
      </div>

      <div className="glass-panel">
        <div className="glass-panel__header">
          <h3 className="glass-panel__title">All Routes</h3>
        </div>

        {error && <div className="glass-panel__body"><p style={{ color: 'var(--color-danger)' }}>Error: {error}</p></div>}

        {loading ? (
          <div className="glass-panel__body"><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Loading routes…</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Route Name</th>
                <th>Start</th>
                <th>End</th>
                <th>Distance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No routes found. Click "+ Create Route" to add one!</td></tr>
              ) : routes.map((route) => (
                <tr key={route.id}>
                  <td>{route.route_name}</td>
                  <td>{route.start_location}</td>
                  <td>{route.end_location}</td>
                  <td>{route.distance_km} km</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn--ghost btn--sm" onClick={() => openEdit(route)}>Edit</button>
                      <button className="btn btn--danger btn--sm" onClick={() => handleDelete(route.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Route' : 'Create New Route'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="route_name">Route Name</label>
            <input id="route_name" placeholder="e.g. Route #7" required value={form.route_name} onChange={(e) => setForm({ ...form, route_name: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start_location">Start Location</label>
              <input id="start_location" placeholder="e.g. MG Road" required value={form.start_location} onChange={(e) => setForm({ ...form, start_location: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="end_location">End Location</label>
              <input id="end_location" placeholder="e.g. Electronic City" required value={form.end_location} onChange={(e) => setForm({ ...form, end_location: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="distance_km">Distance (km)</label>
            <input id="distance_km" type="number" step="0.1" min="0" placeholder="e.g. 22.5" required value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : editId ? 'Update Route' : 'Create Route'}</button>
          </div>
        </form>
      </Modal>

      {toast && <div className={`toast toast--${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
