import { useEffect, useMemo, useState } from 'react'
import { Bell, Pencil, Plus, Trash2, X } from 'lucide-react'
import { announcementService } from '../../services/announcementService'
import type { GroupDto } from '../../types/group'
import type { AnnouncementAudience, AnnouncementDto, AnnouncementPriority, AnnouncementStatus, SaveAnnouncementPayload } from '../../types/announcement'
import { useAuthStore } from '../../stores/auth'
import { localizeText } from '../../utils/localizedText'
import { validateRequiredBilingualFields } from '../../utils/bilingualValidation'
import AppActionButton from '../layout/AppActionButton'
import AiLanguageAutofill from '../ai/AiLanguageAutofill'
import useConfirmation from '../../hooks/useConfirmation'

const toLocalInput = (value?: string | null) => {
  const date = value ? new Date(value) : new Date()
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

const emptyForm = (groupId: string, isChurch: boolean): SaveAnnouncementPayload => ({
  groupId,
  title: { en: '', zh: '' },
  summary: { en: '', zh: '' },
  content: { en: '', zh: '' },
  audience: isChurch ? 'churchMembers' : 'specificGroup',
  priority: 'normal',
  status: 'draft',
  publishUtc: toLocalInput(),
  expireUtc: null,
  isPinned: false,
  createNotifications: false,
})

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950'

const AnnouncementManagementPanel = ({ group, onMessage }: { group: GroupDto; onMessage: (message: string) => void }) => {
  const { language } = useAuthStore()
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const [items, setItems] = useState<AnnouncementDto[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SaveAnnouncementPayload>(() => emptyForm(group.id, group.isChurch))
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const missingTranslations = useMemo(() => validateRequiredBilingualFields(
    { title: form.title, summary: form.summary, content: form.content },
    [
      { field: 'title', textType: 'announcementTitle' },
      { field: 'summary', textType: 'announcementSummary' },
      { field: 'content', textType: 'announcementContent' },
    ],
  ).missingTranslatableFields, [form.content, form.summary, form.title])
  const copy = useMemo(() => language === 'zh' ? {
    title: '公告', hint: '发布有对象、时间和期限的短期信息。', add: '新建公告', empty: '还没有公告。', edit: '编辑公告',
    titleEn: '英文标题', titleZh: '中文标题', summaryEn: '英文摘要', summaryZh: '中文摘要', contentEn: '英文内容（可选）', contentZh: '中文内容（可选）',
    audience: '对象', priority: '优先级', status: '状态', publish: '发布时间', expire: '到期时间（可选）', pinned: '置顶', notify: '发布时发送应用内通知', save: '保存', cancel: '取消', delete: '删除', deleteTitle: '要删除公告吗？', deleteConfirm: '这条公告会被永久删除，此操作无法撤销。', deleteFailed: '无法删除公告。',
  } : {
    title: 'Announcements', hint: 'Publish short-lived information with a clear audience and schedule.', add: 'New announcement', empty: 'No announcements yet.', edit: 'Edit announcement',
    titleEn: 'English title', titleZh: 'Chinese title', summaryEn: 'English summary', summaryZh: 'Chinese summary', contentEn: 'English content (optional)', contentZh: 'Chinese content (optional)',
    audience: 'Audience', priority: 'Priority', status: 'Status', publish: 'Publish time', expire: 'Expiry (optional)', pinned: 'Pinned', notify: 'Send in-app notifications on publication', save: 'Save', cancel: 'Cancel', delete: 'Delete', deleteTitle: 'Delete announcement?', deleteConfirm: 'This announcement will be deleted permanently. This cannot be undone.', deleteFailed: 'Unable to delete announcement.',
  }, [language])

  const load = async () => setItems(await announcementService.listManaged(group.id))
  useEffect(() => { load().catch(() => onMessage(language === 'zh' ? '无法加载公告。' : 'Unable to load announcements.')) }, [group.id, language])

  const beginCreate = () => {
    setEditingId(null)
    setForm(emptyForm(group.id, group.isChurch))
    setOpen(true)
  }
  const beginEdit = (item: AnnouncementDto) => {
    setEditingId(item.id)
    setForm({
      groupId: item.groupId, title: item.title, summary: item.summary, content: item.content ?? { en: '', zh: '' },
      audience: item.audience, priority: item.priority, status: item.status, publishUtc: toLocalInput(item.publishUtc),
      expireUtc: item.expireUtc ? toLocalInput(item.expireUtc) : null, isPinned: item.isPinned, createNotifications: false,
    })
    setOpen(true)
  }
  const localized = (field: 'title' | 'summary' | 'content', locale: 'en' | 'zh', value: string) =>
    setForm((current) => ({ ...current, [field]: { ...(current[field] ?? {}), [locale]: value } }))
  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        publishUtc: new Date(form.publishUtc).toISOString(),
        expireUtc: form.expireUtc ? new Date(form.expireUtc).toISOString() : null,
      }
      if (editingId) await announcementService.update(editingId, payload)
      else await announcementService.create(payload)
      await load()
      setOpen(false)
      onMessage(language === 'zh' ? '公告已保存。' : 'Announcement saved.')
    } catch (error) {
      onMessage(error instanceof Error ? error.message : language === 'zh' ? '保存公告失败。' : 'Unable to save announcement.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item: AnnouncementDto) => {
    if (!await requestConfirmation({
      title: copy.deleteTitle,
      description: copy.deleteConfirm,
      confirmLabel: copy.delete,
      tone: 'danger',
    })) return

    try {
      await announcementService.delete(item.id)
      await load()
    } catch {
      onMessage(copy.deleteFailed)
    }
  }

  return (
    <section>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#2f4b42]/10 pb-4">
        <div><h2 className="text-lg font-black text-[#18332d]">{copy.title}</h2><p className="mt-1 text-sm text-[#66766f]">{copy.hint}</p></div>
        <AppActionButton variant="primary" onClick={beginCreate}><Plus className="mr-1.5 h-4 w-4" />{copy.add}</AppActionButton>
      </header>

      {open ? (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-black text-[#18332d]">{editingId ? copy.edit : copy.add}</h3><button type="button" onClick={() => setOpen(false)} aria-label={copy.cancel}><X className="h-5 w-5" /></button></div>
          <AiLanguageAutofill
            key={editingId ?? 'new-announcement'}
            className="mb-4 rounded-xl border border-sky-200 bg-sky-50/50 p-3"
            groupId={group.id}
            scope={group.isChurch ? 'church' : 'group'}
            fields={missingTranslations}
            disabled={saving}
            onTranslated={(translations) => {
              setForm((current) => {
                const next = { ...current }
                translations.forEach((translation) => {
                  if (translation.field !== 'title' && translation.field !== 'summary' && translation.field !== 'content') return
                  const value = next[translation.field] ?? { en: '', zh: '' }
                  if (value[translation.language]?.trim()) return
                  next[translation.field] = { ...value, [translation.language]: translation.text }
                })
                return next
              })
            }}
          />
          <div className="grid gap-3 md:grid-cols-2">
            {([['title', 'en', copy.titleEn], ['title', 'zh', copy.titleZh], ['summary', 'en', copy.summaryEn], ['summary', 'zh', copy.summaryZh]] as const).map(([field, locale, label]) => <label key={`${field}-${locale}`} className="text-xs font-bold text-slate-700">{label}<input className={inputClass} value={form[field]?.[locale] ?? ''} onChange={(event) => localized(field, locale, event.target.value)} /></label>)}
            <label className="text-xs font-bold text-slate-700">{copy.contentEn}<textarea rows={3} className={inputClass} value={form.content?.en ?? ''} onChange={(event) => localized('content', 'en', event.target.value)} /></label>
            <label className="text-xs font-bold text-slate-700">{copy.contentZh}<textarea rows={3} className={inputClass} value={form.content?.zh ?? ''} onChange={(event) => localized('content', 'zh', event.target.value)} /></label>
            <label className="text-xs font-bold text-slate-700">{copy.audience}<select className={inputClass} value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value as AnnouncementAudience })}>{group.isChurch ? <><option value="public">Public / 公开</option><option value="churchMembers">Church members / 教会成员</option></> : null}<option value="specificGroup">Specific group / 指定小组</option></select></label>
            <label className="text-xs font-bold text-slate-700">{copy.priority}<select className={inputClass} value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as AnnouncementPriority })}><option value="normal">Normal / 普通</option><option value="important">Important / 重要</option><option value="urgent">Urgent / 紧急</option></select></label>
            <label className="text-xs font-bold text-slate-700">{copy.status}<select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AnnouncementStatus })}><option value="draft">Draft / 草稿</option><option value="published">Published / 已发布</option><option value="archived">Archived / 已归档</option></select></label>
            <label className="text-xs font-bold text-slate-700">{copy.publish}<input type="datetime-local" className={inputClass} value={form.publishUtc} onChange={(event) => setForm({ ...form, publishUtc: event.target.value })} /></label>
            <label className="text-xs font-bold text-slate-700">{copy.expire}<input type="datetime-local" className={inputClass} value={form.expireUtc ?? ''} onChange={(event) => setForm({ ...form, expireUtc: event.target.value || null })} /></label>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm"><label><input type="checkbox" className="mr-2" checked={form.isPinned} onChange={(event) => setForm({ ...form, isPinned: event.target.checked })} />{copy.pinned}</label><label><input type="checkbox" className="mr-2" checked={form.createNotifications} disabled={form.status !== 'published'} onChange={(event) => setForm({ ...form, createNotifications: event.target.checked })} />{copy.notify}</label></div>
          <div className="mt-4 flex gap-2"><AppActionButton variant="primary" disabled={saving} onClick={() => save()}>{copy.save}</AppActionButton><AppActionButton variant="secondary" onClick={() => setOpen(false)}>{copy.cancel}</AppActionButton></div>
        </div>
      ) : null}

      {items.length === 0 ? <p className="text-sm text-slate-500">{copy.empty}</p> : <div className="space-y-2">{items.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4"><div className="flex min-w-0 items-start gap-3"><Bell className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><div><p className="font-bold text-slate-950">{localizeText(item.title, language)}</p><p className="mt-1 text-xs text-slate-500">{item.status} · {item.priority} · {new Date(item.publishUtc).toLocaleString()}</p></div></div><div className="flex gap-2"><AppActionButton size="sm" variant="secondary" onClick={() => beginEdit(item)}><Pencil className="h-4 w-4" /></AppActionButton><AppActionButton size="sm" variant="danger" onClick={() => { remove(item).catch(() => undefined) }}><Trash2 className="h-4 w-4" /></AppActionButton></div></article>)}</div>}
      {confirmationModal}
    </section>
  )
}

export default AnnouncementManagementPanel
