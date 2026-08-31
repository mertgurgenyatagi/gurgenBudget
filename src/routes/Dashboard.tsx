import { lira } from '../money'

export function Dashboard() {
  return (
    <div className="screen screen--ink dash">
      <span className="fig num">{lira(284)}</span>
      <span className="lbl">Today</span>
    </div>
  )
}
