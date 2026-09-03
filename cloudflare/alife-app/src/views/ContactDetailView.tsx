import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Mail, Phone, Send, UserRound } from 'lucide-react'
import AppPageShell from '../components/layout/AppPageShell'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { contactService } from '../services/contactService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { ContactProfileDto } from '../types/contact'
import { localizeText } from '../utils/localizedText'

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100'

const ContactDetailView = () => {
  const { groupId: routeGroupId, contactId = '' } = useParams<{ groupId?: string; contactId: string }>()
  const { groupId } = useActiveEntityIds({ groupId: routeGroupId })
  const auth = useAuthStore()
  const zh = auth.language === 'zh'
  const [contact, setContact] = useState<ContactProfileDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({ displayName: auth.me?.displayName ?? '', email: auth.me?.email ?? '', phone: auth.me?.phoneE164 ?? '', message: '' })

  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    setLoading(true)
    contactService.list(groupId)
      .then((items) => { if (!cancelled) setContact(items.find((item) => item.id === contactId) ?? null) })
      .catch((reason) => { if (!cancelled) setError(normalizeApiError(reason).message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [contactId, groupId])

  const submit = async () => {
    setSending(true)
    setError('')
    try {
      await contactService.inquire(contactId, { ...form, preferredLanguage: auth.language, sourcePage: window.location.pathname })
      setSent(true)
      setForm((current) => ({ ...current, message: '' }))
    } catch (reason) {
      setError(normalizeApiError(reason).message)
    } finally {
      setSending(false)
    }
  }

  if (!groupId) return <Navigate to="/groups/select" replace />

  if (loading) return <AppPageShell title={zh ? '联系人' : 'Contact'} context={zh ? '小组生活 / 联系人' : 'Group Life / Contact'}><p className="text-sm text-slate-500">{zh ? '正在加载联系人…' : 'Loading contact…'}</p></AppPageShell>
  if (!contact) return <AppPageShell title={zh ? '联系人' : 'Contact'} context={zh ? '小组生活 / 联系人' : 'Group Life / Contact'}><AppEmptyState title={zh ? '未找到联系人' : 'Contact not found'} description={error || (zh ? '此联系人不可见或已被删除。' : 'This contact is unavailable or has been removed.')} /></AppPageShell>

  const name = localizeText(contact.name, auth.language)
  return (
    <AppPageShell
      title={name}
      context={zh ? '小组生活 / 联系人' : 'Group Life / Contact'}
      subtitle={localizeText(contact.role, auth.language)}
      status={<AppBadge variant={contact.visibility === 'public' ? 'success' : 'info'}>{contact.visibility === 'public' ? (zh ? '公开' : 'Public') : (zh ? '小组可见' : 'Group only')}</AppBadge>}
      backLink={{ label: zh ? '返回小组' : 'Back to group', to: routeGroupId ? `/groups/${encodeURIComponent(routeGroupId)}?view=overview` : '/groups?view=overview' }}
    >
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row">
            {contact.photoUrl ? <img src={contact.photoUrl} alt={name} className="h-32 w-32 rounded-2xl object-cover" /> : <span className="flex h-32 w-32 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><UserRound className="h-14 w-14" /></span>}
            <div className="min-w-0 flex-1">
              {contact.notes ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{localizeText(contact.notes, auth.language)}</p> : null}
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {contact.phone ? <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 font-medium text-emerald-700"><Phone className="h-4 w-4" />{contact.phone}</a> : null}
                {contact.email ? <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 font-medium text-emerald-700"><Mail className="h-4 w-4" />{contact.email}</a> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">{zh ? '给联系人留言' : 'Send an inquiry'}</h2>
          <p className="mt-1 text-sm text-slate-500">{zh ? '留言会通过 Alife 通知发送给此联系人。' : 'Your message will be delivered through Alife notifications.'}</p>
          {sent ? <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{zh ? '留言已发送。' : 'Your inquiry has been sent.'}</p> : null}
          {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">{zh ? '姓名' : 'Name'}<input className={inputClass} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
            <label className="text-sm font-medium">Email<input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="text-sm font-medium sm:col-span-2">{zh ? '电话' : 'Phone'}<input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="text-sm font-medium sm:col-span-2">{zh ? '留言' : 'Message'}<textarea rows={5} className={inputClass} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
          </div>
          <div className="mt-5 flex justify-end"><AppActionButton variant="primary" disabled={sending || !form.displayName.trim() || !form.message.trim() || (!form.email.trim() && !form.phone.trim())} onClick={() => submit().catch(() => undefined)}><Send className="mr-1.5 h-4 w-4" />{sending ? (zh ? '发送中…' : 'Sending…') : (zh ? '发送留言' : 'Send inquiry')}</AppActionButton></div>
        </section>
      </div>
    </AppPageShell>
  )
}

export default ContactDetailView
