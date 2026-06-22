import type { ReactElement } from 'react'

export type ShellNavItem = {
  key: string
  label: string
  to: string
  icon: ReactElement
  matchSearch?: string
  pageId?: string
  requireNoActivePage?: boolean
  actionOnly?: boolean
  onClick?: () => void
}

export type NavigationCopy = {
  alife: string
  memberAccount: string
  collapse: string
  expand: string
  menu: string
  openMenu: string
  closeMenu: string
  communityWorkspace: string
  platformWorkspace: string
}
