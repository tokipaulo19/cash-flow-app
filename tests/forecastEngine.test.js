import assert from 'node:assert/strict'
import test from 'node:test'
import { generateDailyForecast, nextExpectedOccurrence, pendingOccurrenceCount, remainingTrackedBalance, toDateKey, trackedBalanceAfterPayment, trackedBalanceAfterUndo } from '../src/engine/forecastEngine.js'

const trackedIncome = {
  id: 'tracked-income',
  name: 'Contract payout',
  type: 'income',
  frequency: 'Weekly',
  startDate: '2026-10-01',
  paidThroughDate: '2026-10-01',
  amount: 100,
  active: true,
  trackBalance: true,
  totalAmount: 450,
  amountPaid: 200,
  remainingAmount: 250,
}

test('tracked income forecasts only the unpaid balance and caps the last payment', () => {
  const forecast = generateDailyForecast({ transactions: [trackedIncome], startDate: '2026-10-08', days: 28 })
  const payments = forecast.filter((day) => day.income > 0).map((day) => [day.date, day.income])

  assert.deepEqual(payments, [
    ['2026-10-08', 100],
    ['2026-10-15', 100],
    ['2026-10-22', 50],
  ])
  assert.equal(forecast.at(-1).balance, 250)
})

test('fully received income has no next payment or future forecast events', () => {
  const paidOff = { ...trackedIncome, amountPaid: 450, remainingAmount: 0 }
  const forecast = generateDailyForecast({ transactions: [paidOff], startDate: '2026-10-08', days: 28 })

  assert.equal(remainingTrackedBalance(paidOff), 0)
  assert.equal(nextExpectedOccurrence(paidOff), null)
  assert.equal(pendingOccurrenceCount(paidOff, new Date(2026, 10, 1)), 0)
  assert.equal(forecast.reduce((total, day) => total + day.income, 0), 0)
})

test('pending tracked income counts stop at the number of payments left', () => {
  const income = { ...trackedIncome, paidThroughDate: '', totalAmount: 150, amountPaid: 0, remainingAmount: 150 }

  assert.equal(toDateKey(nextExpectedOccurrence(income)), '2026-10-01')
  assert.equal(pendingOccurrenceCount(income, new Date(2026, 9, 29)), 2)
})

test('untracked recurring income continues on its usual schedule', () => {
  const income = { ...trackedIncome, trackBalance: false }
  const forecast = generateDailyForecast({ transactions: [income], startDate: '2026-10-08', days: 28 })

  assert.equal(forecast.filter((day) => day.income > 0).length, 4)
  assert.equal(forecast.at(-1).balance, 400)
})

test('undo restores the prior balance after a payment exceeds the remaining amount', () => {
  const beforePayment = { ...trackedIncome, totalAmount: 250, amountPaid: 220, remainingAmount: 30 }
  const payment = trackedBalanceAfterPayment(beforePayment, 50)
  const fullyReceived = { ...beforePayment, ...payment }
  const restored = trackedBalanceAfterUndo(fullyReceived, payment.previousAmountPaid, 50)

  assert.deepEqual(payment, { previousAmountPaid: 220, amountPaid: 250, remainingAmount: 0 })
  assert.equal(nextExpectedOccurrence(fullyReceived), null)
  assert.deepEqual(restored, { amountPaid: 220, remainingAmount: 30 })
  assert.equal(toDateKey(nextExpectedOccurrence({ ...beforePayment, ...restored })), '2026-10-08')
})

test('tracked recurring bills still stop at their remaining balance', () => {
  const bill = { ...trackedIncome, type: 'expense', totalAmount: 250, amountPaid: 100, remainingAmount: 150 }
  const forecast = generateDailyForecast({ transactions: [bill], startDate: '2026-10-08', days: 28 })

  assert.deepEqual(forecast.filter((day) => day.expenses > 0).map((day) => day.expenses), [100, 50])
  assert.equal(forecast.at(-1).balance, -150)
})

test('every 4 weeks repeats on a 28-day cycle for income and bills', () => {
  const income = { ...trackedIncome, frequency: 'Every 4 weeks', trackBalance: false, paidThroughDate: '' }
  const bill = { ...income, id: 'four-week-bill', type: 'expense', amount: 40 }
  const forecast = generateDailyForecast({ transactions: [income, bill], startDate: '2026-10-01', days: 85 })
  const dates = forecast.filter((day) => day.events.length).map((day) => day.date)

  assert.deepEqual(dates, ['2026-10-01', '2026-10-29', '2026-11-26', '2026-12-24'])
  assert.deepEqual(forecast.filter((day) => day.events.length).map((day) => [day.income, day.expenses]), [
    [100, 40], [100, 40], [100, 40], [100, 40],
  ])
  assert.equal(toDateKey(nextExpectedOccurrence({ ...income, paidThroughDate: '2026-10-29' })), '2026-11-26')
})
