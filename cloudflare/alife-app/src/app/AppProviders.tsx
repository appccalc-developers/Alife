import type { PropsWithChildren } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { queryClient } from '../db/queryClient'
import { AuthProvider } from '../stores/auth'
import { CurrentGroupProvider } from '../stores/currentGroup'

const AppProviders = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CurrentGroupProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </CurrentGroupProvider>
    </AuthProvider>
  </QueryClientProvider>
)

export default AppProviders
