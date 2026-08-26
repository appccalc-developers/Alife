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
      ? (isZh ? '公开访问' : 'Public access')
      : (isZh ? '公开小组页面' : 'Public group page')
  }

  if (visibility === 'group') {
    return isZh ? '小组成员可见' : 'Group members only'
  }

  return isZh ? '仅保存草稿' : 'Save as draft'
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
      ? (isZh ? '保存并发布' : 'Save and publish')
      : (isZh ? '保存为公开小组页面' : 'Save as public group page')
    : model.visibility === 'group'
      ? (isZh ? '保存并对小组可见' : 'Save for group')
      : (isZh ? '保存草稿' : 'Save draft')
  const publishGuidance = (() => {
    if (!validationReady) {
      return {
        tone: 'warning',
        title: isZh ? '下一步：先修正页面内容' : 'Next: fix page content',
        detail: isZh ? '标题或区块还有错误，修正后才可以保存。' : 'Title or section errors need to be fixed before saving.',
        action: isZh ? '修正后保存' : 'Save after fixing',
      }
    }

    if (canEditVisibility && !visibilityReady) {
      return {
        tone: 'warning',
        title: isZh ? '下一步：选择发布范围' : 'Next: choose visibility',
        detail: isZh ? '现在还是草稿。选择小组可见或公开页面后，再保存交付。' : 'This is still a draft. Choose group or public visibility before saving.',
        action: isZh ? '保存草稿' : 'Save draft',
      }
    }

    if (!translationsReady || !imagesReady) {
      return {
        tone: 'active',
        title: isZh ? '下一步：保存并处理待办' : 'Next: save and process pending work',
        detail: isZh ? '保存时会先处理本地图片和双语补全，然后写入页面。' : 'Saving will handle local images and bilingual completion before writing the page.',
        action: saveActionLabel,
      }
    }

    if (!savedReady) {
      return {
        tone: 'active',
        title: model.visibility === 'public'
          ? (isZh ? '下一步：保存并发布页面' : 'Next: save and publish')
          : model.visibility === 'group'
            ? (isZh ? '下一步：保存给小组查看' : 'Next: save for group')
            : (isZh ? '下一步：保存草稿' : 'Next: save draft'),
        detail: isZh ? '检查项已通过，点击保存后这次编辑才会生效。' : 'Checks are ready. Save to apply the current edits.',
        action: saveActionLabel,
      }
    }

    return {
      tone: 'done',
      title: isZh ? '页面已保存' : 'Page is saved',
      detail: isZh ? '当前内容已经写入，可以退出编辑器或继续调整。' : 'The current content is saved. You can exit or keep editing.',
      action: isZh ? '已保存' : 'Saved',
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
            {isZh ? '准备发布' : 'Ready to publish'}
          </p>
          <h2 className="mt-1 text-lg font-black tracking-[-0.02em] text-[#18332d]">
            {isZh ? '保存前最后检查' : 'Final checks before saving'}
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
                  {isZh ? '发布指引' : 'Publishing guide'}
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
            {isZh ? '保存前检查' : 'Pre-save checks'}
          </p>
          <ReadinessRow
            ready={validationReady}
            icon={<AlertTriangle className="h-4 w-4" />}
            label={isZh ? '内容校验' : 'Content validation'}
            detail={validationReady
              ? (isZh ? '标题和区块结构可以保存。' : 'Title and section structure can be saved.')
              : (isZh ? '请先修正标题或区块错误。' : 'Fix title or section errors before saving.')}
          />
          <ReadinessRow
            ready={translationsReady}
            icon={<Languages className="h-4 w-4" />}
            label={isZh ? '双语完整度' : 'Bilingual completion'}
            detail={translationsReady
              ? (isZh ? '中英文内容已补齐。' : 'Chinese and English content is complete.')
              : (isZh ? `还有 ${publishReadiness.missingTranslationCount} 处会在保存时请求 AI 补齐。` : `${publishReadiness.missingTranslationCount} fields will request AI completion when saving.`)}
          />
          <ReadinessRow
            ready={imagesReady}
            icon={<ImageUp className="h-4 w-4" />}
            label={isZh ? '图片上传' : 'Image upload'}
            detail={imagesReady
              ? (isZh ? '没有本地待上传图片。' : 'No local images are waiting to upload.')
              : (isZh ? '保存时会先上传本地图片再替换链接。' : 'Saving will upload local images before replacing links.')}
          />
          <ReadinessRow
            ready={visibilityReady || !canEditVisibility}
            icon={<ShieldCheck className="h-4 w-4" />}
            label={isZh ? '发布范围' : 'Visibility'}
            detail={canEditVisibility
              ? (isZh ? `当前设置为：${formatVisibilityLabel(model.visibility, true, isGlobalPage)}。` : `Current setting: ${formatVisibilityLabel(model.visibility, false, isGlobalPage)}.`)
              : (isZh ? '只有领袖或管理员可以调整发布范围。' : 'Only leaders or admins can change visibility.')}
          />
          <ReadinessRow
            ready={savedReady}
            icon={<Save className="h-4 w-4" />}
            label={isZh ? '保存状态' : 'Save state'}
            detail={savedReady
              ? (isZh ? '当前页面已保存。' : 'The current page is saved.')
              : (isZh ? '页面还有未保存内容。' : 'This page still has unsaved content.')}
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
