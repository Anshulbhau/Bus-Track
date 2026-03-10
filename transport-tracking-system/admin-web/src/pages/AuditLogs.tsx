import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type LogType = 'bus' | 'driver' | 'trip'
type FilterType = 'all' | LogType

type LogEntry = {
  id: string
  type: LogType
  action: string
  detail: string
  timestamp: string
}

const typeIcon: Record<LogType, string> = { bus: '🚌', driver: '👤', trip: '🧭' }
const typeColor: Record<LogType, string> = {
  bus: 'var(--color-accent)',
  driver: 'var(--color-success)',
  trip: 'var(--color-warning)',
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchLogs() {
      const [busRes, driverRes, tripRes] = await Promise.all([
        supabase
          .from('buses')
          .select('id, bus_number, capacity, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('profiles')
          .select('id, name, phone, created_at')
          .eq('role', 'driver')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('trips')
          .select('id, status, created_at, buses(bus_number), routes(route_name)')
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      const entries: LogEntry[] = []

      for (const b of busRes.data ?? []) {
        entries.push({
          id: `bus-${b.id}`,
          type: 'bus',
          action: 'Bus Added',
          detail: `Bus ${b.bus_number} (${b.capacity} seats) was added to the fleet`,
          timestamp: b.created_at,
        })
      }

      for (const d of driverRes.data ?? []) {
        entries.push({
          id: `drv-${d.id}`,
          type: 'driver',
          action: 'Driver Registered',
          detail: `Driver ${d.name ?? d.phone ?? d.id} was registered`,
          timestamp: d.created_at,
        })
      }

      for (const t of tripRes.data ?? []) {
        const bus = (t as any).buses?.bus_number ?? 'Unknown bus'
        const route = (t as any).routes?.route_name ?? 'Unknown route'
        const statusLabel = t.status === 'running' ? 'started' : t.status === 'completed' ? 'completed' : 'scheduled'
        entries.push({
          id: `trip-${t.id}`,
          type: 'trip',
          action: `Trip ${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}`,
          detail: `${bus} on route ${route} — ${t.status}`,
          timestamp: t.created_at,
        })
      }

      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setLogs(entries)
      setLoading(false)
    }

    fetchLogs()
  }, [])

  const filtered = logs
    .filter(l => filter === 'all' || l.type === filter)
    .filter(l => {
      if (!search) return true
      const q = search.toLowerCase()
      return l.detail.toLowerCase().includes(q) || l.action.toLowerCase().includes(q)
    })

  function exportCSV() {
    const header = 'Type,Action,Detail,Timestamp'
    const rows = filtered.map(l =>
      `${l.type},"${l.action}","${l.detail.replace(/"/g, '""')}","${new Date(l.timestamp).toLocaleString()}"`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const countByType = (type: LogType) => logs.filter(l => l.type === type).length

  return (
    <>
      <div className="page-header">
        <div className="page-header__left">
          <h2>Audit Logs</h2>
          <p>Track all system activity and changes</p>
        </div>
        <button className="btn btn--ghost" onClick={exportCSV} disabled={filtered.length === 0}>
          ↓ Export CSV
        </button>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Events', value: logs.length, type: 'accent', icon: '📋' },
          { label: 'Bus Events', value: countByType('bus'), type: 'info', icon: '🚌' },
          { label: 'Driver Events', value: countByType('driver'), type: 'success', icon: '👤' },
          { label: 'Trip Events', value: countByType('trip'), type: 'warning', icon: '🧭' },
        ].map(s => (
          <div key={s.label} className={`stat-card stat-card--${s.type}`}>
            <div className="stat-card__header"><div className="stat-card__icon">{s.icon}</div></div>
            <div className="stat-card__value">{loading ? '—' : s.value}</div>
            <div className="stat-card__label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="glass-panel">
        <div className="glass-panel__header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <h3 className="glass-panel__title">Activity Timeline</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              placeholder="Search logs…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', padding: '6px 12px',
                color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)',
                outline: 'none', width: 180,
              }}
            />
            {(['all', 'bus', 'driver', 'trip'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 14px', borderRadius: 20,
                  fontSize: 'var(--font-size-xs)', fontWeight: 600,
                  border: '1px solid',
                  borderColor: filter === f ? 'var(--color-accent)' : 'var(--color-border)',
                  background: filter === f ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: filter === f ? 'var(--color-accent-light)' : 'var(--color-text-muted)',
                  cursor: 'pointer', textTransform: 'capitalize',
                }}
              >
                {f === 'all' ? `All (${logs.length})` : `${f} (${countByType(f)})`}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-panel__body">
          {loading ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              Loading activity…
            </p>
          ) : filtered.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: 40 }}>
              No logs found
            </p>
          ) : (
            <div className="activity-list">
              {filtered.map(log => (
                <div key={log.id} className="activity-item">
                  <div
                    className="activity-item__icon"
                    style={{
                      background: `color-mix(in srgb, ${typeColor[log.type]} 15%, transparent)`,
                      borderColor: `color-mix(in srgb, ${typeColor[log.type]} 30%, transparent)`,
                    }}
                  >
                    {typeIcon[log.type]}
                  </div>
                  <div className="activity-item__content">
                    <div className="activity-item__text">
                      <strong>{log.action}</strong> — {log.detail}
                    </div>
                    <div className="activity-item__time">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 'var(--font-size-xs)', padding: '2px 10px', borderRadius: 20,
                    background: `color-mix(in srgb, ${typeColor[log.type]} 15%, transparent)`,
                    color: typeColor[log.type],
                    border: `1px solid color-mix(in srgb, ${typeColor[log.type]} 30%, transparent)`,
                    fontWeight: 600, textTransform: 'capitalize', flexShrink: 0,
                  }}>
                    {log.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
