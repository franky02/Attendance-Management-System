import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import { installButtonFeedback } from './feedback'

// A soft click and tiny vibration for every button (see src/feedback.ts).
installButtonFeedback()

// Ask Android not to clear this app's stored data when space runs low.
void navigator.storage?.persist?.().catch(() => {})

// Open the connection to the database early, so the first save is quick.
const sb = import.meta.env.VITE_SUPABASE_URL as string | undefined
if (sb) {
  const l = document.createElement('link')
  l.rel = 'preconnect'
  l.href = new URL(sb).origin
  l.crossOrigin = 'anonymous'
  document.head.appendChild(l)
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
