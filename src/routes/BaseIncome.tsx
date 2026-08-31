import { MonthSetupScreen } from './pages/MonthSetupScreen'
import { currentMonth } from '../lib/time'

export function BaseIncome() {
  return (
    <MonthSetupScreen category="baseIncome" label="Base income" kind="income" month={currentMonth()} />
  )
}
