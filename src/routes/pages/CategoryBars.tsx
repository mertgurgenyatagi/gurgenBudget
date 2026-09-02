import { useEffect, useState } from 'react'
import type { Item } from '../../lib/formulas'
import { lira } from '../../money'

type CategoryBarsProps = {
  label: string
  items: Item[]
  total: number
  /** Income bars run moss, spend bars run rust. */
  kind: 'income' | 'spend'
  /** The item to auto-focus its name field on — set right after "+ Add". */
  autoFocusId: string | null
  onAdd: () => void
  onRename: (item: Item, name: string) => void
  onReamount: (item: Item, amount: number) => void
  onDelete: (item: Item) => void
  /** Only Flex Spend rows get a move-to-Wishlist control. */
  onMove?: (item: Item) => void
}

type BarProps = {
  item: Item
  total: number
  fill: string
  autoFocus: boolean
  onRename: (item: Item, name: string) => void
  onReamount: (item: Item, amount: number) => void
  onDelete: (item: Item) => void
  onMove?: (item: Item) => void
}

function Bar({ item, total, fill, autoFocus, onRename, onReamount, onDelete, onMove }: BarProps) {
  const [name, setName] = useState(item.name)
  const [amount, setAmount] = useState(String(item.amount))

  // Firestore's live value can arrive asynchronously after a local edit
  // round-trips — resync once it lands, same pattern Settings already
  // uses for the Buffer percent field.
  useEffect(() => setName(item.name), [item.name])
  useEffect(() => setAmount(String(item.amount)), [item.amount])

  return (
    <div className="bar">
      <div className="top">
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
      <div className="track">
        <div
          className="fill"
          style={{
            width: total === 0 ? '0%' : `${Math.round((item.amount / total) * 100)}%`,
            background: fill,
          }}
        />
      </div>
      <div className="actions">
        {onMove && (
          <button className="move" onClick={() => onMove(item)}>
            → Wishlist
          </button>
        )}
        <button className="delete" onClick={() => onDelete(item)}>
          Delete
        </button>
      </div>
    </div>
  )
}

// Design #8, "bar share": each item is a labeled bar sized to its share of
// the category total. Rows are inline-editable directly — no add/edit
// sheet — per the "kill the sheet entirely" decision in the launch-hotfixes
// spec.
export function CategoryBars({
  label,
  items,
  total,
  kind,
  autoFocusId,
  onAdd,
  onRename,
  onReamount,
  onDelete,
  onMove,
}: CategoryBarsProps) {
  const fill = kind === 'income' ? 'var(--accent)' : 'var(--short)'

  return (
    <div className="bars">
      <div className="fig num">{lira(total)}</div>
      <div className="lbl">{label}</div>
      {items.map((item) => (
        <Bar
          key={item.id}
          item={item}
          total={total}
          fill={fill}
          autoFocus={item.id === autoFocusId}
          onRename={onRename}
          onReamount={onReamount}
          onDelete={onDelete}
          onMove={onMove}
        />
      ))}
      <div className="add" onClick={onAdd}>
        + Add
      </div>
    </div>
  )
}
