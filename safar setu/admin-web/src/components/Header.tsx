import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/buses': 'Fleet Management',
  '/routes': 'Route Management',
  '/trips': 'Trip Management',
  '/drivers': 'Driver Management',
  '/live-map': 'Live Map',
  '/settings': 'Settings',
  '/audit-logs': 'Audit Logs',
}

type SearchResult = {
  type: 'bus' | 'route' | 'driver' | 'trip'
  id: string
  label: string
  sublabel?: string
  path: string
}

type NotificationItem = {
  id: string
  icon: string
  title: string
  time: string
  read: boolean
}

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const title = pageTitles[location.pathname] || 'Dashboard'

  // ── Search ──────────────────────────────────────
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // ── Notifications ────────────────────────────────
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const notifRef = useRef<HTMLDivElement>(null)

  // Debounced search query
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }

    setSearching(true)
    const timer = setTimeout(async () => {
      const q = `%${query.trim()}%`
      const [busRes, routeRes, driverRes, tripRes] = await Promise.all([
        supabase.from('vehicles').select('id, vehicle_number').ilike('vehicle_number', q).limit(4),
        supabase.from('routes').select('id, route_name, start_location, end_location').or(`route_name.ilike.${q},start_location.ilike.${q},end_location.ilike.${q}`).limit(4),
        supabase.from('profiles').select('id, name, phone').eq('role', 'driver').or(`name.ilike.${q},phone.ilike.${q}`).limit(4),
        supabase.from('trips').select('id, status, vehicles(vehicle_number), routes(route_name)').ilike('status', q).limit(4)
      ])

      const results: SearchResult[] = [
        ...(busRes.data ?? []).map(b => ({
          type: 'bus' as const, id: b.id, label: b.vehicle_number, sublabel: 'Fleet Bus', path: '/buses',
        })),
        ...(routeRes.data ?? []).map(r => ({
          type: 'route' as const, id: r.id, label: r.route_name,
          sublabel: `${r.start_location} → ${r.end_location}`, path: '/routes',
        })),
        ...(driverRes.data ?? []).map(d => ({
          type: 'driver' as const, id: d.id, label: d.name || 'Unknown', sublabel: `Driver ${d.phone ? '• ' + d.phone : ''}`, path: '/drivers',
        })),
        ...(tripRes.data ?? []).map(t => ({
          type: 'trip' as const, id: t.id, 
          label: `Trip: ${(t as any).routes?.route_name || 'Route'}`, 
          sublabel: `Bus ${(t as any).vehicles?.vehicle_number || ''} • ${t.status}`, 
          path: '/trips',
        })),
      ]

      setSearchResults(results)
      setSearchOpen(true)
      setSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Load notifications from recent trips
  async function loadNotifications() {
    const { data } = await supabase
      .from('trips')
      .select('id, status, start_time, vehicles(vehicle_number), routes(route_name)')
      .order('start_time', { ascending: false })
      .limit(8)

    if (data) {
      setNotifications(prev => {
        const readIds = new Set(prev.filter(n => n.read).map(n => n.id))
        return data.map(t => ({
          id: t.id,
          icon: t.status === 'running' ? '🚌' : t.status === 'completed' ? '✅' : '🕐',
          title: `${(t as any).vehicles?.vehicle_number ?? 'Bus'} — ${(t as any).routes?.route_name ?? 'Route'} · ${t.status}`,
          time: new Date(t.start_time).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
          read: readIds.has(t.id),
        }))
      })
    }
  }

  useEffect(() => {
    loadNotifications()

    const channel = supabase
      .channel('header_notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        loadNotifications()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Update unread count when notifications change
  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length)
  }, [notifications])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSearchSelect = (result: SearchResult) => {
    setQuery('')
    setSearchOpen(false)
    navigate(result.path)
  }

  const handleNotifToggle = () => {
    const opening = !notifOpen
    setNotifOpen(opening)
    if (opening) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }
  }

  const typeIcon: Record<string, string> = { bus: '🚌', route: '📍', driver: '👤', trip: '🗺️' }

  return (
    <header className="header" id="header">
      <div className="header__left">
        <h2 className="header__title">{title}</h2>
        <span className="header__breadcrumb">/ Admin / {title}</span>
      </div>

      <div className="header__right">

        {/* ── Search ── */}
        <div className="header__search" ref={searchRef} style={{ position: 'relative' }}>
          <span className="header__search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search vehicles, routes, drivers…"
            id="global-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setSearchOpen(true) }}
          />
          {(searchOpen || searching) && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0,
              width: 340, background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)', zIndex: 300, overflow: 'hidden',
            }}>
              {searching ? (
                <div style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  Searching…
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  No results for "{query}"
                </div>
              ) : (
                <>
                  <div style={{ padding: '8px 16px 4px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </div>
                  {searchResults.map(r => (
                    <button
                      key={`${r.type}-${r.id}`}
                      onClick={() => handleSearchSelect(r)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                        padding: '9px 16px', textAlign: 'left', background: 'none', cursor: 'pointer',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        color: 'inherit', transition: 'background 150ms',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <span style={{
                        width: 32, height: 32, borderRadius: 8, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                        background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', flexShrink: 0,
                      }}>
                        {typeIcon[r.type]}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.label}
                        </div>
                        {r.sublabel && (
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.sublabel}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
                        background: 'var(--color-bg-glass)', padding: '2px 8px',
                        borderRadius: 20, border: '1px solid var(--color-border)', flexShrink: 0, textTransform: 'capitalize',
                      }}>
                        {r.type}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Notifications ── */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button className="header__icon-btn" id="btn-notifications" title="Notifications" onClick={handleNotifToggle}>
            🔔
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 5, right: 5,
                minWidth: 16, height: 16, borderRadius: 8,
                background: 'var(--color-danger)', color: 'white',
                fontSize: '9px', fontWeight: 700, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                padding: '0 3px', lineHeight: 1,
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              width: 340, background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)', zIndex: 300, overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Notifications
                  {unreadCount > 0 && (
                    <span style={{ marginLeft: 8, background: 'var(--color-accent-glow)', color: 'var(--color-accent-light)', fontSize: 'var(--font-size-xs)', fontWeight: 600, padding: '1px 7px', borderRadius: 10 }}>
                      {unreadCount} new
                    </span>
                  )}
                </span>
                <button
                  style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent-light)', background: 'none', cursor: 'pointer' }}
                  onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                >
                  Mark all read
                </button>
              </div>

              {/* Items */}
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔔</div>
                    No notifications yet
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      style={{
                        display: 'flex', gap: 12, padding: '12px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: n.read ? 'none' : 'rgba(99,102,241,0.07)',
                        transition: 'background 150ms',
                      }}
                    >
                      <span style={{
                        width: 34, height: 34, borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                        background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', flexShrink: 0,
                      }}>
                        {n.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {n.time}
                        </div>
                      </div>
                      {!n.read && (
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-accent)', alignSelf: 'center', flexShrink: 0 }} />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
                <button
                  style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent-light)', background: 'none', cursor: 'pointer' }}
                  onClick={() => { setNotifOpen(false); navigate('/trips') }}
                >
                  View all trips →
                </button>
              </div>
            </div>
          )}
        </div>

        <button className="header__icon-btn" id="btn-fullscreen" title="Toggle Fullscreen"
          onClick={() => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() }}>
          ⛶
        </button>
      </div>
    </header>
  )
}
