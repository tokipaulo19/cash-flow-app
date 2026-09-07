import { useMemo, useState } from 'react'
import { occursOnDate, scheduledOccurrenceAmount } from '../engine/forecastEngine'
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

function categoryNameFor(expense) {
  return expense.category?.trim() || fallbackCategories[expense.sourceSection] || 'Uncategorised'
}

function subcategoryNameFor(expense) {
  return expense.subcategory?.trim() || 'Other'
}

function monthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function calendarDaysForMonths(months) {
  return months.flatMap((monthKey) => {
    const [year, month] = monthKey.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, index) => ({ date: `${monthKey}-${String(index + 1).padStart(2, '0')}` }))
  })
}

function buildExpenseOccurrences(transactions, days) {
  return days.flatMap((day) => transactions
    .filter((item) => item.type === 'expense')
    .flatMap((item) => {
      const date = new Date(`${day.date}T00:00:00`)
      const scheduledItem = { ...item, status: 'Unpaid', paidThroughDate: '', trackBalance: false }
      if (!occursOnDate(scheduledItem, date)) return []
      const amount = scheduledOccurrenceAmount(item, date)
      return amount > 0 ? [{ ...item, amount, occurrenceDate: day.date }] : []
    }))
}

function MonthFilter({ months, selectedMonths, onChange }) {
  const allSelected = selectedMonths.length === months.length
  const summary = allSelected
    ? `All ${months.length} months`
    : selectedMonths.length === 1
      ? monthLabel(selectedMonths[0])
      : `${selectedMonths.length} months selected`

  const toggleMonth = (month) => {
    if (selectedMonths.includes(month)) {
      if (selectedMonths.length > 1) onChange(selectedMonths.filter((selected) => selected !== month))
    } else {
      onChange(months.filter((candidate) => candidate === month || selectedMonths.includes(candidate)))
    }
  }

  return (
    <details className="month-multiselect">
      <summary>{summary}</summary>
      <div className="month-options">
        <div className="month-options-actions">
          <button type="button" onClick={() => onChange([...months])}>Select all</button>
          <span>Choose one or more months</span>
        </div>
        {months.map((month) => (
          <label key={month}>
            <input type="checkbox" checked={selectedMonths.includes(month)} onChange={() => toggleMonth(month)} />
            <span>{monthLabel(month)}</span>
          </label>
        ))}
      </div>
    </details>
  )
}

