import { useState } from 'react'
import { useBuses, useDrivers } from '../hooks/useSupabase'
import { insertBus, updateBus, deleteBus } from '../lib/api'
import Modal from '../components/Modal'
import type { Profile } from '../types/database'

export default function Buses() {
  const { data: buses, loading, error, refetch } = useBuses()
  const { data: drivers } = useDrivers()

  // modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ vehicle_number: '', vehicle_type: 'bus', capacity: '', driver_id: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function openAdd() {
    setEditId(null)
    setForm({ vehicle_number: '', vehicle_type: 'bus', capacity: '', driver_id: '' })
    setModalOpen(true)
  }

  function openEdit(bus: any) {
    setEditId(bus.id)
    setForm({ vehicle_number: bus.vehicle_number, vehicle_type: bus.vehicle_type ?? 'bus', capacity: String(bus.capacity), driver_id: bus.driver_id ?? '' })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      vehicle_number: form.vehicle_number,
      vehicle_type: form.vehicle_type,
      capacity: Number(form.capacity),
      driver_id: form.driver_id || null,
    }
    const { error } = editId
      ? await updateBus(editId, payload)
      : await insertBus(payload)

    setSaving(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast(editId ? 'Bus updated!' : 'Bus added!')
      setModalOpen(false)
      refetch()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this bus?')) return
    const { error } = await deleteBus(id)
    if (error) showToast(error.message, 'error')
    else { showToast('Bus deleted!'); refetch() }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header__left">
          <h2>Fleet Management</h2>
          <p>Manage all vehicles in your transit network</p>
        </div>
        <button className="btn btn--primary" id="btn-add-bus" onClick={openAdd}>
          + Add Bus
        </button>
      </div>

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card stat-card--accent">
          <div className="stat-card__header"><div className="stat-card__icon">🚌</div></div>
          <div className="stat-card__value">{loading ? '—' : buses.length}</div>
          <div className="stat-card__label">Total Fleet</div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-card__header"><div className="stat-card__icon">🟢</div></div>
          <div className="stat-card__value">{loading ? '—' : buses.filter((b) => b.driver_id).length}</div>
          <div className="stat-card__label">Driver Assigned</div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-card__header"><div className="stat-card__icon">🅿️</div></div>
          <div className="stat-card__value">{loading ? '—' : buses.filter((b) => !b.driver_id).length}</div>
          <div className="stat-card__label">Unassigned</div>
        </div>
      </div>

      <div className="glass-panel">
        <div className="glass-panel__header">
          <h3 className="glass-panel__title">All Buses</h3>
        </div>

        {error && <div className="glass-panel__body"><p style={{ color: 'var(--color-danger)' }}>Error: {error}</p></div>}

        {loading ? (
          <div className="glass-panel__body"><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Loading buses…</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Bus Number</th>
                <th>Capacity</th>
                <th>Assigned Driver</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {buses.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No buses found. Click "+ Add Bus" to get started!</td></tr>
              ) : buses.map((bus) => (
                <tr key={bus.id}>
                  <td>{bus.vehicle_number}</td>
                  <td>{bus.capacity} seats</td>
                  <td>{(bus as any).profiles?.name ?? <span style={{ color: 'var(--color-text-muted)' }}>Unassigned</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn--ghost btn--sm" onClick={() => openEdit(bus)}>Edit</button>
                      <button className="btn btn--danger btn--sm" onClick={() => handleDelete(bus.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Bus' : 'Add New Bus'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="vehicle_number">Vehicle Number</label>
            <input id="vehicle_number" placeholder="e.g. KA-01-4521" required value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="vehicle_type">Vehicle Type</label>
            <input id="vehicle_type" placeholder="e.g. bus" required value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="capacity">Seating Capacity</label>
            <input id="capacity" type="number" min="1" placeholder="e.g. 48" required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="driver_id">Assign Driver (optional)</label>
            <select id="driver_id" value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}>
              <option value="">— None —</option>
              {drivers.map((d: Profile) => (
                <option key={d.id} value={d.id}>{d.name ?? d.phone ?? d.id}</option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : editId ? 'Update Bus' : 'Add Bus'}</button>
          </div>
        </form>
      </Modal>

      {/* Toast */}
      {toast && <div className={`toast toast--${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
