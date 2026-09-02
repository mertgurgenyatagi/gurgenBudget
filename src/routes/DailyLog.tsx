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
