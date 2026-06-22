import type { ReactElement } from 'react'

export type ShellFabItem = {
  label: string
  icon: ReactElement
  tone: 'manage' | 'edit' | 'save' | 'exit'
  onClick: () => void
}
