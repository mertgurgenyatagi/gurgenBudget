# Launch Hotfixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the six agency/UX fixes from `docs/superpowers/specs/2026-09-02-launch-hotfixes-design.md`: a shared browsable month across the ring, present/future-day logging, inline item editing (no more sheet), the Wishlist checkbox moved to the row and defaulting off, magnitude sorting, and a Dynamic Allowance setting.

**Architecture:** A new `ViewedMonthContext` replaces every screen's own `currentMonth()` call, so Dashboard/Wishlist/the four Month Setup screens/Calendar all browse one shared month. `ItemSheet.tsx` is deleted; `CategoryBars` and `WishlistBody` grow inline row controls (name/amount inputs, delete, move, active checkbox) wired straight to `DataContext`. `formulas.ts` gains a log-based `remainingDays` helper (fixing a future-day double-count bug), a `dynamicAllowance` formula, and a `nextItemName` boilerplate-namer. `History.tsx` and its route are deleted — its job is now native to the ring screens.

**Tech Stack:** React 19 + TypeScript, Firebase (Firestore `onSnapshot`), Vitest for the pure formula layer (the only layer with test coverage, per existing project convention), plain CSS (`src/index.css`).

## Global Constraints

- Whole lira only — every amount input rounds to a whole number on commit (`Math.round(Number(x)) || 0`), no kuruş anywhere (PROJECT.md "Money Formatting").
- No confirmation prompts on any destructive or retroactive action (delete, move, retroactive edit) — the app's existing no-confirmation principle.
- Day boundaries and month keys always derive from the fixed Turkey (UTC+3) clock in `src/lib/time.ts`, never device local time.
- Only `src/lib/formulas.ts` (and now `src/lib/formulas.test.ts`) carries automated test coverage — every other change in this plan is verified by `npm run build` (tsc) plus manual/visual review, matching the project's existing "nothing else has test coverage, by design" convention.
- No Playwright / live-browser verification is available in this execution session — flag final visual QA as a follow-up rather than claiming it's been checked.
- Canon color tokens only (`src/index.css` `:root`) — no new one-off colors.

---

## Task 1: `remainingDays` — log-based remaining-day count, wired into `moneySaved`

**Files:**
- Modify: `src/lib/formulas.ts:1` (imports), `src/lib/formulas.ts:151-175` (`moneySaved` region)
- Test: `src/lib/formulas.test.ts`

**Interfaces:**
- Produces: `export function remainingDays(days: Map<DayKey, number>, month: MonthKey, at?: Date): number` — days in `month`, from today (inclusive) through month-end, that have no entry in `days`. Later tasks (2) call this from `computeMonth`.
- Consumes: `currentMonth`, `daysInMonth`, `todayDayOfMonth`, `dayKey`, all already exported from `src/lib/time.ts`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/formulas.test.ts`, replacing the top import line:

```ts
import { describe, expect, it } from 'vitest'
import {
  amountInMonth,
  categoryTotal,
  dailyAllowance,
  moneySaved,
  remainingDays,
  spendSoFar,
  surplus,
  type Item,
} from './formulas'
```

Append these new `describe` blocks at the end of the file:

```ts
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
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test`
Expected: FAIL — `remainingDays` is not exported yet.

- [ ] **Step 3: Implement `remainingDays` and wire it into `moneySaved`**

Replace the import line at the top of `src/lib/formulas.ts`:

```ts
import { daysInMonth, dayKey, currentMonth, todayDayOfMonth, monthOf, type DayKey, type MonthKey } from './time'
```

Add this new function directly above `moneySaved`:

```ts
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
```

Replace the body of `moneySaved`:

```ts
export function moneySaved(
  surplusValue: number,
  days: Map<DayKey, number>,
  month: MonthKey,
  allowance: number,
  at?: Date,
): number {
  return surplusValue + spendSoFar(days, month) - allowance * remainingDays(days, month, at)
}
```

(This removes the old `elapsedDays`-based `elapsed`/`remaining` local variables and the `elapsedDays` import — leave `time.ts` itself untouched here; its cleanup happens in Task 12 once `DailyLog.tsx` stops using it too.)

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npm test`
Expected: PASS, including the pre-existing `moneySaved` tests (unchanged behavior for their scenarios — verify by reading their output, not just "no failures").

- [ ] **Step 5: Commit**

