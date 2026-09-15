import type { RamText } from './ramGovernance'
export type PlannedActivity = { id: string; type: string; name: RamText; conditions: RamText; occurrenceId?: string | null }
export type ActivityPlanData = { activities: PlannedActivity[]; participantCount: number | null; isOuting: boolean; isOvernight: boolean; isHighRisk: boolean; weatherConfirmation: RamText }
export type ActivityPlanView = { data: ActivityPlanData; eTag: string; canEdit: boolean; legacyCandidate?: ActivityPlanData | null; reports: { moduleCode: string; text: RamText; version: number }[] }
export const emptyActivityPlan = (): ActivityPlanData => ({ activities: [], participantCount: null, isOuting: false, isOvernight: false, isHighRisk: false, weatherConfirmation: {en:'',zh:''} })
export function validStoredActivityPlan(value: unknown): value is ActivityPlanData {
  if (!value || typeof value !== 'object') return false
  const p=value as ActivityPlanData
  const bilingual=(t:unknown)=>!!t&&typeof t==='object'&&typeof (t as RamText).en==='string'&&typeof (t as RamText).zh==='string'&&(t as RamText).en.length<=4000&&(t as RamText).zh.length<=4000
  return Array.isArray(p.activities)&&p.activities.length<=50&&p.activities.every(a=>a&&typeof a.id==='string'&&a.id.length<=80&&typeof a.type==='string'&&bilingual(a.name)&&bilingual(a.conditions)&&(a.occurrenceId==null||typeof a.occurrenceId==='string'))&&new Set(p.activities.map(a=>a.id)).size===p.activities.length&&['isOuting','isOvernight','isHighRisk'].every(k=>typeof p[k as keyof ActivityPlanData]==='boolean')&&(p.participantCount===null||Number.isInteger(p.participantCount)&&p.participantCount>0&&p.participantCount<=1000000)&&(p.weatherConfirmation==null||bilingual(p.weatherConfirmation))
}
