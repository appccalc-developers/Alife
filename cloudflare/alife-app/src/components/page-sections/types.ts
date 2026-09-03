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
export type SectionPreviewDensity = 'full' | 'compact'

export type SectionComponentProps = {
  section: SectionEditModel
  mode: SectionMode
  domId?: string
  page?: GroupPageDto
  pageId?: string
  groupPageItems?: PageLinkItem[]
  contextGroupId?: string
  allowGroupDataSources?: boolean
  sectionDomId?: string
  sectionRootClassName?: string
  disabled?: boolean
  editorPreview?: boolean
  previewDensity?: SectionPreviewDensity
  headingLevel?: 'h1' | 'h2'
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
