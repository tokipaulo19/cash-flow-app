export const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
})

export const compactCurrencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function money(value) {
  return currencyFormatter.format(Number(value) || 0)
}

export function compactMoney(value) {
  return compactCurrencyFormatter.format(Number(value) || 0)
}

export function shortDate(value) {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export function dateRange(start, end) {
  if (!start || !end) return '—'
  const [startYear, startMonth, startDay] = start.split('-').map(Number)
  const [endYear, endMonth, endDay] = end.split('-').map(Number)
  const formatter = new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
  })
  return `${formatter.format(new Date(startYear, startMonth - 1, startDay))}–${formatter.format(new Date(endYear, endMonth - 1, endDay))}`
}
