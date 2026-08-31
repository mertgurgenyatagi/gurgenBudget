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