```bash
git add src/lib/formulas.ts src/lib/formulas.test.ts
git commit -m "$(cat <<'EOF'
Fix Money Saved double-counting a pre-logged future day

remainingDays now counts unlogged days instead of calendar-future days,
so a day that's already been logged (past, today, or future) is never
also projected at the flat allowance.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `dynamicAllowance` formula + `displayAllowance` on `MonthFigures`

**Files:**
- Modify: `src/lib/formulas.ts` (`BufferSettings`, `MonthFigures`, `computeMonth`)
- Test: `src/lib/formulas.test.ts`

**Interfaces:**
- Consumes: `remainingDays` (Task 1), `spendSoFar`, `dailyAllowance`, `daysInMonth` — all already in `formulas.ts`.
- Produces: `export function dynamicAllowance(flat: number, totalDays: number, spendSoFarValue: number, remaining: number): number`. `BufferSettings.dynamicAllowance: boolean`. `MonthFigures.displayAllowance: number`. Task 5 (`DataContext`) reads/writes `BufferSettings.dynamicAllowance`; Tasks 12–13 (`DailyLog`, `Dashboard`) read `MonthFigures.displayAllowance`.

- [ ] **Step 1: Write the failing tests**

Update the import line in `src/lib/formulas.test.ts` again:

```ts
import { describe, expect, it } from 'vitest'
import {
  amountInMonth,
  categoryTotal,
  computeMonth,
  dailyAllowance,
  dynamicAllowance,
  moneySaved,
  remainingDays,
  spendSoFar,
  surplus,
  type BufferSettings,
  type Item,
} from './formulas'
```

Append:

```ts
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
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test`
Expected: FAIL — `dynamicAllowance` isn't exported, `BufferSettings` has no `dynamicAllowance` field yet, `MonthFigures` has no `displayAllowance`.

- [ ] **Step 3: Implement**

In `src/lib/formulas.ts`, update `BufferSettings`:

```ts
export interface BufferSettings {
  percent: number
  mode: BufferMode
  history: BufferHistoryEntry[]
  dynamicAllowance: boolean
}
```

Add `displayAllowance` to `MonthFigures`:

```ts
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
```

Add this function above `computeMonth`:

```ts
/**
 * Recomputes today's rate so the month's total projected spend still
 * lands on flat × daysInMonth, redistributing what's left over whatever
 * days remain unlogged (Task 1's remainingDays). Falls back to the flat
 * figure once there's nothing left to redistribute — which also makes it
 * degrade to the flat figure automatically for any month other than the
 * one currently in progress (a past month has remaining = 0; a future
 * month with nothing pre-logged has remaining = totalDays, spendSoFar =
 * 0, so the formula collapses back to `flat`).
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
```

Update `computeMonth`'s body (everything after `const saved = ...` through the return):

```ts
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
```

Important: **`moneySaved` and `tintFor` (in `DailyLog.tsx`, Task 12) must keep using `dailyAllowance`, never `displayAllowance`** — see the spec's §7 note on why feeding the dynamic figure back into Money Saved's own formula collapses it to a constant.

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/formulas.ts src/lib/formulas.test.ts
git commit -m "$(cat <<'EOF'
Add the Dynamic Allowance formula and displayAllowance figure

dynamicAllowance() redistributes the flat month-long budget over
whatever days are left unlogged. computeMonth exposes it as
displayAllowance, gated by a new BufferSettings.dynamicAllowance flag —
Money Saved and the Calendar's day-tint baseline stay on the flat figure.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Sort every list by magnitude

**Files:**
- Modify: `src/lib/formulas.ts` (`itemsInMonth`)
- Test: `src/lib/formulas.test.ts`

**Interfaces:**
- Produces: `itemsInMonth` now returns its result sorted by `Math.abs(amount)` descending. Every existing caller (`categoryTotal`, `MonthSetupScreen`, `Wishlist`) gets sorted order for free — no call-site changes needed anywhere.

- [ ] **Step 1: Write the failing test**

Add `itemsInMonth` to the import list in `src/lib/formulas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  amountInMonth,
  categoryTotal,
  computeMonth,
  dailyAllowance,
  dynamicAllowance,
  itemsInMonth,
  moneySaved,
  remainingDays,
  spendSoFar,
  surplus,
  type BufferSettings,
  type Item,
} from './formulas'
```

Append:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — current order is insertion order (`a, b, c`), not `b, c, a`.

- [ ] **Step 3: Implement**

Replace `itemsInMonth` in `src/lib/formulas.ts`:

```ts
export function itemsInMonth(items: Item[], month: MonthKey, category: Category): Item[] {
  return items
    .filter((i) => i.category === category && amountInMonth(i, month) !== null)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/formulas.ts src/lib/formulas.test.ts
git commit -m "$(cat <<'EOF'
Sort every category/wishlist list by magnitude of amount

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `nextItemName` boilerplate namer

**Files:**
- Modify: `src/lib/formulas.ts`
- Test: `src/lib/formulas.test.ts`

**Interfaces:**
- Produces: `export function nextItemName(items: Item[]): string`. Tasks 9–10 call this with the already-scoped `itemsInMonth(...)` result when handling "+ Add".

- [ ] **Step 1: Write the failing test**

Add `nextItemName` to the import list in `src/lib/formulas.test.ts` (same block as Task 3, now also including `nextItemName`):

```ts
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
```

Append:

```ts
describe('nextItemName', () => {
  it('starts at Item01 for an empty scope', () => {
    expect(nextItemName([])).toBe('Item01')
  })

  it('numbers one past however many items already exist', () => {
    expect(nextItemName([item({ id: 'a' }), item({ id: 'b' })])).toBe('Item03')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `nextItemName` is not exported yet.

- [ ] **Step 3: Implement**

Add to `src/lib/formulas.ts`:

```ts
/**
 * Boilerplate name for a freshly created item: one past however many
 * already exist in the caller's scope (category, and month for
 * Flex/Wishlist items). No uniqueness guarantee beyond that — the user
 * is expected to rename it immediately.
 */
export function nextItemName(items: Item[]): string {
  return `Item${String(items.length + 1).padStart(2, '0')}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/formulas.ts src/lib/formulas.test.ts
git commit -m "$(cat <<'EOF'
Add nextItemName for boilerplate item creation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `DataContext` — `addItem` returns an id, inactive-by-default, Dynamic Allowance persistence

**Files:**
- Modify: `src/data/DataContext.tsx`

**Interfaces:**
- Consumes: `BufferSettings` (Task 2, now carries `dynamicAllowance`).
- Produces: `addItem(input): string` (was `void`) — the new item's Firestore id, generated client-side, available synchronously. `setDynamicAllowance(on: boolean): void` — new. `buffer.dynamicAllowance: boolean` — now present on every `useData().buffer` read. Tasks 9, 10 use the `addItem` return value for auto-focus; Task 14 uses `setDynamicAllowance` and `buffer.dynamicAllowance`.

- [ ] **Step 1: Update `DataState` and `EMPTY_BUFFER`**

In `src/data/DataContext.tsx`, replace the `DataState` interface:

```ts
interface DataState {
  items: Item[]
  days: Map<DayKey, number>
  buffer: BufferSettings
  ready: boolean
  saveError: string | null
  clearSaveError: () => void
  addItem: (input: { category: Category; name: string; amount: number; month: MonthKey }) => string
  editItem: (item: Item, changes: { name?: string; amount?: number }, month: MonthKey) => void
  deleteItem: (item: Item, month: MonthKey) => void
  moveItem: (item: Item, category: Category) => void
  setActive: (item: Item, active: boolean) => void
  logDay: (day: DayKey, amount: number | null) => void
  setBuffer: (percent: number, mode: BufferMode, month: MonthKey) => void
  setDynamicAllowance: (on: boolean) => void
}
```

Replace `EMPTY_BUFFER`:

```ts
const EMPTY_BUFFER: BufferSettings = { percent: 0, mode: 'slice', history: [], dynamicAllowance: false }
```

- [ ] **Step 2: Read `dynamicAllowance` from the buffer snapshot**

Replace the body of the `unsubBuffer` `onSnapshot` callback:

```ts
    const unsubBuffer = onSnapshot(doc(db, 'users', uid, 'settings', 'buffer'), (snap) => {
      const raw = snap.data()
      setBufferState({
        percent: typeof raw?.percent === 'number' ? raw.percent : 0,
        mode: raw?.mode === 'surplus' ? 'surplus' : 'slice',
        history: Array.isArray(raw?.history) ? raw.history : [],
        dynamicAllowance: raw?.dynamicAllowance === true,
      })
      setLoaded((prev) => ({ ...prev, buffer: true }))
    })
```

- [ ] **Step 3: `addItem` returns the new id; new items default inactive**

Replace `addItem`:

```ts
  const addItem = useCallback<DataState['addItem']>(
    ({ category, name, amount, month }) => {
      if (!uid) return ''
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
        active: false,
      }).catch(report)
      return ref.id
    },
    [uid, report],
  )
