import { useCallback, useEffect, useState } from 'react'
import { Mail, Pencil, Phone, Plus, Trash2, UserRound, X } from 'lucide-react'
import type { GroupMemberToolRow } from '../../hooks/useGroupScreen'
import { useAuthStore } from '../../stores/auth'
import { contactService } from '../../services/contactService'
import type { ContactProfileDto, ContactProfileInput } from '../../types/contact'
import { localizeText } from '../../utils/localizedText'
import { normalizeApiError } from '../../services/http'
import { validateRequiredBilingualFields } from '../../utils/bilingualValidation'
import AiLanguageAutofill from '../ai/AiLanguageAutofill'
import AppActionButton from '../layout/AppActionButton'
import AppBadge from '../layout/AppBadge'
import AppEmptyState from '../layout/AppEmptyState'
import MediaPickerInput from '../media/MediaPickerInput'
import useConfirmation from '../../hooks/useConfirmation'

type Props = {
  groupId: string
  memberships: GroupMemberToolRow[]
  onCountChange?: (count: number) => void
}

const emptyForm = (): ContactProfileInput => ({
  memberId: '',
  name: { en: '', zh: '' },
  role: { en: '', zh: '' },
  photoUrl: '',
  notes: { en: '', zh: '' },
  phone: '',
  email: '',
  visibility: 'groupOnly',
})

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100'

const ContactPhotoPreview = ({ url, label, emptyLabel }: { url?: string | null; label: string; emptyLabel: string }) => {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [url])

  return (
    <div className="aspect-square w-full max-w-40 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      {url && !failed ? (
        <img src={url} alt={label} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="flex h-full min-h-36 flex-col items-center justify-center gap-2 px-3 text-center text-slate-400">
          <UserRound className="h-9 w-9" aria-hidden="true" />
          <span className="text-xs font-medium">{failed ? label : emptyLabel}</span>
        </div>
      )}
    </div>
  )
}

