import { useEffect, useState } from 'react'
import type { Item } from '../../lib/formulas'
import { lira } from '../../money'

type WishlistBodyProps = {
  items: Item[]
  moneySaved: number
  autoFocusId: string | null
  onAdd: () => void
  onRename: (item: Item, name: string) => void
  onReamount: (item: Item, amount: number) => void
  onDelete: (item: Item) => void
  onMove: (item: Item) => void
  onToggleActive: (item: Item, active: boolean) => void
}

type RowProps = {
  item: Item
  autoFocus: boolean
  onRename: (item: Item, name: string) => void
  onReamount: (item: Item, amount: number) => void
  onDelete: (item: Item) => void
  onMove: (item: Item) => void
  onToggleActive: (item: Item, active: boolean) => void
}

function Row({ item, autoFocus, onRename, onReamount, onDelete, onMove, onToggleActive }: RowProps) {
  const [name, setName] = useState(item.name)
  const [amount, setAmount] = useState(String(item.amount))

  useEffect(() => setName(item.name), [item.name])
  useEffect(() => setAmount(String(item.amount)), [item.amount])

  return (
    <div className={item.active ? 'row' : 'row inactive'}>
      <div className="top">
        <input
          type="checkbox"
          checked={item.active}
          onChange={(e) => onToggleActive(item, e.target.checked)}
        />
        <input
          className="n"
          type="text"
          value={name}
          autoFocus={autoFocus}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => onRename(item, name)}
        />
        <input
          className="num"
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => onReamount(item, Math.round(Number(amount)) || 0)}
        />
      </div>
      <div className="actions">
        <button className="move" onClick={() => onMove(item)}>
          → Flex Spend
        </button>
        <button className="delete" onClick={() => onDelete(item)}>
          Delete
        </button>
      </div>
    </div>
  )
}

// Design #01, "ledger stub". Inactive items stay in the list, dimmed —
// never moved out, reversible at will via the checkbox on the row itself.
// Rows are directly editable — no add/edit sheet.
export function WishlistBody({
  items,
  moneySaved,
  autoFocusId,
  onAdd,
  onRename,
  onReamount,
  onDelete,
  onMove,
  onToggleActive,
}: WishlistBodyProps) {
  return (
    <div className="wishlist-body">
      <div className="head">Wishlist</div>
      {items.map((item) => (
        <Row
          key={item.id}
          item={item}
          autoFocus={item.id === autoFocusId}
          onRename={onRename}
          onReamount={onReamount}
          onDelete={onDelete}
          onMove={onMove}
          onToggleActive={onToggleActive}
        />
      ))}
      <div className="add" onClick={onAdd}>
        + Add
      </div>
      <div className="foot">
        <span className="lbl">Money saved</span>
        <span className="num">{lira(moneySaved)}</span>
      </div>
    </div>
  )
}
