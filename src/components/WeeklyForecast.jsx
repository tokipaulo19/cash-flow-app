import { generateWeeklyForecast } from '../engine/forecastEngine'
import { dateRange, money, shortDate } from '../utils/formatters'
import StatusBadge from './StatusBadge'

function WeeklyForecast({ forecast, minimumBuffer }) {
  const weeks = generateWeeklyForecast(forecast, minimumBuffer)

  return (
    <section className="panel forecast-panel">
      <div className="panel-heading forecast-heading">
        <div>
          <span className="eyebrow">Rolling forecast</span>
          <h2>Weekly cash flow</h2>
          <p>Daily movements rolled into decision-friendly weekly totals.</p>
        </div>
        <div className="forecast-legend">
          <span><i className="legend-dot legend-safe" />Above buffer</span>
          <span><i className="legend-dot legend-tight" />Below buffer</span>
          <span><i className="legend-dot legend-shortfall" />Below zero</span>
        </div>
      </div>

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
    </section>
  )
}

export default WeeklyForecast
