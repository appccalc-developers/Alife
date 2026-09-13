import type { RamDraft, RamRisk } from '../types/ramGovernance'

export const ramSuggestionFields = ['hazard', 'consequence', 'controlMeasures', 'additionalAction'] as const
export const riskHasMissingFields = (risk: RamRisk) => !risk.activityId || !risk.categoryCode ||
  [risk.hazard, risk.consequence, risk.controlMeasures].some(value => !value?.en?.trim() && !value?.zh?.trim()) ||
  !risk.personResponsible?.trim() || [risk.likelihood, risk.impact, risk.residualLikelihood, risk.residualImpact].some(n => !Number.isInteger(n) || Number(n) < 1 || Number(n) > 5) ||
  ((risk.initialLevel === 'Yellow' || risk.residualLevel === 'Yellow') && !risk.additionalAction?.en?.trim() && !risk.additionalAction?.zh?.trim())

export function duplicateRamRisk(risk: RamRisk, id: string): RamRisk {
  return { ...structuredClone(risk), id, personResponsible: '', likelihood: null, impact: null, residualLikelihood: null, residualImpact: null, riskScore: null, residualScore: null, initialLevel: 'Incomplete', residualLevel: 'Incomplete' }
}

export const ramDraftFingerprint = (draft: RamDraft, conditions: string) => JSON.stringify([draft, conditions])
export function ramChanges(before: RamDraft, after: RamDraft): { key: string; before: unknown; after: unknown }[] {
  const rows: { key: string; before: unknown; after: unknown }[] = []
  for (const key of Object.keys(after).filter(k => !['activities', 'hazards', 'answers'].includes(k)))
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) rows.push({ key, before: before[key], after: after[key] })
  for (const collection of ['activities', 'hazards', 'answers'] as const) {
    const identity = (v: unknown) => { const x = v as { id?: string; activityId?: string; questionCode?: string }; return x.id || `${x.activityId}:${x.questionCode}` }
    const old = new Map(before[collection].map(v => [identity(v), v]))
    const current = new Map(after[collection].map(v => [identity(v), v]))
    for (const id of new Set([...old.keys(), ...current.keys()])) {
      const left = old.get(id), right = current.get(id)
      if (JSON.stringify(left) !== JSON.stringify(right)) rows.push({ key: `${collection}:${id}`, before: left, after: right })
    }
  }
  return rows
}
