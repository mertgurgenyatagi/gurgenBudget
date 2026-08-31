import { MonthSetupScreen } from './pages/MonthSetupScreen'

const ITEMS = [
  { name: 'Rent', amount: 18000 },
  { name: 'Subscriptions', amount: 450 },
]

export function BaseSpend() {
  return <MonthSetupScreen label="Base spend" items={ITEMS} kind="spend" />
}
