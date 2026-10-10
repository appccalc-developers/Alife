import { eventPreparationNavigationText } from '../../i18n/eventPreparationNavigation.ts'
import { Link } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { ClipboardList, Megaphone, CirclePlay, Flag, LockKeyhole, ChevronDown } from 'lucide-react'
import { canVisitSetupStep, setupStages, type SetupStage } from '../../utils/eventSetupFlow'
import { withDutyReturn } from '../../utils/eventDutyNavigation'
import { eventStageHelp } from '../../utils/eventActionGuidance'

export default function EventPreparationNavigation({ eventId, title, stage, zh, disabled, dirty, frozen, approved, go, returnTo }: {
  eventId: string; title: string; stage: SetupStage; zh: boolean; disabled: boolean; dirty: boolean
  frozen: boolean; approved: boolean; go: (stage: SetupStage) => void; returnTo?: string
}) {
  const labels = zh ? [...eventPreparationNavigationText.localizedCopy.zh] : [...eventPreparationNavigationText.localizedCopy.en]
  const tools = useRef<HTMLElement>(null)
  const stageIcons = [ClipboardList, Megaphone, CirclePlay, Flag]
  useEffect(() => {
    const rail = tools.current, selected = rail?.querySelector<HTMLElement>('[aria-current]')
    if (rail && selected) rail.scrollTo({ left: selected.offsetLeft - rail.offsetLeft - (rail.clientWidth - selected.clientWidth) / 2, behavior: 'instant' })
  }, [stage, zh])
  return <section className="event-editorial-masthead">
    <div className="event-editorial-masthead-main">
      <header className="event-editorial-header"><p className="event-editorial-eyebrow">{zh ? eventPreparationNavigationText.eventWorkspacePreparation.zh : eventPreparationNavigationText.eventWorkspacePreparation.en}</p><h1>{title}</h1></header>
    <nav className="event-editorial-stage-nav" tabIndex={-1} aria-label={zh ? eventPreparationNavigationText.eventStages.zh : eventPreparationNavigationText.eventStages.en}>
      {(['preparation', 'registration', 'execution', 'followup'] as const).map((value, index) => {
        const label = (zh ? [...eventPreparationNavigationText.localizedCopy2.zh] : [...eventPreparationNavigationText.localizedCopy2.en])[index]
        const Icon = stageIcons[index]
        const content = <><Icon size={16} aria-hidden="true" /><span>{label}</span></>
        const path = `/events/${eventId}/work?stage=${value}`
        return index === 0 ? <button type="button" key={value} aria-current="page" disabled={disabled || frozen} onClick={() => go('arrangements')}>{content}</button>
          : disabled || dirty ? <button type="button" key={value} disabled>{content}</button>
            : <Link key={value} to={returnTo ? withDutyReturn(path, returnTo) : path}>{content}</Link>
      })}
    </nav>
    </div>
    <div className="event-editorial-toolbox">
    <div className="event-editorial-toolbox-heading"><span>{zh ? eventPreparationNavigationText.preparationTools.zh : eventPreparationNavigationText.preparationTools.en}</span><details className="event-editorial-flow-help"><summary>{zh ? eventPreparationNavigationText.howItWorks.zh : eventPreparationNavigationText.howItWorks.en}<ChevronDown size={13} aria-hidden="true" /></summary><div><p>{eventStageHelp('preparation', zh)}</p><p>{zh ? eventPreparationNavigationText.savePreparationReviewAndSubmitAfterApprovalPrepareThe.zh : eventPreparationNavigationText.savePreparationReviewAndSubmitAfterApprovalPrepareThe.en}</p></div></details></div>
    <nav ref={tools} className="event-editorial-tools" aria-label={zh ? eventPreparationNavigationText.preparationWorkspace.zh : eventPreparationNavigationText.preparationWorkspace.en}>
      {setupStages.map((value, index) => {
        const locked = !canVisitSetupStep(index + 2, frozen, approved)
        const reason = locked ? (frozen && index < 3 ? (zh ? eventPreparationNavigationText.preparationIsFrozenRequestReopeningInFormalApproval.zh : eventPreparationNavigationText.preparationIsFrozenRequestReopeningInFormalApproval.en) : (zh ? eventPreparationNavigationText.availableAfterFormalApproval.zh : eventPreparationNavigationText.availableAfterFormalApproval.en)) : dirty && index >= 3 ? (zh ? eventPreparationNavigationText.saveYourChangesFirst.zh : eventPreparationNavigationText.saveYourChangesFirst.en) : undefined
        return <button type="button" key={value} aria-label={labels[index]} aria-current={stage === value ? 'page' : undefined} title={reason} disabled={disabled || locked || (dirty && index >= 3)} onClick={() => go(value)}>{labels[index]}{locked ? <LockKeyhole size={12} aria-hidden="true" /> : null}</button>
      })}
    </nav>
    {!approved && !frozen ? <p className="event-editorial-tool-hint"><LockKeyhole size={12} aria-hidden="true" />{zh ? eventPreparationNavigationText.posterAndPublicationBecomeAvailableAfterApproval.zh : eventPreparationNavigationText.posterAndPublicationBecomeAvailableAfterApproval.en}</p> : null}
    </div>
  </section>
}
