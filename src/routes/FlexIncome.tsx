import { MonthSetupScreen } from './pages/MonthSetupScreen'

const ITEMS = [
  { name: 'Freelance', amount: 3200 },
  { name: 'Side gig', amount: 1150 },
]

export function FlexIncome() {
  return <MonthSetupScreen label="Flex income" items={ITEMS} kind="income" />
}
