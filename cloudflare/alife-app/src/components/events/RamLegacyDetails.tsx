import type { EventRamDraft } from '../../types/event'
import { displayRamText as text } from '../../types/ramGovernance'

/** Keep historical supporting facts readable without turning them into new signatures or ratings. */
export default function RamLegacyDetails({ json, zh, expanded = false }: { json: string; zh: boolean; expanded?: boolean }) {
  let legacy: Partial<EventRamDraft>
  try { legacy = JSON.parse(json) } catch { return null }
  const labels: Record<string, [string, string]> = {
    transportRequired: ['Transport required', '需要交通安排'], licensedDriverConfirmed: ['Driver licence checked', '已核查驾照'], vehicleRegistrationConfirmed: ['Vehicle registration checked', '已核查车辆登记'], vehicleWofConfirmed: ['Vehicle roadworthiness checked', '已核查车辆适路性'], venueRiskAssessed: ['Venue risks assessed', '已评估场地风险'], firstAidKitAvailable: ['First aid kit available', '急救包可用'], trainedFirstAiderName: ['First aider', '急救人员'], trainedFirstAiderQualificationConfirmed: ['First aid qualification checked', '已核查急救资质'], participantHealthNeedsReviewed: ['Participant support arrangements reviewed', '已审阅参与者支援安排'], weatherPlanReviewed: ['Weather plan reviewed', '已审阅天气计划'],
  }
  if (!legacy.activityDescription && !legacy.emergencyContacts?.length && !legacy.outingSafety) return null
  return <details open={expanded || undefined} className="space-y-3 rounded-xl border p-4"><summary className="min-h-11 cursor-pointer font-semibold">{zh ? '旧版补充资料（保留原记录）' : 'Legacy supporting information (original record)'}</summary>
    <p>{text(legacy.activityDescription, zh)}</p><p>{zh ? '年龄范围' : 'Age range'}: {text(legacy.participantAgeRange, zh)}</p>
    {legacy.emergencyContacts?.length ? <section><h3 className="font-semibold">{zh ? '原有紧急联系人' : 'Existing emergency contacts'}</h3>{legacy.emergencyContacts.map((contact, i) => <p key={i} className="text-sm">{text(contact.role, zh)} · {contact.name} · {contact.phone}</p>)}</section> : null}
    {legacy.outingSafety ? <dl className="space-y-2 text-sm">{Object.entries(legacy.outingSafety).map(([key, value]) => <div key={key}><dt className="inline font-semibold">{labels[key]?.[zh ? 1 : 0] || key}: </dt><dd className="inline">{value === true ? (zh ? '已确认' : 'Confirmed') : value === false ? (zh ? '否' : 'No') : value || '—'}</dd></div>)}</dl> : null}
    <p className="text-xs text-[#66766f]">{zh ? '这些历史事实不会自动构成新版剩余评估或本人签署。' : 'These historical facts do not constitute a new residual assessment or personal signature.'}</p>
  </details>
}
