import { signInWithPopup } from 'firebase/auth'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { auth, googleProvider } from '../firebase'

export function SignIn() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (user) return <Navigate to="/" replace />

  return (
    <main>
      <h1>gurgenBudget</h1>
      <button onClick={() => signInWithPopup(auth, googleProvider)}>
        Sign in with Google
      </button>
    </main>
  )
}