```

- [ ] **Step 4: `setBuffer` writes with `merge: true`; add `setDynamicAllowance`**

Replace `setBuffer`'s final `setDoc` line — change

```ts
      setDoc(doc(db, 'users', uid, 'settings', 'buffer'), { percent, mode, history }).catch(report)
```

to

```ts
      setDoc(doc(db, 'users', uid, 'settings', 'buffer'), { percent, mode, history }, { merge: true }).catch(report)
```

(Without `merge: true`, this write would wipe out `dynamicAllowance` every time the Buffer percent/mode changes, since `setDoc` without `merge` replaces the whole document.)

Add a new callback right after `setBuffer`:

```ts
  const setDynamicAllowance = useCallback<DataState['setDynamicAllowance']>(
    (on) => {
      if (!uid) return
      setDoc(doc(db, 'users', uid, 'settings', 'buffer'), { dynamicAllowance: on }, { merge: true }).catch(report)
    },
    [uid, report],
  )
```

- [ ] **Step 5: Expose `setDynamicAllowance` from the provider**

In the `value` `useMemo`, add `setDynamicAllowance` to both the returned object and the dependency array:

```ts
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
      setActive,
      logDay,
      setBuffer,
      setDynamicAllowance,
    }),
    [
      items, days, buffer, loaded, saveError,
      addItem, editItem, deleteItem, moveItem, setActive, logDay, setBuffer, setDynamicAllowance,
    ],
  )
```

- [ ] **Step 6: Type-check**

Run: `npm run build`
Expected: This will currently FAIL — `ItemSheet.tsx` still calls `addItem` in a way that's still valid (return value simply unused, which is fine in TS) but you'll see errors from any other file relying on the old `void` return in a way that's now incompatible. In practice at this point in the plan the only consumer is `ItemSheet.tsx`, which doesn't use the return value, so this should actually PASS. If it doesn't, read the error — it means some other call site needs the new return type accounted for; every other consumer is updated in Tasks 9–10.

- [ ] **Step 7: Commit**

```bash
git add src/data/DataContext.tsx
git commit -m "$(cat <<'EOF'
DataContext: addItem returns its id, inactive-by-default, Dynamic Allowance

addItem now returns the client-generated Firestore id synchronously, so
callers can auto-focus a freshly created row. New items default to
active: false. Buffer settings gain a non-historized dynamicAllowance
flag, written via merge so it survives unrelated Buffer edits.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `ViewedMonthContext` — one shared browsable month

**Files:**
- Create: `src/data/ViewedMonthContext.tsx`
- Modify: `src/routes/Ring.tsx`

**Interfaces:**
- Consumes: `currentMonth`, `nextMonth`, `prevMonth`, `type MonthKey` from `src/lib/time.ts`.
- Produces: `export function ViewedMonthProvider({ children }: { children: ReactNode })`. `export function useViewedMonth(): { month: MonthKey; next: () => void; prev: () => void }`. Tasks 7, 9, 10, 12, 13 all consume `useViewedMonth()`.

- [ ] **Step 1: Create the context**

Write `src/data/ViewedMonthContext.tsx`:

```tsx
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { currentMonth, nextMonth, prevMonth, type MonthKey } from '../lib/time'

interface ViewedMonthState {
  month: MonthKey
  next: () => void
  prev: () => void
}

const ViewedMonthContext = createContext<ViewedMonthState | null>(null)

// One browsable month, shared by every month-scoped ring screen (Dashboard,
// Wishlist, the four Month Setup screens, Calendar) — stepping the month on
// any one of them moves all of them, which is what makes "set next month's
// Flex Spend in advance" possible from any screen. Settings has no month
// concept and doesn't consume this. Always starts on the real current
// month; never persisted, same as the app's existing lazy-rollover model.
export function ViewedMonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState<MonthKey>(currentMonth())

  const next = useCallback(() => setMonth((m) => nextMonth(m)), [])
  const prev = useCallback(() => setMonth((m) => prevMonth(m)), [])

  const value = useMemo<ViewedMonthState>(() => ({ month, next, prev }), [month, next, prev])

  return <ViewedMonthContext.Provider value={value}>{children}</ViewedMonthContext.Provider>
}

export function useViewedMonth(): ViewedMonthState {
  const ctx = useContext(ViewedMonthContext)
  if (!ctx) throw new Error('useViewedMonth must be used inside ViewedMonthProvider')
  return ctx
}
```

- [ ] **Step 2: Wrap `Ring` with the provider**

In `src/routes/Ring.tsx`, add the import:

```ts
import { ViewedMonthProvider } from '../data/ViewedMonthContext'
```

Change the component's `return` statement from:

