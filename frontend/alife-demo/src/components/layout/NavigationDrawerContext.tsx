import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

export type NavigationDrawerState = {
  title?: string
  content?: ReactNode
}

type NavigationDrawerContextValue = {
  drawer: NavigationDrawerState
  setDrawer: (next: NavigationDrawerState) => void
  openDrawer: () => void
  closeDrawer: () => void
}

export const NavigationDrawerContext = createContext<NavigationDrawerContextValue | null>(null)

export const useNavigationDrawer = () => {
  const context = useContext(NavigationDrawerContext)

  if (!context) {
    throw new Error('useNavigationDrawer must be used within NavigationDrawerContext.Provider')
  }

  return context
}
