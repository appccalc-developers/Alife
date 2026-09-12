import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import type { EventProgramme } from '../../types/eventOperations'
import AppActionButton from '../layout/AppActionButton'

export default function EventProgrammePrintView({ programme, zh, onClose }: { programme: EventProgramme; zh: boolean; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; close.current?.focus()
    return () => { document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  const text = (value: { en: string; zh: string }) => (zh ? value.zh : value.en) || value.en || value.zh
  const time = (value: string) => new Date(value).toLocaleString(zh ? 'zh-CN' : 'en-NZ')
  return createPortal(<section role="dialog" aria-modal="true" aria-label={zh ? '节目流程打印预览' : 'Programme print preview'} className="programme-print-sheet fixed inset-0 z-[100] overflow-y-auto bg-white p-5 text-[#18332d] sm:p-10" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
    if (event.key === 'Tab') {
      const buttons = event.currentTarget.querySelectorAll('button'), first = buttons[0], last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }}>
    <style>{`@media print { @page { margin: 15mm; } html, body { background: white !important; overflow: visible !important; height: auto !important; min-height: 0 !important; } body > *:not(.programme-print-sheet) { display: none !important; } .programme-print-sheet { position: static !important; overflow: visible !important; padding: 0 !important; } .programme-print-controls { display: none !important; } .programme-print-sheet li { break-inside: avoid; } .programme-print-sheet h2 { break-after: avoid; } }`}</style>
    <div className="programme-print-controls mb-6 flex flex-wrap gap-3"><AppActionButton onClick={() => window.print()}>{zh ? '打印／另存 PDF' : 'Print / save PDF'}</AppActionButton><AppActionButton ref={close} onClick={onClose}>{zh ? '关闭预览' : 'Close preview'}</AppActionButton></div>
    <div className="mx-auto max-w-4xl space-y-6"><h1 className="text-2xl font-bold">{zh ? '节目流程表' : 'Programme run sheet'}</h1>
      {programme.sessions.map(session => <article key={session.id} className="space-y-3"><h2 className="border-b pb-2 text-xl font-bold">{text(session.title)}</h2><p className="text-sm">{time(session.startUtc)} – {time(session.endUtc)} · {session.status}</p><ol className="divide-y">{session.items.map(item => <li key={item.id} className="py-3"><strong>+{item.startOffsetMinutes}m · {text(item.title)}</strong><p>{item.durationMinutes} min</p></li>)}</ol></article>)}
    </div>
  </section>, document.body)
}
