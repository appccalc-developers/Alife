import { useEffect, useId, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import AppSectionCard from '../../layout/AppSectionCard'

export function ArrangementToggle({ open, onToggle, controls, title, zh }: { open: boolean; onToggle: () => void; controls: string; title: string; zh: boolean }) {
  const label = `${zh ? (open ? '收起' : '展开') : (open ? 'Collapse' : 'Expand')} ${title}`
  return <button type="button" aria-expanded={open} aria-controls={controls} aria-label={label} title={label} onClick={onToggle} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-[#176b5a]/20 bg-white text-[#176b5a] hover:bg-[#e3f0eb]">
    {open ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
  </button>
}

export default function ArrangementDisclosure({ title, zh, children, forceOpen = false, confirmed, onConfirm, disabled }: { title: string; zh: boolean; children: ReactNode; forceOpen?: boolean; confirmed?: boolean; onConfirm?: (value: boolean) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(true), id = useId()
  useEffect(() => { if (forceOpen) setOpen(true) }, [forceOpen])
  return <AppSectionCard title={title} action={<div className="flex flex-wrap items-center justify-end gap-2">{onConfirm ? <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={confirmed === true} onChange={event => onConfirm(event.target.checked)} aria-label={`${title} · ${zh ? '已确认' : 'Confirmed'}`} className="size-4 accent-[#176b5a]" />{zh ? '已确认' : 'Confirmed'}</label> : null}<ArrangementToggle {...{ open, title, zh }} controls={id} onToggle={() => setOpen(value => !value)} /></div>}>
    <div id={id} hidden={!open}>{children}</div>
  </AppSectionCard>
}
