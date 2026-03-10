import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type Prefs = {
  emailNotifications: boolean
  soundAlerts: boolean
  compactView: boolean
}

type MapCenter = { lat: number; lng: number; zoom: number; label: string }

const PREFS_KEY = 'transit_admin_prefs'
const MAP_CENTER_KEY = 'transit_map_center'
const DEFAULT_MAP_CENTER: MapCenter = { lat: 32.7266, lng: 74.8570, zoom: 12, label: 'Jammu, J&K' }

const prefOptions: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive alerts for trip status changes' },
  { key: 'soundAlerts', label: 'Sound Alerts', desc: 'Play a sound on critical system alerts' },
  { key: 'compactView', label: 'Compact Table View', desc: 'Show more rows with reduced row height' },
]

export default function Settings() {
  const { session } = useAuth()

  const [profile, setProfile] = useState({ name: '', phone: '' })
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)

  const [password, setPassword] = useState({ next: '', confirm: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)

  const [prefs, setPrefs] = useState<Prefs>({
    emailNotifications: true,
    soundAlerts: false,
    compactView: false,
  })

  const [mapCenter, setMapCenter] = useState<MapCenter>(DEFAULT_MAP_CENTER)
  const [cityInput, setCityInput] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [geoResult, setGeoResult] = useState<MapCenter | null>(null)
  const [customLat, setCustomLat] = useState('')
  const [customLng, setCustomLng] = useState('')
  const [customZoom, setCustomZoom] = useState('12')
  const [manualMode, setManualMode] = useState(false)

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Load profile
  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('profiles')
      .select('name, phone')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile({ name: data.name ?? '', phone: data.phone ?? '' })
        setProfileLoading(false)
      })
  }, [session])

  // Load preferences and map center from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(PREFS_KEY)
    if (saved) {
      try { setPrefs(JSON.parse(saved)) } catch { /* ignore */ }
    }
    const savedCenter = localStorage.getItem(MAP_CENTER_KEY)
    if (savedCenter) {
      try {
        const c = JSON.parse(savedCenter) as MapCenter
        setMapCenter(c)
        setCustomLat(String(c.lat))
        setCustomLng(String(c.lng))
        setCustomZoom(String(c.zoom))
      } catch { /* ignore */ }
    } else {
      setCustomLat(String(DEFAULT_MAP_CENTER.lat))
      setCustomLng(String(DEFAULT_MAP_CENTER.lng))
      setCustomZoom(String(DEFAULT_MAP_CENTER.zoom))
    }
  }, [])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user?.id) return
    setProfileSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ name: profile.name, phone: profile.phone })
      .eq('id', session.user.id)
    setProfileSaving(false)
    if (error) showToast(error.message, 'error')
    else showToast('Profile updated!')
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (password.next !== password.confirm) { showToast('Passwords do not match', 'error'); return }
    if (password.next.length < 6) { showToast('Password must be at least 6 characters', 'error'); return }
    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: password.next })
    setPasswordSaving(false)
    if (error) showToast(error.message, 'error')
    else { showToast('Password updated!'); setPassword({ next: '', confirm: '' }) }
  }

  function togglePref(key: keyof Prefs) {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    localStorage.setItem(PREFS_KEY, JSON.stringify(updated))
    showToast('Preference saved!')
  }

  async function searchCity() {
    if (!cityInput.trim()) return
    setGeocoding(true)
    setGeoResult(null)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityInput)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json()
      if (data.length > 0) {
        const found: MapCenter = {
          lat: parseFloat(parseFloat(data[0].lat).toFixed(5)),
          lng: parseFloat(parseFloat(data[0].lon).toFixed(5)),
          zoom: 12,
          label: data[0].display_name.split(',').slice(0, 2).join(', ').trim(),
        }
        setGeoResult(found)
        setCustomLat(String(found.lat))
        setCustomLng(String(found.lng))
        setCustomZoom('12')
      } else {
        showToast('City not found. Try a different name.', 'error')
      }
    } catch {
      showToast('Geocoding failed. Check your connection.', 'error')
    }
    setGeocoding(false)
  }

  function saveMapCenter() {
    const lat = parseFloat(customLat)
    const lng = parseFloat(customLng)
    const zoom = parseInt(customZoom, 10)
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      showToast('Invalid coordinates. Lat: -90–90, Lng: -180–180', 'error')
      return
    }
    if (isNaN(zoom) || zoom < 1 || zoom > 19) {
      showToast('Zoom must be between 1 and 19', 'error')
      return
    }
    const center: MapCenter = {
      lat, lng, zoom,
      label: geoResult?.label ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    }
    localStorage.setItem(MAP_CENTER_KEY, JSON.stringify(center))
    setMapCenter(center)
    setGeoResult(null)
    showToast('Map center saved! Reload the dashboard to apply.')
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header__left">
          <h2>Settings</h2>
          <p>Manage your account and application preferences</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 24, maxWidth: 720 }}>

        {/* Profile */}
        <div className="glass-panel">
          <div className="glass-panel__header">
            <h3 className="glass-panel__title">Profile</h3>
            <span style={{
              fontSize: 'var(--font-size-xs)', padding: '3px 10px', borderRadius: 20,
              background: 'var(--color-accent-glow)', color: 'var(--color-accent-light)',
              border: '1px solid rgba(99,102,241,0.3)', fontWeight: 600,
            }}>Admin</span>
          </div>
          <div className="glass-panel__body">
            {profileLoading ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Loading…</p>
            ) : (
              <form onSubmit={saveProfile}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      value={profile.name}
                      onChange={e => setProfile({ ...profile, name: e.target.value })}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      value={profile.phone}
                      onChange={e => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    value={session?.user?.email ?? ''}
                    disabled
                    style={{ opacity: 0.5, cursor: 'not-allowed' }}
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn--primary" disabled={profileSaving}>
                    {profileSaving ? 'Saving…' : 'Save Profile'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Security */}
        <div className="glass-panel">
          <div className="glass-panel__header">
            <h3 className="glass-panel__title">Security</h3>
          </div>
          <div className="glass-panel__body">
            <form onSubmit={savePassword}>
              <div className="form-row">
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={password.next}
                    onChange={e => setPassword({ ...password, next: e.target.value })}
                    placeholder="Min. 6 characters"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    value={password.confirm}
                    onChange={e => setPassword({ ...password, confirm: e.target.value })}
                    placeholder="Repeat password"
                    required
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn--primary" disabled={passwordSaving}>
                  {passwordSaving ? 'Updating…' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Preferences */}
        <div className="glass-panel">
          <div className="glass-panel__header">
            <h3 className="glass-panel__title">Preferences</h3>
          </div>
          <div className="glass-panel__body" style={{ padding: '8px 24px' }}>
            {prefOptions.map(({ key, label, desc }, i) => (
              <div
                key={key}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 0',
                  borderBottom: i < prefOptions.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {desc}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => togglePref(key)}
                  aria-label={`Toggle ${label}`}
                  style={{
                    width: 44, height: 24, borderRadius: 12, position: 'relative', flexShrink: 0,
                    background: prefs[key] ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.2s', border: 'none', cursor: 'pointer',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
                    background: 'white', transition: 'left 0.2s', display: 'block',
                    left: prefs[key] ? 23 : 3,
                  }} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Map Center */}
        <div className="glass-panel">
          <div className="glass-panel__header">
            <h3 className="glass-panel__title">Map Center Location</h3>
            <span style={{
              fontSize: 'var(--font-size-xs)', padding: '3px 10px', borderRadius: 20,
              background: 'var(--color-info-glow)', color: 'var(--color-info)',
              border: '1px solid rgba(6,182,212,0.3)', fontWeight: 600,
            }}>
              📍 {mapCenter.label}
            </span>
          </div>
          <div className="glass-panel__body">
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 20 }}>
              Set the default center point for the Dashboard and Live Map views.
            </p>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button
                type="button"
                className={`btn ${!manualMode ? 'btn--primary' : 'btn--ghost'}`}
                style={{ padding: '6px 16px' }}
                onClick={() => setManualMode(false)}
              >
                🔍 Search City
              </button>
              <button
                type="button"
                className={`btn ${manualMode ? 'btn--primary' : 'btn--ghost'}`}
                style={{ padding: '6px 16px' }}
                onClick={() => setManualMode(true)}
              >
                ✏️ Manual Coordinates
              </button>
            </div>

            {!manualMode ? (
              /* City Search Mode */
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input
                    style={{
                      flex: 1, background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                      color: 'var(--color-text-primary)', fontFamily: 'inherit',
                      fontSize: 'var(--font-size-sm)', outline: 'none',
                    }}
                    placeholder="e.g. Srinagar, Delhi, Mumbai…"
                    value={cityInput}
                    onChange={e => { setCityInput(e.target.value); setGeoResult(null) }}
                    onKeyDown={e => e.key === 'Enter' && searchCity()}
                  />
                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}
                    onClick={searchCity}
                    disabled={geocoding || !cityInput.trim()}
                  >
                    {geocoding ? 'Searching…' : 'Search'}
                  </button>
                </div>

                {geoResult && (
                  <div style={{
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-success)', fontWeight: 600 }}>
                        ✅ Found: {geoResult.label}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4, fontFamily: 'monospace' }}>
                        Lat: {geoResult.lat} · Lng: {geoResult.lng}
                      </div>
                    </div>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${geoResult.lat}&mlon=${geoResult.lng}#map=12/${geoResult.lat}/${geoResult.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent-light)', whiteSpace: 'nowrap' }}
                    >
                      Preview ↗
                    </a>
                  </div>
                )}
              </div>
            ) : (
              /* Manual Mode */
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label>Latitude (-90 to 90)</label>
                  <input
                    type="number" step="any" min="-90" max="90"
                    value={customLat}
                    onChange={e => { setCustomLat(e.target.value); setGeoResult(null) }}
                    placeholder="32.7266"
                  />
                </div>
                <div className="form-group">
                  <label>Longitude (-180 to 180)</label>
                  <input
                    type="number" step="any" min="-180" max="180"
                    value={customLng}
                    onChange={e => { setCustomLng(e.target.value); setGeoResult(null) }}
                    placeholder="74.8570"
                  />
                </div>
              </div>
            )}

            {/* Zoom + Save row */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0, width: 140 }}>
                <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  Zoom Level (1–19)
                </label>
                <input
                  type="number" min="1" max="19"
                  value={customZoom}
                  onChange={e => setCustomZoom(e.target.value)}
                  style={{
                    background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                    color: 'var(--color-text-primary)', fontFamily: 'inherit',
                    fontSize: 'var(--font-size-sm)', outline: 'none', width: '100%',
                  }}
                />
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', paddingBottom: 12, flex: 1 }}>
                5=country · 10=district · 12=city · 15=street · 18=building
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  localStorage.removeItem(MAP_CENTER_KEY)
                  setMapCenter(DEFAULT_MAP_CENTER)
                  setCustomLat(String(DEFAULT_MAP_CENTER.lat))
                  setCustomLng(String(DEFAULT_MAP_CENTER.lng))
                  setCustomZoom('12')
                  setGeoResult(null)
                  setCityInput('')
                  showToast('Map center reset to Jammu.')
                }}
              >
                Reset to Default
              </button>
              <button type="button" className="btn btn--primary" onClick={saveMapCenter}>
                Save Map Center
              </button>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="glass-panel">
          <div className="glass-panel__header">
            <h3 className="glass-panel__title">Account Info</h3>
          </div>
          <div className="glass-panel__body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'User ID', value: session?.user?.id ? session.user.id.slice(0, 8) + '…' : '—' },
                { label: 'Role', value: 'Admin' },
                { label: 'Last Sign In', value: session?.user?.last_sign_in_at ? new Date(session.user.last_sign_in_at).toLocaleString() : '—' },
                { label: 'Account Created', value: session?.user?.created_at ? new Date(session.user.created_at).toLocaleDateString() : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: 'var(--color-bg-glass)', borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px', border: '1px solid var(--color-border)',
                }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {toast && <div className={`toast toast--${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
