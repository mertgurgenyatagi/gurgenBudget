import { daysInMonth, elapsedDays, monthOf, type DayKey, type MonthKey } from './time'
import { isBase, type Buffer, type Category, type HistoryEntry, type Item, type MonthFigures } from './types'

/**
 * A month is computed from whatever was true during that specific month.
 * History entries record what an amount used to be, and through which month.
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
    // Creating a base item never backfills; deleting it only applies going forward.
    if (month < item.createdMonth) return null
    if (item.deletedMonth !== null && month >= item.deletedMonth) return null
    return resolveHistoricAmount(item.amount, item.history, month)
  }

  // Flex and Wishlist items live in exactly one month.
  if (item.month !== month) return null
  return resolveHistoricAmount(item.amount, item.history, month)
}

export function itemsInMonth(items: Item[], month: MonthKey, category: Category): Item[] {
  return items.filter(
    (item) => item.category === category && amountInMonth(item, month) !== null,
  )
}

export function categoryTotal(items: Item[], month: MonthKey, category: Category): number {
  return itemsInMonth(items, month, category).reduce(
    (sum, item) => sum + (amountInMonth(item, month) ?? 0),
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

/**
 * Daily Allowance = ((Surplus − Wishlist) / days in month) − Buffer.
 * A flat per-day figure for the whole month — it never re-slices across remaining days.
 * May be negative; that is shown as-is.
 */
export function dailyAllowance(
  surplusValue: number,
  wishlistTotal: number,
  month: MonthKey,
  buffer: number,
): number {
  return (surplusValue - wishlistTotal) / daysInMonth(month) - buffer
}

/** Days actually logged so far this month, summed. Unlogged days count as zero. */
export function spendSoFar(days: Map<DayKey, number>, month: MonthKey): number {
  let total = 0
  for (const [day, amount] of days) {
    if (monthOf(day) === month) total += amount
  }
  return total
}

/**
 * Money Saved = Surplus − (actual logs so far) − (projected spend for remaining days),
 * less whatever Wishlist purchases have already been claimed against it.
 *
 * The basis is the full Surplus, not Surplus − Wishlist: Money Saved is the currency
 * you spend on the Wishlist playground, so subtracting the Wishlist would zero out
 * exactly the purchasing power the mechanic exists to give you.
 */
export function moneySaved(
  surplusValue: number,
  days: Map<DayKey, number>,
  month: MonthKey,
  allowance: number,
  purchasedTotal: number,
  at?: Date,
): number {
  const elapsed = elapsedDays(month, at)
  const remaining = daysInMonth(month) - elapsed
  return surplusValue - spendSoFar(days, month) - allowance * remaining - purchasedTotal
}

/** Wishlist items marked purchased — they consume Money Saved, nothing else. */
export function purchasedTotal(items: Item[], month: MonthKey): number {
  return itemsInMonth(items, month, 'wishlist')
    .filter((item) => item.purchased)
    .reduce((sum, item) => sum + (amountInMonth(item, month) ?? 0), 0)
}

export function bufferInMonth(buffer: Buffer, month: MonthKey): number {
  return resolveHistoricAmount(buffer.amount, buffer.history, month)
}

/** Everything a month's screens need, computed fresh from the raw items. */
export function computeMonth(
  items: Item[],
  days: Map<DayKey, number>,
  buffer: Buffer,
  month: MonthKey,
  at?: Date,
): MonthFigures {
  const baseIncome = categoryTotal(items, month, 'baseIncome')
  const flexIncome = categoryTotal(items, month, 'flexIncome')
  const baseSpend = categoryTotal(items, month, 'baseSpend')
  const flexSpend = categoryTotal(items, month, 'flexSpend')
  const wishlist = categoryTotal(items, month, 'wishlist')

  const surplusValue = baseIncome + flexIncome - baseSpend - flexSpend
  const bufferValue = bufferInMonth(buffer, month)
  const allowance = dailyAllowance(surplusValue, wishlist, month, bufferValue)
  const saved = moneySaved(
    surplusValue,
    days,
    month,
    allowance,
    purchasedTotal(items, month),
    at,
  )

  return {
    baseIncome,
    flexIncome,
    baseSpend,
    flexSpend,
    wishlist,
    surplus: surplusValue,
    dailyAllowance: allowance,
    moneySaved: saved,
    buffer: bufferValue,
    days: daysInMonth(month),
  }
}
