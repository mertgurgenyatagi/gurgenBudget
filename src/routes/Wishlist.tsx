import { useState } from 'react'
import { useData } from '../data/DataContext'
import { computeMonth, itemsInMonth, type Item } from '../lib/formulas'
import { currentMonth } from '../lib/time'
import { ItemSheet } from './pages/ItemSheet'
import { WishlistBody } from './pages/WishlistBody'

export function Wishlist() {
  const { items, days, buffer } = useData()
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const month = currentMonth()
  const wishlistItems = itemsInMonth(items, month, 'wishlist')
  const figures = computeMonth(items, days, buffer, month)

  return (
    <div className="screen wish">
      <WishlistBody
        items={wishlistItems}
        moneySaved={figures.moneySaved}
        onSelectItem={setEditing}
        onAdd={() => setEditing('new')}
      />
      {editing !== null && (
        <ItemSheet
          category="wishlist"
          item={editing === 'new' ? null : editing}
          month={month}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
