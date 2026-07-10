import { useEffect, useState } from 'react'
import { useUiText } from '../../i18n/uiText'
import { subscribeUnsavedChangesPrompt, type UnsavedChangesPrompt } from '../../utils/unsavedChangesGuard'
import AppActionButton from './AppActionButton'

const UnsavedChangesModalHost = () => {
  const t = useUiText()
  const [prompt, setPrompt] = useState<UnsavedChangesPrompt | null>(null)

  useEffect(() => subscribeUnsavedChangesPrompt(setPrompt), [])

  if (!prompt) {
    return null
  }

  const close = () => setPrompt(null)
  const confirm = () => {
    const onConfirm = prompt.onConfirm
    setPrompt(null)
    onConfirm?.()
  }
  const canConfirmExit = prompt.mode === 'confirm'

  return (
    <div className="fixed inset-0 z-[90] flex items-end bg-slate-950/45 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:items-center sm:justify-center sm:pb-4">
      <button type="button" className="absolute inset-0" aria-label={t('cancel')} onClick={close} />
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
      >
        <h2 id="unsaved-changes-title" className="text-lg font-semibold text-slate-950">
          {t('unsavedChangesTitle')}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{prompt.message}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AppActionButton variant={canConfirmExit ? 'secondary' : 'primary'} onClick={close}>
            {canConfirmExit ? t('stayOnPage') : t('close')}
          </AppActionButton>
          {canConfirmExit ? (
            <AppActionButton variant="danger" onClick={confirm}>
              {t('discardAndLeave')}
            </AppActionButton>
          ) : null}
        </div>
      </section>
    </div>
  )
}

export default UnsavedChangesModalHost
