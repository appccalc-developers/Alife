import { pageSettingsPanelText } from '../../i18n/pageSettingsPanel.ts'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, DoorOpen, ImageUp, Languages, Save, ShieldCheck } from 'lucide-react'
import AppActionButton from '../layout/AppActionButton'
import AppBadge from '../layout/AppBadge'
import AppSectionCard from '../layout/AppSectionCard'
import { useUiText } from '../../i18n/uiText'
import { useAuthStore } from '../../stores/auth'
import type { PageVisibility } from '../../types/group'
import type { PageEditModel } from '../../types/page-editor'
import useConfirmation from '../../hooks/useConfirmation'

type PublishReadiness = {
  missingTranslationCount: number
  hasLocalImages: boolean
  hasUnsavedChanges: boolean
  hasValidationErrors: boolean
  canSave: boolean
  saving: boolean
}

type Props = {
  model: PageEditModel
  canEdit: boolean
  canEditVisibility: boolean
  message?: string
  publishReadiness?: PublishReadiness
  onSave?: () => void
  onExit?: () => void
  onChange: (value: PageEditModel) => void
  onResetDefaultHome?: () => void
}

const visibilityOptions: PageVisibility[] = ['draft', 'group', 'public']

const formatVisibilityLabel = (visibility: PageVisibility, isZh: boolean, isGlobalPage = false) => {
  if (visibility === 'public') {
    return isGlobalPage
      ? (isZh ? pageSettingsPanelText.publicAccess.zh : pageSettingsPanelText.publicAccess.en)
      : (isZh ? pageSettingsPanelText.publicGroupPage.zh : pageSettingsPanelText.publicGroupPage.en)
  }

  if (visibility === 'group') {
    return isZh ? pageSettingsPanelText.groupMembersOnly.zh : pageSettingsPanelText.groupMembersOnly.en
  }

  return isZh ? pageSettingsPanelText.saveAsDraft.zh : pageSettingsPanelText.saveAsDraft.en
}

const ReadinessRow = ({
  ready,
  icon,
  label,
  detail,
}: {
  ready: boolean
  icon: ReactNode
  label: string
  detail: string
}) => (
  <div className="flex gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
    <span
      className={[
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
        ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
      ].join(' ')}
    >
      {ready ? <CheckCircle2 className="h-4 w-4" /> : icon}
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-black text-slate-950">{label}</span>
      <span className="mt-0.5 block text-xs leading-5 text-slate-500">{detail}</span>
    </span>
  </div>
)

