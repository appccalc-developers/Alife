import { useId, useRef, useState, type ReactNode } from 'react'
import { Info, TriangleAlert } from 'lucide-react'
import { eventPolicyFormText } from '../../i18n/eventPolicyForm'

// Native popovers escape card clipping and support outside-click/Escape dismissal.
export default function EventPolicyHelp({ label, text, zh, warning = false }: { label: string; text: ReactNode; zh: boolean; warning?: boolean }) {
  const id = useId()
  const popup = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const pinned = useRef(false)
  const [position, setPosition] = useState({ left: 16, top: 16 })
  const show = () => {
    const bounds = button.current?.getBoundingClientRect()
    if (!bounds) return
    const width = Math.min(320, window.innerWidth - 32)
    setPosition({ left: Math.max(16, Math.min(bounds.left, window.innerWidth - width - 16)), top: bounds.bottom + 6 })
    popup.current?.showPopover()
    requestAnimationFrame(() => {
      const height = popup.current?.getBoundingClientRect().height ?? 0
      setPosition(p => ({ ...p, top: Math.max(16, Math.min(bounds.bottom + 6, window.innerHeight - height - 16)) }))
    })
  }
  const Icon = warning ? TriangleAlert : Info
  return <span className="inline-flex align-middle">
    <button ref={button} type="button" popoverTarget={id} popoverTargetAction="show" aria-label={zh ? eventPolicyFormText.helpFor.zh(label) : eventPolicyFormText.helpFor.en(label)} aria-describedby={id}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b5a] ${warning ? 'text-amber-800 hover:bg-amber-50' : 'text-[#66766f] hover:bg-[#e3f0eb]'}`}
      onFocus={show} onPointerEnter={event => { if (event.pointerType === 'mouse') show() }} onClick={() => { pinned.current = true; show() }}
      onBlur={() => { pinned.current = false; popup.current?.hidePopover() }}
      onPointerLeave={event => { if (event.pointerType === 'mouse' && !pinned.current && document.activeElement !== button.current) popup.current?.hidePopover() }}>
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
    <div ref={popup} id={id} popover="auto" role="tooltip" style={position} onToggle={event => { if (event.newState === 'closed') pinned.current = false }}
      className="fixed m-0 max-h-[calc(100dvh-2rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-[#2f4b42]/20 bg-white p-4 text-sm font-normal leading-6 text-[#18332d] shadow-xl">
      {text}
    </div>
  </span>
}
