import { lira } from '../money'

const MONTH = 'April'
const ALLOWANCE = 410

// Placeholder month — `change` is the raw bank-balance change for the day
// (negative = spent, positive = money in). null means the day is unlogged.
const DAYS: { day: number; change: number | null; future?: boolean }[] = [
  { day: 1, change: -320 }, { day: 2, change: -1150 }, { day: 3, change: -60 },
  { day: 4, change: -890 }, { day: 5, change: -2400 }, { day: 6, change: -150 },
  { day: 7, change: 3200 }, { day: 8, change: -430 }, { day: 9, change: -75 },
  { day: 10, change: -1600 }, { day: 11, change: -220 }, { day: 12, change: -95 },
  { day: 13, change: -3100 }, { day: 14, change: -180 }, { day: 15, change: -640 },
  { day: 16, change: -1020 }, { day: 17, change: -310 }, { day: 18, change: -85 },
  { day: 19, change: -1750 }, { day: 20, change: -260 },
  { day: 21, change: null }, { day: 22, change: null },
  { day: 23, change: null }, { day: 24, change: null },
  { day: 25, change: null, future: true }, { day: 26, change: null, future: true },
  { day: 27, change: null, future: true }, { day: 28, change: null, future: true },
  { day: 29, change: null, future: true }, { day: 30, change: null, future: true },
]

// A logged day is tinted by how far it lands from the allowance: rust when
// overspent, moss when underspent, intensity scaled by the gap. Fully saturated
// red sits three allowances past the line; fully saturated green is a day that
// cost nothing at all.
function tintFor(change: number): string {
  const spent = -change
  const over = spent > ALLOWANCE
  const ratio = over
    ? Math.min(1, (spent - ALLOWANCE) / (ALLOWANCE * 3))
    : Math.min(1, (ALLOWANCE - spent) / ALLOWANCE)
  const pct = Math.round(6 + ratio * 40)
  return `color-mix(in oklch, var(${over ? '--short' : '--accent'}) ${pct}%, var(--paper))`
}

// Logged amounts carry no minus sign — spending is the default direction, so
// only the rarer money-in day is signed.
function amountFor(change: number): string {
  return change > 0 ? `+${lira(change)}` : lira(-change)
}

export function DailyLog() {
  return (
    <div className="screen cal">
      <div className="head">
        <span className="month">{MONTH}</span>
        <span className="allw num">Allowance {lira(ALLOWANCE)}/day</span>
      </div>
      <div className="grid">
        {DAYS.map(({ day, change, future }) => {
          const state = future ? 'future' : change === null ? 'unlogged' : 'logged'
          return (
            <div
              className={`cell ${state}`}
              key={day}
              style={change !== null ? { background: tintFor(change) } : undefined}
            >
              <span className="d">{day}</span>
              <span className="v num">
                {change !== null ? amountFor(change) : state === 'unlogged' ? 'log' : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
