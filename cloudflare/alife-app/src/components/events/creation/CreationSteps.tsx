import useConfirmation from '../../../hooks/useConfirmation'
import { eventProjectQuestionnaireText as projectCopy } from '../../../i18n/eventProjectQuestionnaire'
import { creationStepsText } from '../../../i18n/creationSteps.ts'
import { ActivityPlanEditor } from '../EventActivityPlanPanel'
import { emptyActivityPlan } from '../../../types/eventActivityPlan'
import EventCapabilityNotice, { capabilityStatusText, useEventCapabilities } from '../EventCapabilityNotice'
import '../../../styles/eventPreparation.css'
import EventPreparationOverview from '../EventPreparationOverview'
import type { EventWorkspaceItem, Readiness } from '../../../types/eventComposition'
import type { DetailsFocusRequest } from './DetailsWorkspace'
export { default as DetailsWorkspace } from './DetailsWorkspace'
export { default as DetailsStep } from './DetailsStep'
import { creationMessage } from '../../../utils/eventCreationCopy'
import { useCallback, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import AppSectionCard from '../../layout/AppSectionCard'
import AppBadge from '../../layout/AppBadge'
import type { EventActivityType, EventArchetype, EventPlanProposal, ModuleDecision } from '../../../types/eventComposition'
import { localText } from './CreationFields'
import { CreationProgrammeEditor, CreationRosterEditor, CreationVenueEditor, creationRosterModule } from './CreationArrangementEditors'
import { TileButtons, ModuleDraftBoundary, ToolTileDeck, ToolTileGroup, EventToolSection, focusTilePanel, revealArrangementControl } from '../ArrangementTileDeck'
import { Users, UserRoundCheck, CalendarCheck, ShieldCheck, Baby, Music, MapPin, Tent, Bus, Utensils, Wallet, MessagesSquare, Power } from 'lucide-react'
import CreationArrangementSummary from './CreationArrangementSummary'
import { creationSlots, validateCreationArrangements } from '../../../utils/eventCreationArrangements'
export { creationInput, localText } from './CreationFields'
import { ArrangementRoles } from '../EventArrangementRoles'
import { creationModuleCodes, confirmArrangementModule, invalidateArrangementConfirmation, selectArrangementModule, creationSettings, selectCreationTemplate, type CreationDraft } from '../../../utils/eventCreationDraft'

const choice = (selected: boolean) => `min-h-11 rounded-xl border px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#176b5a]/40 ${selected ? 'border-[#176b5a] bg-[#e3f0eb] text-[#0d4f43]' : 'border-[#2f4b42]/20 bg-white text-[#40554e]'}`
type DraftProps = { draft: CreationDraft; setDraft: Dispatch<SetStateAction<CreationDraft>>; zh: boolean; questionDefinitions?: import('../../../types/eventProjectQuestionnaire').EventProjectQuestionDefinition[] }
export const visibilityText = (value: string, zh: boolean) => value === 'public' ? (zh ? creationStepsText.public.zh : creationStepsText.public.en) : value === 'churchVisible' ? (zh ? creationStepsText.churchOnly.zh : creationStepsText.churchOnly.en) : (zh ? creationStepsText.groupOnly.zh : creationStepsText.groupOnly.en)
const arrangementDate = (start: string, end: string) => start.slice(0, 10) === end.slice(0, 10) ? `${start.replace('T', ' ')} – ${end.slice(11)}` : `${start.replace('T', ' ')} – ${end.replace('T', ' ')}`

export function TemplateStep({ draft, setDraft, zh, archetypes, type }: DraftProps & { archetypes: EventArchetype[]; type: EventActivityType | null }) {
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const chooseTemplate = async (item: EventActivityType) => {
    if (draft.activityTypeCode === item.code) return
    if ((draft.activityPlan?.activities.length || draft.activityTypeCode) && !await requestConfirmation({ title: localText(projectCopy.switchTitle,zh), description: localText(projectCopy.switchDescription,zh), confirmLabel: localText(projectCopy.applyTemplate,zh) })) return
    setDraft(current=>selectCreationTemplate(current,item))
  }
  const category = archetypes.find(x => x.code === draft.archetypeCode)
  return <AppSectionCard title={zh ? creationStepsText.chooseAnEventTemplate.zh : creationStepsText.chooseAnEventTemplate.en} subtitle={zh ? creationStepsText.chooseACategoryAndATemplateYouCanAdjust.zh : creationStepsText.chooseACategoryAndATemplateYouCanAdjust.en}>
    <div role="group" aria-label={zh ? creationStepsText.eventCategory.zh : creationStepsText.eventCategory.en} className="grid grid-cols-2 gap-2 desktop:grid-cols-4">
      {archetypes.map(item => <button key={item.code} type="button" aria-pressed={draft.archetypeCode === item.code} className={choice(draft.archetypeCode === item.code)} onClick={() => setDraft(current => current.archetypeCode === item.code ? current : { ...current, archetypeCode: item.code, activityTypeCode: '' })}>{localText(item.name, zh)}<span className="mt-1 block text-xs">{item.activityTypes.length} {zh ? creationStepsText.templates.zh : creationStepsText.templates.en}</span></button>)}
    </div>
    {!category ? <p className="mt-4 text-sm text-[#66766f]">{zh ? creationStepsText.chooseACategoryAbove.zh : creationStepsText.chooseACategoryAbove.en}</p> : !category.activityTypes.length ? <p className="mt-4 text-sm">{zh ? creationStepsText.noActiveTemplatesInThisCategoryChooseAnotherCategory.zh : creationStepsText.noActiveTemplatesInThisCategoryChooseAnotherCategory.en}</p> : <div className="mt-4 grid gap-2 md:grid-cols-2" role="group" aria-label={zh ? creationStepsText.eventTemplate.zh : creationStepsText.eventTemplate.en}>{category.activityTypes.map(item => <button key={item.code} type="button" aria-pressed={type?.code === item.code} className={choice(type?.code === item.code)} onClick={() => void chooseTemplate(item)}><strong className="block">{localText(item.name, zh)}</strong><span className="mt-1 block text-sm leading-6 text-[#66766f]">{localText(item.description, zh)}</span><span className="mt-2 block text-xs">{visibilityText(item.defaults.visibility, zh)} · {item.defaults.registrationMode === 'required' ? (zh ? creationStepsText.registrationNeeded.zh : creationStepsText.registrationNeeded.en) : (zh ? creationStepsText.noRegistration.zh : creationStepsText.noRegistration.en)}</span></button>)}</div>}
    {type && category ? <div className="mt-4 rounded-xl bg-[#e3f0eb] p-3 text-sm" role="status"><strong>{zh ? creationStepsText.selected.zh : creationStepsText.selected.en}{localText(type.name, zh)}</strong><p className="mt-1">{category.isSeries ? (zh ? creationStepsText.repeatsWeeklyWithTheNext12WeeksScheduledAhead.zh : creationStepsText.repeatsWeeklyWithTheNext12WeeksScheduledAhead.en) : category.hasZones ? (zh ? creationStepsText.oneEventWithMultipleSessionsAndAreas.zh : creationStepsText.oneEventWithMultipleSessionsAndAreas.en) : category.hasSessions ? (zh ? creationStepsText.oneEventWithMultipleSessions.zh : creationStepsText.oneEventWithMultipleSessions.en) : (zh ? creationStepsText.oneEvent.zh : creationStepsText.oneEvent.en)}</p><p className="mt-1 text-[#40554e]">{zh ? creationStepsText.templateSuggestionsDoNotConfirmFactsAboutThisEvent.zh : creationStepsText.templateSuggestionsDoNotConfirmFactsAboutThisEvent.en}</p></div> : null}
  {confirmationModal}</AppSectionCard>
}

const reasonCopy: Record<string, [string, string]> = {
  'accountable-owner-required': [creationStepsText.everyEventNeedsAnAccountableTeam.en, creationStepsText.everyEventNeedsAnAccountableTeam.zh],
  'policy-accountable-owner': [creationStepsText.everyEventNeedsAnAccountableTeam.en, creationStepsText.everyEventNeedsAnAccountableTeam.zh],
  'registration-enabled': [creationStepsText.registrationIsRequiredForThisEvent.en, creationStepsText.registrationIsRequiredForThisEvent.zh],
  'public-discovery': [creationStepsText.recommendedForAPublicEvent.en, creationStepsText.recommendedForAPublicEvent.zh],
  'service-slots-required': [creationStepsText.youConfirmedVolunteersAreNeeded.en, creationStepsText.youConfirmedVolunteersAreNeeded.zh],
  'money-flow-present': [creationStepsText.youConfirmedMoneyWillBeCollectedOrSpent.en, creationStepsText.youConfirmedMoneyWillBeCollectedOrSpent.zh],
  'ram-policy-triggered': [creationStepsText.youConfirmedARamReviewIsRequired.en, creationStepsText.youConfirmedARamReviewIsRequired.zh],
  'children-present': [creationStepsText.youConfirmedChildrenWillParticipate.en, creationStepsText.youConfirmedChildrenWillParticipate.zh],
  'managed-programme': [creationStepsText.youConfirmedProgrammeCoordinationIsNeeded.en, creationStepsText.youConfirmedProgrammeCoordinationIsNeeded.zh],
  'managed-place-or-resource': [creationStepsText.youConfirmedVenueOrResourceManagementIsNeeded.en, creationStepsText.youConfirmedVenueOrResourceManagementIsNeeded.zh],
  'transport-required': [creationStepsText.youConfirmedTransportWillBeArranged.en, creationStepsText.youConfirmedTransportWillBeArranged.zh],
  'accommodation-required': [creationStepsText.youConfirmedAccommodationWillBeArranged.en, creationStepsText.youConfirmedAccommodationWillBeArranged.zh],
  'food-service': [creationStepsText.youConfirmedFoodServiceIsNeeded.en, creationStepsText.youConfirmedFoodServiceIsNeeded.zh],
  'multi-zone-live-operation': [creationStepsText.youConfirmedMultipleLiveAreasAreNeeded.en, creationStepsText.youConfirmedMultipleLiveAreasAreNeeded.zh],
  'followup-required': [creationStepsText.youConfirmedOrganisedFollowUpIsNeeded.en, creationStepsText.youConfirmedOrganisedFollowUpIsNeeded.zh],
  'event-communications': [creationStepsText.recommendedForEventCommunications.en, creationStepsText.recommendedForEventCommunications.zh],
  'human-selected': [creationStepsText.addedByYou.en, creationStepsText.addedByYou.zh],
  'human-selected-with-reason': [creationStepsText.addedByYou.en, creationStepsText.addedByYou.zh],
}
export const moduleReason = (decision: ModuleDecision, zh: boolean) => [...new Set(decision.reasonCodes.map(reason => {
  if (reasonCopy[reason]) return reasonCopy[reason][zh ? 1 : 0]
  if (reason.startsWith('activity-type:')) return zh ? creationStepsText.suggestedByTheSelectedTemplate.zh : creationStepsText.suggestedByTheSelectedTemplate.en
  if (reason.startsWith('dependency:')) return zh ? creationStepsText.requiredByAnotherEnabledFeature.zh : creationStepsText.requiredByAnotherEnabledFeature.en
  return zh ? creationStepsText.determinedByTheServerFromEventArrangementsAndRules.zh : creationStepsText.determinedByTheServerFromEventArrangementsAndRules.en
}))].join(' ')

function ModuleResult({ decision, zh }: { decision: ModuleDecision; zh: boolean; questionDefinitions?: import('../../../types/eventProjectQuestionnaire').EventProjectQuestionDefinition[] }) {
  return <div className="rounded-xl bg-[#f5f2eb] p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{localText(decision.label, zh)}</strong><AppBadge variant={decision.status === 'required' ? 'warning' : 'neutral'}>{decision.status === 'required' ? (zh ? creationStepsText.required.zh : creationStepsText.required.en) : (zh ? creationStepsText.enabled.zh : creationStepsText.enabled.en)}</AppBadge></div><p className="mt-1 text-[#66766f]">{moduleReason(decision, zh)}</p><EventCapabilityNotice code={decision.moduleCode} zh={zh} /></div>
}

const tileMeta: Record<string, { en: string; zh: string; color: string; accent: string; ink: string; icon: ReactNode }> = {
  'TEAM.WORK': { en: creationStepsText.teamWork.en, zh: creationStepsText.teamWork.zh, color: '#F5F3FF', accent: '#7C3AED', ink: '#5B21B6', icon: <Users size={20} /> },
  'PEOPLE.REGISTRATION': { en: creationStepsText.peopleRegistration.en, zh: creationStepsText.peopleRegistration.zh, color: '#EFF6FF', accent: '#2563EB', ink: '#1E40AF', icon: <UserRoundCheck size={20} /> },
  'SERVICE.ROSTER': { en: creationStepsText.serviceRoster.en, zh: creationStepsText.serviceRoster.zh, color: '#F5F3FF', accent: '#7C3AED', ink: '#5B21B6', icon: <CalendarCheck size={20} /> },
  'SAFETY.RAM': { en: creationStepsText.safetyRam.en, zh: creationStepsText.safetyRam.zh, color: '#FFFBEB', accent: '#D97706', ink: '#92400E', icon: <ShieldCheck size={20} /> },
  'SAFEGUARDING.CHILD': { en: creationStepsText.safeguardingChild.en, zh: creationStepsText.safeguardingChild.zh, color: '#FDF4FF', accent: '#C026D3', ink: '#86198F', icon: <Baby size={20} /> },
  'PROGRAM.PRODUCTION': { en: creationStepsText.programProduction.en, zh: creationStepsText.programProduction.zh, color: '#EEF2FF', accent: '#4F46E5', ink: '#3730A3', icon: <Music size={20} /> },
  'PLACE.RESOURCE': { en: creationStepsText.placeResource.en, zh: creationStepsText.placeResource.zh, color: '#F0F9FF', accent: '#0284C7', ink: '#075985', icon: <MapPin size={20} /> },
  'FESTIVAL.OPERATIONS': { en: creationStepsText.festivalOperations.en, zh: creationStepsText.festivalOperations.zh, color: '#FFF1F2', accent: '#E11D48', ink: '#9F1239', icon: <Tent size={20} /> },
  'MOVE.STAY': { en: creationStepsText.moveStay.en, zh: creationStepsText.moveStay.zh, color: '#FFF7ED', accent: '#EA580C', ink: '#9A3412', icon: <Bus size={20} /> },
  'FOOD.HOSPITALITY': { en: creationStepsText.foodHospitality.en, zh: creationStepsText.foodHospitality.zh, color: '#FFF7ED', accent: '#EA580C', ink: '#9A3412', icon: <Utensils size={20} /> },
  'MONEY.FINANCE': { en: creationStepsText.moneyFinance.en, zh: creationStepsText.moneyFinance.zh, color: '#F0FDFA', accent: '#0F766E', ink: '#134E4A', icon: <Wallet size={20} /> },
  'COMMS.FOLLOWUP': { en: creationStepsText.commsFollowup.en, zh: creationStepsText.commsFollowup.zh, color: '#FFF1F2', accent: '#E11D48', ink: '#9F1239', icon: <MessagesSquare size={20} /> },
}
function ArrangementModule({ draft, setDraft, zh, decision, current, type, groupId, saved = false, ramPanel, ramDirty = false, readOnly = false, modulePanels, rolePanels, activeModules = [], questionDefinitions }: DraftProps & { activeModules?: string[]; decision: ModuleDecision; current: boolean; type: EventActivityType; groupId: string; saved?: boolean; ramPanel?: ReactNode; ramDirty?: boolean; readOnly?: boolean; modulePanels?: Record<string, ReactNode>; rolePanels?: Record<string, ReactNode> }) {
  const planningOnly = ['MONEY.FINANCE', 'FOOD.HOSPITALITY', 'FESTIVAL.OPERATIONS', 'COMMS.FOLLOWUP'].includes(decision.moduleCode)
  const required = !saved && decision.status === 'required'
  const mandatory = decision.moduleCode === 'TEAM.WORK'
  const locked = mandatory || !current || decision.moduleCode === 'FESTIVAL.OPERATIONS' || (saved && decision.moduleCode === 'SAFETY.RAM' && ramDirty)
  const selected = decision.moduleCode !== 'FESTIVAL.OPERATIONS' && (mandatory || required || (draft.moduleOverrides[decision.moduleCode] ?? decision.status !== 'inactive'))
  const editorProps = { draft, setDraft, zh, type, groupId }
  const toggle = <button type="button" role="switch" aria-checked={selected} aria-label={`${localText(decision.label, zh)} · ${zh ? creationStepsText.enableFeature.zh : creationStepsText.enableFeature.en}`} disabled={locked} className="event-module-switch" onClick={() => setDraft(previous => selectArrangementModule(previous, decision.moduleCode, !selected))}><Power size={14} aria-hidden="true" /><span>{selected ? (zh ? creationStepsText.on.zh : creationStepsText.on.en) : (zh ? creationStepsText.off.zh : creationStepsText.off.en)}</span></button>
  return <ToolTileDeck zh={zh}>
    <EventToolSection defaultOpen title={zh ? creationStepsText.settingsAndResponsibilities.zh : creationStepsText.settingsAndResponsibilities.en} summary={selected ? moduleReason(decision, zh) : (zh ? creationStepsText.notUsedForThisEvent.zh : creationStepsText.notUsedForThisEvent.en)} headerAction={toggle}>
      <fieldset disabled={!current} className="space-y-3"><div className="flex flex-wrap items-center gap-2">{required || mandatory ? <AppBadge variant="warning">{zh ? creationStepsText.requiredLabel.zh : creationStepsText.requiredLabel.en}</AppBadge> : null}<span className="text-sm text-[#66766f]">{selected ? (zh ? creationStepsText.thisFeatureIsPartOfThisEvent.zh : creationStepsText.thisFeatureIsPartOfThisEvent.en) : (zh ? creationStepsText.thisFeatureIsNotPartOfThisEvent.zh : creationStepsText.thisFeatureIsNotPartOfThisEvent.en)}</span></div>
      <EventCapabilityNotice code={decision.moduleCode} zh={zh} />
      <div hidden={!selected}>{rolePanels?.[decision.moduleCode]}</div></fieldset>
    </EventToolSection>
    <ToolTileGroup enabled={selected}><fieldset disabled={readOnly} className="min-w-0">
      {!saved && decision.moduleCode === 'TEAM.WORK' ? <EventToolSection title={zh ? creationStepsText.activitiesAndConditions.zh : creationStepsText.activitiesAndConditions.en} summary={`${draft.activityPlan?.activities.length || 0} ${zh ? creationStepsText.activities.zh : creationStepsText.activities.en}`}><ActivityPlanEditor groupId={groupId} timeZone={draft.timeZone} registrationMode={creationSettings(draft,type).registrationMode} eventAnswers={draft.factValues} questionDefinitions={questionDefinitions} data={draft.activityPlan || emptyActivityPlan()} zh={zh} onChange={activityPlan=>setDraft(previous=>({...previous,activityPlan,moduleConfirmations:{...previous.moduleConfirmations,'TEAM.WORK':false,'SAFETY.RAM':false}}))}/></EventToolSection> : null}
      {decision.moduleCode === 'SAFETY.RAM' ? ramPanel : saved ? modulePanels?.[decision.moduleCode] ?? (!planningOnly ? <p className="text-sm text-[#66766f]">{zh ? creationStepsText.saveArrangementsToConfigureToolsAvailableToYourRole.zh : creationStepsText.saveArrangementsToConfigureToolsAvailableToYourRole.en}</p> : null) : ['SAFEGUARDING.CHILD', 'PROGRAM.PRODUCTION', 'MOVE.STAY', 'FOOD.HOSPITALITY', 'COMMS.FOLLOWUP'].includes(decision.moduleCode) ? <p className="text-sm">{zh ? creationStepsText.afterSavingTheEventTheModuleLeadWritesA.zh : creationStepsText.afterSavingTheEventTheModuleLeadWritesA.en}</p> : decision.moduleCode === 'PROGRAM.PRODUCTION' ? <EventToolSection title={zh ? creationStepsText.programmePlan.zh : creationStepsText.programmePlan.en} summary={zh ? creationStepsText.sessionsItems.zh(draft.arrangements?.sessions?.length || 0, draft.arrangements?.sessions?.reduce((count, session) => count + session.items.length, 0) || 0) : creationStepsText.sessionsItems.en(draft.arrangements?.sessions?.length || 0, draft.arrangements?.sessions?.reduce((count, session) => count + session.items.length, 0) || 0)}><CreationProgrammeEditor {...editorProps} /></EventToolSection> : decision.moduleCode === 'PLACE.RESOURCE' ? <EventToolSection title={zh ? creationStepsText.venuePlan.zh : creationStepsText.venuePlan.en} summary={zh ? creationStepsText.venueBookings.zh(draft.arrangements?.venues?.length || 0) : creationStepsText.venueBookings.en(draft.arrangements?.venues?.length || 0)}><CreationVenueEditor {...editorProps} /></EventToolSection> : null}
      {!saved && decision.moduleCode !== 'TEAM.WORK' && decision.moduleCode !== 'SAFETY.RAM' && activeModules.includes('SERVICE.ROSTER') ? <EventToolSection title={zh ? creationStepsText.roleShifts.zh : creationStepsText.roleShifts.en} summary={zh ? creationStepsText.roleSlots.zh(creationSlots(draft, type).filter(slot => decision.moduleCode === 'SERVICE.ROSTER' || creationRosterModule(slot.roleCode, activeModules) === decision.moduleCode).length) : creationStepsText.roleSlots.en(creationSlots(draft, type).filter(slot => decision.moduleCode === 'SERVICE.ROSTER' || creationRosterModule(slot.roleCode, activeModules) === decision.moduleCode).length)}><CreationRosterEditor {...editorProps} moduleCode={decision.moduleCode} activeModules={activeModules} /></EventToolSection> : null}
    </fieldset></ToolTileGroup>
  </ToolTileDeck>
}

export function ArrangementsStep({ draft, setDraft, readOnly = false, zh, type, proposal, current, status, groupId, saved = false, ramPanel, ramDirty = false, modulePanels, rolePanels, ownerPanel, detailsPanel, detailsDraft = draft, detailsDirty = false, detailsFocusRequest, focusModule, savedModules = {}, onUnsavedTools, editorial, questionDefinitions }: DraftProps & { editorial?: { onSelectModule: (code: string | null) => void; readiness?: Readiness; workspaceItems: EventWorkspaceItem[]; onReview: () => void; reviewDisabled: boolean }; onUnsavedTools?: (dirty: boolean) => void; savedModules?: Record<string, number>; type: EventActivityType; ownerPanel?: ReactNode; detailsPanel?: (active: boolean) => ReactNode; detailsDraft?: CreationDraft; detailsDirty?: boolean; detailsFocusRequest?: DetailsFocusRequest; proposal: EventPlanProposal | null; current: boolean; status: ReactNode; groupId: string; saved?: boolean; ramPanel?: ReactNode; ramDirty?: boolean; readOnly?: boolean; modulePanels?: Record<string, ReactNode>; rolePanels?: Record<string, ReactNode>; focusModule?: string | null }) {
  const [active, setActive] = useState<string | null>(null), [visited, setVisited] = useState<string[]>([])
  const [showAllModules, setShowAllModules] = useState(false)
  const capabilities = useEventCapabilities()
  const [toolDrafts, setToolDrafts] = useState<Record<string, Record<string, boolean>>>({})
  const reportDraft = useCallback((code: string, id: string, dirty: boolean) => {
    setToolDrafts(previous => previous[code]?.[id] === dirty ? previous : ({ ...previous, [code]: { ...previous[code], [id]: dirty } }))
    if (dirty) setDraft(previous => invalidateArrangementConfirmation(previous, code))
  }, [setDraft])
  const unsavedTools = Object.values(toolDrafts).some(group => Object.values(group).some(Boolean))
  useEffect(() => { onUnsavedTools?.(unsavedTools) }, [onUnsavedTools, unsavedTools])
  const [confirmationError, setConfirmationError] = useState('')
  const grid = useRef<HTMLDivElement>(null), panelsRef = useRef<HTMLDivElement>(null), savedRef = useRef(savedModules)
  const decisions = proposal?.moduleDecisions ?? []
  const focusedMode = Boolean(editorial && saved)
  const relevantModules = decisions.filter(item => draft.moduleOverrides[item.moduleCode] ?? item.status !== 'inactive')
  const moduleChoices = [...(!focusedMode && showAllModules ? decisions : relevantModules)].sort((a, b) => Number(a.moduleCode === 'SAFETY.RAM') - Number(b.moduleCode === 'SAFETY.RAM'))
  const relatedCount = relevantModules.length
  const totalCount = decisions.length || creationModuleCodes.length
  const visibleIds = new Set(moduleChoices.map(item => item.moduleCode))
  const moduleSignature = (code: string) => JSON.stringify([draft.moduleOverrides[code], draft.moduleConfirmations?.[code] ?? false,
    code === 'PROGRAM.PRODUCTION' ? draft.arrangements?.sessions : code === 'PLACE.RESOURCE' ? draft.arrangements?.venues : code === 'SERVICE.ROSTER' ? draft.arrangements?.slots : null])
  const [baseline, setBaseline] = useState<Record<string, string>>(() => Object.fromEntries(creationModuleCodes.map(code => [code, moduleSignature(code)])))
  const edited = Object.fromEntries(decisions.map(item => [item.moduleCode, baseline[item.moduleCode] !== moduleSignature(item.moduleCode)]))
  const focusModulePanel = (element: HTMLElement | null) => {
    if (focusedMode && element?.id.startsWith('module-heading-')) {
      // Reveal the navigation as well as the heading, below the live-height savebar.
      // A fixed heading offset can hide the back button when mobile actions wrap.
      element.focus({ preventScroll: true })
      const root = panelsRef.current?.closest<HTMLElement>('.event-editorial')
      const navigation = panelsRef.current?.parentElement?.querySelector<HTMLElement>('.event-editorial-editor-nav')
      const savebar = root?.querySelector<HTMLElement>('.event-editorial-savebar')
      if (navigation) {
        const top = savebar ? parseFloat(getComputedStyle(savebar).top) + savebar.offsetHeight + 12 : 88
        window.scrollTo({ left: 0, top: window.scrollY + navigation.getBoundingClientRect().top - top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      }
      return
    }
    focusTilePanel(element, focusedMode || !window.matchMedia('(min-width: 1024px)').matches)
  }
  const choose = (code: string) => { const next = active === code ? null : code; setActive(next); setVisited(previous => previous.includes(code) ? previous : [...previous, code]); setConfirmationError(''); editorial?.onSelectModule(next); requestAnimationFrame(() => next ? focusModulePanel(document.getElementById(`module-heading-${code}`)) : focusModulePanel(grid.current?.querySelector<HTMLButtonElement>(`[data-arrangement-tile="${code}"]`) ?? null)) }
  useEffect(() => { if (detailsFocusRequest) { setActive('EVENT.DETAILS'); setVisited(previous => previous.includes('EVENT.DETAILS') ? previous : [...previous, 'EVENT.DETAILS']); editorial?.onSelectModule('EVENT.DETAILS') } }, [detailsFocusRequest])
  const focusedLink = useRef<string | null>(null)
  const target = focusModule === 'EVENT.DETAILS' ? focusModule : decisions.find(item => item.moduleCode === focusModule?.toUpperCase())?.moduleCode
  useEffect(() => { if (!target) { focusedLink.current = null; if (focusedMode) setActive(null); return }; if (focusedLink.current === target) return; focusedLink.current = target; setActive(target); setVisited(previous => previous.includes(target) ? previous : [...previous, target]); requestAnimationFrame(() => focusModulePanel(document.getElementById(`module-heading-${target}`))) }, [target, focusedMode])
  useEffect(() => { if (!focusedMode && active && active !== 'EVENT.DETAILS' && !visibleIds.has(active)) setActive(null) }, [active, visibleIds, focusedMode])
  useEffect(() => { const changed = Object.keys(savedModules).filter(code => savedModules[code] !== savedRef.current[code]); savedRef.current = savedModules; if (changed.length) setBaseline(previous => ({ ...previous, ...Object.fromEntries(changed.map(code => [code, moduleSignature(code)])) })) }, [savedModules, draft])
  const issue = !saved && current && proposal ? validateCreationArrangements(draft, type, proposal, zh) : ''
  const confirmModuleDetails = (code: string, checked: boolean) => {
    if (checked && proposal) {
      const error = !saved ? validateCreationArrangements(draft, type, proposal, zh, code) : ''
      const controls = panelsRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')
      const invalid = Array.from(controls || []).find(control => !control.disabled && !control.closest('[hidden]') && !control.validity.valid)
      if (error) { setConfirmationError(error); if (invalid) revealArrangementControl(invalid); return }
      if (!saved && invalid) { revealArrangementControl(invalid); invalid.reportValidity(); return }
    }
    setConfirmationError(''); setDraft(previous => confirmArrangementModule(previous, code, checked, decisions))
  }
  const defaultRoles = Object.fromEntries(decisions.map(decision => [decision.moduleCode, <ArrangementRoles key={decision.moduleCode} roles={proposal?.roleRequirements.filter(role => role.moduleCode === decision.moduleCode && role.roleCode !== 'event.accountableOwner') ?? []} zh={zh} compact />]))
  const modeToggleLabel = showAllModules ? (zh ? creationStepsText.showRelatedModules.zh(relatedCount, totalCount) : creationStepsText.showRelatedModules.en(relatedCount, totalCount)) : (zh ? creationStepsText.showAllModules.zh(totalCount) : creationStepsText.showAllModules.en(totalCount))
  const modeToggle = <button type="button" className="inline-flex min-h-11 max-w-[60%] shrink-0 items-center justify-center rounded-xl border border-[#2f4b42]/25 bg-[#f9f9f9] px-3 py-2 text-sm font-semibold" aria-pressed={showAllModules} onClick={() => setShowAllModules(value => !value)}>{modeToggleLabel}</button>
  return <div className="event-arrangements-pilot space-y-4" data-arrangement-overview>{status}
    {focusedMode && active ? <div className="event-editorial-editor-nav">
      <button type="button" onClick={() => choose(active)}>{zh ? creationStepsText.backToPreparationOverview.zh : creationStepsText.backToPreparationOverview.en}</button>
      <label>{zh ? creationStepsText.currentArea.zh : creationStepsText.currentArea.en}<select value={active} onChange={event => choose(event.target.value)}>
        <option value="EVENT.DETAILS">{zh ? creationStepsText.eventDetails.zh : creationStepsText.eventDetails.en}</option>
        {decisions.map(item => <option key={item.moduleCode} value={item.moduleCode}>{localText(item.label, zh)}</option>)}
      </select></label>
    </div> : null}
    {!focusedMode && !detailsPanel ? <div className="flex justify-end">{modeToggle}</div> : null}
    <div ref={grid} hidden={focusedMode && Boolean(active)} className="space-y-3">{editorial && saved ? <EventPreparationOverview draft={detailsDraft} typeName={type.name} owner={ownerPanel} active={active} onSelect={choose} zh={zh} dirty={detailsDirty} {...editorial} domains={moduleChoices.map(decision => ({ decision, enabled: draft.moduleOverrides[decision.moduleCode] ?? decision.status !== 'inactive', dirty: Object.values(toolDrafts[decision.moduleCode] || {}).some(Boolean) || edited[decision.moduleCode] || (decision.moduleCode === 'SAFETY.RAM' && ramDirty), workspaceItem: editorial.workspaceItems.find(item => item.moduleCode === decision.moduleCode), ...tileMeta[decision.moduleCode], capability: capabilities.find(c => c.moduleCode === decision.moduleCode && c.status !== 'coreAvailable') ? capabilityStatusText(capabilities.find(c => c.moduleCode === decision.moduleCode)!.status, zh) : undefined }))} /> : <>{detailsPanel ? <div data-event-details-card data-selected={active === 'EVENT.DETAILS'} className="event-arrangement-context">
      <header className="event-arrangement-context-header"><h2 className="flex min-h-11 min-w-0 items-center gap-2 break-words font-semibold"><CalendarCheck size={20} className="shrink-0" /><span className="min-w-0">{localText(type.name, zh)}</span></h2>{modeToggle}</header>
      <button type="button" data-arrangement-tile="EVENT.DETAILS" aria-expanded={active === 'EVENT.DETAILS'} aria-controls="tile-panel-EVENT.DETAILS" onClick={() => choose('EVENT.DETAILS')} className="w-full min-h-11 text-left focus-visible:outline focus-visible:outline-2">
        {detailsDirty ? <span className="block text-xs">{zh ? creationStepsText.unsaved.zh : creationStepsText.unsaved.en}</span> : null}
        <strong className="event-arrangement-title">{localText(detailsDraft.title, zh) || (zh ? creationStepsText.addAnEventTitle.zh : creationStepsText.addAnEventTitle.en)}</strong>
        <span className="event-arrangement-date">{arrangementDate(detailsDraft.startLocal, detailsDraft.endLocal)} · {detailsDraft.timeZone}</span>
      </button><div className="event-arrangement-owner"><strong>{zh ? creationStepsText.accountableOwnerCreator.zh : creationStepsText.accountableOwnerCreator.en}</strong>{ownerPanel}</div>
    </div> : null}<TileButtons zh={zh} compact label={zh ? creationStepsText.eventModuleOverview.zh : creationStepsText.eventModuleOverview.en} active={active} onSelect={choose} items={moduleChoices.map(decision => { const meta = tileMeta[decision.moduleCode]; const selected = draft.moduleOverrides[decision.moduleCode] ?? decision.status !== 'inactive'; return { id: decision.moduleCode, title: localText(decision.label, zh), shortTitle: meta ? (zh ? meta.zh : meta.en) : undefined, icon: meta?.icon, color: meta?.color, accent: meta?.accent, ink: meta?.ink, enabled: selected, capability: capabilities.find(c => c.moduleCode === decision.moduleCode && c.status !== 'coreAvailable') ? capabilityStatusText(capabilities.find(c => c.moduleCode === decision.moduleCode)!.status, zh) : undefined, confirmed: draft.moduleConfirmations?.[decision.moduleCode] === true, dirty: Object.values(toolDrafts[decision.moduleCode] || {}).some(Boolean) || edited[decision.moduleCode] || ( decision.moduleCode === 'SAFETY.RAM' && ramDirty), status: [selected ? (zh ? creationStepsText.enabled.zh : creationStepsText.enabled.en) : (zh ? creationStepsText.offLabel.zh : creationStepsText.offLabel.en), capabilities.find(c => c.moduleCode === decision.moduleCode && c.status !== 'coreAvailable') ? capabilityStatusText(capabilities.find(c => c.moduleCode === decision.moduleCode)!.status, zh) : ''].filter(Boolean).join(' · '), faded: showAllModules && decision.status === 'inactive' } })} /></>}</div>
    <div ref={panelsRef}>{detailsPanel && visited.includes('EVENT.DETAILS') ? <section hidden={active !== 'EVENT.DETAILS'} id="tile-panel-EVENT.DETAILS" data-module-editor="EVENT.DETAILS" className="event-details-editor min-w-0"><h2 id="module-heading-EVENT.DETAILS" tabIndex={-1} className="scroll-mt-24 text-xl font-bold outline-none">{zh ? creationStepsText.eventDetails.zh : creationStepsText.eventDetails.en}</h2>{detailsPanel(active === 'EVENT.DETAILS')}</section> : null}{decisions.filter(decision => visited.includes(decision.moduleCode)).map(decision => <section key={decision.moduleCode} hidden={active !== decision.moduleCode} id={`tile-panel-${decision.moduleCode}`} aria-label={localText(decision.label, zh)} data-module-editor={decision.moduleCode} className="arrangement-editor min-w-0 border-t-2 border-[#176b5a] pt-3">
      <header className="mb-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id={`module-heading-${decision.moduleCode}`} tabIndex={-1} className="scroll-mt-24 text-xl font-bold outline-none">{localText(decision.label, zh)}</h2><label data-module-confirmation className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={!current || Object.values(toolDrafts[decision.moduleCode] || {}).some(Boolean) || (saved && decision.moduleCode === 'SAFETY.RAM' && ramDirty)} checked={draft.moduleConfirmations?.[decision.moduleCode] === true} onChange={event => confirmModuleDetails(decision.moduleCode, event.target.checked)} />{zh ? creationStepsText.detailsConfirmed.zh : creationStepsText.detailsConfirmed.en}</label></div></header>
      {confirmationError ? <p role="alert" className="mb-3 text-sm text-rose-800">{confirmationError}</p> : null}
      <EventCapabilityNotice code={decision.moduleCode} zh={zh} /><ModuleDraftBoundary code={decision.moduleCode} onChange={reportDraft}><ArrangementModule {...{ draft, setDraft, zh, type, decision, current, groupId, saved, ramPanel, ramDirty, readOnly, modulePanels, questionDefinitions }} rolePanels={rolePanels ?? defaultRoles} activeModules={decisions.filter(item => item.status === 'required' || item.status === 'selected').map(item => item.moduleCode)} /></ModuleDraftBoundary>
    </section>)}</div>
    <div className={editorial ? 'text-sm' : 'border-t-2 border-[#14564f] pt-3 text-sm'}>{issue ? <p role="status" className="text-amber-900">{issue}</p> : null}{!saved && proposal ? <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">{zh ? creationStepsText.reviewArrangementSummary.zh : creationStepsText.reviewArrangementSummary.en}</summary><CreationArrangementSummary {...{ draft, type, proposal, zh }} /></details> : null}</div>
  </div>
}

export function ReviewStep({ draft, zh, type, archetype, proposal, saved = false, roleSummary }: { roleSummary?: ReactNode; draft: CreationDraft; zh: boolean; type: EventActivityType; archetype: EventArchetype; proposal: EventPlanProposal; saved?: boolean }) {
  const settings = creationSettings(draft, type)
  return <div className="space-y-4"><AppSectionCard title={zh ? creationStepsText.reviewEventPlan.zh : creationStepsText.reviewEventPlan.en} subtitle={saved ? (zh ? creationStepsText.reviewThisEventSDetailsAndArrangementsThenContinue.zh : creationStepsText.reviewThisEventSDetailsAndArrangementsThenContinue.en) : (zh ? creationStepsText.continuePreparationInTheEventWorkspaceAfterCreationThis.zh : creationStepsText.continuePreparationInTheEventWorkspaceAfterCreationThis.en)}><h2 className="text-lg font-bold">{localText(draft.title, zh)}</h2><p className="mt-2 whitespace-pre-wrap text-sm">{localText(draft.description, zh)}</p><dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">{[
    [zh ? creationStepsText.template.zh : creationStepsText.template.en, localText(type.name, zh)], [zh ? creationStepsText.location.zh : creationStepsText.location.en, localText(draft.locationName, zh) || (zh ? creationStepsText.pending.zh : creationStepsText.pending.en)],
    [zh ? creationStepsText.timeZone.zh : creationStepsText.timeZone.en, draft.timeZone], [zh ? creationStepsText.starts.zh : creationStepsText.starts.en, draft.startLocal.replace('T', ' ')], [zh ? creationStepsText.ends.zh : creationStepsText.ends.en, draft.endLocal.replace('T', ' ')],
    [zh ? creationStepsText.visibility.zh : creationStepsText.visibility.en, visibilityText(settings.visibility, zh)], [zh ? creationStepsText.registration.zh : creationStepsText.registration.en, settings.registrationMode === 'required' ? Number(draft.maxCapacity)>0 ? `${zh ? creationStepsText.capacity.zh : creationStepsText.capacity.en}${draft.maxCapacity}` : (zh ? projectCopy.unlimited.zh : projectCopy.unlimited.en) : (zh ? creationStepsText.notRequired.zh : creationStepsText.notRequired.en)],
    ...(archetype.isSeries ? [[zh ? creationStepsText.repeat.zh : creationStepsText.repeat.en, `${zh ? creationStepsText.everyWeekSNext12Weeks.zh(draft.intervalWeeks || '1') : creationStepsText.everyWeekSNext12Weeks.en(draft.intervalWeeks || '1')} · ${draft.timeZone}`]] : []),
  ].map(([label, value]) => <div key={label}><dt className="text-[#66766f]">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl></AppSectionCard>
    <CreationArrangementSummary {...{ draft, type, proposal, zh }} />
    <AppSectionCard title={zh ? creationStepsText.toolsAndReasons.zh : creationStepsText.toolsAndReasons.en}><div className="grid gap-2 md:grid-cols-2">{proposal.moduleDecisions.filter(x => x.status !== 'inactive').map(item => <ModuleResult key={item.moduleCode} decision={item} zh={zh} />)}</div></AppSectionCard>
      <AppSectionCard title={zh ? creationStepsText.moduleConfirmationAndResponsibleRoles.zh : creationStepsText.moduleConfirmationAndResponsibleRoles.en}><div className="space-y-2">{proposal.moduleDecisions.map(module => <div key={module.moduleCode} className="flex items-center justify-between gap-3 text-sm"><span>{localText(module.label, zh)}</span><AppBadge variant={draft.moduleConfirmations?.[module.moduleCode] ? 'success' : 'warning'}>{draft.moduleConfirmations?.[module.moduleCode] ? (zh ? creationStepsText.detailsConfirmed.zh : creationStepsText.detailsConfirmed.en) : (zh ? creationStepsText.pending.zh : creationStepsText.pending.en)}</AppBadge></div>)}</div><div className="mt-4">{roleSummary ?? <ArrangementRoles roles={proposal.roleRequirements} zh={zh} compact summary moduleLabels={Object.fromEntries(proposal.moduleDecisions.map(item => [item.moduleCode, localText(item.label, zh)]))} />}</div></AppSectionCard>

    {proposal.readiness.blockers.length ? <AppSectionCard title={zh ? creationStepsText.preparationAfterCreation.zh : creationStepsText.preparationAfterCreation.en}><ul className="list-disc space-y-1 pl-5 text-sm">{proposal.readiness.blockers.map((item, index) => <li key={index}>{creationMessage(item, zh, proposal.moduleDecisions)}</li>)}</ul></AppSectionCard> : null}
    {proposal.warnings.length ? <AppSectionCard title={zh ? creationStepsText.pleaseNote.zh : creationStepsText.pleaseNote.en}><ul className="list-disc space-y-1 pl-5 text-sm">{proposal.warnings.map((item, index) => <li key={index}>{creationMessage(item, zh, proposal.moduleDecisions)}</li>)}</ul></AppSectionCard> : null}
  </div>
}
