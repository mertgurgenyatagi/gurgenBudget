import { useState } from 'react'
import { useData } from '../data/DataContext'
import { parseAmount } from '../lib/money'
import type { MonthKey } from '../lib/time'
import { CATEGORY_LABELS, type Category, type Item } from '../lib/types'
import { Sheet } from './Sheet'

/** Flex Spend and Wishlist share one add entry point — items move between them. */
const PAIRED: Partial<Record<Category, Category>> = {
  flexSpend: 'wishlist',
  wishlist: 'flexSpend',
}

export function ItemSheet({ category, month, item, onClose }: {
  category: Category
  month: MonthKey
  item: Item | null
  onClose: () => void
}) {
  const { addItem, editItem, deleteItem, moveItem, setPurchased } = useData()
  const [name, setName] = useState(item?.name ?? '')
  const [amount, setAmount] = useState(item ? String(item.amount) : '')
  const [target, setTarget] = useState<Category>(item?.category ?? category)

  const paired = PAIRED[category]
  const parsed = parseAmount(amount)

  function save() {
    const value = parsed ?? 0
    const trimmed = name.trim()
    if (trimmed === '') return

    if (item) {
      editItem(item, { name: trimmed, amount: value }, month)
      if (target !== item.category) moveItem(item, target)
    } else {
      addItem({ category: target, name: trimmed, amount: value, month })
    }
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <h2>{item ? 'Edit item' : `Add to ${CATEGORY_LABELS[target]}`}</h2>

      <div className="field">
        <label htmlFor="item-name">Name</label>
        <input
          id="item-name"
          value={name}
          autoFocus={!item}
          onChange={(event) => setName(event.target.value)}
          placeholder="Rent"
        />
      </div>

      <div className="field">
        <label htmlFor="item-amount">Amount</label>
        <input
          id="item-amount"
          value={amount}
          inputMode="numeric"
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0"
        />
      </div>

      {paired && (
        <div className="sheet-extra">
          {[category, paired].map((option) => (
            <button
              key={option}
              className={`btn ${target === option ? 'btn-primary' : 'btn-quiet'}`}
              onClick={() => setTarget(option)}
            >
              {CATEGORY_LABELS[option]}
            </button>
          ))}
        </div>
      )}

      <div className="sheet-actions">
        <button className="btn btn-quiet" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={save}>
          Save
        </button>
      </div>

      {item && (
        <div className="sheet-extra">
          {item.category === 'wishlist' && (
            <button
              className="btn btn-quiet"
              onClick={() => {
                setPurchased(item, !item.purchased)
                onClose()
              }}
            >
              {item.purchased ? 'Not purchased' : 'Mark purchased'}
            </button>
          )}
          <button
            className="btn btn-danger"
            onClick={() => {
              deleteItem(item, month)
              onClose()
            }}
          >
            Delete
          </button>
        </div>
      )}
    </Sheet>
  )
}