```tsx
  return (
    <div ref={screenRef} className="ring-screen">
      <div ref={trackRef} className="ring-track">
        {paddedPages.map((page, i) => (
          <div className="ring-slot" key={i}>
            {page}
          </div>
        ))}
      </div>
    </div>
  )
```

to:

```tsx
  return (
    <ViewedMonthProvider>
      <div ref={screenRef} className="ring-screen">
        <div ref={trackRef} className="ring-track">
          {paddedPages.map((page, i) => (
            <div className="ring-slot" key={i}>
              {page}
            </div>
          ))}
        </div>
      </div>
    </ViewedMonthProvider>
  )
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: PASS (nothing consumes `useViewedMonth` yet, so this is purely additive).

- [ ] **Step 4: Commit**

```bash
git add src/data/ViewedMonthContext.tsx src/routes/Ring.tsx
git commit -m "$(cat <<'EOF'
Add ViewedMonthContext — one browsable month shared across the ring

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `MonthStepper` — shared header component + CSS

**Files:**
- Create: `src/routes/pages/MonthStepper.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `useViewedMonth()` (Task 6), `monthLabel` from `src/lib/time.ts`.
- Produces: `export function MonthStepper()` — renders `‹ MonthLabel ›`, reads/steps the shared month directly, no props. Tasks 9, 10, 12, 13 render `<MonthStepper />`.

- [ ] **Step 1: Create the component**

Write `src/routes/pages/MonthStepper.tsx`:

```tsx
import { monthLabel } from '../../lib/time'
import { useViewedMonth } from '../../data/ViewedMonthContext'

