import { contactUsSpotlightFormText } from '../../i18n/contactUsSpotlightForm.ts'
import { useMemo, useRef, useState } from 'react'
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

export const DEFAULT_CONTACT_US_GUIDANCE: LocalizedText = { ...contactUsSpotlightFormText.defaultContactUsGuidance }

export const DEFAULT_CONTACT_US_SUCCESS_MESSAGE: LocalizedText = { ...contactUsSpotlightFormText.defaultContactUsSuccessMessage }

type ContactForm = {
  displayName: string
  salutation: string
  method: VisitContactMethod
  email: string
  phoneCountryCode: VisitContactCountryCode
  phoneNumber: string
  message: string
  consent: boolean
  website: string
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
  consent: false,
  website: '',
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
  const formStartedAt = useRef(Date.now())

  const errors = useMemo(() => ({
    displayName: form.displayName.trim() ? '' : (zh ? contactUsSpotlightFormText.enterYourName.zh : contactUsSpotlightFormText.enterYourName.en),
    contact: isSelectedVisitContactValid(form.method, form.email, form.phoneCountryCode, form.phoneNumber)
      ? ''
      : form.method === 'email'
        ? (zh ? contactUsSpotlightFormText.enterAValidEmailAddress.zh : contactUsSpotlightFormText.enterAValidEmailAddress.en)
        : (zh ? contactUsSpotlightFormText.enterAValidPhoneNumber.zh : contactUsSpotlightFormText.enterAValidPhoneNumber.en),
    message: form.message.trim() ? '' : (zh ? contactUsSpotlightFormText.enterAMessage.zh : contactUsSpotlightFormText.enterAMessage.en),
    consent: form.consent ? '' : (zh ? contactUsSpotlightFormText.acceptThePrivacyNotice.zh : contactUsSpotlightFormText.acceptThePrivacyNotice.en),
  }), [form, zh])

  const isValid = !errors.displayName && !errors.contact && !errors.message && !errors.consent
  const controlsDisabled = mode !== 'render' || status === 'submitting' || status === 'success'

  const updateForm = (patch: Partial<ContactForm>) => {
    if (status === 'error') setStatus('idle')
    setForm((current) => ({ ...current, ...patch }))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTouched({ displayName: true, contact: true, message: true, consent: true })
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
        requestKind: 'visitorMessage',
        replyPreference: form.method,
        privacyConsent: form.consent,
        privacyConsentVersion: 'contact-section-v1',
        honeypot: form.website,
        formStartedUnixMilliseconds: formStartedAt.current,
      })
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  const feedback = status === 'success'
    ? successMessage
    : status === 'error'
      ? (zh ? contactUsSpotlightFormText.messageNotSentCheckYourConnectionAndTryAgain.zh : contactUsSpotlightFormText.messageNotSentCheckYourConnectionAndTryAgain.en)
      : status === 'submitting'
        ? (zh ? contactUsSpotlightFormText.sendingYourMessage.zh : contactUsSpotlightFormText.sendingYourMessage.en)
        : guidance

  return (
    <form className="grid gap-4" aria-label={zh ? contactUsSpotlightFormText.contactUs.zh : contactUsSpotlightFormText.contactUs.en} onSubmit={submit} noValidate>
      <fieldset className="grid min-w-0 gap-4 disabled:opacity-80" disabled={controlsDisabled}>
        <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-home-gold-text">
          <span>{zh ? contactUsSpotlightFormText.name.zh : contactUsSpotlightFormText.name.en} <span aria-hidden="true" className="text-rose-600">*</span></span>
          <input
            required
            autoComplete="name"
            maxLength={150}
            value={form.displayName}
            placeholder={zh ? contactUsSpotlightFormText.janeChen.zh : contactUsSpotlightFormText.janeChen.en}
            className={inputClass}
            aria-invalid={Boolean(touched.displayName && errors.displayName)}
            onBlur={() => setTouched((current) => ({ ...current, displayName: true }))}
            onChange={(event) => updateForm({ displayName: event.target.value })}
          />
          {touched.displayName && errors.displayName ? <span className="text-xs font-medium text-rose-600">{errors.displayName}</span> : null}
        </label>

        <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-home-gold-text">
          {zh ? contactUsSpotlightFormText.howShouldWeAddressYouOptional.zh : contactUsSpotlightFormText.howShouldWeAddressYouOptional.en}
          <input
            maxLength={100}
            value={form.salutation}
            placeholder={zh ? contactUsSpotlightFormText.annaMsChenBrotherWang.zh : contactUsSpotlightFormText.annaMsChenBrotherWang.en}
            className={inputClass}
            onChange={(event) => updateForm({ salutation: event.target.value })}
          />
        </label>

        <div className="grid gap-2">
          <span className="text-sm font-semibold text-home-gold-text">{zh ? contactUsSpotlightFormText.contactMethod.zh : contactUsSpotlightFormText.contactMethod.en} <span aria-hidden="true" className="text-rose-600">*</span></span>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-home-border bg-slate-50 p-1" role="group" aria-label={zh ? contactUsSpotlightFormText.chooseContactMethod.zh : contactUsSpotlightFormText.chooseContactMethod.en}>
            {([
              { value: 'email' as const, label: 'Email', Icon: Mail },
              { value: 'phone' as const, label: zh ? contactUsSpotlightFormText.phone.zh : contactUsSpotlightFormText.phone.en, Icon: Phone },
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
                aria-label={zh ? contactUsSpotlightFormText.countryOrRegionCode.zh : contactUsSpotlightFormText.countryOrRegionCode.en}
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
                placeholder={zh ? contactUsSpotlightFormText.eG0211234567.zh : contactUsSpotlightFormText.eG0211234567.en}
                aria-label={zh ? contactUsSpotlightFormText.phoneNumber.zh : contactUsSpotlightFormText.phoneNumber.en}
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
          <span>{zh ? contactUsSpotlightFormText.message.zh : contactUsSpotlightFormText.message.en} <span aria-hidden="true" className="text-rose-600">*</span></span>
          <textarea
            required
            rows={5}
            maxLength={2000}
            value={form.message}
            placeholder={zh ? contactUsSpotlightFormText.tellUsHowWeCanHelp.zh : contactUsSpotlightFormText.tellUsHowWeCanHelp.en}
            aria-invalid={Boolean(touched.message && errors.message)}
            className={`${inputClass} resize-y py-2.5 leading-6`}
            onBlur={() => setTouched((current) => ({ ...current, message: true }))}
            onChange={(event) => updateForm({ message: event.target.value })}
          />
          {touched.message && errors.message ? <span className="text-xs font-medium text-rose-600">{errors.message}</span> : null}
        </label>

        <input
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(event) => updateForm({ website: event.target.value })}
          aria-hidden="true"
        />

        <label className="flex items-start gap-3 text-xs leading-5 text-home-muted">
          <input
            type="checkbox"
            checked={form.consent}
            className="mt-1 h-4 w-4 accent-home-green"
            onChange={(event) => updateForm({ consent: event.target.checked })}
          />
          {zh
            ? contactUsSpotlightFormText.iAgreeThatTheChurchMayUseTheseDetails.zh
            : contactUsSpotlightFormText.iAgreeThatTheChurchMayUseTheseDetails.en}
        </label>
        {touched.consent && errors.consent ? <span className="text-xs font-medium text-rose-600">{errors.consent}</span> : null}

        <button
          type="submit"
          disabled={!isValid || controlsDisabled}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-home-green px-5 text-sm font-semibold text-white transition hover:bg-home-green-hover focus:outline-none focus:ring-2 focus:ring-home-green/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <Send className="h-4 w-4" />
          {status === 'submitting' ? (zh ? contactUsSpotlightFormText.sending.zh : contactUsSpotlightFormText.sending.en) : (zh ? contactUsSpotlightFormText.sendMessage.zh : contactUsSpotlightFormText.sendMessage.en)}
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
