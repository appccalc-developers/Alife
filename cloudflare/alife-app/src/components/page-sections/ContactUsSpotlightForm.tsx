import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Mail, Phone, Send } from 'lucide-react'
import { visitContactService } from '../../services/visitContactService'
import type { LocalizedText } from '../../types'
import {
  buildVisitContactPhone,
  isSelectedVisitContactValid,
  VISIT_CONTACT_COUNTRY_CODES,
  type VisitContactCountryCode,
  type VisitContactMethod,
} from '../../utils/visitContactValidation'
import type { SectionMode } from './types'

export const DEFAULT_CONTACT_US_GUIDANCE: LocalizedText = {
  en: 'Leave your details and message. Our visitor care team will reply as soon as possible.',
  zh: '请留下联系方式和留言，访客接待团队会尽快回复。',
}

export const DEFAULT_CONTACT_US_SUCCESS_MESSAGE: LocalizedText = {
  en: 'Your message has been sent. Our visitor care team will contact you soon.',
  zh: '留言已发送，访客接待团队会尽快与你联系。',
}

type ContactForm = {
  displayName: string
  salutation: string
  method: VisitContactMethod
  email: string
  phoneCountryCode: VisitContactCountryCode
  phoneNumber: string
  message: string
}

type ContactStatus = 'idle' | 'submitting' | 'success' | 'error'

const initialForm = (): ContactForm => ({
  displayName: '',
  salutation: '',
  method: 'email',
  email: '',
  phoneCountryCode: '+64',
  phoneNumber: '',
  message: '',
})

const inputClass = 'min-h-11 w-full rounded-lg border border-home-border bg-white px-3 text-sm font-medium text-home-gold-text outline-none transition placeholder:text-home-muted/70 focus:border-home-green focus:ring-2 focus:ring-home-green/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-home-muted'

