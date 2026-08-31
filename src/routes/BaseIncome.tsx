import { MonthSetupScreen } from './pages/MonthSetupScreen'

const ITEMS = [{ name: 'Salary', amount: 45000 }]

export function BaseIncome() {
  return <MonthSetupScreen label="Base income" items={ITEMS} kind="income" />
}
