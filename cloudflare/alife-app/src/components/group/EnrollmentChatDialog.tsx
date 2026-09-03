import { useEffect, useRef, useState } from 'react'
import { translateUi, type UiTextKey } from '../../i18n/uiText'
import type { GroupEventRecord } from '../../types/event'
import type { EnrollmentDraft } from '../../types/enrollment'
import { enrollmentSessionService } from '../../services/enrollmentSessionService'
import { normalizeApiError } from '../../services/http'

type Props = {
  open?: boolean
  variant?: 'dialog' | 'page'
  groupId: string
  event: GroupEventRecord
  memberId?: string
  initialApplicantName?: string
  language: string
  onClose?: () => void
  onSuccess: (message: string) => void
}

const EnrollmentChatDialog = ({
  open = true,
  variant = 'dialog',
  groupId,
  event,
  initialApplicantName = '',
  language,
  onClose,
  onSuccess,
}: Props) => {
  const t = (key: UiTextKey) => translateUi(language, key)
  const isDialog = variant === 'dialog'
  const [applicantName, setApplicantName] = useState('')
  const [consentStatus, setConsentStatus] = useState<EnrollmentDraft['consentStatus']>('unknown')
  const [paymentFiles, setPaymentFiles] = useState<File[]>([])
  const [commitStatus, setCommitStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [commitError, setCommitError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nameTouchedRef = useRef(false)

  useEffect(() => {
    nameTouchedRef.current = false
    setApplicantName(initialApplicantName.trim())
    setConsentStatus('unknown')
    setPaymentFiles([])
    setCommitStatus('idle')
    setCommitError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [event.id, open])

  useEffect(() => {
    const trimmedName = initialApplicantName.trim()
    if (!trimmedName || nameTouchedRef.current) {
      return
    }

    setApplicantName((current) => current.trim() ? current : trimmedName)
  }, [initialApplicantName])

  if (!open) {
    return null
  }

  const title = language === 'zh'
    ? event.titleZh || event.titleEn || translateUi(language, 'untitled')
    : event.titleEn || event.titleZh || translateUi(language, 'untitled')

  const canCommit = Boolean(applicantName.trim())
    && consentStatus === 'granted'
    && commitStatus !== 'saving'
    && commitStatus !== 'saved'

  const resetCommitState = () => {
    if (commitStatus !== 'idle') {
      setCommitStatus('idle')
    }
    if (commitError) {
      setCommitError('')
    }
  }

  const handleCommit = async () => {
    if (!canCommit) {
      return
    }

    setCommitStatus('saving')
    setCommitError('')

    const draft: EnrollmentDraft = {
      eventId: event.id,
      applicantName: applicantName.trim(),
      consentStatus,
    }

    try {
      await enrollmentSessionService.createEnrollment({
        eventId: event.id,
        groupId,
        draft,
        paymentFiles,
      })
      setCommitStatus('saved')
      onSuccess(t('registeredSuccessfully'))
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setCommitStatus('error')
      setCommitError(apiError.message)
    }
  }

  return (
    <div className={isDialog ? 'fixed inset-0 z-[60] flex items-end bg-slate-950/45 desktop:items-center desktop:justify-center' : 'mx-auto flex w-full max-w-3xl flex-col'}>
      {isDialog ? (
        <button type="button" className="absolute inset-0" aria-label={t('closeEnrollmentDialog')} onClick={() => onClose?.()} />
      ) : null}
      <section className={isDialog ? 'relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl desktop:max-w-2xl desktop:rounded-3xl' : 'flex w-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm'}>
        {isDialog ? <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
              {t('eventEnrollment')}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            onClick={() => onClose?.()}
            aria-label={t('closeEnrollmentDialog')}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div> : null}

        <form
          className="space-y-5 overflow-y-auto px-5 py-5"
          onSubmit={(event) => {
            event.preventDefault()
            handleCommit().catch(() => undefined)
          }}
        >
          <div>
            <label htmlFor="enrollment-applicant-name" className="block text-sm font-medium text-slate-900">
              {t('name')}
            </label>
            <input
              id="enrollment-applicant-name"
              type="text"
              value={applicantName}
              onChange={(event) => {
                nameTouchedRef.current = true
                setApplicantName(event.target.value)
                resetCommitState()
              }}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              autoComplete="name"
              required
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-900">{t('consent')}</legend>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="radio"
                name="enrollment-consent"
                value="granted"
                checked={consentStatus === 'granted'}
                onChange={() => {
                  setConsentStatus('granted')
                  resetCommitState()
                }}
                className="mt-1 h-4 w-4 border-slate-300 text-emerald-700 focus:ring-emerald-500"
                required
              />
              <span>{t('consentGranted')}</span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="radio"
                name="enrollment-consent"
                value="declined"
                checked={consentStatus === 'declined'}
                onChange={() => {
                  setConsentStatus('declined')
                  resetCommitState()
                }}
                className="mt-1 h-4 w-4 border-slate-300 text-emerald-700 focus:ring-emerald-500"
              />
              <span>{t('consentDeclined')}</span>
            </label>
          </fieldset>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{t('paymentFiles')}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{t('enrollmentRequirementsHint')}</p>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                onClick={() => fileInputRef.current?.click()}
              >
                {t('attachPaymentFiles')}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              multiple
              onChange={(event) => {
                setPaymentFiles(Array.from(event.target.files ?? []))
                resetCommitState()
              }}
            />

            {paymentFiles.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                {t('noFilesAttached')}
              </p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-700">
                {paymentFiles.map((file) => (
                  <li key={`${file.name}-${file.size}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    {file.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {commitError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {commitError}
            </p>
          ) : null}

          {commitStatus === 'saved' ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {t('registeredSuccessfully')}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
            {isDialog ? (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                onClick={() => onClose?.()}
              >
                {t('cancel')}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={!canCommit}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {commitStatus === 'saving' ? t('submitting') : t('createEnrollment')}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default EnrollmentChatDialog
