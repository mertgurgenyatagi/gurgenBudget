import type { Item } from '../../lib/formulas'
import { lira } from '../../money'

type WishlistBodyProps = {
  items: Item[]
  moneySaved: number
  onSelectItem: (item: Item) => void
  onAdd: () => void
}

// Design #01, "ledger stub". Inactive items stay in the list, dimmed —
// never moved out, reversible at will. Wrapped in its own `.wishlist-body`
// class rather than relying on an ancestor, because History reuses this
// inside a plain `.history-block` — a different container than Wishlist's
// `.wish` torn-edge card.
export function WishlistBody({ items, moneySaved, onSelectItem, onAdd }: WishlistBodyProps) {
  return (
    <div className="wishlist-body">
      <div className="head">Wishlist</div>
      {items.map((item) => (
        <div
          className={item.active ? 'row' : 'row inactive'}
          key={item.id}
          onClick={() => onSelectItem(item)}
        >
          <span>{item.name}</span>
          <span className="num">{lira(item.amount)}</span>
        </div>
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
