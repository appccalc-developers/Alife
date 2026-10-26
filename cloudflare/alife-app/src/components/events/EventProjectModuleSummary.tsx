import type { PlannedActivity } from '../../types/eventActivityPlan'
import type { EventProjectQuestionDefinition } from '../../types/eventProjectQuestionnaire'
import { movedEventQuestionModules } from '../../types/eventProjectQuestionnaire'
import { projectModuleRequirements, projectRequiresRegistration } from '../../utils/eventProjectQuestionnaire'
import { eventProjectQuestionnaireText as copy } from '../../i18n/eventProjectQuestionnaire'
import { displayRamText as text } from '../../types/ramGovernance'
import EventPolicyHelp from './EventPolicyHelp'

export default function EventProjectModuleSummary({ activities, definitions, zh, onSelectProject, registrationMode, eventAnswers }: { activities: PlannedActivity[]; definitions: EventProjectQuestionDefinition[]; zh: boolean; onSelectProject?: (id: string) => void; registrationMode?: 'none' | 'required'; eventAnswers?: Record<string, 'yes' | 'no' | 'unknown'> }) {
  const eventSources = Object.entries(movedEventQuestionModules).filter(([fact]) => eventAnswers?.[fact] === 'yes')
  const modules = [...new Set([...activities.flatMap(activity => projectModuleRequirements(activity, definitions)), ...eventSources.map(([, module]) => module)])]
  return <div className="space-y-2">{registrationMode === 'none' && activities.some(projectRequiresRegistration) ? <div className="flex items-center gap-2 text-amber-900" role="status"><strong>{text(copy.moduleNames['PEOPLE.REGISTRATION'], zh)}</strong><EventPolicyHelp warning zh={zh} label={text(copy.moduleNames['PEOPLE.REGISTRATION'],zh)} text={text(copy.registrationConflict,zh)}/></div> : null}<details data-project-module-summary className="rounded-xl border border-[#176b5a]/20 px-3 text-sm">
    <summary className="min-h-11 cursor-pointer py-3 font-semibold">{text(copy.moduleSummary, zh)} · {modules.length}</summary>
    <div className="space-y-3 pb-3"><EventPolicyHelp zh={zh} label={text(copy.moduleSummary, zh)} text={text(copy.summaryHelp, zh)} />
      {!modules.length ? <p>{text(copy.noModules, zh)}</p> : modules.map(code => { const projects = activities.filter(activity => projectModuleRequirements(activity, definitions).includes(code)); const eventSource = eventSources.find(([, module]) => module === code); return <article key={code} className="space-y-2 border-l-2 border-[#176b5a]/30 pl-3" data-project-module={code}>
        <h3 className="font-semibold">{text(copy.moduleNames[code], zh)}{projects.length ? ` · ${zh ? copy.projectCount.zh(projects.length) : copy.projectCount.en(projects.length)}` : ''}</h3>
        <div className="flex flex-wrap gap-2">{eventSource ? <span className="rounded-lg border border-[#176b5a]/25 px-3 py-2 text-[#176b5a]">{text(copy.eventSource, zh)}</span> : null}{projects.map(activity => onSelectProject ? <button key={activity.id} type="button" className="min-h-11 rounded-lg border px-3 text-left" onClick={() => onSelectProject(activity.id)}>{text(activity.name, zh)}</button> : <span key={activity.id}>{text(activity.name, zh)}</span>)}</div>
      </article> })}
    </div>
  </details></div>
}