function CategoryBudgetPanel({ transactions, expenses, selectedMonths, categoryBudgets, onSetCategoryBudget }) {
  const [editing, setEditing] = useState(false)

  const categories = useMemo(() => {
    const names = new Set(Object.keys(categoryBudgets))
    transactions
      .filter((item) => item.type === 'expense')
      .forEach((item) => names.add(categoryNameFor(item)))
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [categoryBudgets, transactions])

  const monthlySpending = useMemo(() => {
    const totals = {}

    expenses.forEach((item) => {
      const category = categoryNameFor(item)
      const subcategory = subcategoryNameFor(item)
      const categoryTotal = totals[category] || { total: 0, subcategories: {} }
      categoryTotal.total += item.amount
      categoryTotal.subcategories[subcategory] = (categoryTotal.subcategories[subcategory] || 0) + item.amount
      totals[category] = categoryTotal
    })

    return totals
  }, [expenses])

  const budgetedCategories = categories.filter((category) => Number(categoryBudgets[category]) > 0)

  return (
    <section className="panel category-budget-panel">
      <div className="panel-heading budget-heading">
        <div>
          <span className="eyebrow">Monthly guardrails</span>
          <h2>Category budget limits</h2>
          <p>All expense types count. Monthly limits are multiplied by the number of selected months; income is excluded.</p>
        </div>
        <div className="budget-actions">
          <button className="button-secondary button-small" type="button" onClick={() => setEditing((current) => !current)}>{editing ? 'Done' : 'Set limits'}</button>
        </div>
      </div>

      {editing && (
        <div className="budget-limit-editor">
          {categories.map((category) => (
            <label key={category}>
              <span>{category}</span>
              <div className="currency-input"><b>₱</b><input type="number" min="0" step="100" value={categoryBudgets[category] || ''} placeholder="No limit" onChange={(event) => onSetCategoryBudget(category, Number(event.target.value) || 0)} /></div>
            </label>
          ))}
          {!categories.length && <p className="empty-copy">Add an expense category first, then return here to set its monthly limit.</p>}
        </div>
      )}

      {budgetedCategories.length ? (
        <div className="budget-progress-list">
          {budgetedCategories.map((category) => {
            const monthlyLimit = Number(categoryBudgets[category]) || 0
            const limit = monthlyLimit * selectedMonths.length
            const spending = monthlySpending[category] || { total: 0, subcategories: {} }
            const spent = spending.total
            const remaining = limit - spent
            const percentage = limit ? (spent / limit) * 100 : 0
            const overBudget = remaining < 0
            const subcategories = Object.entries(spending.subcategories)
              .map(([name, amount]) => ({ name, amount }))
              .sort((a, b) => b.amount - a.amount)
            return (
              <div className={`budget-progress-row ${overBudget ? 'budget-over' : ''}`} key={category}>
                <div className="budget-progress-heading">
                  <strong>{category}</strong>
                  <span><b>{money(spent)}</b> of {money(limit)}{selectedMonths.length > 1 ? ` (${selectedMonths.length} months)` : ''}</span>
                </div>
                <div className="budget-progress-track" role="progressbar" aria-label={`${category}: ${money(spent)} of ${money(limit)}`} aria-valuemin="0" aria-valuemax={limit} aria-valuenow={spent}>
                  <i style={{ width: `${Math.min(percentage, 100)}%` }} />
                </div>
                <div className="budget-progress-meta">
                  <span>{overBudget ? `${money(Math.abs(remaining))} over budget` : `${money(remaining)} remaining`}</span>
                  <strong>{Math.round(percentage)}%</strong>
                </div>
                {subcategories.length > 0 && (
                  <div className="budget-subcategories">
                    <span className="budget-subcategory-label">Subcategories</span>
                    {subcategories.map((subcategory) => {
                      const limitShare = limit ? (subcategory.amount / limit) * 100 : 0
                      return (
                        <div className="budget-subcategory-row" key={subcategory.name}>
                          <div>
                            <span>{subcategory.name}</span>
                            <strong>{money(subcategory.amount)}</strong>
                          </div>
                          <div className="budget-subcategory-track" aria-hidden="true">
                            <i style={{ width: `${Math.min(limitShare, 100)}%` }} />
                          </div>
                          <small>{Math.round(limitShare)}% of limit</small>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : !editing && (
        <div className="budget-empty">
          <span>Set a monthly limit for any expense category to see its progress here.</span>
          <button className="button-primary button-small" type="button" onClick={() => setEditing(true)}>Set category limits</button>
        </div>
      )}
    </section>
  )
}

function ExpensesReport({ forecast, transactions, categoryBudgets = {}, onSetCategoryBudget, onAddExpense }) {
  const months = useMemo(() => [...new Set(forecast.map((day) => day.date.slice(0, 7)))], [forecast])
  const [selectedMonths, setSelectedMonths] = useState(() => months.slice(0, 1))
  const activeMonths = selectedMonths.filter((month) => months.includes(month))
  const filteredMonths = activeMonths.length ? activeMonths : months.slice(0, 1)
  const reportDays = useMemo(() => calendarDaysForMonths(filteredMonths), [filteredMonths])
  const expenses = useMemo(() => buildExpenseOccurrences(transactions, reportDays), [transactions, reportDays])

  const report = useMemo(() => {
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)
    const mandatory = expenses
      .filter((expense) => expense.mandatory)
      .reduce((sum, expense) => sum + expense.amount, 0)

    const categoriesByName = new Map()
    const itemsByName = new Map()

    expenses.forEach((expense) => {
      const categoryName = categoryNameFor(expense)
      const subcategoryName = subcategoryNameFor(expense)
      const category = categoriesByName.get(categoryName) || { name: categoryName, amount: 0, occurrences: 0, subcategories: new Map() }
      category.amount += expense.amount
      category.occurrences += 1
      const subcategory = category.subcategories.get(subcategoryName) || { name: subcategoryName, amount: 0, occurrences: 0 }
      subcategory.amount += expense.amount
      subcategory.occurrences += 1
      category.subcategories.set(subcategoryName, subcategory)
      categoriesByName.set(categoryName, category)

      const itemKey = `${expense.name.trim().toLowerCase()}|${categoryName.toLowerCase()}|${subcategoryName.toLowerCase()}`
      const item = itemsByName.get(itemKey) || {
        name: expense.name,
        category: categoryName,
        subcategory: subcategoryName,
        amount: 0,
        occurrences: 0,
        mandatory: Boolean(expense.mandatory),
      }
      item.amount += expense.amount
      item.occurrences += 1
      itemsByName.set(itemKey, item)
    })

    const categories = [...categoriesByName.values()]
      .map((category) => ({
        ...category,
        subcategories: [...category.subcategories.values()].sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.amount - a.amount)
    const items = [...itemsByName.values()].sort((a, b) => b.amount - a.amount)
    const spendingByDate = new Map(reportDays.map((day) => [day.date, 0]))
    expenses.forEach((expense) => spendingByDate.set(expense.occurrenceDate, (spendingByDate.get(expense.occurrenceDate) || 0) + expense.amount))
    const spendingDays = [...spendingByDate]
      .map(([date, amount]) => ({ date, amount }))
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
  }, [expenses, reportDays])

  const periodStart = reportDays[0]?.date
  const periodEnd = reportDays.at(-1)?.date
  const flexible = report.total - report.mandatory
  const topCategoryShare = report.total ? Math.round((report.topCategory?.amount / report.total) * 100) : 0
  const donutGradient = buildDonutGradient(report.categories, report.total)
  const subcategoryCount = report.categories.reduce((sum, category) => sum + category.subcategories.length, 0)
  const reportToolbar = (
    <section className="report-toolbar">
      <div>
        <span className="eyebrow">Months included</span>
        <strong>{shortDate(periodStart)} – {shortDate(periodEnd)}</strong>
      </div>
      <MonthFilter months={months} selectedMonths={filteredMonths} onChange={setSelectedMonths} />
    </section>
  )

  if (!report.total) {
    return (
      <div className="report-stack">
        {reportToolbar}
        <CategoryBudgetPanel transactions={transactions} expenses={expenses} selectedMonths={filteredMonths} categoryBudgets={categoryBudgets} onSetCategoryBudget={onSetCategoryBudget} />
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
      {reportToolbar}

      <section className="metrics-grid report-metrics">
        <ReportMetric label="Scheduled spending" value={money(report.total)} note={`${report.items.length} expense ${report.items.length === 1 ? 'item' : 'items'}`} tone="negative" />
        <ReportMetric label="Top category" value={report.topCategory.name} note={`${money(report.topCategory.amount)} · ${topCategoryShare}% of spending`} />
        <ReportMetric label="Largest expense" value={report.topItem.name} note={`${money(report.topItem.amount)} across ${report.topItem.occurrences} occurrence${report.topItem.occurrences === 1 ? '' : 's'}`} />
        <ReportMetric label="Biggest spending day" value={money(report.largestDay.amount)} note={shortDate(report.largestDay.date)} tone="negative" />
      </section>

      <CategoryBudgetPanel transactions={transactions} expenses={expenses} selectedMonths={filteredMonths} categoryBudgets={categoryBudgets} onSetCategoryBudget={onSetCategoryBudget} />

      <section className="report-grid">
        <article className="panel category-report-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Where it goes</span>
              <h2>Spending by category</h2>
            </div>
            <span className="panel-meta">{report.categories.length} categories · {subcategoryCount} subcategories</span>
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
                  <div className="category-legend-group" key={category.name}>
                    <div className="category-legend-row">
                      <i style={{ background: chartColours[index % chartColours.length] }} />
                      <span>{category.name}</span>
                      <strong>{money(category.amount)}</strong>
                      <small>{share}%</small>
                    </div>
                    <div className="subcategory-legend">
                      {category.subcategories.map((subcategory) => {
                        const categoryShare = category.amount ? (subcategory.amount / category.amount) * 100 : 0
                        return (
                          <div className="subcategory-legend-row" key={subcategory.name}>
                            <div>
                              <span>{subcategory.name}</span>
                              <small>{Math.round(categoryShare)}% of {category.name}</small>
                            </div>
                            <strong>{money(subcategory.amount)}</strong>
                            <div className="subcategory-legend-track" aria-hidden="true"><i style={{ width: `${categoryShare}%` }} /></div>
                          </div>
                        )
                      })}
                    </div>
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
              <div className="expense-ranking-row" key={`${item.name}-${item.category}-${item.subcategory}`}>
                <span className="ranking-number">{index + 1}</span>
                <div className="ranking-copy">
                  <div><strong>{item.name}</strong>{item.mandatory && <span className="mini-tag">Mandatory</span>}</div>
                  <span>{item.category} › {item.subcategory} · {item.occurrences} occurrence{item.occurrences === 1 ? '' : 's'}</span>
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
