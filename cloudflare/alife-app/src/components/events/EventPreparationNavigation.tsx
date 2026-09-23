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
  const labels = zh ? ['活动资料', '筹备总览', '方案核对', '正式审批', '海报制作', '发布活动'] : ['Event details', 'Preparation overview', 'Plan review', 'Formal approval', 'Poster', 'Publish']
  const tools = useRef<HTMLElement>(null)
  const stageIcons = [ClipboardList, Megaphone, CirclePlay, Flag]
  useEffect(() => {
    const rail = tools.current, selected = rail?.querySelector<HTMLElement>('[aria-current]')
    if (rail && selected) rail.scrollTo({ left: selected.offsetLeft - rail.offsetLeft - (rail.clientWidth - selected.clientWidth) / 2, behavior: 'instant' })
  }, [stage, zh])
  return <section className="event-editorial-masthead">
    <div className="event-editorial-masthead-main">
      <header className="event-editorial-header"><p className="event-editorial-eyebrow">{zh ? '活动工作台 / 筹备' : 'Event workspace / Preparation'}</p><h1>{title}</h1></header>
    <nav className="event-editorial-stage-nav" tabIndex={-1} aria-label={zh ? '活动阶段' : 'Event stages'}>
      {(['preparation', 'registration', 'execution', 'followup'] as const).map((value, index) => {
        const label = (zh ? ['筹备', '公布', '执行', '收尾'] : ['Preparation', 'Published', 'Delivery', 'Follow-up'])[index]
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
    <div className="event-editorial-toolbox-heading"><span>{zh ? '筹备工具' : 'Preparation tools'}</span><details className="event-editorial-flow-help"><summary>{zh ? '流程说明' : 'How it works'}<ChevronDown size={13} aria-hidden="true" /></summary><div><p>{eventStageHelp('preparation', zh)}</p><p>{zh ? '保存筹备资料 → 核对并提交审批 → 批准后制作海报与发布。切换阶段不会自动执行这些操作。' : 'Save preparation → review and submit → after approval, prepare the poster and publish. Switching stages does not perform these actions.'}</p></div></details></div>
    <nav ref={tools} className="event-editorial-tools" aria-label={zh ? '筹备工作区' : 'Preparation workspace'}>
      {setupStages.map((value, index) => {
        const locked = !canVisitSetupStep(index + 2, frozen, approved)
        const reason = locked ? (frozen && index < 3 ? (zh ? '方案已冻结，请在正式审批中申请重开' : 'Preparation is frozen; request reopening in Formal approval') : (zh ? '正式审批通过后可用' : 'Available after formal approval')) : dirty && index >= 3 ? (zh ? '请先保存当前修改' : 'Save your changes first') : undefined
        return <button type="button" key={value} aria-label={labels[index]} aria-current={stage === value ? 'page' : undefined} title={reason} disabled={disabled || locked || (dirty && index >= 3)} onClick={() => go(value)}>{labels[index]}{locked ? <LockKeyhole size={12} aria-hidden="true" /> : null}</button>
      })}
    </nav>
    {!approved && !frozen ? <p className="event-editorial-tool-hint"><LockKeyhole size={12} aria-hidden="true" />{zh ? '海报与发布将在正式审批通过后开放' : 'Poster and publication become available after approval'}</p> : null}
    </div>
  </section>
}
