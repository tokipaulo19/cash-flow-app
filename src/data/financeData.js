function todayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const financeData = {
  balance: 0,
  recurringIncome: [],
  recurringBills: [],
  variableExpenses: [],
  oneOffBills: [],
  categoryBudgets: {},
  settings: {
    forecastStartDate: todayKey(),
    minimumBuffer: 40000,
    forecastDays: 84,
  },
}
