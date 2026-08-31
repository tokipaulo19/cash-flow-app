import StatusBadge from './StatusBadge'
import { compactMoney, money, shortDate } from '../utils/formatters'

function BalanceChart({ forecast, minimumBuffer }) {
  const width = 920
  const height = 280
  const padding = { top: 18, right: 18, bottom: 34, left: 68 }
  const values = forecast.map((day) => day.balance)
  const minimum = Math.min(0, minimumBuffer, ...values)
  const maximum = Math.max(minimumBuffer, ...values)
  const span = maximum - minimum || 1
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const x = (index) => padding.left + (index / Math.max(forecast.length - 1, 1)) * plotWidth
  const y = (value) => padding.top + ((maximum - value) / span) * plotHeight
  const points = forecast.map((day, index) => `${x(index)},${y(day.balance)}`).join(' ')
  const areaPoints = `${padding.left},${height - padding.bottom} ${points} ${width - padding.right},${height - padding.bottom}`
  const bufferY = y(minimumBuffer)

  return (
    <div className="chart-wrap">
      <svg className="balance-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Projected daily cash balance">
        <defs>
          <linearGradient id="cashArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#58c7b5" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#58c7b5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const value = maximum - span * tick
          const tickY = padding.top + plotHeight * tick
          return (
            <g key={tick}>
              <line className="chart-grid" x1={padding.left} x2={width - padding.right} y1={tickY} y2={tickY} />
              <text className="chart-label" x={padding.left - 12} y={tickY + 4} textAnchor="end">{compactMoney(value)}</text>
            </g>
          )
        })}
        <line className="buffer-line" x1={padding.left} x2={width - padding.right} y1={bufferY} y2={bufferY} />
        <text className="buffer-label" x={width - padding.right - 4} y={Math.max(bufferY - 7, 12)} textAnchor="end">Buffer {compactMoney(minimumBuffer)}</text>
        <polygon fill="url(#cashArea)" points={areaPoints} />
        <polyline className="balance-line" points={points} />
        <text className="chart-label" x={padding.left} y={height - 8}>{shortDate(forecast[0]?.date)}</text>
        <text className="chart-label" x={width - padding.right} y={height - 8} textAnchor="end">{shortDate(forecast.at(-1)?.date)}</text>
      </svg>
    </div>
  )
}

function MetricCard({ label, value, note, tone = 'default' }) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </article>
  )
}

function Dashboard({ balance, forecast, minimumBuffer }) {
  const next30Days = forecast.slice(0, 30)
  const monthIncome = next30Days.reduce((sum, day) => sum + day.income, 0)
  const monthExpenses = next30Days.reduce((sum, day) => sum + day.expenses, 0)
  const projectedCash = next30Days.at(-1)?.balance ?? balance
  const lowestDay = forecast.reduce(
    (lowest, day) => (day.balance < lowest.balance ? day : lowest),
    { balance: Number(balance) || 0, date: forecast[0]?.date },
  )
  const shortfall = forecast.find((day) => day.balance < 0)
  const bufferBreach = forecast.find((day) => day.balance < minimumBuffer)
  const overallStatus = shortfall ? 'SHORTFALL' : bufferBreach ? 'TIGHT' : 'SAFE'
  const upcomingEvents = forecast
    .slice(0, 14)
    .flatMap((day) => day.events.map((event) => ({ ...event, date: day.date })))
    .slice(0, 6)
  const trigger = lowestDay.date
    ? forecast.find((day) => day.date === lowestDay.date)?.events.filter((event) => event.type === 'expense')
    : []

  return (
    <div className="overview-stack">
      <section className={`risk-banner risk-${overallStatus.toLowerCase()}`}>
        <div>
          <span className="eyebrow">12-week cash position</span>
          <h2>{overallStatus === 'SAFE' ? 'Your cash buffer holds.' : overallStatus === 'TIGHT' ? 'Your buffer is at risk.' : 'A cash shortfall is forecast.'}</h2>
          <p>
            {shortfall
              ? `Cash first drops below zero on ${shortDate(shortfall.date)}.`
              : bufferBreach
                ? `Cash first drops below your ${money(minimumBuffer)} buffer on ${shortDate(bufferBreach.date)}.`
                : `Projected cash remains above ${money(minimumBuffer)} through ${shortDate(forecast.at(-1)?.date)}.`}
          </p>
        </div>
        <StatusBadge status={overallStatus} />
      </section>

      <section className="metrics-grid">
        <MetricCard label="Starting cash" value={money(balance)} note={`As of ${shortDate(forecast[0]?.date)}`} />
        <MetricCard label="30-day inflow" value={money(monthIncome)} note="Scheduled income" tone="positive" />
        <MetricCard label="30-day outflow" value={money(monthExpenses)} note="Bills and expenses" tone="negative" />
        <MetricCard label="30-day projected cash" value={money(projectedCash)} note={`${money(projectedCash - balance)} net change`} tone={projectedCash < 0 ? 'negative' : 'default'} />
        <MetricCard label="Lowest daily cash" value={money(lowestDay.balance)} note={shortDate(lowestDay.date)} tone={lowestDay.balance < minimumBuffer ? 'negative' : 'positive'} />
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Daily projection</span>
              <h2>Cash balance trajectory</h2>
            </div>
            <span className="panel-meta">{forecast.length} days</span>
          </div>
          <BalanceChart forecast={forecast} minimumBuffer={minimumBuffer} />
        </article>

        <article className="panel upcoming-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Next 14 days</span>
              <h2>Scheduled activity</h2>
            </div>
          </div>
          <div className="event-list">
            {upcomingEvents.length ? upcomingEvents.map((event) => (
              <div className="event-row" key={`${event.id}-${event.date}`}>
                <div className={`event-mark event-${event.type}`} aria-hidden="true" />
                <div className="event-copy">
                  <strong>{event.name}</strong>
                  <span>{shortDate(event.date)}</span>
                </div>
                <span className={`event-amount event-${event.type}`}>
                  {event.type === 'income' ? '+' : '−'}{money(event.amount)}
                </span>
              </div>
            )) : <p className="empty-copy">No scheduled activity in the next 14 days.</p>}
          </div>
        </article>
      </section>

      {trigger?.length > 0 && (
        <section className="insight-card">
          <span className="insight-icon">!</span>
          <div>
            <strong>Lowest point driven by {trigger.map((item) => item.name).join(', ')}</strong>
            <p>{money(trigger.reduce((sum, item) => sum + item.amount, 0))} is scheduled to leave on {shortDate(lowestDay.date)}.</p>
          </div>
        </section>
      )}
    </div>
  )
}

export default Dashboard
