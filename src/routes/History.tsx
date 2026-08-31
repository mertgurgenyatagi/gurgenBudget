import { useState } from 'react'
import { useData } from '../data/DataContext'
import { categoryTotal, computeMonth, itemsInMonth, type Category, type Item } from '../lib/formulas'
import { currentMonth, monthLabel, nextMonth, prevMonth, type MonthKey } from '../lib/time'
import { lira } from '../money'
import { CategoryBars } from './pages/CategoryBars'
import { ItemSheet } from './pages/ItemSheet'
import { WishlistBody } from './pages/WishlistBody'

type Editing = { category: Category; item: Item | 'new' }

const SECTIONS: { category: Category; label: string; kind: 'income' | 'spend' }[] = [
  { category: 'baseIncome', label: 'Base income', kind: 'income' },
  { category: 'flexIncome', label: 'Flex income', kind: 'income' },
  { category: 'baseSpend', label: 'Base spend', kind: 'spend' },
  { category: 'flexSpend', label: 'Flex spend', kind: 'spend' },
]

// History is not a destination on the ring. Its job is browsing a past
// month's full picture — Base/Flex figures and Wishlist together — which
// nothing else does for a past month; the Calendar's own stepper only ever
// shows day-by-day logs. Nothing here is read-only: PROJECT.md is explicit
// that past months stay editable, no locking.
export function History() {
  const { items, days, buffer } = useData()
  const [month, setMonth] = useState<MonthKey>(prevMonth(currentMonth()))
  const [editing, setEditing] = useState<Editing | null>(null)

  const figures = computeMonth(items, days, buffer, month)
  const atCurrentMonth = month === currentMonth()
  const wishlistItems = itemsInMonth(items, month, 'wishlist')

  return (
    <main className="history">
      <div className="history-head">
        <button onClick={() => setMonth((m) => prevMonth(m))}>‹</button>
        <span>{monthLabel(month)}</span>
        <button onClick={() => setMonth((m) => nextMonth(m))} disabled={atCurrentMonth}>
          ›
        </button>
      </div>

      <div className="history-summary">
        <div>
          <span>Surplus</span>
          <span className="num">{lira(figures.surplus)}</span>
        </div>
        <div>
          <span>Allowance</span>
          <span className="num">{lira(figures.dailyAllowance)}/day</span>
        </div>
        <div>
          <span>Money saved</span>
          <span className="num">{lira(figures.moneySaved)}</span>
        </div>
      </div>

      {SECTIONS.map((section) => (
        <div className="history-block" key={section.category}>
          <CategoryBars
            label={section.label}
            kind={section.kind}
            items={itemsInMonth(items, month, section.category)}
            total={categoryTotal(items, month, section.category)}
            onSelectItem={(item) => setEditing({ category: section.category, item })}
            onAdd={() => setEditing({ category: section.category, item: 'new' })}
          />
        </div>
      ))}

      <div className="history-block">
        <WishlistBody
          items={wishlistItems}
          moneySaved={figures.moneySaved}
          onSelectItem={(item) => setEditing({ category: 'wishlist', item })}
          onAdd={() => setEditing({ category: 'wishlist', item: 'new' })}
        />
      </div>

      {editing !== null && (
        <ItemSheet
          category={editing.category}
          item={editing.item === 'new' ? null : editing.item}
          month={month}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  )
}
