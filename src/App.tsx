import { signInWithPopup } from 'firebase/auth'
import { useEffect, useMemo, useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { DataProvider, useData } from './data/DataContext'
import { auth, googleProvider } from './firebase'
import { currentMonth, type MonthKey } from './lib/time'
import { CalendarScreen } from './screens/CalendarScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { MonthSetupScreen } from './screens/MonthSetupScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { WishlistScreen } from './screens/WishlistScreen'
import { Ring, type RingScreen } from './ui/Ring'

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

function Gate() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <SignIn />
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  )
}

function SignIn() {
  return (
    <div className="signin">
      <div className="wordmark">gurgenBudget</div>
      <p className="tagline">How much can I spend today?</p>
      <button onClick={() => signInWithPopup(auth, googleProvider)}>Continue with Google</button>
    </div>
  )
}

function Shell() {
  const { ready, saveError, clearSaveError } = useData()
  const [index, setIndex] = useState(0)
  // Lifted out of the Calendar so the month survives swiping away and back.
  const [viewMonth, setViewMonth] = useState<MonthKey>(currentMonth())

  // Month rollover is lazy: the app notices the date when it's opened or refocused.
  useEffect(() => {
    const check = () => {
      const now = currentMonth()
      setViewMonth((month) => (month < now ? now : month))
    }
    globalThis.addEventListener('focus', check)
    return () => globalThis.removeEventListener('focus', check)
  }, [])

  useEffect(() => {
    if (!saveError) return
    const timer = setTimeout(clearSaveError, 4000)
    return () => clearTimeout(timer)
  }, [saveError, clearSaveError])

  const screens = useMemo<RingScreen[]>(
    () => [
      { key: 'dashboard', render: () => <DashboardScreen /> },
      { key: 'wishlist', render: () => <WishlistScreen /> },
      { key: 'settings', render: () => <SettingsScreen /> },
      { key: 'baseIncome', render: () => <MonthSetupScreen category="baseIncome" /> },
      { key: 'flexIncome', render: () => <MonthSetupScreen category="flexIncome" /> },
      { key: 'baseSpend', render: () => <MonthSetupScreen category="baseSpend" /> },
      { key: 'flexSpend', render: () => <MonthSetupScreen category="flexSpend" /> },
      {
        key: 'calendar',
        render: () => <CalendarScreen month={viewMonth} onMonthChange={setViewMonth} />,
      },
    ],
    [viewMonth],
  )

  if (!ready) return null

  return (
    <>
      <Ring screens={screens} index={index} onIndexChange={setIndex} />
      {saveError && <div className="toast">{saveError}</div>}
    </>
  )
}
