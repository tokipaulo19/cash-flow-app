const DAY_MS = 24 * 60 * 60 * 1000

export function parseLocalDate(value) {
  if (!value) return null
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date, amount) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + amount)
  return copy
}

function addMonthsClamped(date, amount) {
  const copy = new Date(date)
  const day = copy.getDate()
  copy.setDate(1)
  copy.setMonth(copy.getMonth() + amount)
  const lastDay = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate()
  copy.setDate(Math.min(day, lastDay))
  return copy
}

function calendarDayDifference(later, earlier) {
  return Math.round(
    (Date.UTC(later.getFullYear(), later.getMonth(), later.getDate()) -
      Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate())) /
      DAY_MS,
  )
}

function monthsBetween(later, earlier) {
  return (
    (later.getFullYear() - earlier.getFullYear()) * 12 +
    later.getMonth() -
    earlier.getMonth()
  )
}

function isMonthlyOccurrence(date, anchor, intervalMonths) {
  const difference = monthsBetween(date, anchor)
  if (difference < 0 || difference % intervalMonths !== 0) return false

  const lastDayOfMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate()

  return date.getDate() === Math.min(anchor.getDate(), lastDayOfMonth)
}

export function recurringEndDate(item) {
  if (item?.endless !== false) return null
  const anchor = parseLocalDate(item.startDate)
  const durationMonths = Math.max(0, Math.floor(Number(item.durationMonths) || 0))
  if (!anchor || !durationMonths) return null
  return addDays(addMonthsClamped(anchor, durationMonths), -1)
}

export function occursOnDate(item, date) {
  if (!item || item.active === false || (item.frequency === 'One-Off' && item.status === 'Paid')) return false

  const anchor = parseLocalDate(item.startDate)
  if (!anchor || date < anchor) return false

  const endDate = recurringEndDate(item)
  if (endDate && date > endDate) return false

  const paidThrough = item.type === 'income' ? parseLocalDate(item.paidThroughDate) : null
  if (paidThrough && date <= paidThrough) return false

  const difference = calendarDayDifference(date, anchor)

  switch (item.frequency) {
    case 'Weekly':
      return difference % 7 === 0
    case 'Fortnightly':
      return difference % 14 === 0
    case 'Monthly':
      return isMonthlyOccurrence(date, anchor, 1)
    case 'Quarterly':
      return isMonthlyOccurrence(date, anchor, 3)
    case 'Annual':
    case 'Yearly':
      return isMonthlyOccurrence(date, anchor, 12)
    case 'One-Off':
      return difference === 0
    default:
      return false
  }
}

export function nextExpectedOccurrence(item) {
  const anchor = parseLocalDate(item?.startDate)
  if (!anchor) return null

  const paidThrough = parseLocalDate(item.paidThroughDate)
  if (!paidThrough || paidThrough < anchor) return anchor

  const scheduleItem = { ...item, active: true, status: 'Unpaid', paidThroughDate: '' }
  let candidate = addDays(paidThrough, 1)

  for (let offset = 0; offset < 800; offset += 1) {
    if (occursOnDate(scheduleItem, candidate)) return candidate
    candidate = addDays(candidate, 1)
  }

  return null
}

export function pendingOccurrenceCount(item, throughDate = new Date()) {
  const end = new Date(throughDate.getFullYear(), throughDate.getMonth(), throughDate.getDate())
  const scheduleItem = { ...item, active: true, status: 'Unpaid', paidThroughDate: '' }
  let occurrence = nextExpectedOccurrence(item)
  let count = 0

  while (occurrence && occurrence <= end && count < 1000) {
    count += 1
    occurrence = nextExpectedOccurrence({ ...scheduleItem, paidThroughDate: toDateKey(occurrence) })
  }

  return count
}

export function generateDailyForecast({
  balance = 0,
  transactions = [],
  startDate,
  days = 84,
  minimumBuffer = 0,
}) {
  const start = parseLocalDate(startDate) || new Date()
  let cash = Number(balance) || 0
  const forecast = []

  for (let index = 0; index < days; index += 1) {
    const date = addDays(start, index)
    const startingBalance = cash
    const events = transactions
      .filter((item) => occursOnDate(item, date))
      .map((item) => ({ ...item, amount: Number(item.amount) || 0 }))

    const income = events
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0)

    const expenses = events
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0)

    cash = startingBalance + income - expenses

    forecast.push({
      date: toDateKey(date),
      startingBalance,
      income,
      expenses,
      balance: cash,
      headroom: cash - minimumBuffer,
      status: cash < 0 ? 'SHORTFALL' : cash < minimumBuffer ? 'TIGHT' : 'SAFE',
      events,
    })
  }

  return forecast
}

export function generateWeeklyForecast(forecast = [], minimumBuffer = 0) {
  const weeks = []

  for (let index = 0; index < forecast.length; index += 7) {
    const days = forecast.slice(index, index + 7)
    if (!days.length) continue

    const lowestDay = days.reduce((lowest, day) =>
      day.balance < lowest.balance ? day : lowest,
    )
    const firstRiskDay = days.find((day) => day.status !== 'SAFE')

    weeks.push({
      week: weeks.length + 1,
      start: days[0].date,
      end: days.at(-1).date,
      openingBalance: days[0].startingBalance,
      income: days.reduce((sum, day) => sum + day.income, 0),
      expenses: days.reduce((sum, day) => sum + day.expenses, 0),
      closingBalance: days.at(-1).balance,
      lowestBalance: lowestDay.balance,
      status:
        lowestDay.balance < 0
          ? 'SHORTFALL'
          : lowestDay.balance < minimumBuffer
            ? 'TIGHT'
            : 'SAFE',
      firstRiskDate: firstRiskDay?.date || null,
    })
  }

  return weeks
}
