import type { ReactElement } from 'react'

export type ShellNavItem = {
  key: string
  label: string
  description?: string
  to: string
  icon: ReactElement
  matchSearch?: string | string[]
  matchPathOnly?: boolean
  pageId?: string
  requireNoActivePage?: boolean
  actionOnly?: boolean
  onClick?: () => void
}

export type ShellNavSection = {
  key: string
  label: string
  description?: string
  items: ShellNavItem[]
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
  contentWorkspace: string
  currentSpace: string
  pagesSection: string
  eventsSection: string
  accountSection: string
}
