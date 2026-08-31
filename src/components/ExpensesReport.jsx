import { useMemo, useState } from 'react'
import { money, shortDate } from '../utils/formatters'

const chartColours = ['#f36a21', '#18191b', '#9a9a9a', '#c64e10', '#5c5c5d', '#f4a177', '#353536', '#c8c5bf']
const fallbackCategories = {
  recurringBills: 'Recurring bills',
  variableExpenses: 'Variable expenses',
  oneOffBills: 'One-off bills',
}

function ReportMetric({ label, value, note, tone = 'default' }) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </article>
  )
}

function buildDonutGradient(categories, total) {
  if (!total) return '#d7d4ce'

  let cursor = 0
  return `conic-gradient(${categories.map((category, index) => {
    const start = cursor
    cursor += (category.amount / total) * 100
    return `${chartColours[index % chartColours.length]} ${start}% ${cursor}%`
  }).join(', ')})`
}

function ExpensesReport({ forecast, onAddExpense }) {
  const [range, setRange] = useState('28')
  const rangeDays = range === 'all' ? forecast.length : Math.min(Number(range), forecast.length)
  const reportDays = forecast.slice(0, rangeDays)

  const report = useMemo(() => {
    const expenses = reportDays.flatMap((day) => day.events
      .filter((event) => event.type === 'expense')
      .map((event) => ({ ...event, occurrenceDate: day.date })))

    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)
    const mandatory = expenses
      .filter((expense) => expense.mandatory)
      .reduce((sum, expense) => sum + expense.amount, 0)

    const categoriesByName = new Map()
    const itemsByName = new Map()

    expenses.forEach((expense) => {
      const categoryName = expense.category?.trim() || fallbackCategories[expense.sourceSection] || 'Uncategorised'
      const category = categoriesByName.get(categoryName) || { name: categoryName, amount: 0, occurrences: 0 }
      category.amount += expense.amount
      category.occurrences += 1
      categoriesByName.set(categoryName, category)

      const itemKey = `${expense.name.trim().toLowerCase()}|${categoryName.toLowerCase()}`
      const item = itemsByName.get(itemKey) || {
        name: expense.name,
        category: categoryName,
        amount: 0,
        occurrences: 0,
        mandatory: Boolean(expense.mandatory),
      }
      item.amount += expense.amount
      item.occurrences += 1
      itemsByName.set(itemKey, item)
    })

    const categories = [...categoriesByName.values()].sort((a, b) => b.amount - a.amount)
    const items = [...itemsByName.values()].sort((a, b) => b.amount - a.amount)
    const spendingDays = reportDays
      .map((day) => ({ date: day.date, amount: day.expenses }))
      .sort((a, b) => b.amount - a.amount)

    return {
      total,
      mandatory,
      categories,
      items,
      topCategory: categories[0],
      topItem: items[0],
      largestDay: spendingDays[0],
    }
  }, [reportDays])

  const periodStart = reportDays[0]?.date
  const periodEnd = reportDays.at(-1)?.date
  const flexible = report.total - report.mandatory
  const topCategoryShare = report.total ? Math.round((report.topCategory?.amount / report.total) * 100) : 0
  const donutGradient = buildDonutGradient(report.categories, report.total)

  if (!report.total) {
    return (
      <div className="report-stack">
        <section className="panel report-empty">
          <div className="report-empty-icon" aria-hidden="true">↗</div>
          <span className="eyebrow">Spending analysis</span>
          <h2>No scheduled expenses to analyse yet</h2>
          <p>Add a bill or planned expense and this report will show what consumes the most money over time.</p>
          <button className="button-primary" type="button" onClick={onAddExpense}>Add an expense</button>
        </section>
      </div>
    )
  }

  return (
    <div className="report-stack">
      <section className="report-toolbar">
        <div>
          <span className="eyebrow">Report period</span>
          <strong>{shortDate(periodStart)} – {shortDate(periodEnd)}</strong>
        </div>
        <label>
          <span className="visually-hidden">Report period</span>
          <select value={range} onChange={(event) => setRange(event.target.value)}>
            <option value="28">Next 4 weeks</option>
            <option value="56">Next 8 weeks</option>
            <option value="all">Full forecast</option>
          </select>
        </label>
      </section>

      <section className="metrics-grid report-metrics">
        <ReportMetric label="Scheduled spending" value={money(report.total)} note={`${report.items.length} expense ${report.items.length === 1 ? 'item' : 'items'}`} tone="negative" />
        <ReportMetric label="Top category" value={report.topCategory.name} note={`${money(report.topCategory.amount)} · ${topCategoryShare}% of spending`} />
        <ReportMetric label="Largest expense" value={report.topItem.name} note={`${money(report.topItem.amount)} across ${report.topItem.occurrences} occurrence${report.topItem.occurrences === 1 ? '' : 's'}`} />
        <ReportMetric label="Biggest spending day" value={money(report.largestDay.amount)} note={shortDate(report.largestDay.date)} tone="negative" />
      </section>

      <section className="report-grid">
        <article className="panel category-report-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Where it goes</span>
              <h2>Spending by category</h2>
            </div>
            <span className="panel-meta">{report.categories.length} categories</span>
          </div>
          <div className="category-report-body">
            <div className="donut-chart" style={{ background: donutGradient }} role="img" aria-label={`Spending by category. ${report.topCategory.name} is the largest at ${topCategoryShare} percent.`}>
              <div>
                <strong>{topCategoryShare}%</strong>
                <span>largest share</span>
              </div>
            </div>
            <div className="category-legend">
              {report.categories.map((category, index) => {
                const share = Math.round((category.amount / report.total) * 100)
                return (
                  <div className="category-legend-row" key={category.name}>
                    <i style={{ background: chartColours[index % chartColours.length] }} />
                    <span>{category.name}</span>
                    <strong>{money(category.amount)}</strong>
                    <small>{share}%</small>
                  </div>
                )
              })}
            </div>
          </div>
        </article>

        <article className="panel spending-split-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Commitments</span>
              <h2>Mandatory vs flexible</h2>
            </div>
          </div>
          <div className="split-total">{money(report.total)}</div>
          <div className="split-bar" aria-label={`${money(report.mandatory)} mandatory and ${money(flexible)} flexible spending`}>
            <span style={{ width: `${report.total ? (report.mandatory / report.total) * 100 : 0}%` }} />
          </div>
          <div className="split-legend">
            <div><i className="split-mandatory" /><span>Mandatory</span><strong>{money(report.mandatory)}</strong></div>
            <div><i className="split-flexible" /><span>Flexible</span><strong>{money(flexible)}</strong></div>
          </div>
          <p className="split-note">Mark expenses as mandatory when they cannot be postponed. Flexible spending is the first place to look when cash gets tight.</p>
        </article>
      </section>

      <article className="panel expense-ranking-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Largest cash drains</span>
            <h2>Top expense items</h2>
            <p>Recurring items are totalled across every occurrence in this period.</p>
          </div>
        </div>
        <div className="expense-ranking-list">
          {report.items.slice(0, 10).map((item, index) => {
            const share = (item.amount / report.total) * 100
            return (
              <div className="expense-ranking-row" key={`${item.name}-${item.category}`}>
                <span className="ranking-number">{index + 1}</span>
                <div className="ranking-copy">
                  <div><strong>{item.name}</strong>{item.mandatory && <span className="mini-tag">Mandatory</span>}</div>
                  <span>{item.category} · {item.occurrences} occurrence{item.occurrences === 1 ? '' : 's'}</span>
                  <div className="ranking-bar"><i style={{ width: `${share}%` }} /></div>
                </div>
                <div className="ranking-value"><strong>{money(item.amount)}</strong><span>{Math.round(share)}%</span></div>
              </div>
            )
          })}
        </div>
      </article>
    </div>
  )
}

export default ExpensesReport
