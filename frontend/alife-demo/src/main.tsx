import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { registerServiceWorker } from './registerSW'
import './style.css'
import { AuthProvider } from './stores/auth'
import { CurrentGroupProvider } from './stores/currentGroup'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CurrentGroupProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </CurrentGroupProvider>
    </AuthProvider>
  </StrictMode>,
)
