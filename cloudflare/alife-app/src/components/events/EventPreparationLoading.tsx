import { ClipboardList } from 'lucide-react'

export default function EventPreparationLoading({ zh }: { zh: boolean }) {
  return <section className="event-editorial-loading" role="status" aria-live="polite" aria-busy="true">
    <div className="event-editorial-loading-label"><ClipboardList size={16} aria-hidden="true" /><span>{zh ? '正在载入筹备工作区' : 'Loading your preparation workspace'}</span></div>
    <div className="event-editorial-loading-layout" aria-hidden="true"><div className="event-editorial-loading-brief"><i /><i /><i /></div><div className="event-editorial-loading-tiles">{[0, 1, 2, 3].map(index => <div key={index}><i /><i /></div>)}</div></div>
  </section>
}
