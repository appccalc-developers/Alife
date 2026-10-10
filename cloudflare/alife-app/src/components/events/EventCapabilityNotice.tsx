import { eventCapabilityNoticeText } from '../../i18n/eventCapabilityNotice.ts'
import { useQuery } from '@tanstack/react-query'
import { http } from '../../services/http'

export type EventCapability = { moduleCode: string; status: 'coreAvailable' | 'partial' | 'unavailable'; description: { en: string; zh: string } }
export const capabilityFallback: EventCapability[] = [
  { moduleCode: 'MONEY.FINANCE', status: 'partial', description: { ...eventCapabilityNoticeText.moneyFinanceDescription } },
  { moduleCode: 'FOOD.HOSPITALITY', status: 'partial', description: { ...eventCapabilityNoticeText.foodHospitalityDescription } },
  { moduleCode: 'FESTIVAL.OPERATIONS', status: 'unavailable', description: { ...eventCapabilityNoticeText.festivalOperationsDescription } },
  { moduleCode: 'COMMS.FOLLOWUP', status: 'partial', description: { ...eventCapabilityNoticeText.commsFollowupDescription } },
]
export const capabilityStatusText = (status: EventCapability['status'], zh: boolean) => status === 'unavailable' ? (zh ? eventCapabilityNoticeText.notYetAvailable.zh : eventCapabilityNoticeText.notYetAvailable.en) : status === 'partial' ? (zh ? eventCapabilityNoticeText.partlyAvailable.zh : eventCapabilityNoticeText.partlyAvailable.en) : (zh ? eventCapabilityNoticeText.coreToolsAvailable.zh : eventCapabilityNoticeText.coreToolsAvailable.en)
export function useEventCapabilities() {
  const current = useQuery({ queryKey: ['event-capabilities'], queryFn: async () => (await http.get<EventCapability[]>('/api/event-capabilities')).data, staleTime: 300_000, retry: false }).data
  return [...capabilityFallback.filter(item => !current?.some(value => value.moduleCode === item.moduleCode)), ...(current || [])]
}
export default function EventCapabilityNotice({ code, zh }: { code: string; zh: boolean }) {
  const capability = useEventCapabilities().find(item => item.moduleCode === code)
  if (!capability || capability.status === 'coreAvailable') return null
  return <div data-capability-status={capability.status} className="my-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>{capabilityStatusText(capability.status, zh)}</strong><p className="mt-1">{capability.description[zh ? 'zh' : 'en']}</p><p className="mt-1 text-xs">{zh ? eventCapabilityNoticeText.enablingOrConfirmingDetailsDoesNotCompleteThisCapability.zh : eventCapabilityNoticeText.enablingOrConfirmingDetailsDoesNotCompleteThisCapability.en}</p></div>
}
