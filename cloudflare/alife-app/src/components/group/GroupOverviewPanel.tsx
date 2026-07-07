import { useEffect, useMemo, useState, type FormEvent } from 'react'
import AppActionButton from '../layout/AppActionButton'
import AppSectionCard from '../layout/AppSectionCard'
import type { GroupDto } from '../../types/group'
import type { LocalizedText } from '../../types'
import { useUiText } from '../../i18n/uiText'
import { toLocalizedText } from '../../utils/localizedText'
import { aiTranslationService } from '../../services/aiTranslationService'
import { validateRequiredBilingualFields, type MissingTranslatableField } from '../../utils/bilingualValidation'

type Props = {
  group: GroupDto
  saving?: boolean
  onSave?: (payload: { name: LocalizedText; description?: LocalizedText; accessType: GroupDto['accessType']; isClosed: boolean }) => Promise<void> | void
  onStatusMessage?: (message: string) => void
  onDirtyChange?: (hasUnsavedChanges: boolean) => void
  framed?: boolean
}

const hasTextChanged = (current: LocalizedText, saved: LocalizedText) =>
  (current.en ?? '') !== (saved.en ?? '') || (current.zh ?? '') !== (saved.zh ?? '')

const GroupOverviewPanel = ({ group, saving = false, onSave, onStatusMessage, onDirtyChange, framed = true }: Props) => {
  const t = useUiText()
  const [name, setName] = useState(() => toLocalizedText(group.name))
  const [description, setDescription] = useState(() => toLocalizedText(group.description))
  const [accessType, setAccessType] = useState<GroupDto['accessType']>(group.accessType)
  const [isClosed, setIsClosed] = useState(group.isClosed)
  const [aiFilling, setAiFilling] = useState(false)
  const [pendingAiFields, setPendingAiFields] = useState<MissingTranslatableField[]>([])
  const canSave = Boolean(onSave) && Object.values(name).some((value) => value.trim().length > 0) && !saving && !aiFilling
  const requiredBilingualFields = [
    { field: 'name', textType: group.isChurch ? 'churchName' : 'groupName' },
    { field: 'description', textType: group.isChurch ? 'churchDescription' : 'groupDescription' },
  ]
  const savedName = useMemo(() => toLocalizedText(group.name), [group.name])
  const savedDescription = useMemo(() => toLocalizedText(group.description), [group.description])
  const hasUnsavedProfileChanges =
    hasTextChanged(name, savedName) ||
    hasTextChanged(description, savedDescription)

  useEffect(() => {
    setName(toLocalizedText(group.name))
    setDescription(toLocalizedText(group.description))
    setAccessType(group.accessType)
    setIsClosed(group.isClosed)
  }, [group])

  useEffect(() => {
    onDirtyChange?.(hasUnsavedProfileChanges)
  }, [hasUnsavedProfileChanges, onDirtyChange])

  useEffect(() => () => {
    onDirtyChange?.(false)
  }, [onDirtyChange])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSave) return
    const validation = validateRequiredBilingualFields({ name, description }, requiredBilingualFields)
    if (!validation.isComplete) {
      if (validation.blockingIncompleteFields.length > 0) {
        onStatusMessage?.(t('bilingualContentIncompleteBlock'))
        return
      }

      if (validation.canAiAutofill) {
        setPendingAiFields(validation.missingTranslatableFields)
        return
      }
    }

    await onSave?.({ name, description, accessType, isClosed })
  }

  const applyAiTranslations = (fields: Array<{ field: string; language: 'zh' | 'en'; text: string }>, requestedFields: MissingTranslatableField[]) => {
    const requestedTargets = new Set(requestedFields.map((field) => `${field.field}.${field.targetLanguage}`))

    const applyToValue = (fieldName: string, current: LocalizedText) => {
      const next = { ...current }
      fields
        .filter((field) => field.field === fieldName && requestedTargets.has(`${field.field}.${field.language}`))
        .forEach((field) => {
          if (!String(next[field.language] ?? '').trim()) {
            next[field.language] = field.text
          }
        })
      return next
    }

    setName((current) => applyToValue('name', current))
    setDescription((current) => applyToValue('description', current))
  }

  const fillMissingWithAi = async () => {
    if (aiFilling || pendingAiFields.length === 0) return

    const requestedFields = pendingAiFields
    setAiFilling(true)
    try {
      const translatedFields = await aiTranslationService.translateTextFields({
        scope: group.isChurch ? 'church' : 'group',
        groupId: group.id,
        fields: requestedFields,
      })
      applyAiTranslations(translatedFields, requestedFields)
      setPendingAiFields([])
      onStatusMessage?.(t('aiBilingualAutofillComplete'))
    } catch {
      onStatusMessage?.(t('aiBilingualAutofillFailed'))
    } finally {
      setAiFilling(false)
    }
  }

  const title = t(group.isChurch ? 'churchSettings' : 'groupSettings')
  const subtitle = t(group.isChurch ? 'churchOverviewSubtitle' : 'overviewSubtitle')
  const content = (
  <>
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <label>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t(group.isChurch ? 'churchNameEnglish' : 'groupNameEnglish')}</span>
          <input
            value={name.en ?? ''}
            onChange={(event) => setName((current) => ({ ...current, en: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t(group.isChurch ? 'churchNameChinese' : 'groupNameChinese')}</span>
          <input
            value={name.zh ?? ''}
            onChange={(event) => setName((current) => ({ en: current.en ?? '', zh: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t(group.isChurch ? 'churchDescriptionEnglish' : 'groupDescriptionEnglish')}</span>
          <textarea
            value={description.en ?? ''}
            onChange={(event) => setDescription((current) => ({ ...current, en: event.target.value }))}
            className="mt-1 min-h-60 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t(group.isChurch ? 'churchDescriptionChinese' : 'groupDescriptionChinese')}</span>
          <textarea
            value={description.zh ?? ''}
            onChange={(event) => setDescription((current) => ({ en: current.en ?? '', zh: event.target.value }))}
            className="mt-1 min-h-60 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('access')}</span>
          <select
            value={accessType}
            onChange={(event) => setAccessType(event.target.value as GroupDto['accessType'])}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="public">{t('public')}</option>
            <option value="protected">{t('protected')}</option>
            <option value="private">{t('private')}</option>
          </select>
        </label>

        <label>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('status')}</span>
          <select
            value={isClosed ? 'closed' : 'active'}
            onChange={(event) => setIsClosed(event.target.value === 'closed')}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="active">{t('active')}</option>
            <option value="closed">{t('closed')}</option>
          </select>
        </label>

        <div className="flex justify-end sm:col-span-2">
          <AppActionButton type="submit" variant="primary" disabled={!canSave}>
            {aiFilling ? t('aiAutofilling') : saving ? t('saving') : t('saveChanges')}
          </AppActionButton>
        </div>
      </div>
    </form>

    {pendingAiFields.length > 0 ? (
      <div className="fixed inset-0 z-[60] flex items-end bg-slate-950/45 px-4 py-6 desktop:items-center desktop:justify-center">
        <button
          type="button"
          className="absolute inset-0"
          aria-label={t('cancel')}
          onClick={() => {
            if (!aiFilling) setPendingAiFields([])
          }}
        />
        <section className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
          <h3 className="text-base font-semibold text-slate-950">{t('aiBilingualAutofillTitle')}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{t('aiBilingualAutofillConfirm')}</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <AppActionButton variant="secondary" disabled={aiFilling} onClick={() => setPendingAiFields([])}>
              {t('aiBilingualAutofillDecline')}
            </AppActionButton>
            <AppActionButton
              variant="primary"
              disabled={aiFilling}
              onClick={() => {
                fillMissingWithAi().catch(() => undefined)
              }}
            >
              {aiFilling ? t('aiAutofilling') : t('aiBilingualAutofillAccept')}
            </AppActionButton>
          </div>
        </section>
      </div>
    ) : null}
  </>
  )

  if (!framed) {
    return (
      <section className="min-w-0">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#2f4b42]/10 pb-4">
          <div className="min-w-0">
            <h2 className="text-base font-black leading-tight text-[#18332d] sm:text-lg">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#66766f]">{subtitle}</p>
          </div>
        </header>
        {content}
      </section>
    )
  }

  return (
    <AppSectionCard dense title={title} subtitle={subtitle}>
      {content}
    </AppSectionCard>
  )
}

export default GroupOverviewPanel
