import type { EventActivityType, LocalizedText } from './eventComposition'

type EventActivityTypeDefaults = EventActivityType['defaults']
type EventActivityTypeServiceSlotPreset = EventActivityType['presetServiceSlots'][number]

export type AdminEventArchetype = {
  code: string
  version: number
  name: LocalizedText
  isMutable: false
  activeTemplateCount: number
  totalTemplateCount: number
}

export type AdminEventTemplateModuleOption = {
  code: string
  name: LocalizedText
  dataClasses: string[]
}

export type AdminEventActivityTemplate = {
  template: EventActivityType
  isActive: boolean
  isSystemPreset: boolean
  eTag: string
  updatedUtc: string
}

export type AdminPagedResult<T> = {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export type AdminEventActivityTemplateCatalog = {
  archetypes: AdminEventArchetype[]
  templates: AdminPagedResult<AdminEventActivityTemplate>
  moduleOptions: AdminEventTemplateModuleOption[]
  iconKeys: string[]
  workflowTemplateCodes: string[]
  canManage: boolean
}

export type AdminEventActivityTemplateValues = {
  name: LocalizedText
  description: LocalizedText
  iconKey: string
  defaults: EventActivityTypeDefaults
  preselectedModules: string[]
  recommendedWorkflowTemplateCode: string | null
  presetServiceSlots: EventActivityTypeServiceSlotPreset[]
  isActive: boolean
}

export type CreateAdminEventActivityTemplateRequest = AdminEventActivityTemplateValues & {
  code: string
  archetypeCode: string
}

export type UpdateAdminEventActivityTemplateRequest = AdminEventActivityTemplateValues

export type EventTemplateAdminFilters = {
  search?: string
  archetypeCode?: string
  status?: 'all' | 'active' | 'inactive'
  sortBy?: 'name' | 'code' | 'category' | 'updated'
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}
