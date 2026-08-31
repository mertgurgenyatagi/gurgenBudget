import type { DayKey, MonthKey } from './time'

export type Category =
  | 'baseIncome'
  | 'flexIncome'
  | 'baseSpend'
  | 'flexSpend'
  | 'wishlist'

/** Base items persist across months; flex/wishlist items belong to one month. */
export const BASE_CATEGORIES: Category[] = ['baseIncome', 'baseSpend']

export function isBase(category: Category): boolean {
  return category === 'baseIncome' || category === 'baseSpend'
}

export const CATEGORY_LABELS: Record<Category, string> = {
  baseIncome: 'Base Income',
  flexIncome: 'Flex Income',
  baseSpend: 'Base Spend',
  flexSpend: 'Flex Spend',
  wishlist: 'Wishlist',
}

/**
 * A past amount, kept quietly so old months keep computing correctly.
 * `until` is the last month this amount applied to.
 */
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

export interface DayLog {
  /** The day's spend — how much the bank balance dropped. Negative means it rose. */
  day: DayKey
  amount: number
}

export interface Buffer {
  amount: number
  history: HistoryEntry[]
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
  buffer: number
  days: number
}
