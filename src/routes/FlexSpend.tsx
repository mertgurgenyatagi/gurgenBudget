import { MonthSetupScreen } from './pages/MonthSetupScreen'
import { currentMonth } from '../lib/time'

export function FlexSpend() {
  return (
    <MonthSetupScreen category="flexSpend" label="Flex spend" kind="spend" month={currentMonth()} />
  )
}
