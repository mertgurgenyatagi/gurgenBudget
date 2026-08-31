import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { Dashboard } from './routes/Dashboard'
import { DailyLog } from './routes/DailyLog'
import { History } from './routes/History'
import { Layout } from './routes/Layout'
import { MonthSetup } from './routes/MonthSetup'
import { Settings } from './routes/Settings'
import { SignIn } from './routes/SignIn'
import { Wishlist } from './routes/Wishlist'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/sign-in" element={<SignIn />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/log" element={<DailyLog />} />
            <Route path="/month" element={<MonthSetup />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
