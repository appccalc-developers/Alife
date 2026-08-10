import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReviewedPageCarousel from '../ReviewedPageCarousel'
import { useUiText } from '../../i18n/uiText'
import { useAuthStore } from '../../stores/auth'
import { pageService, publicPagesQueryKey } from '../../services/pageService'
import type { PageSummaryDto, SectionHeader as SectionHeaderModel } from '../../types'
import { localizeText } from '../../utils/localizedText'
import {
  publicPagesForPrimaryMenu,
  publicPrimaryMenuOptions,
} from '../../utils/publicPageMenus'
import {
  PropertyPanel,
  SelectInput,
  patchLocalizedSectionHeader,
  patchContent,
  readText,
} from './sectionUtils'
import type { SectionComponentProps } from './types'
import { sectionSpacingClass } from './sectionPresets'

const readHeader = (value: unknown): SectionHeaderModel =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as SectionHeaderModel
    : {}

const ReviewedPageCarouselSection = ({
  section,
  mode,
  domId,
  disabled,
  editorPreview,
  previewDensity = 'full',
  propertiesOnly,
  showProperties = true,
  onUpdate,
}: SectionComponentProps) => {
  const auth = useAuthStore()
  const t = useUiText()
  const selectedPrimaryMenuId = readText(section.contentJson, 'primaryMenuId').trim()
  const editable = mode === 'edit' && !disabled && Boolean(onUpdate)
  const {
    data: publicPages = [],
    isLoading,
    isError,
  } = useQuery<PageSummaryDto[]>({
    queryKey: publicPagesQueryKey(),
    queryFn: () => pageService.getPublicPages(),
    enabled: mode === 'edit' || Boolean(selectedPrimaryMenuId),
  })
  const primaryMenuOptions = useMemo(
    () => publicPrimaryMenuOptions(publicPages, auth.language),
    [auth.language, publicPages],
  )
  const selectedMenu = primaryMenuOptions.find((option) => option.id === selectedPrimaryMenuId)
  const menuPages = useMemo(
    () => publicPagesForPrimaryMenu(publicPages, selectedPrimaryMenuId),
    [publicPages, selectedPrimaryMenuId],
  )
  const selectOptions = useMemo(() => {
    const placeholder = isLoading
      ? t('loadingPrimaryMenus')
      : isError
        ? t('primaryMenuLoadFailed')
        : t('selectPrimaryMenu')
    const options = [
      { value: '', label: placeholder },
      ...primaryMenuOptions.map((option) => ({ value: option.id, label: option.label })),
    ]

    if (selectedPrimaryMenuId && !options.some((option) => option.value === selectedPrimaryMenuId)) {
      options.push({ value: selectedPrimaryMenuId, label: t('selectedPrimaryMenuUnavailable') })
    }

    return options
  }, [isError, isLoading, primaryMenuOptions, selectedPrimaryMenuId, t])
  const header = readHeader(section.contentJson.header)
  const title = localizeText(header.title, auth.language) || t('reviewedPageCarouselDefaultTitle')
  const body = localizeText(header.subtitle, auth.language) || t('reviewedPageCarouselDefaultBody')
  const menuLabel = selectedMenu?.label || t('primaryMenu')
  const emptyState = isLoading
    ? t('loadingPrimaryMenus')
    : isError
      ? t('primaryMenuLoadFailed')
      : !selectedPrimaryMenuId
        ? t('selectPrimaryMenu')
        : !selectedMenu
          ? t('selectedPrimaryMenuUnavailable')
          : t('noReviewedMenuPages')
  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateHeader = (field: 'title' | 'subtitle', value: string) =>
    onUpdate?.(patchLocalizedSectionHeader(section, auth.language, field, value))
  const renderProperties = () => (
    <PropertyPanel>
      <SelectInput
        focusKey="reviewed-carousel-primary-menu"
        label={t('primaryMenu')}
        value={selectedPrimaryMenuId}
        required
        disabled={disabled || isLoading || isError}
        options={selectOptions}
        onChange={(value) => updateContent({ primaryMenuId: value })}
      />
      <p className="self-end text-xs leading-5 text-slate-500 md:col-span-2">
        {t('primaryMenuPublicPagesHelp')}
      </p>
    </PropertyPanel>
  )

  if (propertiesOnly) {
    return renderProperties()
  }

  const compact = previewDensity === 'compact' || editorPreview === true

  return (
    <>
      <ReviewedPageCarousel
        language={auth.language}
        pages={menuPages}
        sectionId={domId || 'reviewed-page-carousel'}
        eyebrow={menuLabel}
        title={title}
        body={body}
        action={t('viewDetails')}
        emptyState={emptyState}
        badge={menuLabel}
        compact={compact}
        ordered
        showAll
        shellClassName={`px-5 sm:px-8 lg:px-10 ${sectionSpacingClass(section)}`}
        interactionDisabled={mode === 'edit'}
        onTitleChange={editable ? (value) => updateHeader('title', value) : undefined}
        onBodyChange={editable ? (value) => updateHeader('subtitle', value) : undefined}
      />
      {mode === 'edit' && showProperties ? (
        <div className="mx-auto max-w-6xl px-5 pb-8 sm:px-8 lg:px-10">{renderProperties()}</div>
      ) : null}
    </>
  )
}

export default ReviewedPageCarouselSection
