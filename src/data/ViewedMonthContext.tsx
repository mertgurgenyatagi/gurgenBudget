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
