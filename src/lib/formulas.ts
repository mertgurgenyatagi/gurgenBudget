import { currentMonth, dayKey, daysInMonth, monthOf, todayDayOfMonth, type DayKey, type MonthKey } from './time'

export type Category =
  | 'baseIncome'
  | 'flexIncome'
  | 'baseSpend'
  | 'flexSpend'
  | 'wishlist'

export function isBase(category: Category): boolean {
  return category === 'baseIncome' || category === 'baseSpend'
}

/** A past amount, kept quietly so old months keep computing correctly. */
export interface HistoryEntry {
  amount: number
  until: MonthKey
}

export interface Item {
  id: string
  category: Category
  name: string
  amount: number
  history: HistoryEntry[]
  /** Base items: the month they started applying. Creating one never backfills. */
  createdMonth: MonthKey
  /** Base items: the month they stop applying from. Past months keep showing them. */
  deletedMonth: MonthKey | null
  /** Flex/Wishlist items: the single month they belong to. Null for base items. */
  month: MonthKey | null
  /** Quiet safety net — deleted flex/wishlist items stay put, filtered from view. */
  deleted: boolean
  /** Wishlist only. Inactive items are excluded from the month's totals, same as
   * deleted, but user-toggled and surfaced (dimmed row, checkbox) rather than
   * a quiet backstop. Defaults to true. */
  active: boolean
}

export type BufferMode = 'surplus' | 'slice'

export interface BufferHistoryEntry {
  percent: number
  mode: BufferMode
  until: MonthKey
}

export interface BufferSettings {
  percent: number
  mode: BufferMode
  history: BufferHistoryEntry[]
  dynamicAllowance: boolean
}

export interface MonthFigures {
  baseIncome: number
  flexIncome: number
  baseSpend: number
  flexSpend: number
  wishlist: number
  surplus: number
  dailyAllowance: number
  displayAllowance: number
  moneySaved: number
  bufferPercent: number
  bufferMode: BufferMode
  days: number
}

/**
 * A month is computed from whatever was true during that specific month.
 * History entries record what a value used to be, and through which month.
 */
export function resolveHistoricAmount(
  current: number,
  history: HistoryEntry[],
  month: MonthKey,
): number {
  const past = [...history].sort((a, b) => a.until.localeCompare(b.until))
  for (const entry of past) {
    if (month <= entry.until) return entry.amount
  }
  return current
}

/** The amount an item contributed in `month`, or null if it didn't apply at all. */
export function amountInMonth(item: Item, month: MonthKey): number | null {
  if (item.deleted) return null

  if (isBase(item.category)) {
    if (month < item.createdMonth) return null
    if (item.deletedMonth !== null && month >= item.deletedMonth) return null
    return resolveHistoricAmount(item.amount, item.history, month)
  }

  if (item.month !== month) return null
  return resolveHistoricAmount(item.amount, item.history, month)
}

export function itemsInMonth(items: Item[], month: MonthKey, category: Category): Item[] {
  return items.filter(
    (i) => i.category === category && amountInMonth(i, month) !== null,
  )
}

export function categoryTotal(items: Item[], month: MonthKey, category: Category): number {
  return itemsInMonth(items, month, category)
    .filter((i) => i.category !== 'wishlist' || i.active)
    .reduce((sum, i) => sum + (amountInMonth(i, month) ?? 0), 0)
}

/** Surplus = Base Income + Flex Income − Base Spend − Flex Spend. May be negative. */
export function surplus(items: Item[], month: MonthKey): number {
  return (
    categoryTotal(items, month, 'baseIncome') +
    categoryTotal(items, month, 'flexIncome') -
    categoryTotal(items, month, 'baseSpend') -
    categoryTotal(items, month, 'flexSpend')
  )
}

export function resolveBuffer(
  buffer: BufferSettings,
  month: MonthKey,
): { percent: number; mode: BufferMode } {
  const past = [...buffer.history].sort((a, b) => a.until.localeCompare(b.until))
  for (const entry of past) {
    if (month <= entry.until) return { percent: entry.percent, mode: entry.mode }
  }
  return { percent: buffer.percent, mode: buffer.mode }
}

