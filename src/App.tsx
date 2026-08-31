import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { DataProvider } from './data/DataContext'
import { History } from './routes/History'
import { SaveErrorBanner } from './routes/pages/SaveErrorBanner'
import { Ring } from './routes/Ring'
import { SignIn } from './routes/SignIn'

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <SaveErrorBanner />
        <HashRouter>
          <Routes>
            <Route path="/sign-in" element={<SignIn />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Ring />
                </RequireAuth>
              }
            />
            <Route
              path="/history"
              element={
                <RequireAuth>
                  <History />
                </RequireAuth>
              }
            />
          </Routes>
        </HashRouter>
      </DataProvider>
    </AuthProvider>
  )
}
