import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { fileAssetService, resolveFileAssetAccessUrl, type FileAsset, type FileAssetPurpose, type FileAssetSortBy, type FileAssetVisibility, type PagedResult, type SortDirection } from '../../services/fileAssetService'
import type { AdminGroupOptionDto } from '../../services/groupService'
import { Empty, FilterActions, LabeledField, Loading, Panel, Pager, Pill, SelectInput } from './AdminUi'
import type { LabelFn } from './AdminUi'
import { compactId, formatBytes, formatDate, groupNameLabel } from './adminUtils'

const fileVisibilityOptions: Array<'' | FileAssetVisibility> = ['', 'public', 'groupVisible', 'memberPrivate']
const filePurposeOptions: Array<'' | FileAssetPurpose> = ['', 'general', 'pageMedia', 'eventPoster', 'eventGallery', 'enrollmentPaymentProof', 'reviewPhoto', 'groupCover', 'memberAvatar']
const fileRelatedEntityOptions = ['', 'event', 'enrollment', 'review', 'page', 'section', 'group', 'member']
const fileSortOptions: FileAssetSortBy[] = ['uploadedUtc', 'createdUtc', 'sizeBytes', 'originalFileName', 'purpose', 'visibility']

const fileVisibilityLabel = (visibility: FileAssetVisibility | '', language: string) => {
  if (!visibility) return language === 'zh' ? '全部可见范围' : 'All visibility'
  if (language === 'zh') {
    if (visibility === 'public') return '公开'
    if (visibility === 'groupVisible') return '小组可见'
    return '成员私有'
  }
  if (visibility === 'public') return 'Public'
  if (visibility === 'groupVisible') return 'Group-visible'
  return 'Member-private'
}

const filePurposeLabel = (purpose: FileAssetPurpose | '', language: string) => {
  if (!purpose) return language === 'zh' ? '全部用途' : 'All purposes'
  const labels: Record<FileAssetPurpose, { en: string; zh: string }> = {
    general: { en: 'General', zh: '通用' },
    pageMedia: { en: 'Page media', zh: '页面媒体' },
    eventPoster: { en: 'Event poster', zh: '活动海报' },
    eventGallery: { en: 'Event gallery', zh: '活动相册' },
    enrollmentPaymentProof: { en: 'Payment proof', zh: '付款凭证' },
    reviewPhoto: { en: 'Review photo', zh: '回顾照片' },
    groupCover: { en: 'Group cover', zh: '小组封面' },
    memberAvatar: { en: 'Member avatar', zh: '成员头像' },
    albumPhoto: { en: 'Album photo', zh: '相册图片' },
  }
  return labels[purpose][language === 'zh' ? 'zh' : 'en']
}

const fileSortLabel = (sortBy: FileAssetSortBy, language: string) => {
  const labels: Record<FileAssetSortBy, { en: string; zh: string }> = {
    uploadedUtc: { en: 'Uploaded time', zh: '上传时间' },
    createdUtc: { en: 'Registered time', zh: '登记时间' },
    sizeBytes: { en: 'File size', zh: '文件大小' },
    originalFileName: { en: 'File name', zh: '文件名' },
    purpose: { en: 'Purpose', zh: '用途' },
    visibility: { en: 'Visibility', zh: '可见范围' },
  }
  return labels[sortBy][language === 'zh' ? 'zh' : 'en']
}

const emptyFilePage = (): PagedResult<FileAsset> => ({
  items: [],
  page: 1,
  pageSize: 25,
  totalCount: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
})

