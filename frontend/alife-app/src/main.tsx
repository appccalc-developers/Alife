import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { registerServiceWorker } from './registerSW'
import './style.css'
import { AuthProvider } from './stores/auth'
import { CurrentGroupProvider } from './stores/currentGroup'
import { queryClient } from './db/queryClient'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CurrentGroupProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </CurrentGroupProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
