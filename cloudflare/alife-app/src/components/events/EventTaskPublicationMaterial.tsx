import { eventTaskPublicationMaterialText } from '../../i18n/eventTaskPublicationMaterial.ts'
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
    <h3 className="font-semibold text-violet-900">{zh ? eventTaskPublicationMaterialText.publicationMaterialFromCustomTasks.zh : eventTaskPublicationMaterialText.publicationMaterialFromCustomTasks.en}</h3>
    <p className="text-sm">{zh ? eventTaskPublicationMaterialText.reviewTheSelectedPreparationUpdatesAndCopyThemInto.zh : eventTaskPublicationMaterialText.reviewTheSelectedPreparationUpdatesAndCopyThemInto.en}</p>
    {error ? <p role="alert">{error} <AppActionButton onClick={() => setRevision(value => value + 1)}>{zh ? eventTaskPublicationMaterialText.retry.zh : eventTaskPublicationMaterialText.retry.en}</AppActionButton></p> : tasks === null ? <p role="status">{zh ? eventTaskPublicationMaterialText.loadingMaterial.zh : eventTaskPublicationMaterialText.loadingMaterial.en}</p> : !tasks.length ? <p>{zh ? eventTaskPublicationMaterialText.noMaterialSelectedSelectBilingualPreparationUpdatesInTask.zh : eventTaskPublicationMaterialText.noMaterialSelectedSelectBilingualPreparationUpdatesInTask.en}</p> : tasks.map(task => <article key={task.id} className="space-y-2 rounded-xl bg-white p-3">
      <Link className="font-semibold text-[#176b5a] underline" to={`/events/${eventId}/tasks/${task.id}`}>{task.title[zh ? 'zh' : 'en']}</Link>
      <p className="whitespace-pre-wrap">{task.preparation?.[zh ? 'zh' : 'en']}</p>
      <details key={String(zh)}><summary className="min-h-8 cursor-pointer font-semibold">{zh ? eventTaskPublicationMaterialText.expand.zh : eventTaskPublicationMaterialText.expand.en}</summary><p className="whitespace-pre-wrap">{task.preparation?.[zh ? 'en' : 'zh']}</p></details>
      <AppActionButton onClick={() => { void navigator.clipboard.writeText(`${task.title.zh}\n${task.preparation?.zh || ''}\n\n${task.title.en}\n${task.preparation?.en || ''}`).then(() => setCopied(task.id)).catch(() => setError(zh ? eventTaskPublicationMaterialText.copyFailedSelectTheTextToCopyItManually.zh : eventTaskPublicationMaterialText.copyFailedSelectTheTextToCopyItManually.en)) }}>{zh ? eventTaskPublicationMaterialText.copyBilingualMaterial.zh : eventTaskPublicationMaterialText.copyBilingualMaterial.en}</AppActionButton>
      {copied === task.id ? <p role="status">{zh ? eventTaskPublicationMaterialText.copied.zh : eventTaskPublicationMaterialText.copied.en}</p> : null}
    </article>)}
  </section>
}
