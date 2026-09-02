import { useState } from 'react'
import { useData } from '../../data/DataContext'
import { categoryTotal, itemsInMonth, nextItemName, type Category } from '../../lib/formulas'
import { useViewedMonth } from '../../data/ViewedMonthContext'
import { CategoryBars } from './CategoryBars'
import { MonthStepper } from './MonthStepper'

type MonthSetupScreenProps = {
  category: Category
  label: string
  kind: 'income' | 'spend'
}

// Shared by the four Month Setup screens, which stay four distinct screens
// on the ring. Reads the ring's shared browsable month (ViewedMonthContext)
// rather than taking one as a prop, so stepping the month anywhere on the
// ring moves this screen's contents too — that's what makes setting up
// next month's Flex items in advance possible.
export function MonthSetupScreen({ category, label, kind }: MonthSetupScreenProps) {
  const { items, addItem, editItem, deleteItem, moveItem } = useData()
  const { month } = useViewedMonth()
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null)

  const scoped = itemsInMonth(items, month, category)

  function handleAdd() {
    const id = addItem({ category, name: nextItemName(scoped), amount: 0, month })
    setAutoFocusId(id)
  }

  return (
    <div className="screen ms">
      <MonthStepper />
      <CategoryBars
        label={label}
        kind={kind}
        items={scoped}
        total={categoryTotal(items, month, category)}
        autoFocusId={autoFocusId}
        onAdd={handleAdd}
        onRename={(item, name) => editItem(item, { name }, month)}
        onReamount={(item, amount) => editItem(item, { amount }, month)}
        onDelete={(item) => deleteItem(item, month)}
        onMove={category === 'flexSpend' ? (item) => moveItem(item, 'wishlist') : undefined}
      />
    </div>
  )
}
