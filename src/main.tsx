import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Nudge Chrome for Android into collapsing its dynamic toolbar. It only
// does that in response to an actual scroll; #root's 100vh (index.css)
// gives the page 1px of genuine scroll room to consume for this. Once
// collapsed, the visible area grows to fill 100vh and there's nothing
// left to scroll into, so it stays collapsed without any further JS.
const collapseToolbar = () => window.scrollTo(0, 1)
collapseToolbar()
window.addEventListener('orientationchange', () => setTimeout(collapseToolbar, 50))
