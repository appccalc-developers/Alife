import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AppProviders from './app/AppProviders'
import { applyDocumentLocale, getInitialLanguage } from './i18n/locale'
import { registerServiceWorker } from './registerSW'
import './styles/global.css'

applyDocumentLocale(getInitialLanguage())
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
)
