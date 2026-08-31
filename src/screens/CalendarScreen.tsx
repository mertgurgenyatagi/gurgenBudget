import { useState } from 'react'
import { useData } from '../data/DataContext'
import { computeMonth } from '../lib/formulas'
import { moneyAbs, parseAmount } from '../lib/money'
import {
  addMonths,
  currentMonth,
  dayKey,
  daysInMonth,
  elapsedDays,
  monthLabel,
  weekdayShort,
  type MonthKey,
} from '../lib/time'
import { Sheet } from '../ui/Sheet'

/**
 * Tint each logged day by how far it ran over or under the Daily Allowance.
 * The strength is proportional, capped so it stays a tint rather than an alarm —
 * the app never moralises, it just shows you where the day landed.
 */
function tintFor(spend: number, allowance: number): string | undefined {
  if (allowance <= 0) return undefined
  const ratio = (spend - allowance) / allowance
  const strength = Math.min(Math.abs(ratio), 1) * 30
  if (strength < 1) return undefined
  const hue = ratio > 0 ? 'var(--short)' : 'var(--accent)'
  return `color-mix(in oklch, ${hue} ${strength.toFixed(0)}%, var(--track))`
}

export function CalendarScreen({ month, onMonthChange }: {
  month: MonthKey
  onMonthChange: (next: MonthKey) => void
}) {
  const { items, days, buffer, logDay } = useData()
  const [editing, setEditing] = useState<number | null>(null)

  const figures = computeMonth(items, days, buffer, month)
  const total = daysInMonth(month)
  const elapsed = elapsedDays(month)
  const isCurrent = month === currentMonth()

  return (
    <div className="screen">
      <div className="cal-month">
        <button onClick={() => onMonthChange(addMonths(month, -1))} aria-label="Previous month">
          ‹
        </button>
        <span className="label">{monthLabel(month)}</span>
        <button onClick={() => onMonthChange(addMonths(month, 1))} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="cal-grid">
        {Array.from({ length: total }, (_, i) => i + 1).map((day) => {
          const key = dayKey(month, day)
          const logged = days.get(key)
          const future = day > elapsed
          const today = isCurrent && day === elapsed + 1
          const tint = logged === undefined ? undefined : tintFor(logged, figures.dailyAllowance)

          return (
            <button
              key={key}
              className={`cal-cell${logged === undefined ? (future ? ' future' : ' unlogged') : ''}${today ? ' today' : ''}`}
              style={tint ? { background: tint } : undefined}
              onClick={() => setEditing(day)}
            >
              <span className="d num">{day}</span>
              <span className="v num">{logged === undefined ? '—' : moneyAbs(logged)}</span>
            </button>
          )
        })}
      </div>

      <div className="cal-legend">
        <span>
          <i style={{ background: 'var(--accent)' }} /> under
        </span>
        <span>
          <i style={{ background: 'var(--short)' }} /> over
        </span>
        <span>
          <i style={{ background: 'var(--track)' }} /> {moneyAbs(figures.dailyAllowance)} a day
        </span>
      </div>

      {editing !== null && (
        <DaySheet
          month={month}
          day={editing}
          current={days.get(dayKey(month, editing))}
          onSave={(amount) => {
            logDay(dayKey(month, editing), amount)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function DaySheet({ month, day, current, onSave, onClose }: {
  month: MonthKey
  day: number
  current: number | undefined
  onSave: (amount: number | null) => void
  onClose: () => void
}) {
  const key = dayKey(month, day)
  const [value, setValue] = useState(current === undefined ? '' : String(current))

  return (
    <Sheet onClose={onClose}>
      <h2>
        {weekdayShort(key)}, {monthLabel(month).split(' ')[0]} {day}
      </h2>

      <div className="field">
        <label htmlFor="day-amount">How much your balance dropped</label>
        <input
          id="day-amount"
          value={value}
          autoFocus
          inputMode="numeric"
          onChange={(event) => setValue(event.target.value)}
          placeholder="0"
        />
      </div>

      <div className="sheet-actions">
        <button className="btn btn-quiet" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={() => onSave(parseAmount(value))}>
          Save
        </button>
      </div>

      {current !== undefined && (
        <div className="sheet-extra">
          <button className="btn btn-danger" onClick={() => onSave(null)}>
            Clear this day
          </button>
        </div>
      )}
    </Sheet>
  )
}
