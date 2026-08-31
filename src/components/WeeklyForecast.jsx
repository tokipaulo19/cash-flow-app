import { useState } from 'react'
import { generateWeeklyForecast } from '../engine/forecastEngine'
import { dateRange, money, shortDate } from '../utils/formatters'
import StatusBadge from './StatusBadge'

function weekday(value) {
  if (!value) return '—'
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', { weekday: 'short' }).format(new Date(year, month - 1, day))
}

function WeeklyForecast({ forecast, dailyForecast, minimumBuffer }) {
  const [view, setView] = useState('weekly')
  const weeks = generateWeeklyForecast(forecast, minimumBuffer)
  const days = dailyForecast.slice(0, 90)

  return (
    <section className="panel forecast-panel">
      <div className="panel-heading forecast-heading">
        <div>
          <span className="eyebrow">Rolling forecast</span>
          <h2>{view === 'weekly' ? 'Weekly cash flow' : '90-day daily cash flow'}</h2>
          <p>{view === 'weekly' ? 'Daily movements rolled into decision-friendly weekly totals.' : 'Every day shown with its opening balance, activity and closing cash.'}</p>
        </div>
        <div className="forecast-heading-actions">
          <div className="forecast-view-toggle" aria-label="Forecast detail">
            <button type="button" className={view === 'weekly' ? 'toggle-active' : ''} aria-pressed={view === 'weekly'} onClick={() => setView('weekly')}>Weekly</button>
            <button type="button" className={view === 'daily' ? 'toggle-active' : ''} aria-pressed={view === 'daily'} onClick={() => setView('daily')}>Daily</button>
          </div>
          <div className="forecast-legend">
            <span><i className="legend-dot legend-safe" />Above buffer</span>
            <span><i className="legend-dot legend-tight" />Below buffer</span>
            <span><i className="legend-dot legend-shortfall" />Below zero</span>
          </div>
        </div>
      </div>

      {view === 'weekly' ? (
        <div className="table-scroll">
          <table className="forecast-table">
            <thead>
              <tr>
                <th>Week</th>
                <th>Period</th>
                <th className="number-cell">Opening cash</th>
                <th className="number-cell">Income</th>
                <th className="number-cell">Outgoing</th>
                <th className="number-cell">Closing cash</th>
                <th className="number-cell">Lowest cash</th>
                <th>Status</th>
                <th>First risk date</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week.week}>
                  <td><strong>{String(week.week).padStart(2, '0')}</strong></td>
                  <td>{dateRange(week.start, week.end)}</td>
                  <td className="number-cell">{money(week.openingBalance)}</td>
                  <td className="number-cell positive-number">{money(week.income)}</td>
                  <td className="number-cell negative-number">{money(week.expenses)}</td>
                  <td className="number-cell"><strong>{money(week.closingBalance)}</strong></td>
                  <td className="number-cell">{money(week.lowestBalance)}</td>
                  <td><StatusBadge status={week.status} /></td>
                  <td>{week.firstRiskDate ? shortDate(week.firstRiskDate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-scroll daily-table-scroll">
          <table className="forecast-table daily-forecast-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Date</th>
                <th>Activity</th>
                <th className="number-cell">Opening cash</th>
                <th className="number-cell">Income</th>
                <th className="number-cell">Outgoing</th>
                <th className="number-cell">Net change</th>
                <th className="number-cell">Closing cash</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day, index) => {
                const netChange = day.income - day.expenses
                const activity = day.events.map((event) => event.name).join(', ')
                return (
                  <tr key={day.date}>
                    <td><strong>{String(index + 1).padStart(2, '0')}</strong></td>
                    <td><span className="daily-date"><strong>{weekday(day.date)}</strong>{shortDate(day.date)}</span></td>
                    <td className="activity-cell" title={activity || 'No scheduled activity'}>{activity || '—'}</td>
                    <td className="number-cell">{money(day.startingBalance)}</td>
                    <td className="number-cell positive-number">{day.income ? money(day.income) : '—'}</td>
                    <td className="number-cell negative-number">{day.expenses ? money(day.expenses) : '—'}</td>
                    <td className={`number-cell ${netChange > 0 ? 'positive-number' : netChange < 0 ? 'negative-number' : ''}`}>{netChange ? money(netChange) : '—'}</td>
                    <td className="number-cell"><strong>{money(day.balance)}</strong></td>
                    <td><StatusBadge status={day.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default WeeklyForecast
