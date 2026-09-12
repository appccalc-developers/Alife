import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { canVisitSetupStep, eventFlowLabels, setupPath, setupStages } from '../../utils/eventSetupFlow'

export default function EventFlowRail({ current, zh, eventBasePath, disabled, onSelect, frozen = false, approved = false, pendingChanges = false }: {
  current: number; zh: boolean; eventBasePath?: string; disabled?: boolean; onSelect?: (step: number) => void; frozen?: boolean; approved?: boolean; pendingChanges?: boolean
}) {
  const rail = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const container = rail.current, active = container?.querySelector<HTMLElement>('[aria-current="step"]')
    if (container && active) container.scrollTo({ left: active.offsetLeft - container.offsetLeft - container.clientWidth / 2 + active.clientWidth / 2, behavior: 'instant' })
  }, [current, zh])
  return <nav aria-label={zh ? '活动筹备流程' : 'Event preparation flow'}><ol ref={rail} className="relative flex gap-2 overflow-x-auto pb-2">
    {eventFlowLabels(zh).map((label, index) => {
      const step = index + 1, selected = current === step, saved = Boolean(eventBasePath && step <= 4)
      const className = `flex min-h-14 min-w-24 flex-col items-center justify-center rounded-xl px-3 py-2 text-center text-xs font-semibold ${selected ? 'bg-[#176b5a] text-white' : saved ? 'bg-[#e3f0eb] text-[#0d4f43]' : 'bg-white text-[#40554e] ring-1 ring-inset ring-[#2f4b42]/15'} disabled:opacity-50`
      const content = <><span>{saved ? '✓' : step}</span><span className="mt-1 whitespace-nowrap">{label}</span></>
      return <li key={step} className="shrink-0">{eventBasePath && canVisitSetupStep(step, frozen, approved) && !disabled && !(pendingChanges && step >= 5)
        ? <Link className={className} aria-current={selected ? 'step' : undefined} to={setupPath(eventBasePath, setupStages[step - 2])}>{content}</Link>
        : <button type="button" className={className} aria-current={selected ? 'step' : undefined} disabled={disabled || Boolean(eventBasePath) || step > current} onClick={() => onSelect?.(step)}>{content}</button>}</li>
    })}
  </ol></nav>
}
