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
