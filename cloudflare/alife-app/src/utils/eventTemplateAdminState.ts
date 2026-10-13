import type { AdminEventActivityTemplate, AdminEventActivityTemplateValues } from '../types/eventTemplateAdmin'
import { validActivityAttributes } from '../../../shared/activityAttributes.ts'
import { generalProjectQuestionCodes, movedEventQuestionFacts, projectQuestionCodes, validProjectAnswerValue } from '../types/eventProjectQuestionnaire.ts'

export type EventTemplateAdminForm = AdminEventActivityTemplateValues & {
  code: string
  archetypeCode: string
}

export const emptyEventTemplateAdminForm = (archetypeCode = 'simple-social'): EventTemplateAdminForm => ({
  code: '',
  archetypeCode,
  name: { en: '', zh: '' },
  description: { en: '', zh: '' },
  iconKey: 'people',
  defaults: { visibility: 'groupVisible', registrationMode: 'none', capacityUnit: 'People' },
  preselectedModules: [],
  recommendedWorkflowTemplateCode: null,
  presetServiceSlots: [],
  presetProjects: [],
  isActive: true,
})

export const eventTemplateToAdminForm = (value: AdminEventActivityTemplate): EventTemplateAdminForm => ({
  code: value.template.code,
  archetypeCode: value.template.archetypeCode,
  name: { ...value.template.name },
  description: { ...value.template.description },
  iconKey: value.template.iconKey,
  defaults: { ...value.template.defaults },
  preselectedModules: [...value.template.preselectedModules],
  recommendedWorkflowTemplateCode: null,
  presetServiceSlots: value.template.presetServiceSlots.map((slot) => ({
    ...slot,
    label: { ...slot.label },
  })),
  presetProjects: structuredClone(value.template.presetProjects ?? []),
  isActive: value.isActive,
})

export const normalizeEventTemplateCode = (value: string) => value.trim().toLowerCase()

export const validateEventTemplateAdminForm = (
  form: EventTemplateAdminForm,
  allowedArchetypes: ReadonlySet<string>,
  allowedModules: ReadonlySet<string>,
  allowedIcons: ReadonlySet<string>,
): string | null => {
  if (!/^[a-z][a-z0-9-]{2,79}$/.test(normalizeEventTemplateCode(form.code))) return 'code'
  if (!allowedArchetypes.has(form.archetypeCode)) return 'archetype'
  if (!form.name.en.trim() || !form.name.zh.trim()) return 'name'
  if (!form.description.en.trim() || !form.description.zh.trim()) return 'description'
  if (!allowedIcons.has(form.iconKey)) return 'icon'
  if (form.preselectedModules.some((code) => !allowedModules.has(code))) return 'modules'
  if (form.presetProjects.length > 50 || new Set(form.presetProjects.map(project => project.presetKey)).size !== form.presetProjects.length || form.presetProjects.some(project => !/^[a-z][a-z0-9-]{0,79}$/.test(project.presetKey) || !project.name.en.trim() || !project.name.zh.trim() || project.name.en.length > 300 || project.name.zh.length > 300 || typeof project.conditions.en !== 'string' || typeof project.conditions.zh !== 'string' || project.conditions.en.length > 4000 || project.conditions.zh.length > 4000 || !validActivityAttributes(project.attributes) || typeof project.repeatForEachOccurrence !== 'boolean' || Object.entries(project.defaultAnswers).some(([code, value]) => !projectQuestionCodes.includes(code as typeof projectQuestionCodes[number]) || !validProjectAnswerValue(value)))) return 'projects'
  if (new Set(form.preselectedModules).size !== form.preselectedModules.length) return 'modules'
  if (form.presetServiceSlots.length && !form.preselectedModules.includes('SERVICE.ROSTER')) return 'roster-module'
  if (form.preselectedModules.includes('SERVICE.ROSTER') && !form.presetServiceSlots.length) return 'roster-slots'
  const roleCodes = form.presetServiceSlots.map((slot) => slot.roleCode.trim())
  if (new Set(roleCodes).size !== roleCodes.length) return 'slot-code'
  if (form.presetServiceSlots.some((slot) => !/^[a-z][a-z0-9.]{1,79}$/.test(slot.roleCode.trim()) || !slot.label.en.trim() || !slot.label.zh.trim() || slot.requiredCount < 1 || slot.requiredCount > 999 || slot.eligibilityCode !== 'approvedGroupMember')) return 'slot'
  return null
}

export const toCreateEventTemplateRequest = (form: EventTemplateAdminForm) => ({
  ...toUpdateEventTemplateRequest(form),
  code: normalizeEventTemplateCode(form.code),
  archetypeCode: form.archetypeCode,
})

export const toUpdateEventTemplateRequest = (form: EventTemplateAdminForm): AdminEventActivityTemplateValues => ({
  name: { en: form.name.en.trim(), zh: form.name.zh.trim() },
  description: { en: form.description.en.trim(), zh: form.description.zh.trim() },
  iconKey: form.iconKey,
  defaults: { ...form.defaults, capacityUnit: 'People' },
  preselectedModules: [...new Set(form.preselectedModules)].sort(),
  recommendedWorkflowTemplateCode: null,
  presetServiceSlots: form.presetServiceSlots.map((slot) => ({
    roleCode: slot.roleCode.trim(),
    label: { en: slot.label.en.trim(), zh: slot.label.zh.trim() },
    requiredCount: Number(slot.requiredCount),
    eligibilityCode: 'approvedGroupMember',
  })),
  presetProjects: form.presetProjects.map(project => ({ ...project, name: { en: project.name.en.trim(), zh: project.name.zh.trim() }, conditions: { en: project.conditions.en.trim(), zh: project.conditions.zh.trim() }, attributes: [...project.attributes], defaultAnswers: {
    ...Object.fromEntries(Object.entries(project.defaultAnswers).filter(([code]) => !(code in movedEventQuestionFacts))),
    ...Object.fromEntries(generalProjectQuestionCodes.map(code => [code, project.defaultAnswers[code] === 'yes' ? 'yes' : 'no'])),
  } })),
  isActive: form.isActive,
})
