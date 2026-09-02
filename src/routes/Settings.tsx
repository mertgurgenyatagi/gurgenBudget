import { signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useData } from '../data/DataContext'
import { auth } from '../firebase'
import { currentMonth } from '../lib/time'

export function Settings() {
  const { user } = useAuth()
  const { buffer, setBuffer } = useData()
  const [percent, setPercent] = useState(String(buffer.percent))

  // Firestore's live value arrives asynchronously, after this component has
  // already mounted with the empty default — resync once the real value lands.
  useEffect(() => {
    setPercent(String(buffer.percent))
  }, [buffer.percent])

  function commitPercent() {
    const value = Number(percent)
    setBuffer(Number.isFinite(value) ? value : 0, buffer.mode, currentMonth())
  }

  return (
    <div className="screen set">
      <div className="top">
        <div className="lbl">Signed in as</div>
        <div className="email">{user?.email}</div>
      </div>
      <div className="bottom">
        <div className="row">
          <span>Buffer</span>
          <span className="buffer-field">
            <input
              className="buffer-input num"
              type="text"
              inputMode="decimal"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              onBlur={commitPercent}
            />
            <span>%</span>
          </span>
        </div>
        <div className="toggle2">
          <button
            className={buffer.mode === 'surplus' ? 'active' : ''}
            onClick={() => setBuffer(buffer.percent, 'surplus', currentMonth())}
          >
            Of surplus
          </button>
          <button
            className={buffer.mode === 'slice' ? 'active' : ''}
            onClick={() => setBuffer(buffer.percent, 'slice', currentMonth())}
          >
            Of full slice
          </button>
        </div>
        <div className="signout" onClick={() => signOut(auth)}>
          Sign out
        </div>
      </div>
    </div>
  )
}
