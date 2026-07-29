import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles/global.css'
import App from './App.jsx'
import PublicTrackView from './views/PublicTrackView.jsx'
import OAuthCallbackView from './views/mail/OAuthCallbackView.jsx'

// Public tracking links (/t/:token) render a shell-free, auth-free page — no App
// data machinery, no Supabase auth, no service worker takeover of the authed app.
const isPublicTrack = window.location.pathname.startsWith('/t/')

// Microsoft redirects here after the Outlook OAuth2 consent screen (see ConnectView's
// "Connect with Microsoft" + api/mail/oauth-microsoft.js). Same reasoning as the public
// track view — a dedicated shell-free page, not routed through App's state machine.
const isMailOAuthCallback = window.location.pathname === '/mail-oauth-callback'

if ('serviceWorker' in navigator && !isPublicTrack) registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPublicTrack ? <PublicTrackView /> : isMailOAuthCallback ? <OAuthCallbackView /> : <App />}
  </StrictMode>,
)
