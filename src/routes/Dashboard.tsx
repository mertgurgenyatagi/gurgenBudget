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
