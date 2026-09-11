import { useCallback, useEffect, useRef, useState } from 'react'
import AppActionButton from '../layout/AppActionButton'
import AppSectionCard from '../layout/AppSectionCard'
import { eventPosterAiService } from '../../services/eventPosterAiService'
import { eventPosterWorkspaceService, type EventPosterWorkspace } from '../../services/eventPosterWorkspaceService'
import { isImageFile, normalizeImageUrl, uploadImage } from '../../services/imageWorkerApi'
import { normalizeApiError } from '../../services/http'

export default function EventPosterStep({ eventId, zh, onBusy, onContinue }: {
  eventId: string; zh: boolean; onBusy: (busy: boolean) => void; onContinue: () => void
}) {
  const [info, setInfo] = useState<EventPosterWorkspace | null>(null)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [notice, setNotice] = useState(false), [guidance, setGuidance] = useState(''), [baseImage, setBaseImage] = useState<File | null>(null)
  const [candidate, setCandidate] = useState<{ file: File; id: string; source: string } | null>(null)
  const [preview, setPreview] = useState('')
  const saveRequest = useRef<{ signature: string; url: string; key: string } | null>(null)
  const active = useRef(true), lock = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false; onBusy(false) } }, [onBusy])
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const value = await eventPosterWorkspaceService.get(eventId); if (active.current) setInfo(value) }
    catch (reason) { if (active.current) setError(normalizeApiError(reason).message) }
    finally { if (active.current) setLoading(false) }
  }, [eventId])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!candidate) { setPreview(''); return }
    const url = URL.createObjectURL(candidate.file); setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [candidate?.file])
  const source = info ? JSON.stringify(info.brief) : ''
  const stale = Boolean(candidate && candidate.source !== source)
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true; setBusy(true); onBusy(true); setError(''); setNotice(false)
    try { await action() }
    catch (reason) {
      if (active.current) {
        const failure = normalizeApiError(reason)
        setError(failure.status === 412 ? (zh ? '活动资料已更新，请刷新并按最新资料核对这张海报后再保存。' : 'Event details changed. Refresh and review this poster against the latest details before saving.') : failure.message)
      }
    } finally { lock.current = false; if (active.current) { setBusy(false); onBusy(false) } }
  }
  const choose = (file: File | undefined, base: boolean) => {
    if (!file) return
    if (!isImageFile(file) || file.size > 6 * 1024 * 1024) { setError(zh ? '请选择不超过 6 MB 的图片。' : 'Choose an image no larger than 6 MB.'); return }
    setError(''); setNotice(false)
    if (base) setBaseImage(file)
    else setCandidate({ file, id: crypto.randomUUID(), source })
  }
  const generate = () => run(async () => {
    if (!info?.canManage || !baseImage) return
    const generated = await eventPosterAiService.generate({ groupId: info.groupId, event: info.brief, baseImage, guidance: guidance.trim() })
    const file = await eventPosterAiService.toFile(generated)
    if (active.current) setCandidate({ file, id: crypto.randomUUID(), source })
  })
  const save = () => run(async () => {
    if (!info?.canManage || !candidate || stale) return
    const signature = `${info.eTag}:${candidate.id}`
    if (saveRequest.current?.signature !== signature) {
      const uploaded = await uploadImage(candidate.file, `groups/${info.groupId}/events/${eventId}/calendar`)
      saveRequest.current = { signature, url: uploaded.url, key: crypto.randomUUID() }
    }
    const result = await eventPosterWorkspaceService.save(eventId, saveRequest.current.url, info.eTag, saveRequest.current.key)
    if (active.current) { setInfo(result); setCandidate(null); setNotice(true) }
  })
  return <AppSectionCard title={zh ? '独立海报制作区' : 'Poster studio'} subtitle={zh ? '方案已正式批准。海报不属于审批内容，可依据已批准资料制作，核对并采用后再发布活动。' : 'The plan is approved. Posters are outside formal approval. Make a poster from the approved details, review and adopt it before publication.'}>
    {loading ? <p role="status">{zh ? '正在读取活动资料……' : 'Loading event details…'}</p> : null}
    {error ? <div role="alert" className="my-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><p>{error}</p><AppActionButton className="mt-2" disabled={busy} onClick={() => void load()}>{zh ? '刷新活动资料' : 'Refresh event details'}</AppActionButton></div> : null}
    {info ? <div className="space-y-4">
      <p className="text-sm text-[#66766f]">{info.brief.title[zh ? 'zh' : 'en']} · {new Date(info.brief.startDate).toLocaleString(zh ? 'zh-CN' : 'en-NZ')}</p>
      {info.posterImageUrl ? <figure><img src={normalizeImageUrl(info.posterImageUrl)} alt={zh ? '已保存的活动海报' : 'Saved event poster'} className="h-80 w-full rounded-xl md:h-96 bg-[#f5f2eb] object-contain" /><figcaption className="mt-2 text-sm">{zh ? '当前已采用的海报' : 'Currently adopted poster'}</figcaption></figure> : <p className="text-sm">{zh ? '尚未采用海报，可以上传图片或用 AI 制作。' : 'No poster adopted yet. Upload an image or make one with AI.'}</p>}
      {info.canManage ? <fieldset disabled={busy || loading} className="min-w-0 space-y-4">
        <label className="block text-sm font-semibold">{zh ? '上传现有海报' : 'Upload an existing poster'}<input type="file" accept="image/*" className="mt-2 block max-w-full text-sm" onChange={event => { choose(event.target.files?.[0], false); event.target.value = '' }} /></label>
        <section className="space-y-3 rounded-xl bg-[#f5f2eb] p-4" aria-label={zh ? 'AI 海报制作' : 'AI poster generation'}>
          <h3 className="font-semibold">{zh ? 'AI 辅助制作海报' : 'Make a poster with AI'}</h3>
          <p className="text-sm leading-6 text-[#66766f]">{zh ? '上传底图并填写设计要求。AI 使用活动标题、说明、目的、地点、时间及系统中的教会和小组资料；结果需要人工核对。' : 'Choose a base image and describe the design. AI uses the event title, description, purpose, location, dates and canonical church/group profile. Review the result before adopting it.'}</p>
          <label className="block text-sm font-semibold">{zh ? '海报底图' : 'Base image'}<input type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 block max-w-full text-sm" onChange={event => choose(event.target.files?.[0], true)} /></label>
          <label className="block text-sm font-semibold">{zh ? '设计要求' : 'Design guidance'}<textarea rows={3} maxLength={600} value={guidance} onChange={event => setGuidance(event.target.value)} className="mt-2 w-full rounded-xl border border-[#2f4b42]/20 bg-white p-3 font-normal" /></label>
          <p className="text-xs leading-5 text-[#66766f]">{zh ? '点击生成会调用现有 AI 服务，可能产生费用。请使用有权使用且不含敏感资料的底图。' : 'Generating calls the existing AI service and may incur cost. Use a base image you have rights to use and that contains no sensitive information.'}</p>
          <AppActionButton disabled={!baseImage || busy || !info.brief.title.en.trim() || !info.brief.title.zh.trim()} onClick={() => void generate()}>{zh ? '生成海报草案' : 'Generate poster draft'}</AppActionButton>
        </section>
        {candidate && preview ? <section className="space-y-3" aria-label={zh ? '待核对的海报草案' : 'Poster draft for review'}><img src={preview} alt={zh ? '待核对的海报草案' : 'Poster draft for review'} className="h-80 w-full rounded-xl md:h-96 bg-[#f5f2eb] object-contain" />
          <p className="text-sm">{zh ? '请核对文字、日期、人物及内容，再采用保存；未采用的草案不会替换当前海报。' : 'Check text, dates, people and content before adopting and saving. Unadopted drafts do not replace the current poster.'}</p>
          {stale ? <div className="rounded-xl bg-amber-50 p-3 text-sm"><p>{zh ? '活动资料已变化，请核对这张海报是否仍准确。' : 'Event details changed. Check whether this poster is still accurate.'}</p><AppActionButton className="mt-2" onClick={() => setCandidate({ ...candidate, source })}>{zh ? '已按最新资料核对' : 'Checked against the latest details'}</AppActionButton></div> : null}
          <AppActionButton variant="primary" disabled={busy || stale} onClick={() => void save()}>{zh ? '采用并保存海报' : 'Adopt and save poster'}</AppActionButton>
        </section> : null}
      </fieldset> : null}
      {busy ? <p role="status" className="text-sm">{zh ? '正在处理海报，请稍候……' : 'Processing poster…'}</p> : null}
      {notice ? <p role="status" className="text-sm text-[#176b5a]">{zh ? '海报已保存，可以继续发布活动。' : 'Poster saved. Continue to publication.'}</p> : null}
      <div className="flex justify-end"><AppActionButton disabled={busy || loading} onClick={onContinue}>{candidate ? (zh ? '暂不采用草案，继续发布' : 'Leave draft unadopted and continue') : info.posterImageUrl ? (zh ? '继续发布活动' : 'Continue to publication') : (zh ? '暂不制作海报，继续发布' : 'Skip poster and continue to publication')}</AppActionButton></div>
    </div> : null}
  </AppSectionCard>
}
