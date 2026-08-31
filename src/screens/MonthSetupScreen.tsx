import { useState } from 'react'
import { useData } from '../data/DataContext'
import { amountInMonth, categoryTotal, itemsInMonth } from '../lib/formulas'
import { money } from '../lib/money'
import { currentMonth } from '../lib/time'
import { CATEGORY_LABELS, type Category, type Item } from '../lib/types'
import { ItemSheet } from '../ui/ItemSheet'

/**
 * Month Setup exhibit design #8 — bar share. Each item is a labelled horizontal
 * bar sized to its share of the category total. One screen per category.
 */
export function MonthSetupScreen({ category }: { category: Category }) {
  const { items } = useData()
  const [editing, setEditing] = useState<Item | null>(null)
  const [adding, setAdding] = useState(false)

  const month = currentMonth()
  const list = itemsInMonth(items, month, category)
  const total = categoryTotal(items, month, category)
  const widest = list.reduce(
    (max, item) => Math.max(max, Math.abs(amountInMonth(item, month) ?? 0)),
    0,
  )

  return (
    <div className="screen">
      <div className="screen-head">
        <span className="eyebrow">{CATEGORY_LABELS[category]}</span>
      </div>
      <div className="setup-total num">{money(total)}</div>

      <div className="bars" style={{ marginTop: 22 }}>
        {list.length === 0 && <div className="empty">Nothing here yet</div>}

        {list.map((item) => {
          const amount = amountInMonth(item, month) ?? 0
          const share = widest === 0 ? 0 : (Math.abs(amount) / widest) * 100
          return (
            <button key={item.id} className="bar-row" onClick={() => setEditing(item)}>
              <span className="top">
                <span>{item.name}</span>
                <span className="amt num">{money(amount)}</span>
              </span>
              <span className="track">
                <span className="fill" style={{ width: `${share}%` }} />
              </span>
            </button>
          )
        })}
      </div>

      <button className="add-btn" onClick={() => setAdding(true)}>
        + Add
      </button>

      {(adding || editing) && (
        <ItemSheet
          category={category}
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
