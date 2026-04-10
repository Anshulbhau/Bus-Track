interface StatCardProps {
  icon: string
  label: string
  value: string | number
  trend?: string
  trendDirection?: 'up' | 'down'
  variant?: 'accent' | 'success' | 'warning' | 'info'
}

export default function StatCard({
  icon,
  label,
  value,
  trend,
  trendDirection = 'up',
  variant = 'accent',
}: StatCardProps) {
  return (
    <div className={`stat-card stat-card--${variant}`}>
      <div className="stat-card__header">
        <div className="stat-card__icon">{icon}</div>
        {trend && (
          <span className={`stat-card__trend stat-card__trend--${trendDirection}`}>
            {trendDirection === 'up' ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  )
}
