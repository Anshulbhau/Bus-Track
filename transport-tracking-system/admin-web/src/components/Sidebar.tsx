import { NavLink, useLocation } from 'react-router-dom'

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: '📊' },
  { label: 'Buses', path: '/buses', icon: '🚌' },
  { label: 'Routes', path: '/routes', icon: '🗺️' },
  { label: 'Trips', path: '/trips', icon: '🧭' },
  { label: 'Drivers', path: '/drivers', icon: '👤' },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="sidebar" id="sidebar">
      {/* Brand */}
      <div className="sidebar__brand">
        <div className="sidebar__brand-icon">🚍</div>
        <div className="sidebar__brand-text">
          <h1>Transit Admin</h1>
          <span>Control Panel</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        <div className="sidebar__section-label">Main Menu</div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={`sidebar__link ${
              location.pathname === item.path ? 'sidebar__link--active' : ''
            }`}
          >
            <span className="sidebar__link-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}

        <div className="sidebar__section-label" style={{ marginTop: '16px' }}>
          System
        </div>
        <a href="#" className="sidebar__link">
          <span className="sidebar__link-icon">⚙️</span>
          <span>Settings</span>
        </a>
        <a href="#" className="sidebar__link">
          <span className="sidebar__link-icon">📋</span>
          <span>Audit Logs</span>
        </a>
      </nav>

      {/* Footer profile */}
      <div className="sidebar__footer">
        <div className="sidebar__footer-profile">
          <div className="sidebar__avatar">A</div>
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">Admin User</div>
            <div className="sidebar__user-role">Super Admin</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
