import { useState } from 'react'
import { useData } from '../../data/DataContext'
import { categoryTotal, itemsInMonth, type Category, type Item } from '../../lib/formulas'
import type { MonthKey } from '../../lib/time'
import { CategoryBars } from './CategoryBars'
import { ItemSheet } from './ItemSheet'

type MonthSetupScreenProps = {
  category: Category
  label: string
  kind: 'income' | 'spend'
  month: MonthKey
}

// Shared by the four Month Setup screens, which stay four distinct screens
// on the ring. Also reused by History, fed a past month instead of the
// current one.
export function MonthSetupScreen({ category, label, kind, month }: MonthSetupScreenProps) {
  const { items } = useData()
  const [editing, setEditing] = useState<Item | 'new' | null>(null)

  return (
    <div className="screen ms">
      <CategoryBars
        label={label}
        kind={kind}
        items={itemsInMonth(items, month, category)}
        total={categoryTotal(items, month, category)}
        onSelectItem={setEditing}
        onAdd={() => setEditing('new')}
      />
      {editing !== null && (
        <ItemSheet
          category={category}
          item={editing === 'new' ? null : editing}
          month={month}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
