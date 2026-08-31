import { useData } from '../data/DataContext'
import { computeMonth } from '../lib/formulas'
import { money } from '../lib/money'
import { currentMonth, dayKey, elapsedDays, monthLabel } from '../lib/time'

/**
 * Dashboard exhibit design #17 — one dominant dark figure card flanked by two
 * lighter satellites. The app answers one question every day with one number,
 * so the Daily Allowance is the card that gets the weight.
 */
export function DashboardScreen() {
  const { items, days, buffer } = useData()
  const month = currentMonth()
  const figures = computeMonth(items, days, buffer, month)

  const elapsed = elapsedDays(month)
  let unlogged = 0
  for (let day = 1; day <= elapsed; day++) {
    if (!days.has(dayKey(month, day))) unlogged++
  }

  return (
    <div className="screen dash">
      <div className="dash-month">{monthLabel(month)}</div>

      <div className="dash-hero">
        <div className="lbl">Today</div>
        <div className="fig num">{money(figures.dailyAllowance)}</div>
        <div className="sub">per day · {figures.days} days</div>
      </div>

      <div className="dash-sides">
        <div className="dash-card">
          <div className="lbl">Surplus</div>
          <div className="fig num">{money(figures.surplus)}</div>
        </div>
        <div className="dash-card">
          <div className="lbl">Wishlist</div>
          <div className="fig num">{money(figures.wishlist)}</div>
        </div>
      </div>

      <div className="dash-unlogged">
        {unlogged === 0
          ? elapsed === 0
            ? 'Nothing to log yet'
            : 'All days logged'
          : `${unlogged} ${unlogged === 1 ? 'day' : 'days'} to log`}
      </div>
    </div>
  )
}
