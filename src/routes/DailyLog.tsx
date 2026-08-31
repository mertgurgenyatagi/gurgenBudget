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
