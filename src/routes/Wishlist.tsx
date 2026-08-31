import { lira } from '../money'

// Placeholder items — no Firestore behind these yet.
const ITEMS = [
  { name: 'New guitar', amount: 28000, purchased: false },
  { name: 'Sneakers', amount: 4200, purchased: false },
  { name: 'Concert tickets', amount: 2500, purchased: true },
  { name: 'Weekend trip', amount: 15000, purchased: false },
  { name: 'Wireless earbuds', amount: 3800, purchased: true },
]

const MONEY_SAVED = 56900

export function Wishlist() {
  return (
    <div className="screen wish">
      <div className="head">Wishlist</div>
      {ITEMS.map((item) => (
        // Purchased items stay in the list, struck through — never moved out.
        <div className={item.purchased ? 'row bought' : 'row'} key={item.name}>
          <span>{item.name}</span>
          <span className="num">{lira(item.amount)}</span>
        </div>
      ))}
      <div className="foot">
        <span className="lbl">Money saved</span>
        <span className="num">{lira(MONEY_SAVED)}</span>
      </div>
    </div>
  )
}
