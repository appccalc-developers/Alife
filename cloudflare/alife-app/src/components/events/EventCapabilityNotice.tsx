import { useQuery } from '@tanstack/react-query'
import { http } from '../../services/http'

export type EventCapability = { moduleCode: string; status: 'coreAvailable' | 'partial' | 'unavailable'; description: { en: string; zh: string } }
export const capabilityFallback: EventCapability[] = [
  { moduleCode: 'MONEY.FINANCE', status: 'unavailable', description: { en: 'Budget, fees, claims and reconciliation tools are not available yet.', zh: '预算、收费、报销和对账工具尚未提供。' } },
  { moduleCode: 'FOOD.HOSPITALITY', status: 'unavailable', description: { en: 'Menu, dietary needs and food-service tools are not available yet.', zh: '菜单、饮食需求及餐饮筹备工具尚未提供。' } },
  { moduleCode: 'FESTIVAL.OPERATIONS', status: 'unavailable', description: { en: 'Zone operations, command and incident tools are not available yet.', zh: '分区运营、现场指挥和事件处理工具尚未提供。' } },
  { moduleCode: 'COMMS.FOLLOWUP', status: 'partial', description: { en: 'Event content, posters and publication are available. Audience-confirmed broadcasts, delivery tracking and follow-up are not yet provided.', zh: '已有活动文案、海报和发布功能；收件人确认、广播发送、投递追踪及跟进流程尚未提供。' } },
]
export const capabilityStatusText = (status: EventCapability['status'], zh: boolean) => status === 'unavailable' ? (zh ? '尚未提供' : 'Not yet available') : status === 'partial' ? (zh ? '部分提供' : 'Partly available') : (zh ? '核心功能可用' : 'Core tools available')
export function useEventCapabilities() {
  const current = useQuery({ queryKey: ['event-capabilities'], queryFn: async () => (await http.get<EventCapability[]>('/api/event-capabilities')).data, staleTime: 300_000, retry: false }).data
  return [...capabilityFallback.filter(item => !current?.some(value => value.moduleCode === item.moduleCode)), ...(current || [])]
}
export default function EventCapabilityNotice({ code, zh }: { code: string; zh: boolean }) {
  const capability = useEventCapabilities().find(item => item.moduleCode === code)
  if (!capability || capability.status === 'coreAvailable') return null
  return <div data-capability-status={capability.status} className="my-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>{capabilityStatusText(capability.status, zh)}</strong><p className="mt-1">{capability.description[zh ? 'zh' : 'en']}</p><p className="mt-1 text-xs">{zh ? '启用或确认资料不代表此业务已完成；必需功能的审批检查仍然适用。' : 'Enabling or confirming details does not complete this capability. Required approval checks still apply.'}</p></div>
}
