import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useData } from '../../data/DataContext'
import type { Category, Item } from '../../lib/formulas'
import type { MonthKey } from '../../lib/time'

type ItemSheetProps = {
  category: Category
  /** null means "adding a new item"; otherwise the item being edited. */
  item: Item | null
  month: MonthKey
  onClose: () => void
}

const MOVABLE: Category[] = ['flexSpend', 'wishlist']

// Shared by Base/Flex Income, Base/Flex Spend, Wishlist, and History — one
// sheet, opened by "+ Add" or by tapping an existing row. Flex Spend and
// Wishlist additionally get the category toggle they share (PROJECT.md:
// "share one add entry point with a toggle"), and an Active checkbox while
// the item is currently in Wishlist — unchecking it excludes the item from
// this month's totals, same as a delete, but reversible at will.
export function ItemSheet({ category, item, month, onClose }: ItemSheetProps) {
  const { addItem, editItem, deleteItem, moveItem, setActive } = useData()
  const [name, setName] = useState(item?.name ?? '')
  const [amount, setAmount] = useState(item ? String(item.amount) : '')
  const [cat, setCat] = useState<Category>(item?.category ?? category)
  const [active, setActiveDraft] = useState(item?.active ?? true)

  const canToggle = MOVABLE.includes(category)

  function handleSave() {
    const amt = Math.round(Number(amount)) || 0
    if (item === null) {
      addItem({ category: cat, name, amount: amt, month })
    } else {
      if (cat !== item.category) moveItem(item, cat)
      editItem(item, { name, amount: amt }, month)
      if (cat === 'wishlist' && active !== item.active) setActive(item, active)
    }
    onClose()
  }

  function handleDelete() {
    if (item !== null) deleteItem(item, month)
    onClose()
  }

  // Portalled straight to <body>: the ring screens that open this sheet
  // live inside .ring-track, which has an active `transform` (plus
  // `will-change: transform` for the drag animation). Either one makes an
  // element the containing block for any `position: fixed` descendant, so
  // without the portal this sheet's scrim would size and position itself
  // against the track's own (much wider, off-screen) box instead of the
  // viewport.
  return createPortal(
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <input
          className="sheet-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          autoFocus
        />
        <input
          className="sheet-amount"
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
        />
        {canToggle && (
          <div className="toggle2">
            <button
              className={cat === 'flexSpend' ? 'active' : ''}
              onClick={() => setCat('flexSpend')}
            >
              Flex Spend
            </button>
            <button className={cat === 'wishlist' ? 'active' : ''} onClick={() => setCat('wishlist')}>
              Wishlist
            </button>
          </div>
        )}
        {cat === 'wishlist' && (
          <label className="sheet-active">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActiveDraft(e.target.checked)}
            />
            Active
          </label>
        )}
        <div className="sheet-actions">
          {item !== null && (
            <button className="sheet-delete" onClick={handleDelete}>
              Delete
            </button>
          )}
          <button className="sheet-save" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
