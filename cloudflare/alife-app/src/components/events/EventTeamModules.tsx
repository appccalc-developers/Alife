import { ChevronDown } from 'lucide-react'
import { ArrangementRoles, roleStatusLabel, type ArrangementRoleState } from './EventArrangementRoles'
import { EventToolSection } from './ArrangementTileDeck'

export default function EventTeamModules({ state, eventId, zh, onSaved, onBusy, moduleSelections }: {
  state: ArrangementRoleState; eventId: string; zh: boolean; onSaved: () => Promise<void>; onBusy: (value: boolean) => void; moduleSelections?: Record<string, boolean>
}) {
  const modules = (state.data?.enabledModules ?? []).filter(module => moduleSelections?.[module.moduleCode] !== false)
  return <EventToolSection title={zh ? '已启用模块负责人' : 'Enabled module responsibilities'} summary={zh ? `${modules.length} 个模块` : `${modules.length} modules`}>
    <div className="divide-y divide-violet-200/70 overflow-hidden rounded-xl border border-violet-200 bg-violet-50/60">{modules.map(module => {
      const roles = (state.data?.roleRequirements ?? []).filter(role => (role.moduleCode || role.requirementKey.split(':')[0]) === module.moduleCode).map(role => ({ ...role, moduleCode: module.moduleCode, maximum: role.maximum ?? null, eligibility: role.eligibility ?? [], separationFrom: role.separationFrom ?? [] }))
      const assignments = state.data?.roles.filter(role => roles.some(requirement => requirement.requirementKey === role.roleRequirementKey) && role.status !== 'ended' && !role.endedUtc) ?? []
      const overview = assignments.map(role => `${state.candidates.find(member => member.id === role.memberId)?.displayName || state.data?.members.find(member => member.memberId === role.memberId)?.displayName || role.memberId} · ${roleStatusLabel(role.status, zh)}`).join(zh ? '；' : '; ') || (zh ? '待分配' : 'Unassigned')
      return <details key={module.moduleCode} className="group" data-team-module={module.moduleCode}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600 [&::-webkit-details-marker]:hidden"><span className="min-w-0 flex-1"><strong className="block text-violet-900">{module.label[zh ? 'zh' : 'en']}</strong><span className="block truncate text-xs text-[#66766f]" title={overview}>{overview}</span></span><ChevronDown size={16} className="shrink-0 text-violet-800 group-open:rotate-180" aria-hidden="true" /></summary>
        <div className="border-t border-violet-200/70 bg-white px-3 pb-2">{roles.length ? <ArrangementRoles compact roles={roles} state={state} eventId={eventId} zh={zh} onSaved={onSaved} onBusy={onBusy} /> : <p className="py-2 text-sm">{zh ? '活动总负责人统筹' : 'Coordinated by the event owner'}</p>}</div>
      </details>
    })}</div>
    {!modules.length ? <p className="text-sm text-[#66766f]">{zh ? '暂无已启用模块' : 'No enabled modules'}</p> : null}
  </EventToolSection>
}
