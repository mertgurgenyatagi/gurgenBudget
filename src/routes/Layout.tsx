import { signOut } from 'firebase/auth'
import { NavLink, Outlet } from 'react-router-dom'
import { auth } from '../firebase'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/log', label: 'Log' },
  { to: '/month', label: 'Month Setup' },
  { to: '/wishlist', label: 'Wishlist' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
]

export function Layout() {
  return (
    <div>
      <header>
        <span>gurgenBudget</span>
        <button onClick={() => signOut(auth)}>Sign out</button>
      </header>
      <main>
        <Outlet />
      </main>
      <nav>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
