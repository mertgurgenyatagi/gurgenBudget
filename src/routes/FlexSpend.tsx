import { MonthSetupScreen } from './pages/MonthSetupScreen'

const ITEMS = [
  { name: 'Car wash', amount: 350 },
  { name: 'Vet visit', amount: 900 },
]

export function FlexSpend() {
  return <MonthSetupScreen label="Flex spend" items={ITEMS} kind="spend" />
}
