import { useState } from 'react'
import { useData } from '../data/DataContext'
import { computeMonth, itemsInMonth, nextItemName } from '../lib/formulas'
import { useViewedMonth } from '../data/ViewedMonthContext'
import { MonthStepper } from './pages/MonthStepper'
import { WishlistBody } from './pages/WishlistBody'

export function Wishlist() {
  const { items, days, buffer, addItem, editItem, deleteItem, moveItem, setActive } = useData()
  const { month } = useViewedMonth()
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null)

  const wishlistItems = itemsInMonth(items, month, 'wishlist')
  const figures = computeMonth(items, days, buffer, month)

  function handleAdd() {
    const id = addItem({ category: 'wishlist', name: nextItemName(wishlistItems), amount: 0, month })
    setAutoFocusId(id)
  }

  return (
    <div className="screen wish">
      <MonthStepper />
      <WishlistBody
        items={wishlistItems}
        moneySaved={figures.moneySaved}
        autoFocusId={autoFocusId}
        onAdd={handleAdd}
        onRename={(item, name) => editItem(item, { name }, month)}
        onReamount={(item, amount) => editItem(item, { amount }, month)}
        onDelete={(item) => deleteItem(item, month)}
        onMove={(item) => moveItem(item, 'flexSpend')}
        onToggleActive={(item, active) => setActive(item, active)}
      />
    </div>
  )
}