export const PlatformFilesSection = ({ l, language, groups }: { l: LabelFn; language: string; groups: AdminGroupOptionDto[] }) => {
  const [page, setPage] = useState(emptyFilePage)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    groupId: '',
    unassignedOnly: false,
    visibility: '' as '' | FileAssetVisibility,
    purpose: '' as '' | FileAssetPurpose,
    relatedEntityType: '',
    pageSize: 25,
    sortBy: 'uploadedUtc' as FileAssetSortBy,
    sortDirection: 'desc' as SortDirection,
  })

  const copy = {
    allGroups: language === 'zh' ? '全部小组' : 'All groups',
    unassignedOnly: language === 'zh' ? '只看无归属文件' : 'Unassigned only',
    unassignedHelp: language === 'zh' ? '筛选 groupId 为空的文件。选择小组时会自动关闭。' : 'Shows files whose groupId is empty. Selecting a group turns this off.',
    allRelated: language === 'zh' ? '全部关联对象' : 'All related records',
    visibility: language === 'zh' ? '可见范围' : 'Visibility',
    purpose: language === 'zh' ? '用途' : 'Purpose',
    related: language === 'zh' ? '关联对象' : 'Related record',
    groupFilter: language === 'zh' ? '小组归属' : 'Group',
    sortBy: language === 'zh' ? '排序字段' : 'Sort by',
    direction: language === 'zh' ? '方向' : 'Direction',
    descending: language === 'zh' ? '降序' : 'Descending',
    ascending: language === 'zh' ? '升序' : 'Ascending',
    perPage: language === 'zh' ? '每页' : 'Per page',
    file: language === 'zh' ? '文件' : 'File',
    open: language === 'zh' ? '打开' : 'Open',
    group: language === 'zh' ? '小组' : 'Group',
    owner: language === 'zh' ? '上传者' : 'Owner',
    uploaded: language === 'zh' ? '上传时间' : 'Uploaded',
    size: language === 'zh' ? '大小' : 'Size',
    storage: language === 'zh' ? '存储路径' : 'Storage key',
    provider: language === 'zh' ? '存储服务' : 'Storage provider',
    noFiles: language === 'zh' ? '还没有登记的上传文件。' : 'No registered uploads yet.',
    failed: language === 'zh' ? '文件列表加载失败。' : 'Unable to load files.',
  }

  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])

  const fetchFiles = useCallback(async (nextPage: number, nextFilters = filters) => {
    setLoading(true)
    setError('')
    try {
      const result = await fileAssetService.list({
        groupId: nextFilters.unassignedOnly ? null : nextFilters.groupId || null,
        unassignedOnly: nextFilters.unassignedOnly,
        visibility: nextFilters.visibility || null,
        purpose: nextFilters.purpose || null,
        relatedEntityType: nextFilters.relatedEntityType || null,
        page: nextPage,
        pageSize: nextFilters.pageSize,
        sortBy: nextFilters.sortBy,
        sortDirection: nextFilters.sortDirection,
      })
      setPage(result)
    } catch {
      setError(copy.failed)
    } finally {
      setLoading(false)
    }
  }, [copy.failed, filters])

  const loadFiles = useCallback(async (nextPage = page.page) => {
    await fetchFiles(nextPage)
  }, [fetchFiles, page.page])

  useEffect(() => {
    loadFiles(1).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apply = async () => loadFiles(1)
  const reset = () => {
    const nextFilters = { groupId: '', unassignedOnly: false, visibility: '' as const, purpose: '' as const, relatedEntityType: '', pageSize: 25, sortBy: 'uploadedUtc' as const, sortDirection: 'desc' as const }
    setFilters(nextFilters)
    fetchFiles(1, nextFilters).catch(() => undefined)
  }

  return (
    <Panel title={l('files')} description={l('filesDescription')} count={page.totalCount}>
      <div className="border-b border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <LabeledField label={copy.groupFilter}>
            <SelectInput value={filters.groupId} disabled={filters.unassignedOnly} onChange={(event) => setFilters((x) => ({ ...x, groupId: event.target.value, unassignedOnly: false }))}>
              <option value="">{copy.allGroups}</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{groupNameLabel(group, language)}</option>)}
            </SelectInput>
          </LabeledField>
          <LabeledField label={copy.visibility}>
            <SelectInput value={filters.visibility} onChange={(event) => setFilters((x) => ({ ...x, visibility: event.target.value as '' | FileAssetVisibility }))}>
              {fileVisibilityOptions.map((option) => <option key={option || 'all'} value={option}>{fileVisibilityLabel(option, language)}</option>)}
            </SelectInput>
          </LabeledField>
          <LabeledField label={copy.purpose}>
            <SelectInput value={filters.purpose} onChange={(event) => setFilters((x) => ({ ...x, purpose: event.target.value as '' | FileAssetPurpose }))}>
              {filePurposeOptions.map((option) => <option key={option || 'all'} value={option}>{filePurposeLabel(option, language)}</option>)}
            </SelectInput>
          </LabeledField>
          <LabeledField label={copy.related}>
            <SelectInput value={filters.relatedEntityType} onChange={(event) => setFilters((x) => ({ ...x, relatedEntityType: event.target.value }))}>
              {fileRelatedEntityOptions.map((option) => <option key={option || 'all'} value={option}>{option || copy.allRelated}</option>)}
            </SelectInput>
          </LabeledField>
          <LabeledField label={copy.sortBy}>
            <SelectInput value={filters.sortBy} onChange={(event) => setFilters((x) => ({ ...x, sortBy: event.target.value as FileAssetSortBy }))}>
              {fileSortOptions.map((option) => <option key={option} value={option}>{fileSortLabel(option, language)}</option>)}
            </SelectInput>
          </LabeledField>
          <LabeledField label={copy.direction}>
            <SelectInput value={filters.sortDirection} onChange={(event) => setFilters((x) => ({ ...x, sortDirection: event.target.value as SortDirection }))}>
              <option value="desc">{copy.descending}</option>
              <option value="asc">{copy.ascending}</option>
            </SelectInput>
          </LabeledField>
          <LabeledField label={copy.perPage}>
            <SelectInput value={filters.pageSize} onChange={(event) => setFilters((x) => ({ ...x, pageSize: Number(event.target.value) }))}>
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </SelectInput>
          </LabeledField>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
              checked={filters.unassignedOnly}
              onChange={(event) => setFilters((x) => ({ ...x, unassignedOnly: event.target.checked, groupId: event.target.checked ? '' : x.groupId }))}
            />
            <span>
              <span className="block text-sm font-bold text-slate-800">{copy.unassignedOnly}</span>
              <span className="block text-xs leading-5 text-slate-500">{copy.unassignedHelp}</span>
            </span>
          </label>
        </div>
        <div className="mt-3">
          <FilterActions l={l} apply={apply} reset={reset} />
        </div>
      </div>

      {loading ? <Loading text={l('loading')} /> : null}
      {!loading && error ? <Empty text={error} /> : null}
      {!loading && !error && page.items.length === 0 ? <Empty text={copy.noFiles} /> : null}

      {!loading && !error && page.items.length > 0 ? (
        <div className="grid gap-3 p-4">
          {page.items.map((file) => {
            const openUrl = resolveFileAssetAccessUrl(file.accessUrl || file.publicUrl)
            const group = file.groupId ? groupById.get(file.groupId) : null
            return (
              <article key={file.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={file.visibility === 'memberPrivate' ? 'slate' : file.visibility === 'public' ? 'green' : 'sky'}>{fileVisibilityLabel(file.visibility, language)}</Pill>
                      <Pill tone="slate">{filePurposeLabel(file.purpose, language)}</Pill>
                      {file.relatedEntityType ? <Pill tone="slate">{file.relatedEntityType}</Pill> : null}
                    </div>
                    <h3 className="mt-3 break-words text-base font-black text-slate-950">{file.originalFileName || file.storedFileName || copy.file}</h3>
                    <p className="mt-1 break-all text-xs text-slate-500">{file.contentType} / {copy.provider}: {file.storageProvider}/{file.bucketName}</p>
                  </div>
                  {openUrl ? (
                    <a href={openUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      {copy.open}
                    </a>
                  ) : null}
                </div>
                <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <div><dt className="font-bold text-slate-700">{copy.group}</dt><dd className="mt-1 break-words text-slate-600">{group ? groupNameLabel(group, language) : compactId(file.groupId) || '-'}</dd></div>
                  <div><dt className="font-bold text-slate-700">{copy.owner}</dt><dd className="mt-1 break-words text-slate-600">{compactId(file.ownerMemberId)}</dd></div>
                  <div><dt className="font-bold text-slate-700">{copy.uploaded}</dt><dd className="mt-1 text-slate-600">{formatDate(file.uploadedUtc)}</dd></div>
                  <div><dt className="font-bold text-slate-700">{copy.size}</dt><dd className="mt-1 text-slate-600">{formatBytes(file.sizeBytes)}</dd></div>
                </dl>
                <p className="mt-4 break-all rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                  <span className="font-bold text-slate-700">{copy.storage}: </span>{file.objectKey}
                </p>
              </article>
            )
          })}
        </div>
      ) : null}
      {page.totalCount > 0 ? <Pager l={l} page={page} goToPage={loadFiles} /> : null}
    </Panel>
  )
}
