import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/buses': 'Fleet Management',
  '/routes': 'Route Management',
  '/trips': 'Trip Management',
  '/drivers': 'Driver Management',
}

export default function Header() {
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'Dashboard'

  return (
    <header className="header" id="header">
      <div className="header__left">
        <h2 className="header__title">{title}</h2>
        <span className="header__breadcrumb">/ Admin / {title}</span>
      </div>

      <div className="header__right">
        <div className="header__search">
          <span className="header__search-icon">🔍</span>
          <input type="text" placeholder="Search buses, routes…" id="global-search" />
        </div>

        <button className="header__icon-btn" id="btn-notifications" title="Notifications">
          🔔
          <span className="badge"></span>
        </button>

        <button className="header__icon-btn" id="btn-fullscreen" title="Toggle Fullscreen">
          ⛶
        </button>
      </div>
    </header>
  )
}
