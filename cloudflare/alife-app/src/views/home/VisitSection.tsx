import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { MessageCircle, X, CheckCircle } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { entranceAnimation, createSectionHandler, media } from './homeUtils'
import type { HomeCopy, Language } from './homeCopy'
import { visitContactService } from '../../services/visitContactService'
import {
  buildVisitContactPhone,
  isVisitContactEmailValid,
  isVisitContactPhoneValid,
  VISIT_CONTACT_COUNTRY_CODES,
  type VisitContactCountryCode,
} from '../../utils/visitContactValidation'

type Props = {
  copy: HomeCopy
  language: Language
}

type ContactLanguage = Language | 'bilingual'

const VisitSection = ({ copy, language }: Props) => {
  const prefersReducedMotion = useReducedMotion()
  const entrance = entranceAnimation(prefersReducedMotion)
  const scrollToSection = createSectionHandler()
  const [contactOpen, setContactOpen] = useState(false)
  const [contactForm, setContactForm] = useState({
    displayName: '',
    email: '',
    phoneCountryCode: '+64' as VisitContactCountryCode,
    phoneNumber: '',
    preferredLanguage: language as ContactLanguage,
    message: '',
    consent: false,
    website: '',
  })
  const [formStartedAt, setFormStartedAt] = useState(() => Date.now())
  const [submittingContact, setSubmittingContact] = useState(false)
  const [contactStatus, setContactStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setContactForm((current) => ({ ...current, preferredLanguage: language }))
  }, [language])

  const phoneFull = useMemo(
    () => contactForm.phoneNumber.trim()
      ? buildVisitContactPhone(contactForm.phoneCountryCode, contactForm.phoneNumber)
      : '',
    [contactForm.phoneCountryCode, contactForm.phoneNumber],
  )

  const errors = useMemo(() => {
    const result: Record<string, string> = {}
    const name = contactForm.displayName.trim()
    const email = contactForm.email.trim()
    const phoneNumber = contactForm.phoneNumber.trim()
    const message = contactForm.message.trim()

    if (!name) result.name = copy.visitContactNameRequired
    if (email && !isVisitContactEmailValid(email)) result.email = copy.visitContactEmailInvalid
    if (phoneNumber && !isVisitContactPhoneValid(contactForm.phoneCountryCode, phoneNumber)) {
      result.phone = copy.visitContactPhoneInvalid
    }
    if (!email && !phoneNumber) result.contact = copy.visitContactHint
    if (!message) result.message = copy.visitContactMessageRequired
    if (!contactForm.consent) result.consent = language === 'zh' ? '请先同意隐私说明' : 'Please accept the privacy notice'

    return result
  }, [contactForm, copy, language])

  const isValid = Object.keys(errors).length === 0

  const submitContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTouched({ displayName: true, email: true, phoneNumber: true, message: true, consent: true })
    if (!isValid) return

    setSubmittingContact(true)
    setContactStatus('idle')

    try {
      await visitContactService.create({
        displayName: contactForm.displayName.trim(),
        email: contactForm.email.trim() || null,
        phone: phoneFull || null,
        preferredLanguage: contactForm.preferredLanguage,
        message: contactForm.message.trim(),
        sourcePage: window.location.pathname,
        requestKind: 'visitorMessage',
        replyPreference: contactForm.email.trim() ? 'email' : 'phone',
        privacyConsent: contactForm.consent,
        privacyConsentVersion: 'public-visit-v1',
        honeypot: contactForm.website,
        formStartedUnixMilliseconds: formStartedAt,
      })
      setContactStatus('success')
      setContactForm({
        displayName: '',
        email: '',
        phoneCountryCode: '+64' as VisitContactCountryCode,
        phoneNumber: '',
        preferredLanguage: language as ContactLanguage,
        message: '',
        consent: false,
        website: '',
      })
      setTouched({})
    } catch {
      setContactStatus('error')
    } finally {
      setSubmittingContact(false)
    }
  }

  return (
    <section id="visit" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      <motion.div {...entrance} className="mx-auto grid max-w-6xl overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(30,18,10,0.08)] lg:grid-cols-[0.46fr_0.54fr]">
        <div className="relative min-h-[22rem]">
          <img src={media.visit} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-home-dark/50 to-transparent" />
        </div>
        <div className="flex items-center p-7 sm:p-10 lg:p-14">
          <div>
            <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{copy.visitTitle}</h2>
            <p className="mt-4 max-w-[45ch] text-[0.94rem] leading-7 text-home-muted">{copy.visitBody}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-home-green px-5 text-sm font-semibold text-white transition hover:bg-home-green-hover" href="#location" onClick={(event) => scrollToSection(event, '#location')}>
                {copy.visitAction} <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => {
                  setContactOpen(true)
                  setContactStatus('idle')
                  setFormStartedAt(Date.now())
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-home-border bg-white px-5 text-sm font-semibold text-home-gold-text transition hover:-translate-y-0.5 hover:border-home-green/35 hover:bg-[#fffaf0] focus:outline-none focus:ring-2 focus:ring-home-green/30"
              >
                <MessageCircle className="h-4 w-4 text-home-green" />
                {copy.visitContactAction}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {contactOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-home-dark/58 p-3 sm:px-4 sm:py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="visit-contact-title">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-home-border bg-white shadow-[0_24px_80px_rgba(34,25,17,0.28)] max-h-[92vh] flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-home-border/70 px-4 py-4 sm:px-6 sm:py-5 shrink-0">
              <div>
                <h3 id="visit-contact-title" className="text-lg sm:text-xl font-bold text-home-gold-text">{copy.visitContactTitle}</h3>
                <p className="mt-1 sm:mt-2 text-xs sm:text-sm leading-5 sm:leading-6 text-home-muted">{copy.visitContactBody}</p>
              </div>
              <button
                type="button"
                onClick={() => setContactOpen(false)}
                className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-lg text-home-muted transition hover:bg-home-border/40 focus:outline-none focus:ring-2 focus:ring-home-green/30"
                aria-label={copy.visitContactClose}
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            <div className="px-4 py-4 sm:px-6 sm:py-5 overflow-y-auto">
              {contactStatus === 'success' ? (
                <div className="flex flex-col items-center py-8 sm:py-10 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100">
                    <CheckCircle className="h-7 w-7 text-emerald-600" />
                  </div>
                  <h4 className="mt-4 text-lg font-bold text-home-gold-text">{copy.visitContactSuccessTitle}</h4>
                  <p className="mt-2 max-w-[26ch] text-sm leading-6 text-home-muted">{copy.visitContactSuccess}</p>
                  <button
                    type="button"
                    onClick={() => setContactOpen(false)}
                    className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-home-green px-6 text-sm font-semibold text-white transition hover:bg-home-green-hover"
                  >
                    {copy.visitContactConfirm}
                  </button>
                </div>
              ) : (
                <form className="grid gap-3 sm:gap-4" onSubmit={submitContact}>
                  <label className="grid gap-1.5 min-w-0 text-sm font-semibold text-home-gold-text">
                    {copy.visitContactName}
                    <input
                      value={contactForm.displayName}
                      onChange={(event) => setContactForm((current) => ({ ...current, displayName: event.target.value }))}
                      onBlur={() => setTouched((current) => ({ ...current, displayName: true }))}
                      className="min-h-11 min-w-0 rounded-lg border border-home-border bg-white px-3 text-sm font-medium text-home-gold-text outline-none transition focus:border-home-green focus:ring-2 focus:ring-home-green/20"
                    />
                    {touched.displayName && errors.name ? (
                      <span className="text-xs font-medium text-rose-600">{errors.name}</span>
                    ) : null}
                  </label>

                  <input
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                    value={contactForm.website}
                    onChange={(event) => setContactForm((current) => ({ ...current, website: event.target.value }))}
                    aria-hidden="true"
                  />

                  <label className="flex items-start gap-3 text-xs leading-5 text-home-muted">
                    <input
                      type="checkbox"
                      checked={contactForm.consent}
                      className="mt-1 h-4 w-4 accent-home-green"
                      onChange={(event) => setContactForm((current) => ({ ...current, consent: event.target.checked }))}
                    />
                    {language === 'zh'
                      ? '我同意教会使用这些资料回复本次请求。提交不会创建 ALIFE 账号。'
                      : 'I agree that the church may use these details to respond. Submitting does not create an ALIFE account.'}
                  </label>
                  {touched.consent && errors.consent ? <span className="text-xs font-medium text-rose-600">{errors.consent}</span> : null}

                  <label className="grid gap-1.5 min-w-0 text-sm font-semibold text-home-gold-text">
                    {copy.visitContactEmail}
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))}
                      onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                      className="min-h-11 min-w-0 rounded-lg border border-home-border bg-white px-3 text-sm font-medium text-home-gold-text outline-none transition focus:border-home-green focus:ring-2 focus:ring-home-green/20"
                    />
                    {touched.email && errors.email ? (
                      <span className="text-xs font-medium text-rose-600">{errors.email}</span>
                    ) : null}
                  </label>

                  <label className="grid gap-1.5 min-w-0 text-sm font-semibold text-home-gold-text">
                    {copy.visitContactPhone}
                    <div className="flex gap-2">
                      <select
                        aria-label={copy.visitContactCountryCode}
                        value={contactForm.phoneCountryCode}
                        onChange={(event) => setContactForm((current) => ({ ...current, phoneCountryCode: event.target.value as VisitContactCountryCode }))}
                        className="min-h-11 w-[7rem] shrink-0 rounded-lg border border-home-border bg-white px-2 text-sm font-medium text-home-gold-text outline-none transition focus:border-home-green focus:ring-2 focus:ring-home-green/20"
                      >
                        {VISIT_CONTACT_COUNTRY_CODES.map((code) => (
                          <option key={code.value} value={code.value}>{code.value}</option>
                        ))}
                      </select>
                      <input
                        aria-label={copy.visitContactPhone}
                        value={contactForm.phoneNumber}
                        onChange={(event) => setContactForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                        onBlur={() => setTouched((current) => ({ ...current, phoneNumber: true }))}
                        placeholder={copy.visitContactPhonePlaceholder}
                        className="min-h-11 min-w-0 flex-1 rounded-lg border border-home-border bg-white px-3 text-sm font-medium text-home-gold-text outline-none transition focus:border-home-green focus:ring-2 focus:ring-home-green/20"
                      />
                    </div>
                    {touched.phoneNumber && errors.phone ? (
                      <span className="text-xs font-medium text-rose-600">{errors.phone}</span>
                    ) : (
                      <span className="text-xs text-home-muted">{copy.visitContactPhoneHint}</span>
                    )}
                  </label>

                  {touched.email && touched.phoneNumber && errors.contact ? (
                    <p className="text-xs font-medium text-rose-600">{errors.contact}</p>
                  ) : null}

                  <label className="grid gap-1.5 min-w-0 text-sm font-semibold text-home-gold-text">
                    {copy.visitContactLanguage}
                    <select
                      value={contactForm.preferredLanguage}
                      onChange={(event) => setContactForm((current) => ({ ...current, preferredLanguage: event.target.value as ContactLanguage }))}
                      className="min-h-11 min-w-0 rounded-lg border border-home-border bg-white px-3 text-sm font-medium text-home-gold-text outline-none transition focus:border-home-green focus:ring-2 focus:ring-home-green/20"
                    >
                      <option value="zh">中文</option>
                      <option value="en">English</option>
                      <option value="bilingual">Bilingual</option>
                    </select>
                  </label>

                  <label className="grid gap-1.5 min-w-0 text-sm font-semibold text-home-gold-text">
                    {copy.visitContactMessage}
                    <textarea
                      rows={3}
                      value={contactForm.message}
                      onChange={(event) => setContactForm((current) => ({ ...current, message: event.target.value }))}
                      onBlur={() => setTouched((current) => ({ ...current, message: true }))}
                      className="resize-none min-w-0 rounded-lg border border-home-border bg-white px-3 py-2.5 text-sm font-medium leading-6 text-home-gold-text outline-none transition focus:border-home-green focus:ring-2 focus:ring-home-green/20"
                    />
                    {touched.message && errors.message ? (
                      <span className="text-xs font-medium text-rose-600">{errors.message}</span>
                    ) : null}
                  </label>

                  {contactStatus === 'error' ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{copy.visitContactError}</p> : null}

                  <button
                    type="submit"
                    disabled={submittingContact || !isValid}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-home-green px-5 text-sm font-semibold text-white transition hover:bg-home-green-hover disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {submittingContact ? '...' : copy.visitContactSubmit}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default VisitSection
