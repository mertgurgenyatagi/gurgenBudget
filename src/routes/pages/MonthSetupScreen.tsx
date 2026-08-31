import { lira } from '../../money'

export type Item = { name: string; amount: number }

type MonthSetupScreenProps = {
  label: string
  items: Item[]
  /** Income bars run moss, spend bars run rust. */
  kind: 'income' | 'spend'
}

// Design #8, "bar share": each item is a labeled bar sized to its share of the
// category total. Shared by the four Month Setup screens, which stay four
// distinct screens on the ring.
export function MonthSetupScreen({ label, items, kind }: MonthSetupScreenProps) {
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const fill = kind === 'income' ? 'var(--accent)' : 'var(--short)'

  return (
    <div className="screen ms">
      <div className="fig num">{lira(total)}</div>
      <div className="lbl">{label}</div>
      {items.map((item) => (
        <div className="bar" key={item.name}>
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
      <div className="add">+ Add</div>
    </div>
  )
}