const ContactUsSpotlightForm = ({ mode, language, guidance, successMessage }: {
  mode: SectionMode
  language: string
  guidance: string
  successMessage: string
}) => {
  const zh = language === 'zh'
  const [form, setForm] = useState<ContactForm>(initialForm)
  const [status, setStatus] = useState<ContactStatus>('idle')
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const errors = useMemo(() => ({
    displayName: form.displayName.trim() ? '' : (zh ? '请输入姓名' : 'Enter your name'),
    contact: isSelectedVisitContactValid(form.method, form.email, form.phoneCountryCode, form.phoneNumber)
      ? ''
      : form.method === 'email'
        ? (zh ? '请输入有效的 Email 地址' : 'Enter a valid email address')
        : (zh ? '请输入有效的电话号码' : 'Enter a valid phone number'),
    message: form.message.trim() ? '' : (zh ? '请输入留言' : 'Enter a message'),
  }), [form, zh])

  const isValid = !errors.displayName && !errors.contact && !errors.message
  const controlsDisabled = mode !== 'render' || status === 'submitting' || status === 'success'

  const updateForm = (patch: Partial<ContactForm>) => {
    if (status === 'error') setStatus('idle')
    setForm((current) => ({ ...current, ...patch }))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTouched({ displayName: true, contact: true, message: true })
    if (mode !== 'render' || !isValid || controlsDisabled) return

    setStatus('submitting')
    try {
      await visitContactService.create({
        displayName: form.displayName.trim(),
        salutation: form.salutation.trim() || null,
        email: form.method === 'email' ? form.email.trim() : null,
        phone: form.method === 'phone' ? buildVisitContactPhone(form.phoneCountryCode, form.phoneNumber) : null,
        preferredLanguage: zh ? 'zh' : 'en',
        message: form.message.trim(),
        sourcePage: window.location.pathname,
      })
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  const feedback = status === 'success'
    ? successMessage
    : status === 'error'
      ? (zh ? '发送失败，请检查网络后重试。' : 'Message not sent. Check your connection and try again.')
      : status === 'submitting'
        ? (zh ? '正在发送留言…' : 'Sending your message…')
        : guidance

  return (
    <form className="grid gap-4" aria-label={zh ? '联系我们' : 'Contact us'} onSubmit={submit} noValidate>
      <fieldset className="grid min-w-0 gap-4 disabled:opacity-80" disabled={controlsDisabled}>
        <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-home-gold-text">
          <span>{zh ? '姓名' : 'Name'} <span aria-hidden="true" className="text-rose-600">*</span></span>
          <input
            required
            autoComplete="name"
            maxLength={150}
            value={form.displayName}
            placeholder={zh ? '陈小明' : 'Jane Chen'}
            className={inputClass}
            aria-invalid={Boolean(touched.displayName && errors.displayName)}
            onBlur={() => setTouched((current) => ({ ...current, displayName: true }))}
            onChange={(event) => updateForm({ displayName: event.target.value })}
          />
          {touched.displayName && errors.displayName ? <span className="text-xs font-medium text-rose-600">{errors.displayName}</span> : null}
        </label>

        <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-home-gold-text">
          {zh ? '希望如何称呼您（可选）' : 'How should we address you? (optional)'}
          <input
            maxLength={100}
            value={form.salutation}
            placeholder={zh ? '王弟兄、陈女士、Anna…' : 'Anna, Ms Chen, Brother Wang…'}
            className={inputClass}
            onChange={(event) => updateForm({ salutation: event.target.value })}
          />
        </label>

        <div className="grid gap-2">
          <span className="text-sm font-semibold text-home-gold-text">{zh ? '联系方式' : 'Contact method'} <span aria-hidden="true" className="text-rose-600">*</span></span>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-home-border bg-slate-50 p-1" role="group" aria-label={zh ? '选择联系方式' : 'Choose contact method'}>
            {([
              { value: 'email' as const, label: 'Email', Icon: Mail },
              { value: 'phone' as const, label: zh ? '电话' : 'Phone', Icon: Phone },
            ]).map(({ value, label, Icon }) => {
              const active = form.method === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-home-green/30 ${active ? 'bg-white text-home-green shadow-sm' : 'text-home-muted hover:text-home-gold-text'}`}
                  onClick={() => {
                    updateForm({ method: value })
                    setTouched((current) => ({ ...current, contact: false }))
                  }}
                >
                  <Icon className="h-4 w-4" />{label}
                </button>
              )
            })}
          </div>

          {form.method === 'email' ? (
            <input
              type="email"
              required
              autoComplete="email"
              maxLength={200}
              value={form.email}
              placeholder="you@example.com"
              aria-label="Email"
              aria-invalid={Boolean(touched.contact && errors.contact)}
              className={inputClass}
              onBlur={() => setTouched((current) => ({ ...current, contact: true }))}
              onChange={(event) => updateForm({ email: event.target.value })}
            />
          ) : (
            <div className="flex min-w-0 gap-2">
              <select
                value={form.phoneCountryCode}
                aria-label={zh ? '国家或地区代码' : 'Country or region code'}
                className="min-h-11 w-[7.4rem] shrink-0 rounded-lg border border-home-border bg-white px-2 text-sm font-medium text-home-gold-text outline-none transition focus:border-home-green focus:ring-2 focus:ring-home-green/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-home-muted"
                onChange={(event) => updateForm({ phoneCountryCode: event.target.value as VisitContactCountryCode })}
              >
                {VISIT_CONTACT_COUNTRY_CODES.map((country) => (
                  <option key={country.value} value={country.value}>{country.value} {zh ? country.zh : country.en}</option>
                ))}
              </select>
              <input
                type="tel"
                required
                inputMode="tel"
                autoComplete="tel"
                maxLength={30}
                value={form.phoneNumber}
                placeholder={zh ? '例如 021 123 4567' : 'e.g. 021 123 4567'}
                aria-label={zh ? '电话号码' : 'Phone number'}
                aria-invalid={Boolean(touched.contact && errors.contact)}
                className={`${inputClass} min-w-0 flex-1`}
                onBlur={() => setTouched((current) => ({ ...current, contact: true }))}
                onChange={(event) => updateForm({ phoneNumber: event.target.value })}
              />
            </div>
          )}
          {touched.contact && errors.contact ? <span className="text-xs font-medium text-rose-600">{errors.contact}</span> : null}
        </div>

        <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-home-gold-text">
          <span>{zh ? '留言' : 'Message'} <span aria-hidden="true" className="text-rose-600">*</span></span>
          <textarea
            required
            rows={5}
            maxLength={2000}
            value={form.message}
            placeholder={zh ? '请告诉我们你想了解什么…' : 'Tell us how we can help…'}
            aria-invalid={Boolean(touched.message && errors.message)}
            className={`${inputClass} resize-y py-2.5 leading-6`}
            onBlur={() => setTouched((current) => ({ ...current, message: true }))}
            onChange={(event) => updateForm({ message: event.target.value })}
          />
          {touched.message && errors.message ? <span className="text-xs font-medium text-rose-600">{errors.message}</span> : null}
        </label>

        <button
          type="submit"
          disabled={!isValid || controlsDisabled}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-home-green px-5 text-sm font-semibold text-white transition hover:bg-home-green-hover focus:outline-none focus:ring-2 focus:ring-home-green/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <Send className="h-4 w-4" />
          {status === 'submitting' ? (zh ? '发送中…' : 'Sending…') : (zh ? '确定发送' : 'Send message')}
        </button>
      </fieldset>

      <p
        aria-live="polite"
        className={`whitespace-pre-wrap text-sm leading-6 ${status === 'success' ? 'font-semibold text-home-green' : status === 'error' ? 'font-semibold text-rose-700' : 'text-home-muted'}`}
      >
        {feedback}
      </p>
    </form>
  )
}

export default ContactUsSpotlightForm