const ContactManagementPanel = ({ groupId, memberships, onCountChange }: Props) => {
  const { language } = useAuthStore()
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const zh = language === 'zh'
  const [contacts, setContacts] = useState<ContactProfileDto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<ContactProfileDto | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ContactProfileInput>(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const items = await contactService.list(groupId)
      setContacts(items)
      onCountChange?.(items.length)
    } catch (reason) {
      setError(normalizeApiError(reason).message)
    } finally {
      setLoading(false)
    }
  }, [groupId, onCountChange])

  useEffect(() => { load().catch(() => undefined) }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  const openEdit = (contact: ContactProfileDto) => {
    setEditing(contact)
    setForm({
      memberId: contact.memberId,
      name: { en: contact.name.en ?? '', zh: contact.name.zh ?? '' },
      role: { en: contact.role.en ?? '', zh: contact.role.zh ?? '' },
      photoUrl: contact.photoUrl ?? '',
      notes: { en: contact.notes?.en ?? '', zh: contact.notes?.zh ?? '' },
      phone: contact.phone ?? '',
      email: contact.email ?? '',
      visibility: contact.visibility,
    })
    setShowForm(true)
  }

  const updateLocalized = (field: 'name' | 'role' | 'notes', key: 'en' | 'zh', value: string) => {
    setForm((current) => ({ ...current, [field]: { ...(current[field] ?? {}), [key]: value } }))
  }

  const save = async () => {
    if (!form.memberId || (!form.name.en?.trim() && !form.name.zh?.trim()) || (!form.role.en?.trim() && !form.role.zh?.trim())) {
      setError(zh ? '请选择成员，并填写姓名和角色。' : 'Choose a member and enter a name and role.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editing) await contactService.update(editing.id, form)
      else await contactService.create(groupId, form)
      setShowForm(false)
      await load()
    } catch (reason) {
      setError(normalizeApiError(reason).message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (contact: ContactProfileDto) => {
    const name = localizeText(contact.name, language)
    if (!await requestConfirmation({
      title: zh ? '要删除联系人吗？' : 'Delete contact?',
      description: zh ? `联系人“${name}”会从这个小组中删除。` : `“${name}” will be removed from this group’s contacts.`,
      confirmLabel: zh ? '删除联系人' : 'Delete contact',
      tone: 'danger',
    })) return
    try {
      await contactService.remove(contact.id)
      await load()
    } catch (reason) {
      setError(normalizeApiError(reason).message)
    }
  }

  const approvedMembers = memberships.filter((item) => item.status === 'approved')
  const missingTranslations = validateRequiredBilingualFields(
    { name: form.name, role: form.role, notes: form.notes },
    [
      { field: 'name', textType: 'contactName' },
      { field: 'role', textType: 'contactRole' },
      { field: 'notes', textType: 'contactNotes' },
    ],
  ).missingTranslatableFields

  const renderForm = () => (
    <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-[#18332d]">{editing ? (zh ? '编辑联系人' : 'Edit contact') : (zh ? '新增联系人' : 'Add contact')}</h3>
          <p className="mt-1 text-xs text-slate-500">{zh ? '联系人表单与列表保留在同一个管理面板中。' : 'The contact form stays inside the management panel with the list.'}</p>
        </div>
        <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-800" onClick={() => setShowForm(false)} aria-label={zh ? '取消' : 'Cancel'}><X className="h-5 w-5" /></button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2 text-sm font-medium">{zh ? '关联成员' : 'Member'}<select className={inputClass} value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}><option value="">{zh ? '请选择' : 'Choose member'}</option>{approvedMembers.map((member) => <option key={member.memberId} value={member.memberId}>{member.displayName || member.memberId.slice(0, 8)}</option>)}</select></label>

        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white/80 p-4">
          <div className="grid items-start gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <ContactPhotoPreview
              url={form.photoUrl}
              label={zh ? '照片无法预览' : 'Photo preview unavailable'}
              emptyLabel={zh ? '选择照片后在此预览' : 'Photo preview appears here'}
            />
            <div className="min-w-0">
              <MediaPickerInput focusKey="contact-photo" label={zh ? '照片' : 'Photo'} value={form.photoUrl ?? ''} groupId={groupId} accept="image" onChange={(value) => setForm({ ...form, photoUrl: value })} />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {zh ? '可从小组或公共媒体库选择，也可以上传新照片。Public 联系人请使用公共图片。' : 'Choose from group or public media, or upload a new photo. Use a public image for Public contacts.'}
              </p>
              {form.photoUrl ? <button type="button" className="mt-2 text-xs font-bold text-rose-600 hover:text-rose-700" onClick={() => setForm({ ...form, photoUrl: '' })}>{zh ? '移除照片' : 'Remove photo'}</button> : null}
            </div>
          </div>
        </div>

        <label className="text-sm font-medium">Name (English)<input className={inputClass} value={form.name.en ?? ''} onChange={(e) => updateLocalized('name', 'en', e.target.value)} /></label>
        <label className="text-sm font-medium">姓名（中文）<input className={inputClass} value={form.name.zh ?? ''} onChange={(e) => updateLocalized('name', 'zh', e.target.value)} /></label>
        <label className="text-sm font-medium">Role (English)<input className={inputClass} value={form.role.en ?? ''} onChange={(e) => updateLocalized('role', 'en', e.target.value)} /></label>
        <label className="text-sm font-medium">角色（中文）<input className={inputClass} value={form.role.zh ?? ''} onChange={(e) => updateLocalized('role', 'zh', e.target.value)} /></label>
        <label className="text-sm font-medium">{zh ? '电话' : 'Phone'}<input className={inputClass} value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label className="text-sm font-medium">Email<input type="email" className={inputClass} value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="text-sm font-medium">Notes (English)<textarea rows={3} className={inputClass} value={form.notes?.en ?? ''} onChange={(e) => updateLocalized('notes', 'en', e.target.value)} /></label>
        <label className="text-sm font-medium">备注（中文）<textarea rows={3} className={inputClass} value={form.notes?.zh ?? ''} onChange={(e) => updateLocalized('notes', 'zh', e.target.value)} /></label>
        <AiLanguageAutofill
          key={editing?.id ?? 'new-contact'}
          className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 md:col-span-2"
          groupId={groupId}
          fields={missingTranslations}
          disabled={saving}
          sensitive
          onTranslated={(translations) => {
            setForm((current) => {
              const next = { ...current }
              translations.forEach((translation) => {
                if (translation.field !== 'name' && translation.field !== 'role' && translation.field !== 'notes') return
                const value = next[translation.field] ?? { en: '', zh: '' }
                if (value[translation.language]?.trim()) return
                next[translation.field] = { ...value, [translation.language]: translation.text }
              })
              return next
            })
          }}
        />
        <label className="md:col-span-2 text-sm font-medium">{zh ? '可见范围' : 'Visibility'}<select className={inputClass} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as ContactProfileInput['visibility'] })}><option value="groupOnly">GroupOnly</option><option value="public">Public</option></select></label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <AppActionButton variant="primary" disabled={saving} onClick={() => save().catch(() => undefined)}>{saving ? (zh ? '保存中…' : 'Saving…') : (zh ? '保存' : 'Save')}</AppActionButton>
        <AppActionButton variant="secondary" onClick={() => setShowForm(false)}>{zh ? '取消' : 'Cancel'}</AppActionButton>
      </div>
    </div>
  )

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#2f4b42]/10 pb-4">
        <div>
          <h2 className="text-lg font-black text-[#18332d]">{zh ? '联系人' : 'Contacts'}</h2>
          <p className="mt-1 text-sm text-[#66766f]">{zh ? '维护可用于页面展示、活动和留言的联系人资料。' : 'Manage contact profiles used by pages, events, and inquiries.'}</p>
        </div>
        <AppActionButton variant="primary" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />{zh ? '新增联系人' : 'Add contact'}</AppActionButton>
      </div>

      {error ? <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {showForm ? renderForm() : null}
      {loading ? <p className="text-sm text-slate-500">{zh ? '正在加载联系人…' : 'Loading contacts…'}</p> : null}
      {!loading && contacts.length === 0 ? (
        <AppEmptyState title={zh ? '还没有联系人' : 'No contacts yet'} description={zh ? '从已批准成员中创建第一个联系人。' : 'Create the first contact from an approved member.'} actionLabel={zh ? '新增联系人' : 'Add contact'} onAction={openCreate} />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {contacts.map((contact) => (
          <article key={contact.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            {contact.photoUrl ? <img src={contact.photoUrl} alt={localizeText(contact.name, language)} className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><UserRound /></span>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h3 className="font-bold text-slate-950">{localizeText(contact.name, language)}</h3><p className="text-sm text-slate-500">{localizeText(contact.role, language)}</p></div>
                <AppBadge variant={contact.visibility === 'public' ? 'success' : 'info'}>{contact.visibility === 'public' ? 'Public' : 'GroupOnly'}</AppBadge>
              </div>
              {contact.phone ? <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600"><Phone className="h-3.5 w-3.5" />{contact.phone}</p> : null}
              {contact.email ? <p className="mt-1 flex items-center gap-1.5 break-all text-xs text-slate-600"><Mail className="h-3.5 w-3.5" />{contact.email}</p> : null}
              <div className="mt-3 flex gap-2"><AppActionButton size="sm" variant="secondary" onClick={() => openEdit(contact)}><Pencil className="mr-1 h-3.5 w-3.5" />{zh ? '编辑' : 'Edit'}</AppActionButton><AppActionButton size="sm" variant="danger" onClick={() => remove(contact)}><Trash2 className="mr-1 h-3.5 w-3.5" />{zh ? '删除' : 'Delete'}</AppActionButton></div>
            </div>
          </article>
        ))}
      </div>
      {confirmationModal}
    </section>
  )
}

export default ContactManagementPanel