/**
 * Daily Allowance, in either Buffer mode. `percent` is whole percentage
 * points (10 means 10%). Never re-slices across remaining days — a flat
 * per-day figure for the whole month. May be negative; shown as-is.
 */
export function dailyAllowance(
  surplusValue: number,
  wishlistTotal: number,
  month: MonthKey,
  percent: number,
  mode: BufferMode,
): number {
  const pct = percent / 100
  const days = daysInMonth(month)
  if (mode === 'surplus') {
    return (surplusValue * (1 - pct) - wishlistTotal) / days
  }
  return ((surplusValue - wishlistTotal) / days) * (1 - pct)
}

/** The raw signed sum of logged days in `month` — negative when money left the account. */
export function spendSoFar(days: Map<DayKey, number>, month: MonthKey): number {
  let total = 0
  for (const [day, amount] of days) {
    if (monthOf(day) === month) total += amount
  }
  return total
}

/**
 * Days left to project the allowance onto: any day from today through
 * month-end (or the whole month, for a future month) that has no log
 * entry yet. A logged day — past, today, or future — is never projected,
 * since its actual is already counted via spendSoFar. This is what makes
 * pre-logging a future day (day-boundary agency, PROJECT.md's "no
 * same-day fast path" aside) not double-count in Money Saved.
 */
export function remainingDays(days: Map<DayKey, number>, month: MonthKey, at?: Date): number {
  const now = currentMonth(at)
  if (month < now) return 0
  const total = daysInMonth(month)
  const from = month === now ? todayDayOfMonth(at) : 1
  let count = 0
  for (let d = from; d <= total; d++) {
    if (!days.has(dayKey(month, d))) count++
  }
  return count
}

/**
 * Money Saved = Surplus + spendSoFar − (allowance × remaining days).
 * spendSoFar is added, not subtracted, because it's already negative when
 * money left the account — see the design spec's sign note.
 */
export function moneySaved(
  surplusValue: number,
  days: Map<DayKey, number>,
  month: MonthKey,
  allowance: number,
  at?: Date,
): number {
  return surplusValue + spendSoFar(days, month) - allowance * remainingDays(days, month, at)
}

/**
 * Recomputes today's rate so the month's total projected spend still
 * lands on flat × daysInMonth, redistributing what's left over whatever
 * days remain unlogged. Falls back to the flat figure once there's
 * nothing left to redistribute — which also makes it degrade to the flat
 * figure automatically for any month other than the one currently in
 * progress (a past month has remaining = 0; a future month with nothing
 * pre-logged has remaining = totalDays, spendSoFar = 0, so the formula
 * collapses back to `flat`).
 */
export function dynamicAllowance(
  flat: number,
  totalDays: number,
  spendSoFarValue: number,
  remaining: number,
): number {
  if (remaining <= 0) return flat
  return (flat * totalDays + spendSoFarValue) / remaining
}

/** Everything a month's screens need, computed fresh from the raw items. */
export function computeMonth(
  items: Item[],
  days: Map<DayKey, number>,
  buffer: BufferSettings,
  month: MonthKey,
  at?: Date,
): MonthFigures {
  const baseIncome = categoryTotal(items, month, 'baseIncome')
  const flexIncome = categoryTotal(items, month, 'flexIncome')
  const baseSpend = categoryTotal(items, month, 'baseSpend')
  const flexSpend = categoryTotal(items, month, 'flexSpend')
  const wishlist = categoryTotal(items, month, 'wishlist')

  const surplusValue = baseIncome + flexIncome - baseSpend - flexSpend
  const { percent, mode } = resolveBuffer(buffer, month)
  const allowance = dailyAllowance(surplusValue, wishlist, month, percent, mode)
  const saved = moneySaved(surplusValue, days, month, allowance, at)
  const remaining = remainingDays(days, month, at)
  const dynamic = dynamicAllowance(allowance, daysInMonth(month), spendSoFar(days, month), remaining)

  return {
    baseIncome,
    flexIncome,
    baseSpend,
    flexSpend,
    wishlist,
    surplus: surplusValue,
    dailyAllowance: allowance,
    displayAllowance: buffer.dynamicAllowance ? dynamic : allowance,
    moneySaved: saved,
    bufferPercent: percent,
    bufferMode: mode,
    days: daysInMonth(month),
  }
}
