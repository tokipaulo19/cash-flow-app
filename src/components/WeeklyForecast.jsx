import { useState } from 'react'
import { generateWeeklyForecast } from '../engine/forecastEngine'
import { dateRange, money, shortDate } from '../utils/formatters'
import StatusBadge from './StatusBadge'

function weekday(value) {
  if (!value) return '—'
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', { weekday: 'short' }).format(new Date(year, month - 1, day))
}

function eventCategory(event) {
  const category = event.category?.trim()
  const subcategory = event.subcategory?.trim()
  return [category, subcategory].filter(Boolean).join(' › ') || (event.type === 'income' ? 'Income' : 'Uncategorised')
}

function ForecastBreakdown({ title, period, days, onClose }) {
  const events = days.flatMap((day) => day.events.map((event) => ({ ...event, occurrenceDate: day.date })))
  const incomeEvents = events.filter((event) => event.type === 'income')
  const expenseEvents = events.filter((event) => event.type === 'expense')
  const income = incomeEvents.reduce((sum, event) => sum + event.amount, 0)
  const expenses = expenseEvents.reduce((sum, event) => sum + event.amount, 0)

  const renderEvents = (items, emptyCopy) => items.length ? items.map((event, index) => (
    <div className="forecast-breakdown-event" key={`${event.id || event.name}-${event.occurrenceDate}-${index}`}>
      <div>
        <strong>{event.name}</strong>
        <span>{shortDate(event.occurrenceDate)} · {eventCategory(event)}</span>
      </div>
      <strong className={event.type === 'income' ? 'positive-number' : 'negative-number'}>{event.type === 'income' ? '+' : '−'}{money(event.amount)}</strong>
    </div>
  )) : <p className="forecast-breakdown-empty">{emptyCopy}</p>

  return (
    <aside className="forecast-breakdown" aria-live="polite">
      <div className="forecast-breakdown-heading">
        <div><span className="eyebrow">Selected period</span><h3>{title}</h3><p>{period}</p></div>
        <button className="button-secondary button-small" type="button" onClick={onClose}>Close details</button>
      </div>
      <div className="forecast-breakdown-summary">
        <div><span>Expected income</span><strong>{money(income)}</strong></div>
        <div><span>Outgoing</span><strong>{money(expenses)}</strong></div>
        <div><span>Net movement</span><strong className={income - expenses >= 0 ? 'positive-number' : 'negative-number'}>{money(income - expenses)}</strong></div>
      </div>
      <div className="forecast-breakdown-columns">
        <section><h4>Income</h4>{renderEvents(incomeEvents, 'No income expected in this period.')}</section>
        <section><h4>Expenses</h4>{renderEvents(expenseEvents, 'No expenses expected in this period.')}</section>
      </div>
    </aside>
  )
}

function WeeklyForecast({ forecast, dailyForecast, minimumBuffer }) {
  const [view, setView] = useState('weekly')
  const [selection, setSelection] = useState(null)
  const weeks = generateWeeklyForecast(forecast, minimumBuffer)
  const days = dailyForecast.slice(0, 90)
  const selectedDays = selection?.view === 'weekly'
    ? forecast.slice((selection.key - 1) * 7, selection.key * 7)
    : selection?.view === 'daily'
      ? days.filter((day) => day.date === selection.key)
      : []
  const selectedTitle = selection?.view === 'weekly' ? `Week ${String(selection.key).padStart(2, '0')} breakdown` : 'Daily breakdown'
  const selectedPeriod = selectedDays.length > 1 ? dateRange(selectedDays[0].date, selectedDays.at(-1).date) : shortDate(selectedDays[0]?.date)

  const changeView = (nextView) => {
    setView(nextView)
    setSelection(null)
  }

  const toggleSelection = (nextSelection) => {
    setSelection((current) => current?.view === nextSelection.view && current.key === nextSelection.key ? null : nextSelection)
  }

  const handleRowKey = (event, nextSelection) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    toggleSelection(nextSelection)
  }

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
            <button type="button" className={view === 'weekly' ? 'toggle-active' : ''} aria-pressed={view === 'weekly'} onClick={() => changeView('weekly')}>Weekly</button>
            <button type="button" className={view === 'daily' ? 'toggle-active' : ''} aria-pressed={view === 'daily'} onClick={() => changeView('daily')}>Daily</button>
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
                <tr className={`forecast-clickable-row ${selection?.view === 'weekly' && selection.key === week.week ? 'forecast-row-selected' : ''}`} key={week.week} tabIndex="0" aria-selected={selection?.view === 'weekly' && selection.key === week.week} onClick={() => toggleSelection({ view: 'weekly', key: week.week })} onKeyDown={(event) => handleRowKey(event, { view: 'weekly', key: week.week })}>
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
                  <tr className={`forecast-clickable-row ${selection?.view === 'daily' && selection.key === day.date ? 'forecast-row-selected' : ''}`} key={day.date} tabIndex="0" aria-selected={selection?.view === 'daily' && selection.key === day.date} onClick={() => toggleSelection({ view: 'daily', key: day.date })} onKeyDown={(event) => handleRowKey(event, { view: 'daily', key: day.date })}>
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
      {selection && selectedDays.length > 0 && <ForecastBreakdown title={selectedTitle} period={selectedPeriod} days={selectedDays} onClose={() => setSelection(null)} />}
    </section>
  )
}

export default WeeklyForecast