export function MonthStepper() {
  const { month, prev, next } = useViewedMonth()
  return (
    <div className="stepper">
      <button className="step" onClick={prev}>
        ‹
      </button>
      <span className="name">{monthLabel(month)}</span>
      <button className="step" onClick={next}>
        ›
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add shared CSS**

In `src/index.css`, replace the existing `.cal .head .month` block (currently under `/* ===== Calendar ===== */`):

```css
.cal .head .month {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--muted);
}

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

with this generalized version (usable by any screen, not just Calendar):

```css
.stepper {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--muted);
}

.stepper .step {
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

.screen--ink .stepper {
  color: var(--b-muted);
}

.screen--ink .stepper .step {
  color: var(--onink);
}

/* Wishlist, Month Setup, and Dashboard render MonthStepper as the screen's
   first direct child; the Calendar keeps its own .cal .head layout below,
   so this only fires where it should. */
.screen > .stepper {
  margin-bottom: 18px;
}
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: PASS (component not yet used anywhere, purely additive; `DailyLog.tsx` still uses its own inline `.month` markup for now — that gets swapped to `.stepper` in Task 12).

- [ ] **Step 4: Commit**

```bash
git add src/routes/pages/MonthStepper.tsx src/index.css
git commit -m "$(cat <<'EOF'
Add shared MonthStepper component, generalize the Calendar's header CSS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Delete History

**Files:**
- Delete: `src/routes/History.tsx`
- Modify: `src/App.tsx`, `src/routes/Settings.tsx`, `src/index.css`

**Interfaces:**
- None — this is pure removal. Nothing later in the plan depends on `History.tsx`.

- [ ] **Step 1: Delete the route file**

```bash
git rm src/routes/History.tsx
```

- [ ] **Step 2: Remove the route and its import from `App.tsx`**

In `src/App.tsx`, remove the import line:

```ts
import { History } from './routes/History'
```

and remove this `<Route>` block:

```tsx
            <Route
              path="/history"
              element={
                <RequireAuth>
                  <History />
                </RequireAuth>
              }
            />
```

- [ ] **Step 3: Remove the History row from Settings**

In `src/routes/Settings.tsx`, remove:

```tsx
        <Link className="aside" to="/history">
          <span>History</span>
          <span>›</span>
        </Link>
```

and remove the now-unused `Link` import:

```ts
import { Link } from 'react-router-dom'
```

(Leave the rest of `Settings.tsx` untouched here — the Dynamic Allowance toggle lands in Task 14.)

- [ ] **Step 4: Remove History's CSS**

In `src/index.css`, delete the entire `/* ===== History — off the ring, its own scrolling page ===== */` section at the bottom of the file (the `.history`, `.history-head`, `.history-head button`, `.history-head button:disabled`, `.history-summary`, `.history-summary .num`, and `.history-block` rules — everything from that comment to end of file). Also delete the now-orphaned `.set .aside` rule (it only ever styled the History row just removed):

```css
/* Deliberately quieter than the Buffer row above it — an afterthought,
   sitting with Sign out at the foot of the panel. */
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

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src/routes/History.tsx src/App.tsx src/routes/Settings.tsx src/index.css
git commit -m "$(cat <<'EOF'
Delete History — its job is now native to the ring screens' own month browsing

Every ring screen that touches month-scoped data now shares one browsable
month (ViewedMonthContext, previous task), which does everything History
used to do plus lets you edit while browsing. The dedicated /history route,
its Settings link, and its CSS are all removed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `CategoryBars` inline editing + shared month (Base/Flex Income/Spend)

**Files:**
- Modify: `src/routes/pages/CategoryBars.tsx`, `src/routes/pages/MonthSetupScreen.tsx`, `src/routes/BaseIncome.tsx`, `src/routes/FlexIncome.tsx`, `src/routes/BaseSpend.tsx`, `src/routes/FlexSpend.tsx`, `src/index.css`

**Interfaces:**
- Consumes: `useViewedMonth()` (Task 6), `MonthStepper` (Task 7), `nextItemName` (Task 4), `itemsInMonth`/`categoryTotal` (already sorted per Task 3), `useData()`'s `addItem` (now returns `string`, Task 5).
- Produces: `CategoryBarsProps` no longer includes `onSelectItem`; gains `autoFocusId: string | null`, `onRename`, `onReamount`, `onDelete`, optional `onMove`. `MonthSetupScreen` no longer takes a `month` prop — it reads the shared one itself.

- [ ] **Step 1: Rewrite `CategoryBars.tsx`**

Replace the full contents of `src/routes/pages/CategoryBars.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { Item } from '../../lib/formulas'
import { lira } from '../../money'

type CategoryBarsProps = {
  label: string
  items: Item[]
  total: number
  /** Income bars run moss, spend bars run rust. */
  kind: 'income' | 'spend'
  /** The item to auto-focus its name field on — set right after "+ Add". */
  autoFocusId: string | null
  onAdd: () => void
  onRename: (item: Item, name: string) => void
  onReamount: (item: Item, amount: number) => void
  onDelete: (item: Item) => void
  /** Only Flex Spend rows get a move-to-Wishlist control. */
  onMove?: (item: Item) => void
}

type BarProps = {
  item: Item
  total: number
  fill: string
  autoFocus: boolean
  onRename: (item: Item, name: string) => void
  onReamount: (item: Item, amount: number) => void
  onDelete: (item: Item) => void
  onMove?: (item: Item) => void
}

function Bar({ item, total, fill, autoFocus, onRename, onReamount, onDelete, onMove }: BarProps) {
  const [name, setName] = useState(item.name)
  const [amount, setAmount] = useState(String(item.amount))

  // Firestore's live value can arrive asynchronously after a local edit
  // round-trips — resync once it lands, same pattern Settings already
  // uses for the Buffer percent field.
  useEffect(() => setName(item.name), [item.name])
  useEffect(() => setAmount(String(item.amount)), [item.amount])

  return (
    <div className="bar">
      <div className="top">
        <input
          className="n"
          type="text"
          value={name}
          autoFocus={autoFocus}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => onRename(item, name)}
        />
        <input
          className="num"
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => onReamount(item, Math.round(Number(amount)) || 0)}
        />
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
      <div className="actions">
        {onMove && (
          <button className="move" onClick={() => onMove(item)}>
            → Wishlist
          </button>
        )}
        <button className="delete" onClick={() => onDelete(item)}>
          Delete
        </button>
      </div>
    </div>
  )
}

// Design #8, "bar share": each item is a labeled bar sized to its share of
// the category total. Rows are inline-editable directly — no add/edit
// sheet — per the "kill the sheet entirely" decision in the launch-hotfixes
// spec.
export function CategoryBars({
  label,
  items,
  total,
  kind,
  autoFocusId,
  onAdd,
  onRename,
  onReamount,
  onDelete,
  onMove,
}: CategoryBarsProps) {
  const fill = kind === 'income' ? 'var(--accent)' : 'var(--short)'

  return (
    <div className="bars">
      <div className="fig num">{lira(total)}</div>
      <div className="lbl">{label}</div>
      {items.map((item) => (
        <Bar
          key={item.id}
          item={item}
          total={total}
          fill={fill}
          autoFocus={item.id === autoFocusId}
          onRename={onRename}
          onReamount={onReamount}
          onDelete={onDelete}
          onMove={onMove}
        />
      ))}
      <div className="add" onClick={onAdd}>
        + Add
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `MonthSetupScreen.tsx`**

Replace the full contents of `src/routes/pages/MonthSetupScreen.tsx`:

```tsx
import { useState } from 'react'
import { useData } from '../../data/DataContext'
import { categoryTotal, itemsInMonth, nextItemName, type Category } from '../../lib/formulas'
import { useViewedMonth } from '../../data/ViewedMonthContext'
import { CategoryBars } from './CategoryBars'
import { MonthStepper } from './MonthStepper'

type MonthSetupScreenProps = {
  category: Category
  label: string
  kind: 'income' | 'spend'
}

// Shared by the four Month Setup screens, which stay four distinct screens
// on the ring. Reads the ring's shared browsable month (ViewedMonthContext)
// rather than taking one as a prop, so stepping the month anywhere on the
// ring moves this screen's contents too — that's what makes setting up
// next month's Flex items in advance possible.
export function MonthSetupScreen({ category, label, kind }: MonthSetupScreenProps) {
  const { items, addItem, editItem, deleteItem, moveItem } = useData()
  const { month } = useViewedMonth()
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null)

  const scoped = itemsInMonth(items, month, category)

  function handleAdd() {
    const id = addItem({ category, name: nextItemName(scoped), amount: 0, month })
    setAutoFocusId(id)
  }

  return (
    <div className="screen ms">
      <MonthStepper />
      <CategoryBars
        label={label}
        kind={kind}
        items={scoped}
        total={categoryTotal(items, month, category)}
        autoFocusId={autoFocusId}
        onAdd={handleAdd}
        onRename={(item, name) => editItem(item, { name }, month)}
        onReamount={(item, amount) => editItem(item, { amount }, month)}
        onDelete={(item) => deleteItem(item, month)}
        onMove={category === 'flexSpend' ? (item) => moveItem(item, 'wishlist') : undefined}
      />
    </div>
  )
}
```

- [ ] **Step 3: Simplify the four screen wrappers**

Replace `src/routes/BaseIncome.tsx`:

```tsx
import { MonthSetupScreen } from './pages/MonthSetupScreen'

export function BaseIncome() {
  return <MonthSetupScreen category="baseIncome" label="Base income" kind="income" />
}
```

Replace `src/routes/FlexIncome.tsx`:

```tsx
import { MonthSetupScreen } from './pages/MonthSetupScreen'

export function FlexIncome() {
  return <MonthSetupScreen category="flexIncome" label="Flex income" kind="income" />
}
```

Replace `src/routes/BaseSpend.tsx`:

```tsx
import { MonthSetupScreen } from './pages/MonthSetupScreen'

export function BaseSpend() {
  return <MonthSetupScreen category="baseSpend" label="Base spend" kind="spend" />
}
```

Replace `src/routes/FlexSpend.tsx`:

```tsx
import { MonthSetupScreen } from './pages/MonthSetupScreen'

export function FlexSpend() {
  return <MonthSetupScreen category="flexSpend" label="Flex spend" kind="spend" />
}
```

- [ ] **Step 4: Add CSS for the inline bar controls**

In `src/index.css`, under `/* ===== Month Setup (x4) — bar share ===== */`, replace the `.bars .bar` rule:

```css
.bars .bar {
  margin: 12px 0;
  cursor: pointer;
}
```

with:

```css
.bars .bar {
  margin: 18px 0;
}
```

Replace the `.bars .bar .top .n` and `.bars .bar .top .num` rules:

```css
.bars .bar .top .n {
  color: var(--muted);
}

.bars .bar .top .num {
  font-weight: 700;
}
```

with:

```css
.bars .bar .top input {
  font: inherit;
  border: none;
  border-bottom: 1px solid transparent;
  background: transparent;
  color: inherit;
  padding: 0 0 2px;
}

.bars .bar .top input:focus {
  outline: none;
  border-bottom: 1px solid var(--ink);
}

.bars .bar .top input.n {
  flex: 1;
  color: var(--muted);
}

.bars .bar .top input.num {
  width: 100px;
  text-align: right;
  font-weight: 700;
}
```

Add new rules after the existing `.bars .bar .fill` rule:

```css
.bars .bar .actions {
  display: flex;
  gap: 14px;
  margin-top: 8px;
}

.bars .bar .actions button {
  border: none;
  background: none;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--muted);
  cursor: pointer;
  padding: 0;
}

