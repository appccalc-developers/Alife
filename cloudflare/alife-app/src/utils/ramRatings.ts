import type { RamDraft, RamLevel, RamPolicyData, RamRisk } from '../types/ramGovernance'
export function previewRisk(risk: RamRisk, policy?: RamPolicyData): RamRisk {
  const valid = (n: number | null) => Number.isInteger(n) && n! >= 1 && n! <= 5
  const score = (l: number | null, i: number | null) => valid(l) && valid(i) ? l! * i! : null
  const level = (l: number | null, i: number | null): RamLevel => score(l,i) === null ? 'Incomplete' : policy?.matrix.find(c=>c.likelihood===l && c.impact===i)?.level || 'Incomplete'
  return {...risk,riskScore:score(risk.likelihood,risk.impact),residualScore:score(risk.residualLikelihood,risk.residualImpact),initialLevel:level(risk.likelihood,risk.impact),residualLevel:level(risk.residualLikelihood,risk.residualImpact)}
}
export function worstRamLevel(risks: RamRisk[]): RamLevel {
  if (!risks.length || risks.some(r=>r.residualLevel==='Incomplete'||!r.residualLevel)) return 'Incomplete'
  return risks.some(r=>r.residualLevel==='Red')?'Red':risks.some(r=>r.residualLevel==='Yellow')?'Yellow':'Green'
}
export const previewRam = (draft: RamDraft, policy?: RamPolicyData): RamDraft => ({...draft,hazards:draft.hazards.map(r=>previewRisk(r,policy))})
