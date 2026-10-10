import { eventSetupFlowText } from '../i18n/eventSetupFlow.ts'
export const setupStages = ['details', 'arrangements', 'review', 'approval', 'poster', 'publish'] as const
export type SetupStage = typeof setupStages[number]
import type { EventLifecycle, EventPackage, EventPackageActorCapabilities } from '../types/eventPackage'
export const canPublishFromFlow = (item: EventPackage | null, lifecycle: EventLifecycle | null, capabilities: EventPackageActorCapabilities | null) =>
  Boolean(item && (item.status === 'approved' || item.status === 'approvedWithConditions') && item.approvalValidityStatus === 'active' &&
    capabilities?.canPublish && lifecycle?.gates.some(gate => gate.gate === 'publish' && gate.allowed && gate.requirementsSatisfied))
export const resolveSetupStage = (value: string | null): SetupStage => setupStages.includes(value as SetupStage) ? value as SetupStage : 'arrangements'
export const setupPath = (eventBasePath: string, stage: SetupStage | 'setup', module?: string) =>
  `${eventBasePath}/workspace?flow=setup&stage=${resolveSetupStage(stage)}${module ? `&module=${encodeURIComponent(module)}` : ''}`
export const eventFlowLabels = (zh: boolean) => zh
  ? [...eventSetupFlowText.localizedCopy.zh]
  : [...eventSetupFlowText.localizedCopy.en]
export const canVisitSetupStep = (step: number, frozen: boolean, approved: boolean) =>
  step === 5 || (step >= 2 && step <= 4 && !frozen) || (step >= 6 && step <= 7 && approved)
export const publicationAudience = (visibility: string, zh: boolean) => visibility === 'public'
  ? (zh ? eventSetupFlowText.thePublicWebsiteAndApplicableChurchLifeAndGroup.zh : eventSetupFlowText.thePublicWebsiteAndApplicableChurchLifeAndGroup.en)
  : visibility === 'churchVisible'
    ? (zh ? eventSetupFlowText.authorisedChurchAndOwningGroupMembersInChurchLife.zh : eventSetupFlowText.authorisedChurchAndOwningGroupMembersInChurchLife.en)
    : (zh ? eventSetupFlowText.theOwningGroupSGroupLifeVisibleOnlyTo.zh : eventSetupFlowText.theOwningGroupSGroupLifeVisibleOnlyTo.en)
