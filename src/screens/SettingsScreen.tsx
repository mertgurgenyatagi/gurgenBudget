import { signOut } from 'firebase/auth'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../data/DataContext'
import { auth } from '../firebase'
import { amountInMonth, computeMonth, itemsInMonth, spendSoFar } from '../lib/formulas'
import { money, parseAmount } from '../lib/money'
import { addMonths, currentMonth, monthLabel, type MonthKey } from '../lib/time'
import { Sheet } from '../ui/Sheet'

/** Settings exhibit design #03 — two-tone: dark account band over a light panel. */
export function SettingsScreen() {
  const { user } = useAuth()
  const { buffer } = useData()
  const [editingBuffer, setEditingBuffer] = useState(false)
  const [browsing, setBrowsing] = useState(false)

  return (
    <div className="screen set">
      <div className="set-top">
        <span className="lbl">Signed in as</span>
        <div className="email">{user?.email ?? '—'}</div>
      </div>

      <div className="set-body">
        <button className="set-row" onClick={() => setEditingBuffer(true)}>
          <span>Buffer</span>
          <span className="val num">{money(buffer.amount)} / day</span>
        </button>

        <button className="set-row" onClick={() => setBrowsing(true)}>
          <span>Past months</span>
          <span className="chev">›</span>
        </button>

        <button className="set-signout" onClick={() => signOut(auth)}>
          Sign out
        </button>
      </div>

      {editingBuffer && <BufferSheet onClose={() => setEditingBuffer(false)} />}
      {browsing && <HistorySheet onClose={() => setBrowsing(false)} />}
    </div>
  )
}

function BufferSheet({ onClose }: { onClose: () => void }) {
  const { buffer, setBuffer } = useData()
  const [value, setValue] = useState(String(buffer.amount))

  return (
    <Sheet onClose={onClose}>
      <h2>Buffer</h2>
      <div className="field">
        <label htmlFor="buffer-amount">Held back from every day</label>
        <input
          id="buffer-amount"
          value={value}
          autoFocus
          inputMode="numeric"
          onChange={(event) => setValue(event.target.value)}
          placeholder="0"
        />
      </div>
      <div className="sheet-actions">
        <button className="btn btn-quiet" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            setBuffer(parseAmount(value) ?? 0, currentMonth())
            onClose()
          }}
        >
          Save
        </button>
      </div>
    </Sheet>
  )
}

/**
 * Past months, tucked away here rather than given a screen of their own —
 * month-by-month day editing lives in the Calendar, so what's left is reference.
 */
function HistorySheet({ onClose }: { onClose: () => void }) {
  const { items, days, buffer } = useData()
  const [month, setMonth] = useState<MonthKey>(addMonths(currentMonth(), -1))

  const figures = computeMonth(items, days, buffer, month)
  const wishlist = itemsInMonth(items, month, 'wishlist')
  const logged = spendSoFar(days, month)

  const lines: [string, string][] = [
    ['Base Income', money(figures.baseIncome)],
    ['Flex Income', money(figures.flexIncome)],
    ['Base Spend', money(figures.baseSpend)],
    ['Flex Spend', money(figures.flexSpend)],
    ['Surplus', money(figures.surplus)],
    ['Wishlist', money(figures.wishlist)],
    ['Buffer', `${money(figures.buffer)} / day`],
    ['Daily allowance', money(figures.dailyAllowance)],
    ['Logged spend', money(logged)],
    ['Money saved', money(figures.moneySaved)],
  ]

  return (
    <Sheet onClose={onClose}>
      <div className="cal-month">
        <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
          ‹
        </button>
        <span className="label">{monthLabel(month)}</span>
        <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
          ›
        </button>
      </div>

      <div>
        {lines.map(([key, value]) => (
          <div className="hist-line" key={key}>
            <span className="k">{key}</span>
            <span className="v num">{value}</span>
          </div>
        ))}
      </div>

      <div className="hist-section">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Wishlist that month
        </div>
        {wishlist.length === 0 && <div className="empty">Nothing on the list</div>}
        {wishlist.map((item) => (
          <div
            className="hist-line"
            key={item.id}
            style={
              item.purchased
                ? { textDecoration: 'line-through', color: 'var(--muted)' }
                : undefined
            }
          >
            <span className="k">{item.name}</span>
            <span className="v num">{money(amountInMonth(item, month) ?? 0)}</span>
          </div>
        ))}
      </div>

      <div className="sheet-actions">
        <button className="btn btn-quiet" onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  )
}
