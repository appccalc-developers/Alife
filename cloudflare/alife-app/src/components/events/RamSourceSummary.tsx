import { Link } from 'react-router-dom'
import type { RamDraft } from '../../types/ramGovernance'
import { displayRamText as text } from '../../types/ramGovernance'
import { EventToolSection } from './ArrangementTileDeck'

export default function RamSourceSummary({draft,zh,eventId}:{draft:RamDraft;zh:boolean;eventId?:string}) {
  const absent=zh?'尚未提供':'Not provided'
  return <EventToolSection title={zh?'活动资料来源':'Activity source information'} summary={`${draft.activities.length} ${zh?'个活动项目':'activities'} · ${draft.participantCount??absent} ${zh?'人':'people'}`}>
    <div data-ram-field="ram.activities" className="space-y-2 text-sm">
      {!draft.activities.length?<p>{zh?'请在任务与交接中定义活动项目。':'Define activities in Tasks and handoffs.'}</p>:draft.activities.map(a=><details key={a.id} className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">{text(a.name,zh)||absent}</summary><p className="whitespace-pre-wrap">{text(a.conditions,zh)||absent}</p><details><summary>{zh?'展开 English':'Expand 中文'}</summary><p>{text(a.name,!zh)||absent}</p><p>{text(a.conditions,!zh)||absent}</p></details></details>)}
      <p data-ram-field="ram.participants">{zh?'预计人数：':'Expected participants: '}{draft.participantCount??absent}</p>
      <p>{[draft.isOuting?(zh?'室外／场外':'Outdoor / off-site'):'',draft.isOvernight?(zh?'过夜':'Overnight'):'',draft.isHighRisk?(zh?'已知高风险':'Known high risk'):''].filter(Boolean).join(' · ')|| (zh?'无已标记的特殊条件':'No special conditions marked')}</p>
      {(['weatherConfirmation','transport','accommodation'] as const).map((key,i)=><details key={key} data-ram-field={key==='weatherConfirmation'?'ram.weather':`ram.${key}`}><summary>{(zh?['天气核查与替代安排','交通安排 · 来源报告','住宿安排 · 来源报告']:['Weather review and alternatives','Transport · source report','Accommodation · source report'])[i]}</summary><p className="whitespace-pre-wrap">{text(draft[key],zh)||absent}</p><details><summary>{zh?'展开 English':'Expand 中文'}</summary><p>{text(draft[key],!zh)||absent}</p></details></details>)}
      {eventId?<Link className="inline-flex min-h-11 items-center font-semibold text-[#176b5a] underline" to={`/events/${eventId}/workspace?flow=setup&stage=arrangements&module=team.work`}>{zh?'前往任务与交接修改来源':'Edit sources in Tasks and handoffs'}</Link>:<p>{zh?'请在任务与交接中修改；创建时一起保存。':'Edit in Tasks and handoffs; save with Event creation.'}</p>}
    </div>
  </EventToolSection>
}