.bars .bar .actions .delete {
  color: var(--short);
}
```

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/pages/CategoryBars.tsx src/routes/pages/MonthSetupScreen.tsx \
  src/routes/BaseIncome.tsx src/routes/FlexIncome.tsx src/routes/BaseSpend.tsx src/routes/FlexSpend.tsx \
  src/index.css
git commit -m "$(cat <<'EOF'
Inline item editing for the four Month Setup screens

CategoryBars rows are now directly editable — name/amount inputs, a
delete action, and (Flex Spend only) a move-to-Wishlist action — with
+Add creating a real ItemNN/0 item immediately instead of opening a
sheet. MonthSetupScreen reads the ring's shared browsable month instead
of always using the current month.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `WishlistBody` inline editing + shared month

**Files:**
- Modify: `src/routes/pages/WishlistBody.tsx`, `src/routes/Wishlist.tsx`, `src/index.css`

**Interfaces:**
- Consumes: same as Task 9, plus `setActive` from `useData()`.
- Produces: `WishlistBodyProps` gains `autoFocusId`, `onRename`, `onReamount`, `onDelete`, `onMove`, `onToggleActive`; drops `onSelectItem`.

- [ ] **Step 1: Rewrite `WishlistBody.tsx`**

Replace the full contents of `src/routes/pages/WishlistBody.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { Item } from '../../lib/formulas'
import { lira } from '../../money'

type WishlistBodyProps = {
  items: Item[]
  moneySaved: number
  autoFocusId: string | null
  onAdd: () => void
  onRename: (item: Item, name: string) => void
  onReamount: (item: Item, amount: number) => void
  onDelete: (item: Item) => void
  onMove: (item: Item) => void
  onToggleActive: (item: Item, active: boolean) => void
}

type RowProps = {
  item: Item
  autoFocus: boolean
  onRename: (item: Item, name: string) => void
  onReamount: (item: Item, amount: number) => void
  onDelete: (item: Item) => void
  onMove: (item: Item) => void
  onToggleActive: (item: Item, active: boolean) => void
}

function Row({ item, autoFocus, onRename, onReamount, onDelete, onMove, onToggleActive }: RowProps) {
  const [name, setName] = useState(item.name)
  const [amount, setAmount] = useState(String(item.amount))

  useEffect(() => setName(item.name), [item.name])
  useEffect(() => setAmount(String(item.amount)), [item.amount])

  return (
    <div className={item.active ? 'row' : 'row inactive'}>
      <div className="top">
        <input
          type="checkbox"
          checked={item.active}
          onChange={(e) => onToggleActive(item, e.target.checked)}
        />
        <input
          className="n"
          type="text"
          value={name}
          autoFocus={autoFocus}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => onRename(item, name)}
        />
        <input
          className="num"
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => onReamount(item, Math.round(Number(amount)) || 0)}
        />
      </div>
      <div className="actions">
        <button className="move" onClick={() => onMove(item)}>
          → Flex Spend
        </button>
        <button className="delete" onClick={() => onDelete(item)}>
          Delete
        </button>
      </div>
    </div>
  )
}

