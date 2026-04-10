import { useState } from 'react'
import { useDrivers } from '../hooks/useSupabase'
import { insertDriver, updateDriver, deleteDriver } from '../lib/api'
import Modal from '../components/Modal'

export default function Drivers() {
  const { data: drivers, loading, error, refetch } = useDrivers()

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function openAdd() {
    setEditId(null)
    setForm({ name: '', phone: '' })
    setModalOpen(true)
  }

  function openEdit(driver: any) {
    setEditId(driver.id)
    setForm({ name: driver.name ?? '', phone: driver.phone ?? '' })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = editId
      ? await updateDriver(editId, form)
      : await insertDriver(form)

    setSaving(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast(editId ? 'Driver updated!' : 'Driver added!')
      setModalOpen(false)
      refetch()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this driver? Any bus assignments will be affected.')) return
    const { error } = await deleteDriver(id)
    if (error) showToast(error.message, 'error')
    else { showToast('Driver deleted!'); refetch() }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header__left">
          <h2>Driver Management</h2>
          <p>View and manage all registered drivers</p>
        </div>
        <button className="btn btn--primary" id="btn-add-driver" onClick={openAdd}>
          + Add Driver
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-card--accent">
          <div className="stat-card__header"><div className="stat-card__icon">👤</div></div>
          <div className="stat-card__value">{loading ? '—' : drivers.length}</div>
          <div className="stat-card__label">Total Drivers</div>
        </div>
      </div>

      <div className="glass-panel">
        <div className="glass-panel__header">
          <h3 className="glass-panel__title">All Drivers</h3>
        </div>

        {error && <div className="glass-panel__body"><p style={{ color: 'var(--color-danger)' }}>Error: {error}</p></div>}

        {loading ? (
          <div className="glass-panel__body"><p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Loading drivers…</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No drivers yet. Click "+ Add Driver" to register one!</td></tr>
              ) : drivers.map((driver) => (
                <tr key={driver.id}>
                  <td>{driver.name ?? '—'}</td>
                  <td>{driver.phone ?? '—'}</td>
                  <td>{new Date(driver.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn--ghost btn--sm" onClick={() => openEdit(driver)}>Edit</button>
                      <button className="btn btn--danger btn--sm" onClick={() => handleDelete(driver.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Driver' : 'Add New Driver'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="driver_name">Full Name</label>
            <input id="driver_name" placeholder="e.g. Ravi Kumar" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="driver_phone">Phone Number</label>
            <input id="driver_phone" placeholder="e.g. +91 98765 43210" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : editId ? 'Update Driver' : 'Add Driver'}</button>
          </div>
        </form>
      </Modal>

      {toast && <div className={`toast toast--${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
