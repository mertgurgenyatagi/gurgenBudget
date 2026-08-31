# Backend Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every hardcoded placeholder figure across the eight ring screens plus `/history` with a real Firestore-backed data model, the PROJECT.md formulas (Buffer reworked to a percentage with a surplus/slice mode toggle), and the write-side interactions (item add/edit, day logging, Buffer settings, sign out) needed to actually create and edit that data.

**Architecture:** A pure, fully-tested formula layer (`src/lib/time.ts`, `src/lib/formulas.ts`) with no dependency on React or Firestore. A single `DataProvider` React context (`src/data/DataContext.tsx`) holds three live `onSnapshot` listeners and every write function; it's the only thing that talks to Firestore. Every screen reads through `useData()` and feeds the pure formulas — no screen calls Firestore directly, and no screen owns business logic.

**Tech Stack:** React 19, TypeScript (~6.0.2, `verbatimModuleSyntax`), Vite 8, Firebase 12 (Auth + Firestore, modular SDK), Vitest 4 (new — formulas only).

**Spec:** [docs/superpowers/specs/2026-08-31-backend-wiring-design.md](../specs/2026-08-31-backend-wiring-design.md)

## Global Constraints

- Money is always whole lira, formatted only via the existing `lira()` in `src/money.ts` — never format currency any other way.
- Day/month boundaries are always fixed UTC+3 (Turkey time), never the device's local time — see `src/lib/time.ts` in Task 1.
- No 0–100 clamp, no required-field validation anywhere in this feature — every numeric/text field accepts anything, matching the rest of the app.
- Firestore paths are all under `users/{uid}/...`, already scoped by the existing `firestore.rules`. No rules changes needed.
- Reuse the existing canon palette tokens (`--ink`, `--paper`, `--accent`, `--short`, `--muted`, `--rule`, `--track`, `--onink`, `--backdrop`, the `--b-*` dark-band set) and Inter typeface. No new colors, no new fonts.
- **No Playwright / browser automation this session.** Verification for every task is `npm run build` (tsc + vite build) and, for Task 1 only, `npm run test` (Vitest). There is no live-browser click-through as part of this plan — flag that to the user as a follow-up once implementation is done.
- Testing is scoped to `src/lib/formulas.ts` only, per the spec — no component tests, no Firestore emulator.
- Every screen keeps its already-shipped visual design; this plan changes data and interactions, not layout, except where a task explicitly adds a small new control (the sheet, the buffer toggle, the calendar's inline edit input) that has no prior design to preserve.

---

## File Structure

New:
```
src/lib/time.ts                    MonthKey/DayKey helpers, Turkey offset
src/lib/formulas.ts                Category/Item/Buffer types + pure formulas
src/lib/formulas.test.ts           Vitest cases over formulas.ts
src/data/DataContext.tsx           DataProvider + useData() — the only Firestore access point
src/routes/pages/SaveErrorBanner.tsx  global write-failure banner
src/routes/pages/ItemSheet.tsx     shared add/edit sheet (all 5 categories)
src/routes/pages/CategoryBars.tsx  extracted bar-list (shared by Month Setup + History)
src/routes/pages/WishlistBody.tsx  extracted item list + Money Saved (shared by Wishlist + History)
```

Modified:
```
package.json, vite.config.ts        add Vitest
src/App.tsx                         mount DataProvider + SaveErrorBanner
src/routes/Dashboard.tsx            real dailyAllowance
src/routes/pages/MonthSetupScreen.tsx  real data, opens ItemSheet
src/routes/BaseIncome.tsx, FlexIncome.tsx, BaseSpend.tsx, FlexSpend.tsx  pass category + month
src/routes/Wishlist.tsx             real data, opens ItemSheet
src/routes/DailyLog.tsx             real data, month stepper, inline day editing
src/routes/Settings.tsx             real Buffer (percent + mode toggle), real email, sign out, History link
src/routes/History.tsx              full rewrite — month stepper, summary, reuses CategoryBars/WishlistBody
src/index.css                       additions per task below
```

Deleted:
```
src/routes/pages/RingPage.tsx       dead once History stops using it (Task 7)
```

---

### Task 1: Pure formula layer

**Files:**
- Create: `src/lib/time.ts`
- Create: `src/lib/formulas.ts`
- Create: `src/lib/formulas.test.ts`
- Modify: `package.json` — add `vitest` devDependency + `test` script
- Modify: `vite.config.ts` — add Vitest config

**Interfaces:**
- Produces (consumed by every later task): `MonthKey`, `DayKey` (both `string`) and every function/type in `src/lib/time.ts` and `src/lib/formulas.ts` listed below.

```
time.ts: todayKey(at?), currentMonth(at?), todayDayOfMonth(at?), monthOf(day),
  dayKey(month, day), daysInMonth(month), addMonths(month, delta), prevMonth(month),
  nextMonth(month), monthLabel(month), elapsedDays(month, at?)

formulas.ts:
  type Category = 'baseIncome' | 'flexIncome' | 'baseSpend' | 'flexSpend' | 'wishlist'
  isBase(category): boolean
  interface HistoryEntry { amount: number; until: MonthKey }
  interface Item { id, category, name, amount, history, createdMonth, deletedMonth, month, deleted, purchased }
  type BufferMode = 'surplus' | 'slice'
  interface BufferHistoryEntry { percent: number; mode: BufferMode; until: MonthKey }
  interface BufferSettings { percent: number; mode: BufferMode; history: BufferHistoryEntry[] }
  interface MonthFigures { baseIncome, flexIncome, baseSpend, flexSpend, wishlist,
    surplus, dailyAllowance, moneySaved, bufferPercent, bufferMode, days }
  resolveHistoricAmount(current, history, month): number
  amountInMonth(item, month): number | null
  itemsInMonth(items, month, category): Item[]
  categoryTotal(items, month, category): number
  surplus(items, month): number
  resolveBuffer(buffer, month): { percent: number; mode: BufferMode }
  dailyAllowance(surplusValue, wishlistTotal, month, percent, mode): number
  spendSoFar(days: Map<DayKey, number>, month): number
  purchasedTotal(items, month): number
  moneySaved(surplusValue, days, month, allowance, purchased, at?): number
  computeMonth(items, days, buffer, month, at?): MonthFigures
```

- [ ] **Step 1: Add Vitest**

```bash
npm install -D vitest@^4.1.11
```

- [ ] **Step 2: Wire Vitest into vite.config.ts**

Replace the full contents of `vite.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: '/gurgenBudget/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Add the test script to package.json**

In `package.json`, add a `test` entry to `scripts` (alongside the existing `dev`/`build`/`lint`/`preview`):

```json
"test": "vitest run"
```

- [ ] **Step 4: Write `src/lib/time.ts`**

```ts
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

/**
 * How many days of `month` are loggable so far. Logging is inherently
 * retrospective — today is never loggable, since the day isn't over yet.
 */
export function elapsedDays(month: MonthKey, at?: Date): number {
  const now = currentMonth(at)
  if (month < now) return daysInMonth(month)
  if (month > now) return 0
  return Math.max(0, todayDayOfMonth(at) - 1)
}
```

- [ ] **Step 5: Write the failing tests — `src/lib/formulas.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import {
  amountInMonth,
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
    purchased: false,
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
    const saved = moneySaved(surplusValue, days, '2026-04', allowance, 0, at)
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
    const saved = moneySaved(surplusValue, days, '2026-04', allowance, 0, at)
    expect(saved).toBeCloseTo(wishlistTotal + (surplusValue - wishlistTotal) * 0.1, 6)
  })

  it('an unlogged day contributes zero', () => {
    const days = new Map<string, number>([['2026-04-01', -100]])
    const at = new Date('2026-04-10T00:00:00Z') // elapsed = 9 loggable days
    const saved = moneySaved(1000, days, '2026-04', 30, 0, at)
    expect(saved).toBe(1000 + -100 - 30 * (30 - 9))
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `./formulas` has no exported member (the module doesn't exist yet).

- [ ] **Step 7: Write `src/lib/formulas.ts`**

```ts
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
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS — all 13 cases green.

- [ ] **Step 9: Run the full build**

Run: `npm run build`
Expected: succeeds (tsc + vite build), same as before this task.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/lib/time.ts src/lib/formulas.ts src/lib/formulas.test.ts
git commit -m "Add the pure formula layer: time, formulas, and Vitest"
```

---

### Task 2: Firestore data layer + Dashboard wired

**Files:**
- Create: `src/data/DataContext.tsx`
- Create: `src/routes/pages/SaveErrorBanner.tsx`
- Modify: `src/App.tsx`
- Modify: `src/routes/Dashboard.tsx`
- Modify: `src/index.css` — append the save-error banner styles

**Interfaces:**
- Consumes: `Category`, `Item`, `BufferMode`, `BufferSettings`, `isBase`, `computeMonth` from `src/lib/formulas.ts`; `MonthKey`, `DayKey`, `currentMonth`, `prevMonth` from `src/lib/time.ts`; `useAuth()` from `src/auth/AuthContext.tsx`; `db` from `src/firebase.ts`.
- Produces (consumed by every later task): `useData(): DataState` where
  ```ts
  interface DataState {
    items: Item[]
    days: Map<DayKey, number>
    buffer: BufferSettings
    ready: boolean
    saveError: string | null
    clearSaveError: () => void
    addItem: (input: { category: Category; name: string; amount: number; month: MonthKey }) => void
    editItem: (item: Item, changes: { name?: string; amount?: number }, month: MonthKey) => void
    deleteItem: (item: Item, month: MonthKey) => void
    moveItem: (item: Item, category: Category) => void
    setPurchased: (item: Item, purchased: boolean) => void
    logDay: (day: DayKey, amount: number | null) => void
    setBuffer: (percent: number, mode: BufferMode, month: MonthKey) => void
  }
  ```
  and `<DataProvider>` (must wrap anything calling `useData()`).

- [ ] **Step 1: Write `src/data/DataContext.tsx`**

```tsx
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/AuthContext'
import { db } from '../firebase'
import { isBase, type BufferMode, type BufferSettings, type Category, type Item } from '../lib/formulas'
import { prevMonth, type DayKey, type MonthKey } from '../lib/time'

interface DataState {
  items: Item[]
  days: Map<DayKey, number>
  buffer: BufferSettings
  ready: boolean
  saveError: string | null
  clearSaveError: () => void
  addItem: (input: { category: Category; name: string; amount: number; month: MonthKey }) => void
  editItem: (item: Item, changes: { name?: string; amount?: number }, month: MonthKey) => void
  deleteItem: (item: Item, month: MonthKey) => void
  moveItem: (item: Item, category: Category) => void
  setPurchased: (item: Item, purchased: boolean) => void
  logDay: (day: DayKey, amount: number | null) => void
  setBuffer: (percent: number, mode: BufferMode, month: MonthKey) => void
}

const EMPTY_BUFFER: BufferSettings = { percent: 0, mode: 'slice', history: [] }

const DataContext = createContext<DataState | null>(null)

function itemFromDoc(id: string, raw: DocumentData): Item {
  return {
    id,
    category: raw.category,
    name: typeof raw.name === 'string' ? raw.name : '',
    amount: typeof raw.amount === 'number' ? raw.amount : 0,
    history: Array.isArray(raw.history) ? raw.history : [],
    createdMonth: raw.createdMonth,
    deletedMonth: raw.deletedMonth ?? null,
    month: raw.month ?? null,
    deleted: raw.deleted === true,
    purchased: raw.purchased === true,
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.uid ?? null

  const [items, setItems] = useState<Item[]>([])
  const [days, setDays] = useState<Map<DayKey, number>>(new Map())
  const [buffer, setBufferState] = useState<BufferSettings>(EMPTY_BUFFER)
  const [loaded, setLoaded] = useState({ items: false, days: false, buffer: false })
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) {
      setItems([])
      setDays(new Map())
      setBufferState(EMPTY_BUFFER)
      setLoaded({ items: false, days: false, buffer: false })
      return
    }

    const unsubItems = onSnapshot(collection(db, 'users', uid, 'items'), (snap) => {
      setItems(snap.docs.map((d) => itemFromDoc(d.id, d.data())))
      setLoaded((prev) => ({ ...prev, items: true }))
    })

    const unsubDays = onSnapshot(collection(db, 'users', uid, 'days'), (snap) => {
      const next = new Map<DayKey, number>()
      for (const d of snap.docs) {
        const amount = d.data().amount
        if (typeof amount === 'number') next.set(d.id, amount)
      }
      setDays(next)
      setLoaded((prev) => ({ ...prev, days: true }))
    })

    const unsubBuffer = onSnapshot(doc(db, 'users', uid, 'settings', 'buffer'), (snap) => {
      const raw = snap.data()
      setBufferState({
        percent: typeof raw?.percent === 'number' ? raw.percent : 0,
        mode: raw?.mode === 'surplus' ? 'surplus' : 'slice',
        history: Array.isArray(raw?.history) ? raw.history : [],
      })
      setLoaded((prev) => ({ ...prev, buffer: true }))
    })

    return () => {
      unsubItems()
      unsubDays()
      unsubBuffer()
    }
  }, [uid])

  const report = useCallback((error: unknown) => {
    console.error(error)
    setSaveError("Didn't save. Try again.")
  }, [])

  const addItem = useCallback<DataState['addItem']>(
    ({ category, name, amount, month }) => {
      if (!uid) return
      const ref = doc(collection(db, 'users', uid, 'items'))
      setDoc(ref, {
        category,
        name,
        amount,
        history: [],
        createdMonth: month,
        deletedMonth: null,
        month: isBase(category) ? null : month,
        deleted: false,
        purchased: false,
      }).catch(report)
    },
    [uid, report],
  )

  const editItem = useCallback<DataState['editItem']>(
    (item, changes, month) => {
      if (!uid) return
      const patch: Record<string, unknown> = {}
      if (changes.name !== undefined) patch.name = changes.name

      if (changes.amount !== undefined && changes.amount !== item.amount) {
        patch.amount = changes.amount
        const boundary = prevMonth(month)
        const alreadyRecorded = item.history.some((entry) => entry.until === boundary)
        if (!alreadyRecorded && month > item.createdMonth) {
          patch.history = [...item.history, { amount: item.amount, until: boundary }]
        }
      }

      if (Object.keys(patch).length === 0) return
      updateDoc(doc(db, 'users', uid, 'items', item.id), patch).catch(report)
    },
    [uid, report],
  )

  const deleteItem = useCallback<DataState['deleteItem']>(
    (item, month) => {
      if (!uid) return
      const patch = isBase(item.category) ? { deletedMonth: month } : { deleted: true }
      updateDoc(doc(db, 'users', uid, 'items', item.id), patch).catch(report)
    },
    [uid, report],
  )

  const moveItem = useCallback<DataState['moveItem']>(
    (item, category) => {
      if (!uid) return
      updateDoc(doc(db, 'users', uid, 'items', item.id), {
        category,
        purchased: category === 'wishlist' ? item.purchased : false,
      }).catch(report)
    },
    [uid, report],
  )

  const setPurchased = useCallback<DataState['setPurchased']>(
    (item, purchased) => {
      if (!uid) return
      updateDoc(doc(db, 'users', uid, 'items', item.id), { purchased }).catch(report)
    },
    [uid, report],
  )

  const logDay = useCallback<DataState['logDay']>(
    (day, amount) => {
      if (!uid) return
      const ref = doc(db, 'users', uid, 'days', day)
      if (amount === null) {
        deleteDoc(ref).catch(report)
      } else {
        setDoc(ref, { amount }).catch(report)
      }
    },
    [uid, report],
  )

  const setBuffer = useCallback<DataState['setBuffer']>(
    (percent, mode, month) => {
      if (!uid) return
      const boundary = prevMonth(month)
      const alreadyRecorded = buffer.history.some((entry) => entry.until === boundary)
      const changed = percent !== buffer.percent || mode !== buffer.mode
      const history =
        alreadyRecorded || !changed
          ? buffer.history
          : [...buffer.history, { percent: buffer.percent, mode: buffer.mode, until: boundary }]
      setDoc(doc(db, 'users', uid, 'settings', 'buffer'), { percent, mode, history }).catch(report)
    },
    [uid, buffer, report],
  )

  const value = useMemo<DataState>(
    () => ({
      items,
      days,
      buffer,
      ready: loaded.items && loaded.days && loaded.buffer,
      saveError,
      clearSaveError: () => setSaveError(null),
      addItem,
      editItem,
      deleteItem,
      moveItem,
      setPurchased,
      logDay,
      setBuffer,
    }),
    [
      items, days, buffer, loaded, saveError,
      addItem, editItem, deleteItem, moveItem, setPurchased, logDay, setBuffer,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataState {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}
```

- [ ] **Step 2: Write `src/routes/pages/SaveErrorBanner.tsx`**

```tsx
import { useData } from '../../data/DataContext'

export function SaveErrorBanner() {
  const { saveError, clearSaveError } = useData()
  if (!saveError) return null

  return (
    <div className="save-error" onClick={clearSaveError}>
      {saveError}
    </div>
  )
}
```

- [ ] **Step 3: Append save-error banner styles to `src/index.css`**

```css
.save-error {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  background: var(--short);
  color: var(--onink);
  font-size: 12px;
  font-weight: 700;
  padding: 10px 16px;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 12px 30px -12px rgba(0, 0, 0, .5);
}
```

- [ ] **Step 4: Mount DataProvider in `src/App.tsx`**

Replace the full contents of `src/App.tsx`:

```tsx
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { DataProvider } from './data/DataContext'
import { History } from './routes/History'
import { SaveErrorBanner } from './routes/pages/SaveErrorBanner'
import { Ring } from './routes/Ring'
import { SignIn } from './routes/SignIn'

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <SaveErrorBanner />
        <HashRouter>
          <Routes>
            <Route path="/sign-in" element={<SignIn />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Ring />
                </RequireAuth>
              }
            />
            <Route
              path="/history"
              element={
                <RequireAuth>
                  <History />
                </RequireAuth>
              }
            />
          </Routes>
        </HashRouter>
      </DataProvider>
    </AuthProvider>
  )
}
```

- [ ] **Step 5: Wire Dashboard to real data**

Replace the full contents of `src/routes/Dashboard.tsx`:

```tsx
import { useData } from '../data/DataContext'
import { computeMonth } from '../lib/formulas'
import { currentMonth } from '../lib/time'
import { lira } from '../money'

export function Dashboard() {
  const { items, days, buffer } = useData()
  const figures = computeMonth(items, days, buffer, currentMonth())

  return (
    <div className="screen screen--ink dash">
      <span className="fig num">{lira(figures.dailyAllowance)}</span>
      <span className="lbl">Today</span>
    </div>
  )
}
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: succeeds. (No live-browser check this session — see Global Constraints.)

- [ ] **Step 7: Commit**

```bash
git add src/data/DataContext.tsx src/routes/pages/SaveErrorBanner.tsx src/App.tsx src/routes/Dashboard.tsx src/index.css
git commit -m "Wire Firestore data layer; Dashboard shows the real Daily Allowance"
```

---

### Task 3: Month Setup screens wired (+ shared ItemSheet)

**Files:**
- Create: `src/routes/pages/CategoryBars.tsx`
- Create: `src/routes/pages/ItemSheet.tsx`
- Modify: `src/routes/pages/MonthSetupScreen.tsx`
- Modify: `src/routes/BaseIncome.tsx`, `src/routes/FlexIncome.tsx`, `src/routes/BaseSpend.tsx`, `src/routes/FlexSpend.tsx`
- Modify: `src/index.css` — sheet/scrim styles, the shared `.toggle2` control, cursor affordances

**Interfaces:**
- Consumes: `useData()` from Task 2; `Category`, `Item`, `itemsInMonth`, `categoryTotal` from `src/lib/formulas.ts`; `currentMonth` from `src/lib/time.ts`; `lira` from `src/money.ts`.
- Produces (consumed by Task 4, Task 7): `ItemSheet` with props `{ category: Category; item: Item | null; month: MonthKey; onClose: () => void }`; `CategoryBars` with props `{ label: string; items: Item[]; total: number; kind: 'income' | 'spend'; onSelectItem: (item: Item) => void; onAdd: () => void }`.
- Produces (consumed by Task 7): `MonthSetupScreen` now takes `{ category: Category; label: string; kind: 'income' | 'spend'; month: MonthKey }` (was `{ label, items, kind }` — the `items` prop is gone).

- [ ] **Step 1: Write `src/routes/pages/CategoryBars.tsx`**

```tsx
import type { Item } from '../../lib/formulas'
import { lira } from '../../money'

type CategoryBarsProps = {
  label: string
  items: Item[]
  total: number
  /** Income bars run moss, spend bars run rust. */
  kind: 'income' | 'spend'
  onSelectItem: (item: Item) => void
  onAdd: () => void
}

// Design #8, "bar share": each item is a labeled bar sized to its share of
// the category total. Wrapped in its own `.bars` class rather than relying
// on an ancestor to style it, because History reuses this inside a plain
// `.history-block` — a different container than MonthSetupScreen's `.ms`.
export function CategoryBars({ label, items, total, kind, onSelectItem, onAdd }: CategoryBarsProps) {
  const fill = kind === 'income' ? 'var(--accent)' : 'var(--short)'

  return (
    <div className="bars">
      <div className="fig num">{lira(total)}</div>
      <div className="lbl">{label}</div>
      {items.map((item) => (
        <div className="bar" key={item.id} onClick={() => onSelectItem(item)}>
          <div className="top">
            <span className="n">{item.name}</span>
            <span className="num">{lira(item.amount)}</span>
          </div>
          <div className="track">
            <div
              className="fill"
              style={{
                width: total === 0 ? '0%' : `${Math.round((item.amount / total) * 100)}%`,
                background: fill,
              }}
            />
          </div>
        </div>
      ))}
      <div className="add" onClick={onAdd}>
        + Add
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/routes/pages/ItemSheet.tsx`**

```tsx
import { useState } from 'react'
import { useData } from '../../data/DataContext'
import type { Category, Item } from '../../lib/formulas'
import type { MonthKey } from '../../lib/time'

type ItemSheetProps = {
  category: Category
  /** null means "adding a new item"; otherwise the item being edited. */
  item: Item | null
  month: MonthKey
  onClose: () => void
}

const MOVABLE: Category[] = ['flexSpend', 'wishlist']

// Shared by Base/Flex Income, Base/Flex Spend, Wishlist, and History — one
// sheet, opened by "+ Add" or by tapping an existing row. Flex Spend and
// Wishlist additionally get the category toggle they share (PROJECT.md:
// "share one add entry point with a toggle"), and a Purchased checkbox
// while the item is currently in Wishlist.
export function ItemSheet({ category, item, month, onClose }: ItemSheetProps) {
  const { addItem, editItem, deleteItem, moveItem, setPurchased } = useData()
  const [name, setName] = useState(item?.name ?? '')
  const [amount, setAmount] = useState(item ? String(item.amount) : '')
  const [cat, setCat] = useState<Category>(item?.category ?? category)
  const [purchased, setPurchasedDraft] = useState(item?.purchased ?? false)

  const canToggle = MOVABLE.includes(category)

  function handleSave() {
    const amt = Math.round(Number(amount)) || 0
    if (item === null) {
      addItem({ category: cat, name, amount: amt, month })
    } else {
      if (cat !== item.category) moveItem(item, cat)
      editItem(item, { name, amount: amt }, month)
      if (cat === 'wishlist' && purchased !== item.purchased) setPurchased(item, purchased)
    }
    onClose()
  }

  function handleDelete() {
    if (item !== null) deleteItem(item, month)
    onClose()
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <input
          className="sheet-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          autoFocus
        />
        <input
          className="sheet-amount"
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
        />
        {canToggle && (
          <div className="toggle2">
            <button
              className={cat === 'flexSpend' ? 'active' : ''}
              onClick={() => setCat('flexSpend')}
            >
              Flex Spend
            </button>
            <button className={cat === 'wishlist' ? 'active' : ''} onClick={() => setCat('wishlist')}>
              Wishlist
            </button>
          </div>
        )}
        {cat === 'wishlist' && (
          <label className="sheet-purchased">
            <input
              type="checkbox"
              checked={purchased}
              onChange={(e) => setPurchasedDraft(e.target.checked)}
            />
            Purchased
          </label>
        )}
        <div className="sheet-actions">
          {item !== null && (
            <button className="sheet-delete" onClick={handleDelete}>
              Delete
            </button>
          )}
          <button className="sheet-save" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Rewrite `src/routes/pages/MonthSetupScreen.tsx`**

Replace the full contents:

```tsx
import { useState } from 'react'
import { useData } from '../../data/DataContext'
import { categoryTotal, itemsInMonth, type Category, type Item } from '../../lib/formulas'
import type { MonthKey } from '../../lib/time'
import { CategoryBars } from './CategoryBars'
import { ItemSheet } from './ItemSheet'

type MonthSetupScreenProps = {
  category: Category
  label: string
  kind: 'income' | 'spend'
  month: MonthKey
}

// Shared by the four Month Setup screens, which stay four distinct screens
// on the ring. Also reused by History, fed a past month instead of the
// current one.
export function MonthSetupScreen({ category, label, kind, month }: MonthSetupScreenProps) {
  const { items } = useData()
  const [editing, setEditing] = useState<Item | 'new' | null>(null)

  return (
    <div className="screen ms">
      <CategoryBars
        label={label}
        kind={kind}
        items={itemsInMonth(items, month, category)}
        total={categoryTotal(items, month, category)}
        onSelectItem={setEditing}
        onAdd={() => setEditing('new')}
      />
      {editing !== null && (
        <ItemSheet
          category={category}
          item={editing === 'new' ? null : editing}
          month={month}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update the four wrapper screens**

Replace the full contents of `src/routes/BaseIncome.tsx`:

```tsx
import { MonthSetupScreen } from './pages/MonthSetupScreen'
import { currentMonth } from '../lib/time'

export function BaseIncome() {
  return (
    <MonthSetupScreen category="baseIncome" label="Base income" kind="income" month={currentMonth()} />
  )
}
```

Replace the full contents of `src/routes/FlexIncome.tsx`:

```tsx
import { MonthSetupScreen } from './pages/MonthSetupScreen'
import { currentMonth } from '../lib/time'

export function FlexIncome() {
  return (
    <MonthSetupScreen category="flexIncome" label="Flex income" kind="income" month={currentMonth()} />
  )
}
```

Replace the full contents of `src/routes/BaseSpend.tsx`:

```tsx
import { MonthSetupScreen } from './pages/MonthSetupScreen'
import { currentMonth } from '../lib/time'

export function BaseSpend() {
  return (
    <MonthSetupScreen category="baseSpend" label="Base spend" kind="spend" month={currentMonth()} />
  )
}
```

Replace the full contents of `src/routes/FlexSpend.tsx`:

```tsx
import { MonthSetupScreen } from './pages/MonthSetupScreen'
import { currentMonth } from '../lib/time'

export function FlexSpend() {
  return (
    <MonthSetupScreen category="flexSpend" label="Flex spend" kind="spend" month={currentMonth()} />
  )
}
```

- [ ] **Step 5: Add the sheet, toggle, and cursor styles to `src/index.css`**

Append:

```css
/* ===== Two-option pill toggle — shared by ItemSheet's category toggle
   and Settings' Buffer mode toggle ===== */
.toggle2 {
  display: flex;
  gap: 6px;
  margin: 4px 0;
}

.toggle2 button {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--rule);
  border-radius: 10px;
  background: var(--paper);
  color: var(--muted);
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .04em;
  cursor: pointer;
}

.toggle2 button.active {
  background: var(--ink);
  color: var(--onink);
  border-color: var(--ink);
}

/* ===== Item sheet ===== */
.sheet-scrim {
  position: fixed;
  inset: 0;
  background: color-mix(in oklch, var(--ink) 55%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 10;
}

.sheet {
  width: 100%;
  max-width: 320px;
  background: var(--paper);
  color: var(--ink);
  border-radius: 20px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, .5);
}

.sheet input[type='text'] {
  font: inherit;
  font-size: 15px;
  padding: 10px 12px;
  border: 1px solid var(--rule);
  border-radius: 10px;
  background: var(--paper);
  color: var(--ink);
}

.sheet-purchased {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
}

.sheet-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.sheet-actions button {
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.sheet-save {
  border: none;
  background: var(--ink);
  color: var(--onink);
}

.sheet-delete {
  border: 1px solid var(--short);
  background: var(--paper);
  color: var(--short);
}
```

Then **rename** the existing `.ms .fig`, `.ms .lbl`, `.ms .bar` (and its
three nested rules), and `.ms .add` rules to `.bars` instead of `.ms` — this
inner content now lives in `CategoryBars`'s own `.bars` wrapper (Step 1
above) so it renders correctly wherever `CategoryBars` is used, not only
inside `MonthSetupScreen`'s `.screen.ms` shell. `.ms` itself stays exactly
as-is (it's still the outer screen shell, just padding). Find this existing
block:

```css
.ms .fig {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -.02em;
}

.ms .lbl {
  font-size: 10px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 18px;
}

.ms .bar {
  margin: 12px 0;
}

.ms .bar .top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  margin-bottom: 5px;
}

.ms .bar .top .n {
  color: var(--muted);
}

.ms .bar .top .num {
  font-weight: 700;
}

.ms .bar .track {
  height: 7px;
  border-radius: 4px;
  background: var(--track);
  overflow: hidden;
}

.ms .bar .fill {
  height: 100%;
  border-radius: 4px;
}

.ms .add {
  margin-top: 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  text-align: center;
}
```

Replace it with (renamed to `.bars`, plus `cursor: pointer` on the two
interactive elements):

```css
.bars .fig {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -.02em;
}

.bars .lbl {
  font-size: 10px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 18px;
}

.bars .bar {
  margin: 12px 0;
  cursor: pointer;
}

.bars .bar .top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  margin-bottom: 5px;
}

.bars .bar .top .n {
  color: var(--muted);
}

.bars .bar .top .num {
  font-weight: 700;
}

.bars .bar .track {
  height: 7px;
  border-radius: 4px;
  background: var(--track);
  overflow: hidden;
}

.bars .bar .fill {
  height: 100%;
  border-radius: 4px;
}

.bars .add {
  margin-top: 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  text-align: center;
  cursor: pointer;
}
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/routes/pages/CategoryBars.tsx src/routes/pages/ItemSheet.tsx src/routes/pages/MonthSetupScreen.tsx src/routes/BaseIncome.tsx src/routes/FlexIncome.tsx src/routes/BaseSpend.tsx src/routes/FlexSpend.tsx src/index.css
git commit -m "Wire the four Month Setup screens to real data via a shared item sheet"
```

---

### Task 4: Wishlist screen wired

**Files:**
- Create: `src/routes/pages/WishlistBody.tsx`
- Modify: `src/routes/Wishlist.tsx`
- Modify: `src/index.css` — the "+ Add" row and cursor affordance

**Interfaces:**
- Consumes: `ItemSheet` from Task 3; `useData()` from Task 2; `computeMonth`, `itemsInMonth` from `src/lib/formulas.ts`; `currentMonth` from `src/lib/time.ts`.
- Produces (consumed by Task 7): `WishlistBody` with props `{ items: Item[]; moneySaved: number; onSelectItem: (item: Item) => void; onAdd: () => void }`.

- [ ] **Step 1: Write `src/routes/pages/WishlistBody.tsx`**

```tsx
import type { Item } from '../../lib/formulas'
import { lira } from '../../money'

type WishlistBodyProps = {
  items: Item[]
  moneySaved: number
  onSelectItem: (item: Item) => void
  onAdd: () => void
}

// Design #01, "ledger stub". Purchased items stay in the list, struck
// through — never moved out. Wrapped in its own `.wishlist-body` class
// rather than relying on an ancestor, because History reuses this inside a
// plain `.history-block` — a different container than Wishlist's `.wish`
// torn-edge card.
export function WishlistBody({ items, moneySaved, onSelectItem, onAdd }: WishlistBodyProps) {
  return (
    <div className="wishlist-body">
      <div className="head">Wishlist</div>
      {items.map((item) => (
        <div
          className={item.purchased ? 'row bought' : 'row'}
          key={item.id}
          onClick={() => onSelectItem(item)}
        >
          <span>{item.name}</span>
          <span className="num">{lira(item.amount)}</span>
        </div>
      ))}
      <div className="add" onClick={onAdd}>
        + Add
      </div>
      <div className="foot">
        <span className="lbl">Money saved</span>
        <span className="num">{lira(moneySaved)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `src/routes/Wishlist.tsx`**

Replace the full contents:

```tsx
import { useState } from 'react'
import { useData } from '../data/DataContext'
import { computeMonth, itemsInMonth, type Item } from '../lib/formulas'
import { currentMonth } from '../lib/time'
import { ItemSheet } from './pages/ItemSheet'
import { WishlistBody } from './pages/WishlistBody'

export function Wishlist() {
  const { items, days, buffer } = useData()
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const month = currentMonth()
  const wishlistItems = itemsInMonth(items, month, 'wishlist')
  const figures = computeMonth(items, days, buffer, month)

  return (
    <div className="screen wish">
      <WishlistBody
        items={wishlistItems}
        moneySaved={figures.moneySaved}
        onSelectItem={setEditing}
        onAdd={() => setEditing('new')}
      />
      {editing !== null && (
        <ItemSheet
          category="wishlist"
          item={editing === 'new' ? null : editing}
          month={month}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Rename the Wishlist content styles to `.wishlist-body` in `src/index.css`**

This inner content now lives in `WishlistBody`'s own `.wishlist-body`
wrapper (Step 1 above) so it renders correctly wherever `WishlistBody` is
used, not only inside `Wishlist`'s `.screen.wish` torn-edge card. `.wish`
itself stays exactly as-is (it's still the outer card shell — padding and
the torn-edge `clip-path`). Find this existing block:

```css
.wish .head {
  font-size: 10px;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 20px;
}

.wish .row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  border-bottom: 1px dashed var(--rule);
  padding: 12px 0;
  font-size: 14px;
}

.wish .row .num {
  font-size: 15px;
  font-weight: 700;
}

.wish .row.bought {
  text-decoration: line-through;
  opacity: .5;
}

.wish .foot {
  margin-top: 22px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.wish .foot .lbl {
  font-size: 10px;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--muted);
}

.wish .foot .num {
  font-size: 32px;
  font-weight: 800;
  color: var(--accent);
}
```

Replace it with (renamed to `.wishlist-body`, plus `cursor: pointer` on the
row and a new `.add` rule to go with it):

```css
.wishlist-body .head {
  font-size: 10px;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 20px;
}

.wishlist-body .row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  border-bottom: 1px dashed var(--rule);
  padding: 12px 0;
  font-size: 14px;
  cursor: pointer;
}

.wishlist-body .row .num {
  font-size: 15px;
  font-weight: 700;
}

.wishlist-body .row.bought {
  text-decoration: line-through;
  opacity: .5;
}

.wishlist-body .add {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  text-align: center;
  cursor: pointer;
}

.wishlist-body .foot {
  margin-top: 22px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.wishlist-body .foot .lbl {
  font-size: 10px;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--muted);
}

.wishlist-body .foot .num {
  font-size: 32px;
  font-weight: 800;
  color: var(--accent);
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/routes/pages/WishlistBody.tsx src/routes/Wishlist.tsx src/index.css
git commit -m "Wire the Wishlist screen to real data and Money Saved"
```

---

### Task 5: Calendar screen wired

**Files:**
- Modify: `src/routes/DailyLog.tsx`
- Modify: `src/index.css` — month-stepper buttons, inline day-edit input, cursor affordance

**Interfaces:**
- Consumes: `useData()` from Task 2; `computeMonth` from `src/lib/formulas.ts`; `currentMonth`, `dayKey`, `daysInMonth`, `elapsedDays`, `monthLabel`, `nextMonth`, `prevMonth`, `DayKey` from `src/lib/time.ts`.
- Produces: nothing consumed elsewhere — Calendar is a ring leaf.

- [ ] **Step 1: Rewrite `src/routes/DailyLog.tsx`**

Replace the full contents:

```tsx
import { useState } from 'react'
import { useData } from '../data/DataContext'
import { computeMonth } from '../lib/formulas'
import {
  currentMonth,
  dayKey,
  daysInMonth,
  elapsedDays,
  monthLabel,
  nextMonth,
  prevMonth,
  type DayKey,
} from '../lib/time'
import { lira } from '../money'

// A logged day is tinted by how far it lands from the allowance: rust when
// overspent, moss when underspent, intensity scaled by the gap. Fully
// saturated red sits three allowances past the line; fully saturated green
// is a day that cost nothing at all.
function tintFor(change: number, allowance: number): string {
  const spent = -change
  const scale = Math.abs(allowance) || 1
  const over = spent > allowance
  const ratio = over
    ? Math.min(1, (spent - allowance) / (scale * 3))
    : Math.min(1, (allowance - spent) / scale)
  const pct = Math.round(6 + ratio * 40)
  return `color-mix(in oklch, var(${over ? '--short' : '--accent'}) ${pct}%, var(--paper))`
}

// Logged amounts carry no minus sign — spending is the default direction,
// so only the rarer money-in day is signed.
function amountFor(change: number): string {
  return change > 0 ? `+${lira(change)}` : lira(-change)
}

export function DailyLog() {
  const { items, days, buffer, logDay } = useData()
  const [viewedMonth, setViewedMonth] = useState(currentMonth())
  const [editingDay, setEditingDay] = useState<DayKey | null>(null)
  const [draft, setDraft] = useState('')

  const figures = computeMonth(items, days, buffer, viewedMonth)
  const total = daysInMonth(viewedMonth)
  const elapsed = elapsedDays(viewedMonth)
  const atCurrentMonth = viewedMonth === currentMonth()

  function openEditor(day: number, existing: number | null) {
    setEditingDay(dayKey(viewedMonth, day))
    setDraft(existing === null ? '' : String(existing))
  }

  function commit() {
    if (!editingDay) return
    const trimmed = draft.trim()
    logDay(editingDay, trimmed === '' ? null : Math.round(Number(trimmed)))
    setEditingDay(null)
  }

  return (
    <div className="screen cal">
      <div className="head">
        <div className="month">
          <button className="step" onClick={() => setViewedMonth((m) => prevMonth(m))}>
            ‹
          </button>
          <span className="name">{monthLabel(viewedMonth)}</span>
          <button
            className="step"
            onClick={() => setViewedMonth((m) => nextMonth(m))}
            disabled={atCurrentMonth}
          >
            ›
          </button>
        </div>
        <span className="allw num">Allowance {lira(figures.dailyAllowance)}/day</span>
      </div>
      <div className="grid">
        {Array.from({ length: total }, (_, i) => i + 1).map((day) => {
          const key = dayKey(viewedMonth, day)
          const change = days.get(key) ?? null
          const future = day > elapsed
          const state = future ? 'future' : change === null ? 'unlogged' : 'logged'
          const editing = editingDay === key

          return (
            <div
              className={`cell ${state}`}
              key={day}
              style={change !== null ? { background: tintFor(change, figures.dailyAllowance) } : undefined}
              onClick={() => !future && !editing && openEditor(day, change)}
            >
              <span className="d">{day}</span>
              {editing ? (
                <input
                  className="edit"
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') setEditingDay(null)
                  }}
                />
              ) : (
                <span className="v num">
                  {change !== null ? amountFor(change) : state === 'unlogged' ? 'log' : ''}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace the `.cal .head .month .step` rule in `src/index.css`**

This was styled as a bare `<span>`; it's now a `<button>` and needs its
browser-default chrome reset. Find the existing rule:

```css
.cal .head .month .step {
  font-size: 17px;
  line-height: 1;
  letter-spacing: 0;
  color: var(--ink);
}
```

Replace it with:

```css
.cal .head .month .step {
  font-size: 17px;
  line-height: 1;
  letter-spacing: 0;
  color: var(--ink);
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  cursor: pointer;
}

.cal .head .month .step:disabled {
  opacity: .3;
  cursor: default;
}
```

- [ ] **Step 3: Append the day-cell edit-input and cursor styles**

```css
.cal .cell:not(.future) {
  cursor: pointer;
}

.cal .cell .edit {
  width: 90%;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  padding: 0;
}

.cal .cell .edit:focus {
  outline: none;
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/routes/DailyLog.tsx src/index.css
git commit -m "Wire the Calendar to real data: month stepping and inline day logging"
```

---

### Task 6: Settings screen wired

**Files:**
- Modify: `src/routes/Settings.tsx`
- Modify: `src/index.css` — Buffer field layout, aside link, sign-out cursor

**Interfaces:**
- Consumes: `useAuth()` from `src/auth/AuthContext.tsx`; `useData()` from Task 2; `auth` from `src/firebase.ts`; `currentMonth` from `src/lib/time.ts`; the shared `.toggle2` styles from Task 3.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Rewrite `src/routes/Settings.tsx`**

Replace the full contents:

```tsx
import { signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../data/DataContext'
import { auth } from '../firebase'
import { currentMonth } from '../lib/time'

export function Settings() {
  const { user } = useAuth()
  const { buffer, setBuffer } = useData()
  const [percent, setPercent] = useState(String(buffer.percent))

  // Firestore's live value arrives asynchronously, after this component has
  // already mounted with the empty default — resync once the real value lands.
  useEffect(() => {
    setPercent(String(buffer.percent))
  }, [buffer.percent])

  function commitPercent() {
    const value = Number(percent)
    setBuffer(Number.isFinite(value) ? value : 0, buffer.mode, currentMonth())
  }

  return (
    <div className="screen set">
      <div className="top">
        <div className="lbl">Signed in as</div>
        <div className="email">{user?.email}</div>
      </div>
      <div className="bottom">
        <div className="row">
          <span>Buffer</span>
          <span className="buffer-field">
            <input
              className="buffer-input num"
              type="text"
              inputMode="decimal"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              onBlur={commitPercent}
            />
            <span>%</span>
          </span>
        </div>
        <div className="toggle2">
          <button
            className={buffer.mode === 'surplus' ? 'active' : ''}
            onClick={() => setBuffer(buffer.percent, 'surplus', currentMonth())}
          >
            Of surplus
          </button>
          <button
            className={buffer.mode === 'slice' ? 'active' : ''}
            onClick={() => setBuffer(buffer.percent, 'slice', currentMonth())}
          >
            Of full slice
          </button>
        </div>
        <Link className="aside" to="/history">
          <span>History</span>
          <span>›</span>
        </Link>
        <div className="signout" onClick={() => signOut(auth)}>
          Sign out
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `src/index.css` for the Buffer field and aside link**

First, delete the now-dead `.set .row .num` rule — the rewritten Settings
no longer renders a `.num`-classed child inside `.row` (the Buffer figure
became the `.buffer-field` input below, not a `<span className="num">`):

```css
.set .row .num {
  font-weight: 700;
}
```

Modify the existing `.set .aside` rule to add `text-decoration: none`
(it's now an `<Link>`, rendering an `<a>` — the existing explicit
`color: var(--muted)` already overrides the browser's default link blue,
so no extra `color` override is needed):

```css
.set .aside {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
  color: var(--muted);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--rule);
  text-decoration: none;
}
```

Modify the existing `.set .signout` rule to add `cursor: pointer`:

```css
.set .signout {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  text-align: center;
  cursor: pointer;
}
```

Append the Buffer field layout:

```css
.set .buffer-field {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-weight: 700;
}

.set .buffer-input {
  width: 48px;
  border: none;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-weight: 700;
  text-align: right;
  padding: 0;
}

.set .buffer-input:focus {
  outline: none;
  border-bottom: 1px solid var(--ink);
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/routes/Settings.tsx src/index.css
git commit -m "Wire Settings: Buffer percent + mode toggle, real sign-out"
```

---

### Task 7: History screen built

**Files:**
- Modify: `src/routes/History.tsx` (full rewrite)
- Delete: `src/routes/pages/RingPage.tsx`
- Modify: `src/index.css` — the History page layout

**Interfaces:**
- Consumes: `CategoryBars` and `ItemSheet` from Task 3; `WishlistBody` from Task 4; `useData()` from Task 2; `categoryTotal`, `computeMonth`, `itemsInMonth`, `Category`, `Item` from `src/lib/formulas.ts`; `currentMonth`, `monthLabel`, `nextMonth`, `prevMonth`, `MonthKey` from `src/lib/time.ts`.
- Produces: nothing consumed elsewhere — this is the last task.

- [ ] **Step 1: Rewrite `src/routes/History.tsx`**

Replace the full contents:

```tsx
import { useState } from 'react'
import { useData } from '../data/DataContext'
import { categoryTotal, computeMonth, itemsInMonth, type Category, type Item } from '../lib/formulas'
import { currentMonth, monthLabel, nextMonth, prevMonth, type MonthKey } from '../lib/time'
import { lira } from '../money'
import { CategoryBars } from './pages/CategoryBars'
import { ItemSheet } from './pages/ItemSheet'
import { WishlistBody } from './pages/WishlistBody'

type Editing = { category: Category; item: Item | 'new' }

const SECTIONS: { category: Category; label: string; kind: 'income' | 'spend' }[] = [
  { category: 'baseIncome', label: 'Base income', kind: 'income' },
  { category: 'flexIncome', label: 'Flex income', kind: 'income' },
  { category: 'baseSpend', label: 'Base spend', kind: 'spend' },
  { category: 'flexSpend', label: 'Flex spend', kind: 'spend' },
]

// History is not a destination on the ring. Its job is browsing a past
// month's full picture — Base/Flex figures and Wishlist together — which
// nothing else does for a past month; the Calendar's own stepper only ever
// shows day-by-day logs. Nothing here is read-only: PROJECT.md is explicit
// that past months stay editable, no locking.
export function History() {
  const { items, days, buffer } = useData()
  const [month, setMonth] = useState<MonthKey>(prevMonth(currentMonth()))
  const [editing, setEditing] = useState<Editing | null>(null)

  const figures = computeMonth(items, days, buffer, month)
  const atCurrentMonth = month === currentMonth()
  const wishlistItems = itemsInMonth(items, month, 'wishlist')

  return (
    <main className="history">
      <div className="history-head">
        <button onClick={() => setMonth((m) => prevMonth(m))}>‹</button>
        <span>{monthLabel(month)}</span>
        <button onClick={() => setMonth((m) => nextMonth(m))} disabled={atCurrentMonth}>
          ›
        </button>
      </div>

      <div className="history-summary">
        <div>
          <span>Surplus</span>
          <span className="num">{lira(figures.surplus)}</span>
        </div>
        <div>
          <span>Allowance</span>
          <span className="num">{lira(figures.dailyAllowance)}/day</span>
        </div>
        <div>
          <span>Money saved</span>
          <span className="num">{lira(figures.moneySaved)}</span>
        </div>
      </div>

      {SECTIONS.map((section) => (
        <div className="history-block" key={section.category}>
          <CategoryBars
            label={section.label}
            kind={section.kind}
            items={itemsInMonth(items, month, section.category)}
            total={categoryTotal(items, month, section.category)}
            onSelectItem={(item) => setEditing({ category: section.category, item })}
            onAdd={() => setEditing({ category: section.category, item: 'new' })}
          />
        </div>
      ))}

      <div className="history-block">
        <WishlistBody
          items={wishlistItems}
          moneySaved={figures.moneySaved}
          onSelectItem={(item) => setEditing({ category: 'wishlist', item })}
          onAdd={() => setEditing({ category: 'wishlist', item: 'new' })}
        />
      </div>

      {editing !== null && (
        <ItemSheet
          category={editing.category}
          item={editing.item === 'new' ? null : editing.item}
          month={month}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  )
}
```

- [ ] **Step 2: Delete the now-unused `RingPage`**

```bash
git rm src/routes/pages/RingPage.tsx
```

- [ ] **Step 3: Append the History page layout to `src/index.css`**

```css
/* ===== History — off the ring, its own scrolling page ===== */
.history {
  position: fixed;
  inset: 0;
  overflow-y: auto;
  background: var(--backdrop);
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
}

.history-head button {
  font-size: 20px;
  background: none;
  border: none;
  color: var(--ink);
  cursor: pointer;
  font-family: inherit;
}

.history-head button:disabled {
  opacity: .3;
  cursor: default;
}

.history-summary {
  display: flex;
  justify-content: space-between;
  background: var(--paper);
  border-radius: 16px;
  padding: 14px 18px;
  font-size: 12px;
  color: var(--muted);
}

.history-summary .num {
  display: block;
  color: var(--ink);
  font-size: 15px;
  font-weight: 700;
  margin-top: 2px;
}

.history-block {
  background: var(--paper);
  border-radius: 16px;
  padding: 18px;
  color: var(--ink);
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds. This is the last task — also re-run `npm run test` to confirm Task 1's suite is still green after everything built on top of it.

- [ ] **Step 5: Commit**

```bash
git add src/routes/History.tsx src/index.css
git commit -m "Build the real History screen: past months, fully editable"
```

---

## Self-Review Notes

- **Spec coverage:** every spec section has a task — data model & formulas (Task 1), the data layer + saveError (Task 2), Month Setup + ItemSheet (Task 3), Wishlist (Task 4), Calendar (Task 5), Settings (Task 6), History (Task 7). The Money Saved sign fix found while writing Task 1's tests was back-ported into the spec file itself before this plan was written, so Task 1's code already matches the corrected spec.
- **Type consistency checked:** `Category`, `Item`, `BufferMode`, `BufferSettings`, `MonthKey`, `DayKey` are defined once (Task 1) and every later task imports rather than redefines them. `useData()`'s `DataState` shape (Task 2) is used identically in Tasks 3–7. `ItemSheetProps`, `CategoryBarsProps`, `WishlistBodyProps` are each defined once (Task 3/4) and consumed with matching field names in Task 7.
- **No placeholders:** every step above has complete, runnable code — no TBDs, no "similar to Task N" cross-references without the actual code repeated in place.
- **CSS scoping bug caught and fixed:** the first draft had `CategoryBars` and `WishlistBody` render their content directly (a bare fragment), styled entirely through `.ms .fig`/`.wish .head`-style selectors scoped to the ring screens' outer `.screen.ms`/`.screen.wish` shells. Since Task 7 (History) reuses both components inside a plain `.history-block` div with no such ancestor, that content would have rendered completely unstyled there. Fixed by giving each component its own wrapper class (`.bars`, `.wishlist-body`) and moving the styling onto that class instead of the outer shell — Tasks 3 and 4 above now include the full rename, not just an addition.