// Design #01, "ledger stub". Inactive items stay in the list, dimmed —
// never moved out, reversible at will via the checkbox on the row itself.
// Rows are directly editable — no add/edit sheet.
export function WishlistBody({
  items,
  moneySaved,
  autoFocusId,
  onAdd,
  onRename,
  onReamount,
  onDelete,
  onMove,
  onToggleActive,
}: WishlistBodyProps) {
  return (
    <div className="wishlist-body">
      <div className="head">Wishlist</div>
      {items.map((item) => (
        <Row
          key={item.id}
          item={item}
          autoFocus={item.id === autoFocusId}
          onRename={onRename}
          onReamount={onReamount}
          onDelete={onDelete}
          onMove={onMove}
          onToggleActive={onToggleActive}
        />
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

- [ ] **Step 2: Rewrite `Wishlist.tsx`**

Replace the full contents of `src/routes/Wishlist.tsx`:

```tsx
import { useState } from 'react'
import { useData } from '../data/DataContext'
import { computeMonth, itemsInMonth, nextItemName } from '../lib/formulas'
import { useViewedMonth } from '../data/ViewedMonthContext'
import { MonthStepper } from './pages/MonthStepper'
import { WishlistBody } from './pages/WishlistBody'

export function Wishlist() {
  const { items, days, buffer, addItem, editItem, deleteItem, moveItem, setActive } = useData()
  const { month } = useViewedMonth()
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null)

  const wishlistItems = itemsInMonth(items, month, 'wishlist')
  const figures = computeMonth(items, days, buffer, month)

  function handleAdd() {
    const id = addItem({ category: 'wishlist', name: nextItemName(wishlistItems), amount: 0, month })
    setAutoFocusId(id)
  }

  return (
    <div className="screen wish">
      <MonthStepper />
      <WishlistBody
        items={wishlistItems}
        moneySaved={figures.moneySaved}
        autoFocusId={autoFocusId}
        onAdd={handleAdd}
        onRename={(item, name) => editItem(item, { name }, month)}
        onReamount={(item, amount) => editItem(item, { amount }, month)}
        onDelete={(item) => deleteItem(item, month)}
        onMove={(item) => moveItem(item, 'flexSpend')}
        onToggleActive={(item, active) => setActive(item, active)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Add CSS for the inline wishlist row controls**

In `src/index.css`, replace the `.wishlist-body .row` and `.wishlist-body .row .num` rules:

```css
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
```

with:

```css
.wishlist-body .row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px dashed var(--rule);
  padding: 14px 0;
  font-size: 14px;
}

.wishlist-body .row .top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wishlist-body .row .top input[type='text'] {
  font: inherit;
  border: none;
  border-bottom: 1px solid transparent;
  background: transparent;
  color: inherit;
  padding: 0 0 2px;
}

.wishlist-body .row .top input[type='text']:focus {
  outline: none;
  border-bottom: 1px solid var(--ink);
}

.wishlist-body .row .top input.n {
  flex: 1;
}

.wishlist-body .row .top input.num {
  font-size: 15px;
  font-weight: 700;
  text-align: right;
  width: 90px;
}

.wishlist-body .row .actions {
  display: flex;
  gap: 14px;
  padding-left: 26px;
}

.wishlist-body .row .actions button {
  border: none;
  background: none;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--muted);
  cursor: pointer;
  padding: 0;
}

.wishlist-body .row .actions .delete {
  color: var(--short);
}
```

(`.wishlist-body .row.inactive { opacity: .4; }` stays as-is — no change needed.)

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/pages/WishlistBody.tsx src/routes/Wishlist.tsx src/index.css
git commit -m "$(cat <<'EOF'
Inline item editing for Wishlist, Active checkbox moved onto the row

WishlistBody rows are now directly editable — the Active checkbox, name,
and amount are all inline, plus a move-to-Flex-Spend and a delete action.
+Add creates a real ItemNN/0 item immediately. Wishlist reads the ring's
shared browsable month instead of always using the current month.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Delete `ItemSheet`

**Files:**
- Delete: `src/routes/pages/ItemSheet.tsx`
- Modify: `src/index.css`

**Interfaces:**
- None — by this point `MonthSetupScreen` and `Wishlist` (Tasks 9–10) no longer import it, and `History` (Task 8) is already gone, so nothing references it.

- [ ] **Step 1: Confirm nothing still imports it**

Run: `grep -rn "ItemSheet" src/` (or use your editor's find-in-files)
Expected: no results.

- [ ] **Step 2: Delete the file**

```bash
git rm src/routes/pages/ItemSheet.tsx
```

- [ ] **Step 3: Remove its CSS**

In `src/index.css`, delete the entire `/* ===== Item sheet ===== */` section: the `.sheet-scrim`, `.sheet`, `.sheet input[type='text']`, `.sheet-active`, `.sheet-actions`, `.sheet-actions button`, `.sheet-save`, and `.sheet-delete` rules. (Leave `.toggle2` alone — `Settings.tsx`'s Buffer mode toggle still uses it. Leave `.save-error` alone too — unrelated, used by `SaveErrorBanner`.)

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/routes/pages/ItemSheet.tsx src/index.css
git commit -m "$(cat <<'EOF'
Delete ItemSheet — fully replaced by inline row editing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: `DailyLog` — shared month, present/future-day logging, `displayAllowance`

**Files:**
- Modify: `src/routes/DailyLog.tsx`, `src/lib/time.ts`, `src/index.css`

**Interfaces:**
- Consumes: `useViewedMonth()` (Task 6), `MonthStepper` (Task 7), `figures.displayAllowance` (Task 2).
- Produces: removes the last caller of `time.ts`'s `elapsedDays`, so that function is deleted from `time.ts` in this task.

- [ ] **Step 1: Confirm `elapsedDays` has no other callers before deleting it**

Run: `grep -rn "elapsedDays" src/`
Expected: two hits — `src/lib/time.ts` (the definition) and `src/routes/DailyLog.tsx` (the only remaining usage, about to be removed in this task). `src/lib/formulas.ts` already stopped importing it in Task 1.

- [ ] **Step 2: Remove `elapsedDays` from `time.ts`**

In `src/lib/time.ts`, delete this function (it has no remaining callers after Step 3 below):

```ts
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

- [ ] **Step 3: Rewrite `DailyLog.tsx`**

Replace the full contents of `src/routes/DailyLog.tsx`:

```tsx
import { useState } from 'react'
import { useData } from '../data/DataContext'
import { computeMonth } from '../lib/formulas'
import { dayKey, daysInMonth, type DayKey } from '../lib/time'
import { useViewedMonth } from '../data/ViewedMonthContext'
import { lira } from '../money'
import { MonthStepper } from './pages/MonthStepper'

// A logged day is tinted by how far it lands from the flat allowance: rust
// when overspent, moss when underspent, intensity scaled by the gap. Fully
// saturated red sits three allowances past the line; fully saturated green
// is a day that cost nothing at all. Always compares against the flat
// allowance, never the Dynamic Allowance figure — see formulas.ts's note
// on why Dynamic Allowance must stay purely a display concern.
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
  const { month } = useViewedMonth()
  const [editingDay, setEditingDay] = useState<DayKey | null>(null)
  const [draft, setDraft] = useState('')

  const figures = computeMonth(items, days, buffer, month)
  const total = daysInMonth(month)

  function openEditor(day: number, existing: number | null) {
    setEditingDay(dayKey(month, day))
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
        <MonthStepper />
        <span className="allw num">Allowance {lira(figures.displayAllowance)}/day</span>
      </div>
      <div className="grid">
        {Array.from({ length: total }, (_, i) => i + 1).map((day) => {
          const key = dayKey(month, day)
          const change = days.get(key) ?? null
          const state = change === null ? 'unlogged' : 'logged'
          const editing = editingDay === key

          return (
            <div
              className={`cell ${state}`}
              key={day}
              style={change !== null ? { background: tintFor(change, figures.dailyAllowance) } : undefined}
              onClick={() => !editing && openEditor(day, change)}
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
                <span className="v num">{change !== null ? amountFor(change) : 'log'}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

Note every cell — past, today, and future — is now clickable and opens the same editor: the old `future`/`elapsed` split and its `!future &&` click guard are gone, along with the now-unused `todayDayOfMonth`/`elapsedDays` import.

- [ ] **Step 4: Remove now-dead CSS for the future cell state**

In `src/index.css`, delete these two rules entirely:

```css
.cal .cell.future {
  opacity: .35;
}

.cal .cell:not(.future) {
  cursor: pointer;
}
```

Then add `cursor: pointer;` into the existing base `.cal .cell { ... }` rule's property list (every cell is clickable now, so this is unconditional). That rule should read:

```css
.cal .cell {
  height: 48px;
  border-radius: 8px;
  background: var(--track);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  cursor: pointer;
}
```

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/DailyLog.tsx src/lib/time.ts src/index.css
git commit -m "$(cat <<'EOF'
Allow logging today and future days; Calendar reads the shared month

Every day cell is now clickable and editable, not just past ones. Drops
the now-unused elapsedDays (superseded by Task 1's log-based
remainingDays) and reads the shared browsable month via
ViewedMonthContext instead of its own local state. The header's
"Allowance X/day" now shows displayAllowance (Dynamic Allowance-aware),
while per-cell tinting still compares against the flat dailyAllowance.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: `Dashboard` — shared month, `displayAllowance`, month-aware label

**Files:**
- Modify: `src/routes/Dashboard.tsx`, `src/index.css`

**Interfaces:**
- Consumes: `useViewedMonth()` (Task 6), `MonthStepper` (Task 7), `figures.displayAllowance` (Task 2), `currentMonth`/`monthLabel` from `src/lib/time.ts`.

- [ ] **Step 1: Rewrite `Dashboard.tsx`**

Replace the full contents of `src/routes/Dashboard.tsx`:

```tsx
import { useData } from '../data/DataContext'
import { computeMonth } from '../lib/formulas'
import { currentMonth, monthLabel } from '../lib/time'
import { useViewedMonth } from '../data/ViewedMonthContext'
import { lira } from '../money'
import { MonthStepper } from './pages/MonthStepper'

export function Dashboard() {
  const { items, days, buffer } = useData()
  const { month } = useViewedMonth()
  const figures = computeMonth(items, days, buffer, month)
  const isCurrentMonth = month === currentMonth()

  return (
    <div className="screen screen--ink dash">
      <MonthStepper />
      <div className="figure">
        <span className="fig num">{lira(figures.displayAllowance)}</span>
        <span className="lbl">{isCurrentMonth ? 'Today' : monthLabel(month)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Restructure `.dash` CSS to hold the stepper above the centered figure**

In `src/index.css`, replace the `.dash` rule:

```css
.dash {
  align-items: center;
  justify-content: center;
}
```

with:

```css
.dash {
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.dash .figure {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
```

(The `.dash .fig` and `.dash .lbl` rules below it stay exactly as they are — they still target the same class names, just now nested one level deeper inside `.figure`, which doesn't affect the plain-class CSS selectors at all.)

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/routes/Dashboard.tsx src/index.css
git commit -m "$(cat <<'EOF'
Dashboard follows the shared browsed month

Shows displayAllowance for whichever month is browsed, with the label
switching between "Today" and the month name accordingly.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Settings — Dynamic Allowance toggle

**Files:**
- Modify: `src/routes/Settings.tsx`

**Interfaces:**
- Consumes: `buffer.dynamicAllowance`, `setDynamicAllowance` (Task 5).

- [ ] **Step 1: Add the toggle**

In `src/routes/Settings.tsx`, destructure `setDynamicAllowance` alongside the existing `buffer`/`setBuffer`:

```ts
  const { buffer, setBuffer, setDynamicAllowance } = useData()
```

Add a new row right after the existing Buffer mode `.toggle2` block and before the (now-removed, per Task 8) History link — i.e. as the last row inside `.bottom` before `.signout`:

```tsx
        <div className="row">
          <span>Dynamic Allowance</span>
          <input
            type="checkbox"
            checked={buffer.dynamicAllowance}
            onChange={(e) => setDynamicAllowance(e.target.checked)}
          />
        </div>
```

The full `.bottom` block should now read, in order: the Buffer percent row, the Buffer mode `.toggle2`, this new Dynamic Allowance row, then `.signout`.

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/Settings.tsx
git commit -m "$(cat <<'EOF'
Add the Dynamic Allowance toggle to Settings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests PASS, including every new `describe` block added in Tasks 1–4.

- [ ] **Step 2: Full type-check + build**

Run: `npm run build`
Expected: PASS, no TypeScript errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS (or only pre-existing warnings unrelated to this work — fix anything new this plan introduced).

- [ ] **Step 4: Confirm nothing still references deleted files**

Run: `grep -rln "ItemSheet\|routes/History\|elapsedDays" src/`
Expected: no results.

- [ ] **Step 5: Note the visual QA gap**

This session has no Playwright/live-browser access, so the inline row controls, the shared month stepper across all six screens, and the Dashboard's restyled layout have only been verified by type-checking and code review — not by eye. Tell the user the batch is ready for a manual pass (or a Playwright-equipped session) against the real app before considering it launch-ready: check row spacing/wrapping on a real phone-sized viewport, confirm the move/delete buttons don't accidentally trigger from a stray tap next to the name field, and confirm the boilerplate item's auto-focus actually opens the keyboard on mobile Safari/Chrome.

- [ ] **Step 6: Final commit if anything was fixed in this task**

Only if Steps 1–4 required changes:

```bash
git add -A
git commit -m "$(cat <<'EOF'
Fix verification failures from the launch-hotfixes batch

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
