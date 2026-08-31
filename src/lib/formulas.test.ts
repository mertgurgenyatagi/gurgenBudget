import { describe, expect, it } from 'vitest'
import {
  amountInMonth,
  categoryTotal,
  dailyAllowance,
  moneySaved,
  spendSoFar,
  surplus,
  type Item,
} from './formulas'

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    category: 'baseIncome',
    name: 'Salary',
    amount: 1000,
    history: [],
    createdMonth: '2026-01',
    deletedMonth: null,
    month: null,
    deleted: false,
    active: true,
    ...overrides,
  }
}

describe('amountInMonth — base items', () => {
  it('is null before createdMonth', () => {
    expect(amountInMonth(item({ createdMonth: '2026-03' }), '2026-02')).toBeNull()
  })

  it('resolves the live amount when there is no history', () => {
    expect(amountInMonth(item({ amount: 5000 }), '2026-06')).toBe(5000)
  })

  it('resolves the old amount at/before the edit boundary, the new amount after', () => {
    // Edited in 2026-04: the old value (1000) applied through 2026-03.
    const edited = item({ amount: 1200, history: [{ amount: 1000, until: '2026-03' }] })
    expect(amountInMonth(edited, '2026-03')).toBe(1000)
    expect(amountInMonth(edited, '2026-04')).toBe(1200)
  })

  it('is null at and after deletedMonth, still resolves the month before', () => {
    const deleted = item({ deletedMonth: '2026-05' })
    expect(amountInMonth(deleted, '2026-04')).toBe(1000)
    expect(amountInMonth(deleted, '2026-05')).toBeNull()
  })
})

describe('amountInMonth — flex/wishlist items', () => {
  it('is null outside its one month', () => {
    const flex = item({ category: 'flexSpend', month: '2026-04', createdMonth: '2026-04' })
    expect(amountInMonth(flex, '2026-04')).toBe(1000)
    expect(amountInMonth(flex, '2026-05')).toBeNull()
  })

  it('is null once deleted', () => {
    const removed = item({
      category: 'wishlist',
      month: '2026-04',
      createdMonth: '2026-04',
      deleted: true,
    })
    expect(amountInMonth(removed, '2026-04')).toBeNull()
  })
})

describe('categoryTotal — wishlist active/inactive', () => {
  it('excludes inactive wishlist items from the total, but not other categories', () => {
    const items = [
      item({ id: 'a', category: 'wishlist', month: '2026-04', createdMonth: '2026-04', amount: 1000, active: true }),
      item({ id: 'b', category: 'wishlist', month: '2026-04', createdMonth: '2026-04', amount: 500, active: false }),
      item({ id: 'c', category: 'baseIncome', amount: 200, active: false }),
    ]
    expect(categoryTotal(items, '2026-04', 'wishlist')).toBe(1000)
    expect(categoryTotal(items, '2026-04', 'baseIncome')).toBe(200)
  })
})

describe('surplus', () => {
  it('is positive when income exceeds spend', () => {
    const items = [
      item({ id: 'a', category: 'baseIncome', amount: 5000 }),
      item({ id: 'b', category: 'baseSpend', amount: 2000 }),
    ]
    expect(surplus(items, '2026-06')).toBe(3000)
  })

  it('is negative when spend exceeds income', () => {
    const items = [
      item({ id: 'a', category: 'baseIncome', amount: 1000 }),
      item({ id: 'b', category: 'baseSpend', amount: 4000 }),
    ]
    expect(surplus(items, '2026-06')).toBe(-3000)
  })
})

describe('dailyAllowance', () => {
  // Surplus 10,000, Wishlist 2,000, 30-day month, 10%.
  it("mode 'surplus' takes its cut from Surplus only, before Wishlist", () => {
    const result = dailyAllowance(10000, 2000, '2026-04', 10, 'surplus')
    expect(result).toBeCloseTo((10000 * 0.9 - 2000) / 30)
  })

  it("mode 'slice' takes its cut from the whole daily figure, after Wishlist", () => {
    const result = dailyAllowance(10000, 2000, '2026-04', 10, 'slice')
    expect(result).toBeCloseTo(((10000 - 2000) / 30) * 0.9)
  })
})

describe('spendSoFar', () => {
  it('sums only the target month and treats missing days as zero', () => {
    const days = new Map<string, number>([
      ['2026-04-05', -300],
      ['2026-04-06', 200],
      ['2026-05-01', -9999], // different month — must not count
    ])
    expect(spendSoFar(days, '2026-04')).toBe(-100)
  })
})

describe('moneySaved', () => {
  it("mode 'surplus': spending exactly the allowance all month lands on Wishlist + Surplus*pct", () => {
    const wishlistTotal = 2000
    const surplusValue = 10000
    const allowance = dailyAllowance(surplusValue, wishlistTotal, '2026-04', 10, 'surplus')
    const days = new Map<string, number>()
    for (let d = 1; d <= 30; d++) {
      days.set(`2026-04-${String(d).padStart(2, '0')}`, -allowance)
    }
    const at = new Date('2026-05-01T00:00:00Z') // April fully elapsed
    const saved = moneySaved(surplusValue, days, '2026-04', allowance, at)
    expect(saved).toBeCloseTo(wishlistTotal + surplusValue * 0.1, 6)
  })

  it("mode 'slice': spending exactly the allowance all month lands on Wishlist + (Surplus-Wishlist)*pct", () => {
    const wishlistTotal = 2000
    const surplusValue = 10000
    const allowance = dailyAllowance(surplusValue, wishlistTotal, '2026-04', 10, 'slice')
    const days = new Map<string, number>()
    for (let d = 1; d <= 30; d++) {
      days.set(`2026-04-${String(d).padStart(2, '0')}`, -allowance)
    }
    const at = new Date('2026-05-01T00:00:00Z')
    const saved = moneySaved(surplusValue, days, '2026-04', allowance, at)
    expect(saved).toBeCloseTo(wishlistTotal + (surplusValue - wishlistTotal) * 0.1, 6)
  })

  it('an unlogged day contributes zero', () => {
    const days = new Map<string, number>([['2026-04-01', -100]])
    const at = new Date('2026-04-10T00:00:00Z') // elapsed = 9 loggable days
    const saved = moneySaved(1000, days, '2026-04', 30, at)
    expect(saved).toBe(1000 + -100 - 30 * (30 - 9))
  })
})
