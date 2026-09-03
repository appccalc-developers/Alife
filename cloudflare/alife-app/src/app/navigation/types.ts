import type { ReactElement } from 'react'

export type ShellNavBadge = {
  text: string
  compactText: string
  accessibleLabel: string
  tone: 'attention' | 'neutral' | 'urgent' | 'general'
}

export type ShellNavItem = {
  key: string
  label: string
  description?: string
  to: string
  icon: ReactElement
  matchSearch?: string | string[]
  matchPathOnly?: boolean
  matchDescendants?: boolean
  pageId?: string
  requireNoActivePage?: boolean
  actionOnly?: boolean
  onClick?: () => void
  badge?: ShellNavBadge
  badges?: ShellNavBadge[]
  children?: ShellNavItem[]
}

export type ShellNavSection = {
  key: string
  label: string
  description?: string
  to?: string
  icon?: ReactElement
  collapsible?: boolean
  showDescription?: boolean
  toggleOnHeaderClick?: boolean
  alignToBottom?: boolean
  matchDescendants?: boolean
  items: ShellNavItem[]
}

export type NavigationCopy = {
  alife: string
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
