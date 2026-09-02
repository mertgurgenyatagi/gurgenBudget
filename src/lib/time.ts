/**
 * Every day boundary in gurgenBudget is Turkey time, never the device's
 * local time. Turkey has run a fixed UTC+3 with no daylight saving since
 * 2016, so a plain offset is correct here — no timezone library needed.
 */
const TR_OFFSET_MS = 3 * 60 * 60 * 1000

export type MonthKey = string // 'YYYY-MM'
export type DayKey = string // 'YYYY-MM-DD'

function trNow(at: Date = new Date()): Date {
  return new Date(at.getTime() + TR_OFFSET_MS)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function todayKey(at?: Date): DayKey {
  const d = trNow(at)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function currentMonth(at?: Date): MonthKey {
  return todayKey(at).slice(0, 7)
}

export function todayDayOfMonth(at?: Date): number {
  return Number(todayKey(at).slice(8, 10))
}

export function monthOf(day: DayKey): MonthKey {
  return day.slice(0, 7)
}

export function dayKey(month: MonthKey, day: number): DayKey {
  return `${month}-${pad(day)}`
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}

export function prevMonth(month: MonthKey): MonthKey {
  return addMonths(month, -1)
}

export function nextMonth(month: MonthKey): MonthKey {
  return addMonths(month, 1)
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function monthLabel(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}
