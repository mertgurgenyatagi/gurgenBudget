import { MonthSetupScreen } from './pages/MonthSetupScreen'
import { currentMonth } from '../lib/time'

export function BaseSpend() {
  return (
    <MonthSetupScreen category="baseSpend" label="Base spend" kind="spend" month={currentMonth()} />
  )
}
