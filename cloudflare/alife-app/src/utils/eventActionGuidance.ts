import type { EventLifecycle, EventPackageApprovalDelegation } from '../types/eventPackage'

export const preparationAreas: Record<string, [string, string]> = {
  'TEAM.WORK': ['Team and tasks', '团队与任务'],
  'PEOPLE.REGISTRATION': ['Registration rules', '报名设置'],
  'SERVICE.ROSTER': ['Roles and shifts', '岗位与轮班'],
  'SAFETY.RAM': ['Risk assessment', '风险评估'],
  'SAFEGUARDING.CHILD': ['Child safeguarding', '儿童保护'],
  'PROGRAM.PRODUCTION': ['Programme', '节目安排'],
  'PLACE.RESOURCE': ['Venue and resources', '场地与资源'],
  'MOVE.STAY': ['Transport and accommodation', '交通与住宿'],
  'MONEY.FINANCE': ['Registration fees', '报名费用'],
  'FOOD.HOSPITALITY': ['Food and hospitality', '餐饮接待'],
  'COMMS.FOLLOWUP': ['Communication and follow-up', '通知与跟进'],
}

export const preparationAreaLabel = (code: string, zh: boolean) => preparationAreas[code.toUpperCase()]?.[zh ? 1 : 0] ?? (zh ? '相关筹备事项' : 'Related preparation')
export const knownPreparationArea = (code: string) => Object.hasOwn(preparationAreas, code.toUpperCase())
export const gateLabel = (gate: string, zh: boolean) => ({ publish: zh ? '发布' : 'Publish', registration: zh ? '报名' : 'Registration', payment: zh ? '收款' : 'Payment', execute: zh ? '执行' : 'Delivery' }[gate] ?? (zh ? '活动操作' : 'Event action'))

type Gate = EventLifecycle['gates'][number]
export type GateIssue = { key: string; blocker: Gate['blockers'][number]; gates: string[]; scopeType: Gate['scopeType']; scopeId?: string | null; packageVersion?: number | null; warningsOnly: boolean }

// Combine only the same requirement and evidence scope. Never merge different
// occurrence evidence or treat navigation as resolving the server requirement.
export function groupGateIssues(gates: Gate[]): GateIssue[] {
  const issues = new Map<string, GateIssue>()
  for (const gate of gates) for (const [warning, items] of [[false, gate.blockers], [true, gate.warnings]] as const) for (const blocker of items) {
    const reason = blocker.code.split('.').at(-1) ?? blocker.code
    const normalized = ['packageNotApproved', 'approvalDecisionMissing', 'approvalQuorumMissing'].includes(reason) ? 'approvalMissing' : reason
    const key = JSON.stringify([normalized, blocker.nextAction, blocker.responsibleRole, blocker.message, gate.scopeType, gate.scopeId, gate.eventPackageVersion, gate.governancePolicyVersion])
    const existing = issues.get(key)
    if (existing) { if (!existing.gates.includes(gate.gate)) existing.gates.push(gate.gate); existing.warningsOnly &&= warning }
    else issues.set(key, { key, blocker, gates: [gate.gate], scopeType: gate.scopeType, scopeId: gate.scopeId, packageVersion: gate.eventPackageVersion, warningsOnly: warning })
  }
  return [...issues.values()]
}

export function gateStateLabel(gate: Gate, zh: boolean) {
  if (!gate.allowed) return zh ? '暂不可操作' : 'Not available'
  if (gate.enforcementMode === 'off') return zh ? '未启用此检查' : 'Check disabled'
  if (gate.enforcementMode === 'dryRun') return gate.requirementsSatisfied ? (zh ? '试运行 · 检查满足' : 'Trial · checks met') : (zh ? '试运行 · 有待完善' : 'Trial · attention needed')
  return gate.requirementsSatisfied ? (zh ? '条件已满足' : 'Requirements met') : (zh ? '有待完善' : 'Attention needed')
}

export const packageStatusLabel = (value: string, zh: boolean) => ({
  draft: ['Not submitted', '待提交'], submitted: ['Awaiting decision', '待审批'], returnedForAmendment: ['Changes requested', '需修改后重提'], rejected: ['Not approved', '未获批准'], approvedWithConditions: ['Approved with conditions', '附条件批准'], approved: ['Approved', '已批准'], withdrawn: ['Withdrawn', '已撤回'], superseded: ['Replaced by a newer version', '已有新版本'],
  notDecided: ['No decision yet', '尚无批准决定'], active: ['Approval valid', '批准有效'], invalidated: ['Approval needs renewal', '需重新审批'], expired: ['Approval expired', '批准已过期'], revoked: ['Approval revoked', '批准已撤销'],
}[value]?.[zh ? 1 : 0] ?? (zh ? '状态待核对' : 'Status needs review'))

export function eventDelegations(items: EventPackageApprovalDelegation[], eventId: string, now = Date.now()) {
  return items.filter(item => item.scopeType === 'event' && item.scopeId === eventId && !item.revokedUtc && new Date(item.expiresUtc).getTime() > now)
}

export const futureDelegationExpiry = (value: string, now = Date.now()) => Boolean(value && Number.isFinite(new Date(value).getTime()) && new Date(value).getTime() > now)

export const eventStageHelp = (stage: string, zh: boolean) => ({
  preparation: ['Arrange people, venue and safety, then submit the plan for approval.', '安排人员、场地与安全事项，核对方案后提交审批。'],
  registration: ['Publish the approved event and manage registration. Publication does not automatically open registration.', '发布已获批准的活动，处理报名。发布与开放报名是两个独立操作。'],
  execution: ['Handle the selected date’s duties, check-in and on-site coordination.', '处理具体场次的岗位、签到与现场协作。'],
  followup: ['Complete remaining tasks, feedback and event follow-up.', '完成后续任务、反馈及活动回顾。'],
}[stage]?.[zh ? 1 : 0] ?? '')
