import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { eventOperationsService } from '../../services/eventOperationsService'
import { normalizeApiError } from '../../services/http'
import type { EventTask } from '../../types/eventOperations'
import AppActionButton from '../layout/AppActionButton'

export default function EventTaskPublicationMaterial({ eventId, zh }: { eventId: string; zh: boolean }) {
  const [tasks, setTasks] = useState<EventTask[] | null>(null), [error, setError] = useState(''), [copied, setCopied] = useState(''), [revision, setRevision] = useState(0)
  useEffect(() => {
    let live = true
    setTasks(null); setError('')
    void eventOperationsService.getTeam(eventId).then(data => { if (live) setTasks(data.tasks.filter(task => task.preparationPublicationCandidate && !task.isRestricted && task.status !== 'cancelled')) }).catch(e => { if (live) setError(normalizeApiError(e).message) })
    return () => { live = false }
  }, [eventId, revision])
  return <section className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
    <h3 className="font-semibold text-violet-900">{zh ? '自定义任务的发布素材' : 'Publication material from custom tasks'}</h3>
    <p className="text-sm">{zh ? '核对已选择的准备情况，可复制到对外说明或发布文案中。' : 'Review the selected preparation updates and copy them into your audience-facing description or publication copy.'}</p>
    {error ? <p role="alert">{error} <AppActionButton onClick={() => setRevision(value => value + 1)}>{zh ? '重试' : 'Retry'}</AppActionButton></p> : tasks === null ? <p role="status">{zh ? '正在读取素材…' : 'Loading material…'}</p> : !tasks.length ? <p>{zh ? '尚未选择素材，可在任务详情中选择已完成双语填写的准备情况。' : 'No material selected. Select bilingual preparation updates in task details.'}</p> : tasks.map(task => <article key={task.id} className="space-y-2 rounded-xl bg-white p-3">
      <Link className="font-semibold text-[#176b5a] underline" to={`/events/${eventId}/tasks/${task.id}`}>{task.title[zh ? 'zh' : 'en']}</Link>
      <p className="whitespace-pre-wrap">{task.preparation?.[zh ? 'zh' : 'en']}</p>
      <details key={String(zh)}><summary className="min-h-8 cursor-pointer font-semibold">{zh ? '展开 English' : 'Expand 中文'}</summary><p className="whitespace-pre-wrap">{task.preparation?.[zh ? 'en' : 'zh']}</p></details>
      <AppActionButton onClick={() => { void navigator.clipboard.writeText(`${task.title.zh}\n${task.preparation?.zh || ''}\n\n${task.title.en}\n${task.preparation?.en || ''}`).then(() => setCopied(task.id)).catch(() => setError(zh ? '复制失败，请选择文字手动复制。' : 'Copy failed. Select the text to copy it manually.')) }}>{zh ? '复制双语素材' : 'Copy bilingual material'}</AppActionButton>
      {copied === task.id ? <p role="status">{zh ? '已复制' : 'Copied'}</p> : null}
    </article>)}
  </section>
}
