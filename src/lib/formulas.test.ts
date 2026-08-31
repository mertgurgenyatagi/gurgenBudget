import { describe, expect, it } from 'vitest'
import { amountInMonth, computeMonth, dailyAllowance, moneySaved, surplus } from './formulas'
import { elapsedDays, todayKey } from './time'
import type { Buffer, Category, Item } from './types'

function item(partial: Partial<Item> & { category: Category; amount: number }): Item {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'x',
    history: [],
    createdMonth: '2020-01',
    deletedMonth: null,
    month: null,
    deleted: false,
    purchased: false,
    ...partial,
  }
}

const NO_BUFFER: Buffer = { amount: 0, history: [] }

describe('surplus', () => {
  it('is income minus spend, and may go negative', () => {
    const items = [
      item({ category: 'baseIncome', amount: 45000 }),
      item({ category: 'flexIncome', amount: 3200, month: '2026-04' }),
      item({ category: 'baseSpend', amount: 18000 }),
      item({ category: 'flexSpend', amount: 1250, month: '2026-04' }),
    ]
    expect(surplus(items, '2026-04')).toBe(28950)

    const broke = [item({ category: 'baseSpend', amount: 500 })]
    expect(surplus(broke, '2026-04')).toBe(-500)
  })
})

describe('dailyAllowance', () => {
  it('subtracts the wishlist, divides by the calendar month, then takes the buffer off each day', () => {
    // (31000 - 1000) / 30 = 1000, minus a 150 buffer
    expect(dailyAllowance(31000, 1000, '2026-04', 150)).toBe(850)
  })

  it('does not re-slice across remaining days — it is flat for the whole month', () => {
    const early = dailyAllowance(30000, 0, '2026-04', 0)
    const late = dailyAllowance(30000, 0, '2026-04', 0)
    expect(early).toBe(late)
  })
})

describe('a month is computed from what was true during it', () => {
  it('uses the historic amount for past months and the current one for now', () => {
    const rent = item({
      category: 'baseSpend',
      amount: 20000,
      history: [{ amount: 18000, until: '2026-03' }],
    })
    expect(amountInMonth(rent, '2026-02')).toBe(18000)
    expect(amountInMonth(rent, '2026-03')).toBe(18000)
    expect(amountInMonth(rent, '2026-04')).toBe(20000)
  })

  it('never backfills a newly created base item', () => {
    const salary = item({ category: 'baseIncome', amount: 45000, createdMonth: '2026-04' })
    expect(amountInMonth(salary, '2026-03')).toBeNull()
    expect(amountInMonth(salary, '2026-04')).toBe(45000)
  })

  it('keeps a deleted base item in past months only', () => {
    const gym = item({ category: 'baseSpend', amount: 900, deletedMonth: '2026-04' })
    expect(amountInMonth(gym, '2026-03')).toBe(900)
    expect(amountInMonth(gym, '2026-04')).toBeNull()
    expect(amountInMonth(gym, '2026-05')).toBeNull()
  })

  it('keeps flex items inside their own month', () => {
    const gig = item({ category: 'flexIncome', amount: 1000, month: '2026-04' })
    expect(amountInMonth(gig, '2026-03')).toBeNull()
    expect(amountInMonth(gig, '2026-04')).toBe(1000)
  })
})

describe('moneySaved', () => {
  it('spending exactly the allowance every day leaves the wishlist plus the buffer', () => {
    // The load-bearing property: Money Saved is the currency you spend on the
    // Wishlist playground, so a perfectly on-budget month buys the whole list.
    const month = '2026-04'
    const days = 30
    const wishlist = 6000
    const buffer = 150
    const surplusValue = 36000

    const allowance = dailyAllowance(surplusValue, wishlist, month, buffer)
    const logs = new Map(
      Array.from({ length: days }, (_, i) => [`${month}-${String(i + 1).padStart(2, '0')}`, allowance] as const),
    )

    // At month end every day is both elapsed and logged.
    const saved = moneySaved(surplusValue, logs, month, allowance, 0, new Date('2026-05-01T12:00:00Z'))
    expect(Math.round(saved)).toBe(wishlist + buffer * days)
  })

  it('a purchase consumes money saved without touching the wishlist total', () => {
    const items = [
      item({ category: 'baseIncome', amount: 30000 }),
      item({ category: 'wishlist', amount: 5000, month: '2026-04', purchased: true }),
    ]
    const figures = computeMonth(items, new Map(), NO_BUFFER, '2026-04')
    const unpurchased = computeMonth(
      items.map((i) => (i.category === 'wishlist' ? { ...i, purchased: false } : i)),
      new Map(),
      NO_BUFFER,
      '2026-04',
    )

    expect(figures.wishlist).toBe(unpurchased.wishlist)
    expect(figures.dailyAllowance).toBe(unpurchased.dailyAllowance)
    expect(figures.moneySaved).toBe(unpurchased.moneySaved - 5000)
  })
})

describe('elapsedDays', () => {
  it('never counts today — logging is retrospective', () => {
    const today = todayKey()
    const month = today.slice(0, 7)
    expect(elapsedDays(month)).toBe(Number(today.slice(8, 10)) - 1)
  })

  it('counts a past month in full and a future month not at all', () => {
    expect(elapsedDays('2020-02')).toBe(29)
    expect(elapsedDays('2999-01')).toBe(0)
  })
})
