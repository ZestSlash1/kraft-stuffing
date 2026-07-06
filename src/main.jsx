import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles/global.css'
import App from './App.jsx'
import PublicTrackView from './views/PublicTrackView.jsx'

// Public tracking links (/t/:token) render a shell-free, auth-free page — no App
// data machinery, no Supabase auth, no service worker takeover of the authed app.
const isPublicTrack = window.location.pathname.startsWith('/t/')

if ('serviceWorker' in navigator && !isPublicTrack) registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPublicTrack ? <PublicTrackView /> : <App />}
  </StrictMode>,
)
