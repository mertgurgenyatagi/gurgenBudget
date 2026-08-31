import type { Item } from '../../lib/formulas'
import { lira } from '../../money'

type CategoryBarsProps = {
  label: string
  items: Item[]
  total: number
  /** Income bars run moss, spend bars run rust. */
  kind: 'income' | 'spend'
  onSelectItem: (item: Item) => void
  onAdd: () => void
}

// Design #8, "bar share": each item is a labeled bar sized to its share of
// the category total. Wrapped in its own `.bars` class rather than relying
// on an ancestor to style it, because History reuses this inside a plain
// `.history-block` — a different container than MonthSetupScreen's `.ms`.
export function CategoryBars({ label, items, total, kind, onSelectItem, onAdd }: CategoryBarsProps) {
  const fill = kind === 'income' ? 'var(--accent)' : 'var(--short)'

  return (
    <div className="bars">
      <div className="fig num">{lira(total)}</div>
      <div className="lbl">{label}</div>
      {items.map((item) => (
        <div className="bar" key={item.id} onClick={() => onSelectItem(item)}>
          <div className="top">
            <span className="n">{item.name}</span>
            <span className="num">{lira(item.amount)}</span>
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
        </div>
      ))}
      <div className="add" onClick={onAdd}>
        + Add
      </div>
    </div>
  )
}