const PageSettingsPanel = ({
  model,
  canEdit,
  canEditVisibility,
  message,
  publishReadiness,
  onSave,
  onExit,
  onChange,
  onResetDefaultHome,
}: Props) => {
  const t = useUiText()
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const { language } = useAuthStore()
  const isZh = language === 'zh'
  const canUsePublishDock = Boolean(publishReadiness && onSave)
  const isGlobalPage = !model.groupId
  const visibilityReady = model.visibility !== 'draft'
  const translationsReady = !publishReadiness || publishReadiness.missingTranslationCount === 0
  const imagesReady = !publishReadiness || !publishReadiness.hasLocalImages
  const validationReady = !publishReadiness || !publishReadiness.hasValidationErrors
  const savedReady = !publishReadiness || (!publishReadiness.hasUnsavedChanges && Boolean(model.id))
  const manualSaveNeeded = !savedReady || !translationsReady || !imagesReady
  const readinessCount = [
    validationReady,
    translationsReady,
    imagesReady,
    visibilityReady || !canEditVisibility,
    savedReady,
  ].filter(Boolean).length
  const saveActionLabel = model.visibility === 'public'
    ? isGlobalPage
      ? (isZh ? pageSettingsPanelText.saveAndPublish.zh : pageSettingsPanelText.saveAndPublish.en)
      : (isZh ? pageSettingsPanelText.saveAsPublicGroupPage.zh : pageSettingsPanelText.saveAsPublicGroupPage.en)
    : model.visibility === 'group'
      ? (isZh ? pageSettingsPanelText.saveForGroup.zh : pageSettingsPanelText.saveForGroup.en)
      : (isZh ? pageSettingsPanelText.saveDraft.zh : pageSettingsPanelText.saveDraft.en)
  const publishGuidance = (() => {
    if (!validationReady) {
      return {
        tone: 'warning',
        title: isZh ? pageSettingsPanelText.nextFixPageContent.zh : pageSettingsPanelText.nextFixPageContent.en,
        detail: isZh ? pageSettingsPanelText.titleOrSectionErrorsNeedToBeFixedBefore.zh : pageSettingsPanelText.titleOrSectionErrorsNeedToBeFixedBefore.en,
        action: isZh ? pageSettingsPanelText.saveAfterFixing.zh : pageSettingsPanelText.saveAfterFixing.en,
      }
    }

    if (canEditVisibility && !visibilityReady) {
      return {
        tone: 'warning',
        title: isZh ? pageSettingsPanelText.nextChooseVisibility.zh : pageSettingsPanelText.nextChooseVisibility.en,
        detail: isZh ? pageSettingsPanelText.thisIsStillADraftChooseGroupOrPublic.zh : pageSettingsPanelText.thisIsStillADraftChooseGroupOrPublic.en,
        action: isZh ? pageSettingsPanelText.saveDraft.zh : pageSettingsPanelText.saveDraft.en,
      }
    }

    if (!translationsReady || !imagesReady) {
      return {
        tone: 'active',
        title: isZh ? pageSettingsPanelText.nextSaveAndProcessPendingWork.zh : pageSettingsPanelText.nextSaveAndProcessPendingWork.en,
        detail: isZh ? pageSettingsPanelText.savingWillHandleLocalImagesAndBilingualCompletionBefore.zh : pageSettingsPanelText.savingWillHandleLocalImagesAndBilingualCompletionBefore.en,
        action: saveActionLabel,
      }
    }

    if (!savedReady) {
      return {
        tone: 'active',
        title: model.visibility === 'public'
          ? (isZh ? pageSettingsPanelText.nextSaveAndPublish.zh : pageSettingsPanelText.nextSaveAndPublish.en)
          : model.visibility === 'group'
            ? (isZh ? pageSettingsPanelText.nextSaveForGroup.zh : pageSettingsPanelText.nextSaveForGroup.en)
            : (isZh ? pageSettingsPanelText.nextSaveDraft.zh : pageSettingsPanelText.nextSaveDraft.en),
        detail: isZh ? pageSettingsPanelText.checksAreReadySaveToApplyTheCurrentEdits.zh : pageSettingsPanelText.checksAreReadySaveToApplyTheCurrentEdits.en,
        action: saveActionLabel,
      }
    }

    return {
      tone: 'done',
      title: isZh ? pageSettingsPanelText.pageIsSaved.zh : pageSettingsPanelText.pageIsSaved.en,
      detail: isZh ? pageSettingsPanelText.theCurrentContentIsSavedYouCanExitOr.zh : pageSettingsPanelText.theCurrentContentIsSavedYouCanExitOr.en,
      action: isZh ? pageSettingsPanelText.saved.zh : pageSettingsPanelText.saved.en,
    }
  })()
  const updateLocalizedField = (field: 'title' | 'description', key: 'en' | 'zh', value: string) => {
    const current = model[field]
    onChange({
      ...model,
      [field]: {
        en: key === 'en' ? value : current.en ?? '',
        zh: key === 'zh' ? value : current.zh ?? '',
      },
    })
  }

  return (
  <div className="space-y-4">
    {canUsePublishDock && publishReadiness ? (
      <section className="overflow-hidden rounded-2xl border border-[#2f4b42]/10 bg-white shadow-[0_14px_36px_rgba(31,56,48,0.1)]">
        <div className="border-b border-slate-200 bg-[#f7f3e9] px-4 py-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#176b5a]">
            {isZh ? pageSettingsPanelText.readyToPublish.zh : pageSettingsPanelText.readyToPublish.en}
          </p>
          <h2 className="mt-1 text-lg font-black tracking-[-0.02em] text-[#18332d]">
            {isZh ? pageSettingsPanelText.finalChecksBeforeSaving.zh : pageSettingsPanelText.finalChecksBeforeSaving.en}
          </h2>
        </div>
        <div className="space-y-3 p-4">
          <div
            className={[
              'rounded-2xl border p-3',
              publishGuidance.tone === 'done'
                ? 'border-emerald-200 bg-emerald-50/80'
                : publishGuidance.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50/80'
                  : 'border-[#176b5a]/20 bg-[#f1faf6]',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#176b5a]">
                  {isZh ? pageSettingsPanelText.publishingGuide.zh : pageSettingsPanelText.publishingGuide.en}
                </p>
                <h3 className="mt-1 text-base font-black text-slate-950">{publishGuidance.title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">{publishGuidance.detail}</p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#176b5a] shadow-sm">
                {readinessCount}/5
              </span>
            </div>
            <div className="mt-3 rounded-xl border border-white/80 bg-white/85 p-3 shadow-sm">
              <label className="block space-y-1.5">
                <span className="text-sm font-black text-slate-800">{t('visibility')}</span>
                <select
                  value={model.visibility}
                  disabled={!canEditVisibility}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                  onChange={(event) => onChange({ ...model, visibility: event.target.value as PageVisibility })}
                >
                  {visibilityOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatVisibilityLabel(option, isZh, isGlobalPage)}
                    </option>
                  ))}
                </select>
              </label>
              {!canEditVisibility ? <p className="mt-1.5 text-xs text-slate-500">{t('leaderVisibilityOnly')}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AppBadge variant="warning">{formatVisibilityLabel('draft', isZh, isGlobalPage)}</AppBadge>
                <AppBadge variant="info">{formatVisibilityLabel('group', isZh, isGlobalPage)}</AppBadge>
                <AppBadge variant="success">{formatVisibilityLabel('public', isZh, isGlobalPage)}</AppBadge>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <AppActionButton
                variant="primary"
                block
                disabled={!manualSaveNeeded || !publishReadiness.canSave || publishReadiness.saving}
                onClick={onSave}
              >
                <Save className="mr-2 h-4 w-4" />
                {publishReadiness.saving ? t('saving') : publishGuidance.action}
              </AppActionButton>
              {onExit ? (
                <AppActionButton variant="secondary" block onClick={onExit}>
                  <DoorOpen className="mr-2 h-4 w-4" />
                  {t('exitEditor')}
                </AppActionButton>
              ) : null}
            </div>
          </div>

          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {isZh ? pageSettingsPanelText.preSaveChecks.zh : pageSettingsPanelText.preSaveChecks.en}
          </p>
          <ReadinessRow
            ready={validationReady}
            icon={<AlertTriangle className="h-4 w-4" />}
            label={isZh ? pageSettingsPanelText.contentValidation.zh : pageSettingsPanelText.contentValidation.en}
            detail={validationReady
              ? (isZh ? pageSettingsPanelText.titleAndSectionStructureCanBeSaved.zh : pageSettingsPanelText.titleAndSectionStructureCanBeSaved.en)
              : (isZh ? pageSettingsPanelText.fixTitleOrSectionErrorsBeforeSaving.zh : pageSettingsPanelText.fixTitleOrSectionErrorsBeforeSaving.en)}
          />
          <ReadinessRow
            ready={translationsReady}
            icon={<Languages className="h-4 w-4" />}
            label={isZh ? pageSettingsPanelText.bilingualCompletion.zh : pageSettingsPanelText.bilingualCompletion.en}
            detail={translationsReady
              ? (isZh ? pageSettingsPanelText.chineseAndEnglishContentIsComplete.zh : pageSettingsPanelText.chineseAndEnglishContentIsComplete.en)
              : (isZh ? pageSettingsPanelText.fieldsWillRequestAiCompletionWhenSaving.zh(publishReadiness.missingTranslationCount) : pageSettingsPanelText.fieldsWillRequestAiCompletionWhenSaving.en(publishReadiness.missingTranslationCount))}
          />
          <ReadinessRow
            ready={imagesReady}
            icon={<ImageUp className="h-4 w-4" />}
            label={isZh ? pageSettingsPanelText.imageUpload.zh : pageSettingsPanelText.imageUpload.en}
            detail={imagesReady
              ? (isZh ? pageSettingsPanelText.noLocalImagesAreWaitingToUpload.zh : pageSettingsPanelText.noLocalImagesAreWaitingToUpload.en)
              : (isZh ? pageSettingsPanelText.savingWillUploadLocalImagesBeforeReplacingLinks.zh : pageSettingsPanelText.savingWillUploadLocalImagesBeforeReplacingLinks.en)}
          />
          <ReadinessRow
            ready={visibilityReady || !canEditVisibility}
            icon={<ShieldCheck className="h-4 w-4" />}
            label={isZh ? pageSettingsPanelText.visibility.zh : pageSettingsPanelText.visibility.en}
            detail={canEditVisibility
              ? (isZh ? pageSettingsPanelText.currentSetting.zh(formatVisibilityLabel(model.visibility, true, isGlobalPage)) : pageSettingsPanelText.currentSetting.en(formatVisibilityLabel(model.visibility, false, isGlobalPage)))
              : (isZh ? pageSettingsPanelText.onlyLeadersOrAdminsCanChangeVisibility.zh : pageSettingsPanelText.onlyLeadersOrAdminsCanChangeVisibility.en)}
          />
          <ReadinessRow
            ready={savedReady}
            icon={<Save className="h-4 w-4" />}
            label={isZh ? pageSettingsPanelText.saveState.zh : pageSettingsPanelText.saveState.en}
            detail={savedReady
              ? (isZh ? pageSettingsPanelText.theCurrentPageIsSaved.zh : pageSettingsPanelText.theCurrentPageIsSaved.en)
              : (isZh ? pageSettingsPanelText.thisPageStillHasUnsavedContent.zh : pageSettingsPanelText.thisPageStillHasUnsavedContent.en)}
          />

        </div>
      </section>
    ) : null}

    <AppSectionCard title={t('pageSettings')} subtitle={t('pageSettingsSubtitle')}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">{t('titleEnglish')}</span>
            <input
              value={model.title.en ?? ''}
              disabled={!canEdit}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              placeholder={t('pageTitlePlaceholder')}
              onChange={(event) => updateLocalizedField('title', 'en', event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">{t('titleChinese')}</span>
            <input
              value={model.title.zh ?? ''}
              disabled={!canEdit}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              placeholder={t('pageTitlePlaceholder')}
              onChange={(event) => updateLocalizedField('title', 'zh', event.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">{t('descriptionEnglish')}</span>
            <textarea
              value={model.description.en ?? ''}
              disabled={!canEdit}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              placeholder={t('pageSummaryPlaceholder')}
              onChange={(event) => updateLocalizedField('description', 'en', event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">{t('descriptionChinese')}</span>
            <textarea
              value={model.description.zh ?? ''}
              disabled={!canEdit}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              placeholder={t('pageSummaryPlaceholder')}
              onChange={(event) => updateLocalizedField('description', 'zh', event.target.value)}
            />
          </label>
        </div>

        {onResetDefaultHome ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-950">{t('defaultHomeTemplate')}</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">{t('defaultHomeTemplateHelp')}</p>
            <button
              type="button"
              className="mt-3 inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:opacity-60"
              disabled={!canEdit}
              onClick={() => {
                requestConfirmation({
                  title: t('restoreDefaultHome'),
                  description: t('restoreDefaultHomeConfirm'),
                  confirmLabel: t('restoreDefaultHome'),
                  tone: 'danger',
                }).then((confirmed) => {
                  if (confirmed) {
                    onResetDefaultHome()
                  }
                }).catch(() => undefined)
              }}
            >
              {t('restoreDefaultHome')}
            </button>
          </div>
        ) : null}

      </div>
    </AppSectionCard>

    <AppSectionCard title={t('editingTips')} dense>
      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
        <li>{t('saveDraftTip')}</li>
        <li>{t('publishReadyTip')}</li>
        <li>{t('controlledPresetsTip')}</li>
      </ul>
      {message ? <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">{message}</p> : null}
    </AppSectionCard>
    {confirmationModal}
  </div>
  )
}

export default PageSettingsPanel
