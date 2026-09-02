import { describe, expect, it } from 'vitest'
import {
  amountInMonth,
  categoryTotal,
  computeMonth,
  dailyAllowance,
  dynamicAllowance,
  itemsInMonth,
  moneySaved,
  nextItemName,
  remainingDays,
  spendSoFar,
  surplus,
  type BufferSettings,
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

describe('remainingDays', () => {
  it('counts from today through month-end when browsing the current month', () => {
    const at = new Date('2026-04-10T00:00:00Z') // today = April 10
    expect(remainingDays(new Map(), '2026-04', at)).toBe(21) // days 10..30
  })

  it('excludes a logged future day from the count', () => {
    const at = new Date('2026-04-10T00:00:00Z')
    const days = new Map<string, number>([['2026-04-25', -500]])
    expect(remainingDays(days, '2026-04', at)).toBe(20) // 21 minus the pre-logged day
  })

  it('is the full month minus pre-logged days for a future month', () => {
    const at = new Date('2026-04-10T00:00:00Z')
    const days = new Map<string, number>([['2026-06-01', -200]])
    expect(remainingDays(days, '2026-06', at)).toBe(29) // 30 - 1 pre-logged day
  })

  it('is zero for a fully elapsed past month', () => {
    const at = new Date('2026-05-01T00:00:00Z')
    expect(remainingDays(new Map(), '2026-04', at)).toBe(0)
  })
})

describe('moneySaved — future-day logging', () => {
  it('does not double-count a pre-logged future day', () => {
    const at = new Date('2026-04-10T00:00:00Z')
    const days = new Map<string, number>([['2026-04-25', -500]])
    const allowance = 100
    const saved = moneySaved(1000, days, '2026-04', allowance, at)
    // remaining = 20 (21 minus the pre-logged day), spendSoFar = -500
    expect(saved).toBe(1000 + -500 - allowance * 20)
  })
})

describe('dynamicAllowance', () => {
  it('redistributes the remaining flat budget over what is left', () => {
    // flat 100/day, 30-day month, net -200 spent so far, 20 days left unlogged.
    const result = dynamicAllowance(100, 30, -200, 20)
    expect(result).toBeCloseTo((100 * 30 - 200) / 20)
  })

  it('falls back to the flat figure once nothing is left to redistribute', () => {
    expect(dynamicAllowance(100, 30, -500, 0)).toBe(100)
  })

  it('equals the flat figure at the very start of the month, nothing spent yet', () => {
    expect(dynamicAllowance(100, 30, 0, 30)).toBeCloseTo(100)
  })
})

describe('itemsInMonth — sorting', () => {
  it('sorts by magnitude of amount, descending', () => {
    const items = [
      item({ id: 'a', category: 'flexSpend', month: '2026-04', createdMonth: '2026-04', amount: 50 }),
      item({ id: 'b', category: 'flexSpend', month: '2026-04', createdMonth: '2026-04', amount: -500 }),
      item({ id: 'c', category: 'flexSpend', month: '2026-04', createdMonth: '2026-04', amount: 200 }),
    ]
    const result = itemsInMonth(items, '2026-04', 'flexSpend')
    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('nextItemName', () => {
  it('starts at Item01 for an empty scope', () => {
    expect(nextItemName([])).toBe('Item01')
  })

  it('numbers one past however many items already exist', () => {
    expect(nextItemName([item({ id: 'a' }), item({ id: 'b' })])).toBe('Item03')
  })
})

describe('computeMonth — displayAllowance', () => {
  it('matches dailyAllowance when Dynamic Allowance is off', () => {
    const items = [
      item({ id: 'a', category: 'baseIncome', amount: 9000 }),
      item({ id: 'b', category: 'baseSpend', amount: 3000 }),
    ]
    const buffer: BufferSettings = { percent: 0, mode: 'slice', history: [], dynamicAllowance: false }
    const figures = computeMonth(items, new Map(), buffer, '2026-04')
    expect(figures.displayAllowance).toBe(figures.dailyAllowance)
  })

  it('diverges from dailyAllowance when Dynamic Allowance is on and money has been spent', () => {
    const items = [
      item({ id: 'a', category: 'baseIncome', amount: 9000 }),
      item({ id: 'b', category: 'baseSpend', amount: 3000 }),
    ]
    const buffer: BufferSettings = { percent: 0, mode: 'slice', history: [], dynamicAllowance: true }
    const days = new Map<string, number>([['2026-04-01', -1000]])
    const at = new Date('2026-04-05T00:00:00Z')
    const figures = computeMonth(items, days, buffer, '2026-04', at)
    expect(figures.displayAllowance).not.toBe(figures.dailyAllowance)
  })
})
