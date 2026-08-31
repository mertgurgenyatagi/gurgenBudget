import { daysInMonth, elapsedDays, monthOf, type DayKey, type MonthKey } from './time'

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
  /** Wishlist only. Purchased items stay in the list, crossed out. */
  purchased: boolean
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
}

export interface MonthFigures {
  baseIncome: number
  flexIncome: number
  baseSpend: number
  flexSpend: number
  wishlist: number
  surplus: number
  dailyAllowance: number
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
  return itemsInMonth(items, month, category).reduce(
    (sum, i) => sum + (amountInMonth(i, month) ?? 0),
    0,
  )
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

/** Wishlist items marked purchased — they consume Money Saved, nothing else. */
export function purchasedTotal(items: Item[], month: MonthKey): number {
  return itemsInMonth(items, month, 'wishlist')
    .filter((i) => i.purchased)
    .reduce((sum, i) => sum + (amountInMonth(i, month) ?? 0), 0)
}

/**
 * Money Saved = Surplus + spendSoFar − (allowance × remaining days) − purchased.
 * spendSoFar is added, not subtracted, because it's already negative when
 * money left the account — see the design spec's sign note.
 */
export function moneySaved(
  surplusValue: number,
  days: Map<DayKey, number>,
  month: MonthKey,
  allowance: number,
  purchased: number,
  at?: Date,
): number {
  const elapsed = elapsedDays(month, at)
  const remaining = daysInMonth(month) - elapsed
  return surplusValue + spendSoFar(days, month) - allowance * remaining - purchased
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
  const saved = moneySaved(surplusValue, days, month, allowance, purchasedTotal(items, month), at)

  return {
    baseIncome,
    flexIncome,
    baseSpend,
    flexSpend,
    wishlist,
    surplus: surplusValue,
    dailyAllowance: allowance,
    moneySaved: saved,
    bufferPercent: percent,
    bufferMode: mode,
    days: daysInMonth(month),
  }
}
