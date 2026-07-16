import { useEffect, type PropsWithChildren } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { queryClient } from '../db/queryClient'
import { AuthProvider } from '../stores/auth'
import { CurrentGroupProvider } from '../stores/currentGroup'
import UnsavedChangesModalHost from '../components/layout/UnsavedChangesModalHost'
import AuthBootstrapGate from './components/AuthBootstrapGate'

const LocalDevHostRedirect = () => {
  useEffect(() => {
    if (!import.meta.env.DEV || window.location.hostname !== '127.0.0.1') {
      return
    }

    const url = new URL(window.location.href)
    url.hostname = 'localhost'
    window.location.replace(url.toString())
  }, [])

  return null
}

const AppProviders = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <AuthBootstrapGate>
          <CurrentGroupProvider>
            <LocalDevHostRedirect />
            {children}
            <UnsavedChangesModalHost />
          </CurrentGroupProvider>
        </AuthBootstrapGate>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
)

export default AppProviders
