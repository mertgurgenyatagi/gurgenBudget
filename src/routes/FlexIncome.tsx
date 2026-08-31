import { MonthSetupScreen } from './pages/MonthSetupScreen'
import { currentMonth } from '../lib/time'

export function FlexIncome() {
  return (
    <MonthSetupScreen category="flexIncome" label="Flex income" kind="income" month={currentMonth()} />
  )
}
