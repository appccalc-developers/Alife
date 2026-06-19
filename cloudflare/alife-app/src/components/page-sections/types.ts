import type { ReactNode } from 'react'
import type { GroupPageDto } from '../../types/group'
import type { LocalizedText } from '../../types'
import type { JsonMap, SectionEditModel } from '../../types/page-editor'

export type PageLinkItem = {
  id: string
  title: string | LocalizedText
  visibility: string
}

export type SectionMode = 'render' | 'edit'

export type SectionComponentProps = {
  section: SectionEditModel
  mode: SectionMode
  page?: GroupPageDto
  groupPageItems?: PageLinkItem[]
  contextGroupId?: string
  disabled?: boolean
  propertiesOnly?: boolean
  showProperties?: boolean
  onUpdate?: (section: SectionEditModel) => void
}

export type EditableTextProps = {
  value: string
  fallback: string
  disabled?: boolean
  className: string
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
  multiline?: boolean
  onChange?: (value: string) => void
}

export type PropertyPanelProps = {
  children: ReactNode
}

export type PatchSection = (patch: Partial<SectionEditModel>) => void
export type PatchJson = (patch: JsonMap) => void
