import { contactDetailViewText } from '../i18n/contactDetailView.ts'
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

  if (loading) return <AppPageShell title={zh ? contactDetailViewText.contact.zh : contactDetailViewText.contact.en} context={zh ? contactDetailViewText.groupLifeContact.zh : contactDetailViewText.groupLifeContact.en}><p className="text-sm text-slate-500">{zh ? contactDetailViewText.loadingContact.zh : contactDetailViewText.loadingContact.en}</p></AppPageShell>
  if (!contact) return <AppPageShell title={zh ? contactDetailViewText.contact.zh : contactDetailViewText.contact.en} context={zh ? contactDetailViewText.groupLifeContact.zh : contactDetailViewText.groupLifeContact.en}><AppEmptyState title={zh ? contactDetailViewText.contactNotFound.zh : contactDetailViewText.contactNotFound.en} description={error || (zh ? contactDetailViewText.thisContactIsUnavailableOrHasBeenRemoved.zh : contactDetailViewText.thisContactIsUnavailableOrHasBeenRemoved.en)} /></AppPageShell>

  const name = localizeText(contact.name, auth.language)
  return (
    <AppPageShell
      title={name}
      context={zh ? contactDetailViewText.groupLifeContact.zh : contactDetailViewText.groupLifeContact.en}
      subtitle={localizeText(contact.role, auth.language)}
      status={<AppBadge variant={contact.visibility === 'public' ? 'success' : 'info'}>{contact.visibility === 'public' ? (zh ? contactDetailViewText.public.zh : contactDetailViewText.public.en) : (zh ? contactDetailViewText.groupOnly.zh : contactDetailViewText.groupOnly.en)}</AppBadge>}
      backLink={{ label: zh ? contactDetailViewText.backToGroup.zh : contactDetailViewText.backToGroup.en, to: routeGroupId ? `/groups/${encodeURIComponent(routeGroupId)}?view=overview` : '/groups?view=overview' }}
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
          <h2 className="text-xl font-black text-slate-950">{zh ? contactDetailViewText.sendAnInquiry.zh : contactDetailViewText.sendAnInquiry.en}</h2>
          <p className="mt-1 text-sm text-slate-500">{zh ? contactDetailViewText.yourMessageWillBeDeliveredThroughAlifeNotifications.zh : contactDetailViewText.yourMessageWillBeDeliveredThroughAlifeNotifications.en}</p>
          {sent ? <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{zh ? contactDetailViewText.yourInquiryHasBeenSent.zh : contactDetailViewText.yourInquiryHasBeenSent.en}</p> : null}
          {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">{zh ? contactDetailViewText.name.zh : contactDetailViewText.name.en}<input className={inputClass} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
            <label className="text-sm font-medium">Email<input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="text-sm font-medium sm:col-span-2">{zh ? contactDetailViewText.phone.zh : contactDetailViewText.phone.en}<input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="text-sm font-medium sm:col-span-2">{zh ? contactDetailViewText.message.zh : contactDetailViewText.message.en}<textarea rows={5} className={inputClass} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
          </div>
          <div className="mt-5 flex justify-end"><AppActionButton variant="primary" disabled={sending || !form.displayName.trim() || !form.message.trim() || (!form.email.trim() && !form.phone.trim())} onClick={() => submit().catch(() => undefined)}><Send className="mr-1.5 h-4 w-4" />{sending ? (zh ? contactDetailViewText.sending.zh : contactDetailViewText.sending.en) : (zh ? contactDetailViewText.sendInquiry.zh : contactDetailViewText.sendInquiry.en)}</AppActionButton></div>
        </section>
      </div>
    </AppPageShell>
  )
}

export default ContactDetailView
