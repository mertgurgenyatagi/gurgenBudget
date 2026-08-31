import { useState } from 'react'
import { useData } from '../data/DataContext'
import { amountInMonth, computeMonth, itemsInMonth } from '../lib/formulas'
import { money } from '../lib/money'
import { currentMonth } from '../lib/time'
import type { Item } from '../lib/types'
import { ItemSheet } from '../ui/ItemSheet'

/**
 * Wishlist exhibit design #01 — ledger stub. A torn-edge ledger card, with
 * Money Saved as the bold footer figure: your currency on the Wishlist playground.
 * Purchased items stay in the list, crossed out, never moved to a separate one.
 */
export function WishlistScreen() {
  const { items, days, buffer } = useData()
  const [editing, setEditing] = useState<Item | null>(null)
  const [adding, setAdding] = useState(false)

  const month = currentMonth()
  const figures = computeMonth(items, days, buffer, month)
  const list = itemsInMonth(items, month, 'wishlist')

  return (
    <div className="screen wish">
      <div className="wish-stub">
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Wishlist
        </div>

        {list.length === 0 && <div className="empty">Nothing on the list</div>}

        {list.map((item) => (
          <button
            key={item.id}
            className={`wish-row${item.purchased ? ' done' : ''}`}
            onClick={() => setEditing(item)}
          >
            <span>{item.name}</span>
            <span className="amt num">{money(amountInMonth(item, month) ?? 0)}</span>
          </button>
        ))}

        <button className="add-btn" onClick={() => setAdding(true)}>
          + Add
        </button>

        <div className="wish-foot">
          <span className="lbl">Money saved</span>
          <span className="fig num">{money(figures.moneySaved)}</span>
        </div>
      </div>

      {(adding || editing) && (
        <ItemSheet
          category="wishlist"
          month={month}
          item={editing}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
