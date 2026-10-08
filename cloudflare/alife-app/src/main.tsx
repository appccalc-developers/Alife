import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AppProviders from './app/AppProviders'
import { applyDocumentLocale, getInitialLanguage } from './i18n/locale'
import { registerServiceWorker } from './registerSW'
import './styles/global.css'

applyDocumentLocale(getInitialLanguage())
// A fresh-origin performance run needs to observe direct network transport
// before a newly installed Service Worker claims and reloads the page. This
// opt-in diagnostic never changes normal PWA registration.
const networkOnly3DProfile = new URLSearchParams(window.location.search)
  .get('profile3dTransport') === 'network'

const renderApp = () => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
)

const workerReady = networkOnly3DProfile || registerServiceWorker()
if (typeof workerReady === 'boolean') {
  if (workerReady) renderApp()
} else {
  // A reused dev origin must clear an old production worker before React can
  // briefly paint its stale 3D bundle and then reload into the current one.
  void workerReady.then(shouldRender => { if (shouldRender) renderApp() })
}
