import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, LockKeyhole } from 'lucide-react'
import type { LocalizedText } from '../../types'
import { useUiText } from '../../i18n/uiText'
import AppActionButton from '../layout/AppActionButton'
import AppModal from '../layout/AppModal'

type CreateSubgroupModalProps = {
  open: boolean
  busy: boolean
  error?: string
  onClose: () => void
  onCreate: (name: LocalizedText) => void
}

const inputClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-[#cbdad4] bg-white px-3 text-sm text-[#18332d] outline-none transition focus:border-[#21705f] focus:ring-4 focus:ring-[#dcece6]'

const CreateSubgroupModal = ({ open, busy, error, onClose, onCreate }: CreateSubgroupModalProps) => {
  const t = useUiText()
  const englishNameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState<LocalizedText>({ en: '', zh: '' })

  useEffect(() => {
    if (open) setName({ en: '', zh: '' })
  }, [open])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return

    const en = name.en.trim()
    const zh = name.zh.trim()
    const fallback = en || zh
    if (!fallback) return
    onCreate({ en: en || fallback, zh: zh || fallback })
  }

  const hasName = Boolean(name.en.trim() || name.zh.trim())

  return (
    <AppModal
      open={open}
      title={t('manageAddSubgroup')}
      description={t('createSubgroupDescription')}
      closeLabel={t('closeCreateSubgroupDialog')}
      onClose={onClose}
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      closeDisabled={busy}
      initialFocusRef={englishNameRef}
      footer={(
        <>
          <AppActionButton variant="secondary" disabled={busy} onClick={onClose}>
            {t('cancel')}
          </AppActionButton>
          <AppActionButton type="submit" form="create-subgroup-form" variant="primary" disabled={busy || !hasName}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {busy ? t('creatingSubgroup') : t('manageAddSubgroup')}
          </AppActionButton>
        </>
      )}
    >
      <form id="create-subgroup-form" className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-[#40554e]">
            {t('subgroupNameEnglish')}
            <input
              ref={englishNameRef}
              value={name.en}
              maxLength={150}
              autoComplete="off"
              className={inputClass}
              onChange={(event) => setName((current) => ({ ...current, en: event.target.value }))}
            />
          </label>
          <label className="text-sm font-bold text-[#40554e]">
            {t('subgroupNameChinese')}
            <input
              value={name.zh}
              maxLength={150}
              autoComplete="off"
              className={inputClass}
              onChange={(event) => setName((current) => ({ ...current, zh: event.target.value }))}
            />
          </label>
        </div>
        <p className="text-xs leading-5 text-[#66766f]">{t('subgroupNameFallbackHelp')}</p>
        <div className="flex gap-3 rounded-2xl border border-[#c7ddd5] bg-[#f1f7f4] px-4 py-3 text-[#31544b]">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#176b5a]" aria-hidden="true" />
          <p className="text-xs font-semibold leading-5">{t('subgroupProtectedNotice')}</p>
        </div>
        {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p> : null}
      </form>
    </AppModal>
  )
}

export default CreateSubgroupModal
