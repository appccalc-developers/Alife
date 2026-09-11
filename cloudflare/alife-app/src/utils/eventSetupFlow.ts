export const setupStages = ['details', 'arrangements', 'review', 'setup', 'approval', 'poster', 'publish'] as const
export type SetupStage = typeof setupStages[number]
import type { EventLifecycle, EventPackage, EventPackageActorCapabilities } from '../types/eventPackage'
export const canPublishFromFlow = (item: EventPackage | null, lifecycle: EventLifecycle | null, capabilities: EventPackageActorCapabilities | null) =>
  Boolean(item && (item.status === 'approved' || item.status === 'approvedWithConditions') && item.approvalValidityStatus === 'active' &&
    capabilities?.canPublish && lifecycle?.gates.some(gate => gate.gate === 'publish' && gate.allowed && gate.requirementsSatisfied))
export const resolveSetupStage = (value: string | null): SetupStage => setupStages.includes(value as SetupStage) ? value as SetupStage : 'setup'
export const setupPath = (eventBasePath: string, stage: SetupStage, module?: string) =>
  `${eventBasePath}/workspace?flow=setup&stage=${stage}${module ? `&module=${encodeURIComponent(module)}` : ''}`
export const eventFlowLabels = (zh: boolean) => zh
  ? ['选择模板', '活动资料', '活动安排', '确认创建', '团队与功能', '正式审批', '海报制作', '发布活动']
  : ['Template', 'Details', 'Arrangements', 'Create', 'Team and tools', 'Approval', 'Poster', 'Publish']
export const canVisitSetupStep = (step: number, frozen: boolean, approved: boolean) =>
  step === 6 || (step >= 2 && step <= 5 && !frozen) || (step >= 7 && approved)
export const publicationAudience = (visibility: string, zh: boolean) => visibility === 'public'
  ? (zh ? '公共网站，以及符合范围的教会生活和小组生活。' : 'The public website, and applicable Church Life and Group Life views.')
  : visibility === 'churchVisible'
    ? (zh ? '教会生活及所属小组中有权限的成员；匿名访客不可见。' : 'Authorised church and owning-group members in Church Life and Group Life; hidden from anonymous visitors.')
    : (zh ? '所属小组生活，仅有权限的小组成员可见。' : 'The owning group’s Group Life, visible only to authorised group members.')
